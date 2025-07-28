#backend_logic/backendConnection/replay_app.py
import faust
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from mode import Service
from configs.config import settings
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from configs.logging_config import faust_logger
from backend_logic.pydantic_responses_in import replay_pydantic
import websockets
import asyncio
import json


# The function safely converts a timestamp (which could be a string, a datetime object, or something else) into a Python datetime object. If parsing fails, it returns the current UTC time.
def parse_timestamp(timestamp):
    """
    Safely parse timestamp to datetime object
    """
    # Check if Already a datetime Object
    if isinstance(timestamp, datetime):
        return timestamp
    try:
        return datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp
    except (TypeError, ValueError):
        return datetime.utcnow()

# def parse_timestamp(timestamp):
#     """
#     Safely parse timestamp to datetime object.
#     """
#     if isinstance(timestamp, datetime):
#         return timestamp
#     if isinstance(timestamp, str):
#         try:
#             return datetime.fromisoformat(timestamp)
#         except ValueError:
#             return datetime.utcnow()
#     # Handle other types explicitly
#     return datetime.utcnow()


class WebSocketService(Service):
    def __init__(self, app, port: int, name: str):
        self.app = app
        self.port = port
        self.name = name
        self.host = settings.WS_HOST
        self.connections = set()
        self.server = None
        super().__init__()
        faust_logger.info(f"Initialized {name} WebSocket service on port {port}")

    async def on_started(self) -> None:
        """Start WebSocket server when service starts"""
        try:
            self.server = await websockets.serve(
                self.handle_connection,
                self.host,
                self.port
            )
            faust_logger.info(f"Started {self.name} WebSocket server on {self.host}:{self.port}")
        except Exception as e:
            faust_logger.error(f"Failed to start {self.name} WebSocket server: {str(e)}")
            raise

    async def on_stop(self) -> None:
        """Cleanup when service stops"""
        try:
            if hasattr(self, 'server'):
                self.server.close()
                await self.server.wait_closed()
            
            # Close all active connections
            close_tasks = [ws.close() for ws in self.connections]
            if close_tasks:
                await asyncio.gather(*close_tasks, return_exceptions=True)
            
            self.connections.clear()
            faust_logger.info(f"Stopped {self.name} WebSocket server")
        except Exception as e:
            faust_logger.error(f"Error stopping {self.name} WebSocket server: {str(e)}")

    async def handle_connection(self, websocket, path):
        """Handle new WebSocket connections with explicit path handling"""
        try:
            # Check if the path is '/ws' or matches expected path
            if path != '/ws':
                faust_logger.warning(f"Unexpected connection path: {path}")
                await websocket.close(code=1003, reason="Invalid path")
                return

            self.connections.add(websocket)
            faust_logger.info(f"New connection to {self.name} WebSocket from {websocket.remote_address}")
            
            try:
                # Send initial connection confirmation
                await websocket.send(json.dumps({
                    "type": "connection",
                    "status": "connected",
                    "service": self.name
                }))
                
                # Keep the connection open and handle incoming messages if needed
                async for message in websocket:
                    faust_logger.debug(f"Received message on {self.name} WebSocket: {message}")
                    # Optional: Add message handling logic here
            
            except websockets.exceptions.ConnectionClosed:
                faust_logger.info(f"Connection closed for {self.name} WebSocket")
            finally:
                self.connections.remove(websocket)
    
        except Exception as e:
            faust_logger.error(f"Error in {self.name} WebSocket connection handler: {str(e)}")

    async def broadcast(self, message: dict):
        """
        Broadcast message to all connected clients with enhanced error handling
        
        Args:
            message (dict): Message to broadcast
        """
        if not self.connections:
            faust_logger.debug(f"No active connections for {self.name} WebSocket")
            return
            
        disconnected = set()
        try:
            # Ensure message is JSON serializable
            message_str = json.dumps(message)
            
            broadcast_tasks = []
            for websocket in self.connections:
                try:
                    # Create a task for each send to handle concurrency
                    task = asyncio.create_task(websocket.send(message_str))
                    broadcast_tasks.append(task)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(websocket)
                except Exception as e:
                    faust_logger.error(f"Error preparing broadcast to {self.name} WebSocket: {str(e)}")
                    disconnected.add(websocket)
            
            # Wait for all broadcast tasks to complete
            if broadcast_tasks:
                await asyncio.gather(*broadcast_tasks, return_exceptions=True)
            
            # Remove disconnected clients
            self.connections.difference_update(disconnected)
            
            faust_logger.debug(f"Broadcasted message to {len(self.connections)} {self.name} WebSocket connections")
        
        except Exception as e:
            faust_logger.error(f"Unexpected error in {self.name} WebSocket broadcast: {str(e)}")

class ReplayController:
    def __init__(self, session_id: str, app):
        self.session_id = session_id
        self.app = app
        
        # Core replay control parameters
        self.speed = 1.0
        self.is_paused = False
        self.is_running = False
        
        # Window and buffer management
        self.window_size = timedelta(minutes=5)  # Default 5-minute window
        self.prefetch_threshold = 0.8  # Load next window when 80% through current
        self.buffer = {
            'start_ts': None,
            'end_ts': None,
            'events': []
        }
        
        # Timestamp and cursor tracking
        self.current_timestamp = None
        self.start_timestamp = None
        self.end_timestamp = None
        self.current_index = 0
        
        # Channel-specific timestamps for last broadcast
        self.last_broadcast_timestamps = {
            "ws_raw": None,
            "ws_killfeed": None,
            "ws_stats": None
        }
        
        # Database connection
        self.db = AsyncIOMotorClient(settings.MONGODB_URI)[settings.DB_in]
        
        # Replay task management
        self._replay_task = None

    async def initialize(self) -> bool:
        """Initialize replay session with comprehensive validation."""
        try:
            # Fetch session data
            self.session = await self.db["sessions"].find_one({"session_id": self.session_id})
            if not self.session:
                raise ValueError(f"Session {self.session_id} not found")
            
            # Validate session data structure
            self._validate_session_data()

            # Compute earliest & latest timestamps
            self.start_timestamp = await self._get_first_timestamp()
            self.end_timestamp = await self._get_last_timestamp()
            self.current_timestamp = self.start_timestamp

            # Initialize broadcast timestamps
            for k in self.last_broadcast_timestamps:
                self.last_broadcast_timestamps[k] = self.start_timestamp

            # Initialize first window of events
            await self._load_window(self.start_timestamp)
            
            self.is_running = True
            self.is_paused = False
            
            faust_logger.info(
                f"Initialized replay for session {self.session_id} "
                f"with window size {self.window_size}"
            )
            return True

        except Exception as e:
            faust_logger.error(f"Initialization failed: {str(e)}")
            raise

    async def _load_window(self, start_time: datetime):
        """Load events for a time window starting at start_time."""
        end_time = min(start_time + self.window_size, self.end_timestamp)
        
        # Get events for the window
        soldier_events, session_events = await self._get_events(start_time, end_time)
        
        # Update buffer with new window
        self.buffer['start_ts'] = start_time
        self.buffer['end_ts'] = end_time
        self.buffer['events'] = []
        
        # Flatten and sort events
        for soldier in soldier_events:
            self.buffer['events'].extend(soldier['movement_data'])
        self.buffer['events'].extend(session_events['kill_feed'])
        self.buffer['events'].extend(session_events['stats'])
        
        # Sort events by timestamp
        self.buffer['events'].sort(key=lambda x: parse_timestamp(x['timestamp']))
        
        faust_logger.info(
            f"Loaded window from {start_time} to {end_time} "
            f"with {len(self.buffer['events'])} events"
        )

    # This is when user wants to rewind or skip out of the buffer window
    async def _ensure_window_contains_timestamp(self, target_timestamp: datetime):
        """Ensure the buffer window contains the target timestamp."""
        if (self.buffer['start_ts'] is None or 
            target_timestamp < self.buffer['start_ts'] or 
            target_timestamp >= self.buffer['end_ts']):
            # Need to load new window
            window_start = target_timestamp
            if target_timestamp > self.start_timestamp:
                # Start window a bit earlier for context
                window_start = max(
                    self.start_timestamp,
                    target_timestamp - timedelta(seconds=30)
                )
            await self._load_window(window_start)

    def _find_event_index(self, target_timestamp: datetime) -> int:
        """Find index of first event with timestamp >= target_timestamp using binary search."""
        if not self.buffer['events']:
            return 0
            
        left, right = 0, len(self.buffer['events'])
        
        # Handle edge cases
        first_ts = parse_timestamp(self.buffer['events'][0]['timestamp'])
        last_ts = parse_timestamp(self.buffer['events'][-1]['timestamp'])
        
        if target_timestamp <= first_ts:
            return 0
        if target_timestamp > last_ts:
            return len(self.buffer['events']) - 1
            
        # Binary search
        while left < right:
            mid = (left + right) // 2
            mid_timestamp = parse_timestamp(self.buffer['events'][mid]['timestamp'])
            
            if mid_timestamp < target_timestamp:
                left = mid + 1
            else:
                right = mid
                
        return min(left, len(self.buffer['events']) - 1)

    async def _replay_loop(self):
        """Core replay loop with window management."""
        try:
            while self.is_running:
                if self.is_paused:
                    await asyncio.sleep(0.5)
                    continue

                if self.current_index >= len(self.buffer['events']):
                    # Check if we need to load next window
                    if self.buffer['end_ts'] >= self.end_timestamp:
                        faust_logger.info(f"Replay completed for session {self.session_id}")
                        await self.stop()
                        break
                    else:
                        await self._load_window(self.buffer['end_ts'])
                        self.current_index = 0
                        continue

                # Process current event
                current_event = self.buffer['events'][self.current_index]
                event_timestamp = parse_timestamp(current_event['timestamp'])
                self.current_timestamp = event_timestamp

                # Broadcast based on type
                etype = current_event['type']
                if etype == 'soldier_movement':
                    if event_timestamp >= self.last_broadcast_timestamps['ws_raw']:
                        await self._broadcast_movement(current_event, event_timestamp)
                elif etype == 'kill_event':
                    if event_timestamp >= self.last_broadcast_timestamps['ws_killfeed']:
                        await self._broadcast_killfeed(current_event, event_timestamp)
                elif etype == 'soldier_stats':
                    if event_timestamp >= self.last_broadcast_timestamps['ws_stats']:
                        await self._broadcast_stats(current_event, event_timestamp)

                # Move to next event
                self.current_index += 1

                # Check if we should pre-fetch next window
                if (self.current_index / len(self.buffer['events']) > self.prefetch_threshold and
                    self.buffer['end_ts'] < self.end_timestamp):
                    # Load next window in background
                    asyncio.create_task(self._load_window(self.buffer['end_ts']))

                # Calculate delay until next event
                if self.current_index < len(self.buffer['events']):
                    next_event = self.buffer['events'][self.current_index]
                    next_ts = parse_timestamp(next_event['timestamp'])
                    delay = (next_ts - event_timestamp).total_seconds()
                    delay = max(delay, 0) / self.speed
                    await asyncio.sleep(delay)

        except asyncio.CancelledError:
            faust_logger.info(f"Replay loop cancelled for session {self.session_id}")
            await self.stop()
        except Exception as e:
            faust_logger.error(f"Replay loop error: {str(e)}")
            await self.stop()

    async def _broadcast_state_at_timestamp(self, target_timestamp: datetime):
        """Broadcast the complete state at the given timestamp."""
        # Find all latest states before or at target_timestamp
        latest_movements = {}  # soldier_id -> latest movement
        latest_stats = {}      # soldier_id -> latest stats
        
        for event in self.buffer['events']:
            event_ts = parse_timestamp(event['timestamp'])
            if event_ts > target_timestamp:
                break
                
            if event['type'] == 'soldier_movement':
                latest_movements[event['soldier_id']] = event
            elif event['type'] == 'soldier_stats':
                latest_stats[event['soldier_id']] = event
                
        # Broadcast latest state for each soldier
        for soldier_id in set(latest_movements.keys()) | set(latest_stats.keys()):
            # Broadcast movement if exists
            if soldier_id in latest_movements:
                await self._broadcast_movement(latest_movements[soldier_id], target_timestamp)
            
            # Broadcast stats if exists
            if soldier_id in latest_stats:
                await self._broadcast_stats(latest_stats[soldier_id], target_timestamp)
        
        faust_logger.debug(f"Broadcasted state at timestamp {target_timestamp}")

    async def skip_n_seconds(self, n_seconds: int):
        """Skip forward n seconds and broadcast state at new position."""
        if not self.current_timestamp:
            raise ValueError("Replay not initialized properly")
            
        new_timestamp = min(
            self.current_timestamp + timedelta(seconds=n_seconds),
            self.end_timestamp
        )
        
        # Ensure window contains target timestamp
        await self._ensure_window_contains_timestamp(new_timestamp)
        
        # Update current position and broadcast timestamps
        self.current_timestamp = new_timestamp
        self.current_index = self._find_event_index(new_timestamp)
        
        # Update broadcast timestamps
        for channel in self.last_broadcast_timestamps:
            self.last_broadcast_timestamps[channel] = new_timestamp
            
        # Immediately broadcast state at new position
        await self._broadcast_state_at_timestamp(new_timestamp)
        
        faust_logger.info(
            f"Skipped to {self.current_timestamp}, "
            f"new index: {self.current_index}/{len(self.buffer['events'])}"
        )

    async def go_back_n_seconds(self, n_seconds: int):
        """Go back n seconds and broadcast state at new position."""
        if not self.current_timestamp:
            raise ValueError("Replay not initialized properly")
            
        new_timestamp = max(
            self.current_timestamp - timedelta(seconds=n_seconds),
            self.start_timestamp
        )
        
        # Ensure window contains target timestamp
        await self._ensure_window_contains_timestamp(new_timestamp)
        
        # Update current position and broadcast timestamps
        self.current_timestamp = new_timestamp
        self.current_index = self._find_event_index(new_timestamp)
        
        # Update broadcast timestamps
        for channel in self.last_broadcast_timestamps:
            self.last_broadcast_timestamps[channel] = new_timestamp
            
        # Immediately broadcast state at new position
        await self._broadcast_state_at_timestamp(new_timestamp)
        
        faust_logger.info(
            f"Went back to {self.current_timestamp}, "
            f"new index: {self.current_index}/{len(self.buffer['events'])}"
        )

    def _validate_session_data(self):
        """Validate session data integrity."""
        required_keys = ['participated_soldiers', 'events']
        for key in required_keys:
            if key not in self.session:
                raise ValueError(f"Missing required session key: {key}")
        
        if not self.session['participated_soldiers']:
            raise ValueError("No soldiers participated in the session")
        
        # Validate timestamp formats in soldier locations
        for soldier in self.session.get('participated_soldiers', []):
            for loc in soldier.get('location', []):
                try:
                    parse_timestamp(loc.get('timestamp'))
                except Exception as e:
                    raise ValueError(f"Invalid timestamp in soldier location: {e}")

    async def _get_first_timestamp(self) -> datetime:
        """Get earliest timestamp from session data."""
        timestamps = []
        
        for soldier in self.session.get('participated_soldiers', []):
            timestamps.extend(
                parse_timestamp(loc['timestamp']) 
                for loc in soldier.get('location', [])
            )
            timestamps.extend(
                parse_timestamp(stat['timestamp']) 
                for stat in soldier.get('stats', [])
            )
        
        timestamps.extend(
            parse_timestamp(event['timestamp']) 
            for event in self.session.get('events', [])
        )
        
        return min(timestamps) if timestamps else datetime.utcnow()

    async def _get_last_timestamp(self) -> datetime:
        """Get the latest timestamp from session data."""
        timestamps = []
        
        for soldier in self.session.get('participated_soldiers', []):
            timestamps.extend(
                parse_timestamp(loc['timestamp']) 
                for loc in soldier.get('location', [])
            )
            timestamps.extend(
                parse_timestamp(stat['timestamp']) 
                for stat in soldier.get('stats', [])
            )
        
        timestamps.extend(
            parse_timestamp(event['timestamp']) 
            for event in self.session.get('events', [])
        )
        
        return max(timestamps) if timestamps else datetime.utcnow()

    async def _get_events(self, start_time: datetime, end_time: datetime):
        """
        Retrieve and process events for a specific time window.
        Return (soldier_events, session_events).
        """
        soldier_events = []
        kill_feed = []
        stats = []

        try:
            participated_soldiers = self.session.get("participated_soldiers", [])
            session_data_events = self.session.get("events", [])

            # Process soldier movement events
            for soldier in participated_soldiers:
                soldier_movement_data = []
                locations = soldier.get('location', [])
                orientations = soldier.get('orientation', [])

                for loc, orient in zip(locations, orientations):
                    loc_ts = parse_timestamp(loc["timestamp"])
                    if not (start_time <= loc_ts <= end_time):
                        continue

                    movement_event = {
                        "type": "soldier_movement",
                        "soldier_id": soldier.get("soldier_id", ""),
                        "team": soldier.get("team", ""),
                        "call_sign": soldier.get("call_sign", ""),
                        "timestamp": loc_ts.isoformat(),
                        "position": {
                            "latitude": loc.get("latitude"),
                            "longitude": loc.get("longitude")
                        },
                        "orientation": {
                            "roll": orient.get("roll"),
                            "pitch": orient.get("pitch"),
                            "yaw": orient.get("yaw")
                        }
                    }
                    soldier_movement_data.append(movement_event)

                if soldier_movement_data:
                    soldier_events.append({
                        "soldier_id": soldier.get("soldier_id", ""),
                        "team": soldier.get("team", ""),
                        "call_sign": soldier.get("call_sign", ""),
                        "movement_data": sorted(soldier_movement_data, key=lambda x: x["timestamp"])
                    })

            # Process kill feed events
            for ev in session_data_events:
                ev_ts = parse_timestamp(ev.get("timestamp"))
                if not (start_time <= ev_ts <= end_time):
                    continue

                kill_event = {
                    "type": "kill_event",
                    "timestamp": ev_ts.isoformat(),
                    "attacker_id": ev.get("attacker_id"),
                    "attacker_call_sign": ev.get("attacker_call_sign"),
                    "victim_id": ev.get("victim_id"),
                    "victim_call_sign": ev.get("victim_call_sign"),
                    "distance_to_victim": ev.get("distance_to_victim"),
                }
                kill_feed.append(kill_event)

            # Process soldier stats events
            for soldier in participated_soldiers:
                for st in soldier.get("stats", []):
                    st_ts = parse_timestamp(st.get("timestamp"))
                    if not (start_time <= st_ts <= end_time):
                        continue

                    soldier_stat_event = {
                        "type": "soldier_stats",
                        "soldier_id": soldier.get("soldier_id", ""),
                        "team": soldier.get("team", ""),
                        "call_sign": soldier.get("call_sign", ""),
                        "timestamp": st_ts.isoformat(),
                        "health": st.get("health"),
                        "kills": st.get("kill_count"),
                        "bullets_fired": st.get("bullets_fired")
                    }
                    stats.append(soldier_stat_event)

            # Sort all events
            kill_feed.sort(key=lambda x: x["timestamp"])
            stats.sort(key=lambda x: x["timestamp"])
            soldier_events.sort(key=lambda x: x["movement_data"][0]["timestamp"] if x["movement_data"] else "")

            return soldier_events, {
                "kill_feed": kill_feed,
                "stats": stats
            }

        except Exception as e:
            faust_logger.error(f"Error in _get_events: {str(e)}", exc_info=True)
            return [], {"kill_feed": [], "stats": []}

    async def _broadcast_movement(self, event, event_timestamp):
        """Handle soldier_movement broadcast logic."""
        broadcast_msg = {
            "type": "soldier_movement",
            "soldier_id": event["soldier_id"],
            "team": event["team"],
            "call_sign": event["call_sign"],
            "position": event["position"],
            "orientation": event["orientation"],
            "db_timestamp": event["timestamp"]
        }

        faust_logger.debug(
            f"[REPLAY] Broadcasting soldier_movement for soldier {event['soldier_id']} "
            f"(DB timestamp: {event['timestamp']}, replay-time parsed: {event_timestamp.isoformat()})"
        )

        await self.app.ws_raw.broadcast(broadcast_msg)
        self.last_broadcast_timestamps['ws_raw'] = event_timestamp

    async def _broadcast_killfeed(self, event, event_timestamp):
        """Handle kill_feed broadcast logic."""
        kill_feed_msg = {
            "type": "kill_feed",
            "attacker_id": event.get("attacker_id"),
            "attacker_call_sign": event.get("attacker_call_sign"),
            "victim_id": event.get("victim_id"),
            "victim_call_sign": event.get("victim_call_sign"),
            "distance_to_victim": event.get("distance_to_victim"),
            "db_timestamp": event["timestamp"]
        }

        faust_logger.debug(
            f"[REPLAY] Broadcasting kill_feed event (DB timestamp: {event['timestamp']}, "
            f"replay-time parsed: {event_timestamp.isoformat()})"
        )

        await self.app.ws_killfeed.broadcast(kill_feed_msg)
        self.last_broadcast_timestamps['ws_killfeed'] = event_timestamp

    async def _broadcast_stats(self, event, event_timestamp):
        """Handle soldier_stats broadcast logic."""
        stats_msg = {
            "type": "stats",
            "soldier_id": event["soldier_id"],
            "team": event["team"],
            "call_sign": event["call_sign"],
            "health": event.get("health"),
            "kills": event.get("kills"),
            "bullets_fired": event.get("bullets_fired"),
            "db_timestamp": event["timestamp"]
        }

        faust_logger.debug(
            f"[REPLAY] Broadcasting soldier_stats for soldier {event['soldier_id']} "
            f"(DB timestamp: {event['timestamp']}, replay-time parsed: {event_timestamp.isoformat()})"
        )

        await self.app.ws_stats.broadcast(stats_msg)
        self.last_broadcast_timestamps['ws_stats'] = event_timestamp

    async def start(self):
        """Start the replay task."""
        if self._replay_task is not None:
            return
        self._replay_task = asyncio.create_task(self._replay_loop())
        faust_logger.info(f"Started replay task for session {self.session_id}")
        
    async def stop(self):
        """Stop the replay task."""
        self.is_running = False
        if self._replay_task:
            self._replay_task.cancel()
            try:
                await self._replay_task
            except asyncio.CancelledError:
                pass
            self._replay_task = None
        faust_logger.info(f"Stopped replay for session {self.session_id}")

class ReplayApp(faust.App):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Initialize WebSocket services
        self.ws_raw = WebSocketService(self, 8765, "raw")
        self.ws_killfeed = WebSocketService(self, 8766, "killfeed")
        self.ws_stats = WebSocketService(self, 8767, "stats")
        
        self.controller = None
        self.api = APIRouter()
        self._setup_routes()
        
        faust_logger.info("ReplayApp initialized")

    async def start_websocket_services(self):
        """Start all WebSocket services"""
        try:
            # Start each WebSocket service
            await self.ws_raw.start()
            await self.ws_killfeed.start()
            await self.ws_stats.start()
            faust_logger.info("All WebSocket services started successfully")
        except Exception as e:
            faust_logger.error(f"Failed to start WebSocket services: {str(e)}")
            raise

    async def stop_websocket_services(self):
        """Stop all WebSocket services"""
        try:
            # Stop each WebSocket service
            await self.ws_raw.stop()
            await self.ws_killfeed.stop()
            await self.ws_stats.stop()
            faust_logger.info("All WebSocket services stopped successfully")
        except Exception as e:
            faust_logger.error(f"Failed to stop WebSocket services: {str(e)}")
            raise

    def _setup_routes(self):
        @self.api.post("/select_session/{session_id}")
        async def select_session(session_id: str):
            try:
                # Stop existing replay if any
                if self.controller:
                    await self.controller.stop()
                
                # Initialize new replay controller
                self.controller = ReplayController(session_id, self)
                await self.controller.initialize()
                await self.controller.start()
                
                return {
                    "status": "success",
                    "message": "Replay started",
                    "session_id": session_id
                }
            except ValueError as e:
                raise HTTPException(status_code=404, detail=str(e))
            except Exception as e:
                faust_logger.error(f"Error starting replay: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.api.post("/control/{session_id}")
        async def control_replay(session_id: str, control_request: replay_pydantic.ReplayControlRequest):
            """
            Control replay for a given session using body data.
            
            Args:
                session_id: The session ID to control.
                control_request: Request body containing the command, speed, or n_seconds.

            Returns:
                A success message if the command is executed successfully.
            """
            if not self.controller or self.controller.session_id != session_id:
                raise HTTPException(
                    status_code=400,
                    detail="No active replay session for this ID"
                )

            try:
                command = control_request.command
                n_seconds = control_request.n_seconds
                speed = control_request.speed

                if command == "pause":
                    self.controller.is_paused = True
                elif command == "resume":
                    self.controller.is_paused = False
                elif command == "stop":
                    await self.controller.stop()
                    self.controller = None
                elif command == "speed":
                    if speed is None:
                        raise HTTPException(
                            status_code=400,
                            detail="Speed parameter is required for 'speed' command"
                        )
                    self.controller.speed = max(0.1, min(5.0, speed))
                elif command == "skip":
                    if n_seconds is None or n_seconds <= 0:
                        raise HTTPException(
                            status_code=400,
                            detail="'n_seconds' must be provided and greater than 0 for 'skip' command"
                        )
                    await self.controller.skip_n_seconds(n_seconds)
                elif command == "go_back":
                    if n_seconds is None or n_seconds <= 0:
                        raise HTTPException(
                            status_code=400,
                            detail="'n_seconds' must be provided and greater than 0 for 'go_back' command"
                        )
                    await self.controller.go_back_n_seconds(n_seconds)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid command. Must be 'pause', 'resume', 'stop', 'speed', 'skip', or 'go_back'."
                    )

                return {"status": "success", "command": command}

            except Exception as e:
                faust_logger.error(f"Error controlling replay: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))

def create_replay_app() -> ReplayApp:
    """Create and configure the replay Faust application"""
    app = ReplayApp(
        'replay-app',
        broker=settings.KAFKA_BROKER,
        store='memory://',
    )
    faust_logger.info("Created new replay application")
    return app

# Create the application instance
app = create_replay_app()