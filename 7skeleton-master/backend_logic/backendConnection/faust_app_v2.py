# backend_logic/backendConnection/faust_app_v1.py

import faust
import json
import asyncio
from mode import Service
from websockets.server import WebSocketServerProtocol
from websockets.exceptions import ConnectionClosed
from db.schemas.incoming_soldier import Soldier
from db.data_transformer import transform_soldier_data
from db.mongodb_handler import (
    store_to_mongo,
    get_soldier_data_from_db,
    get_soldier_data_from_latest_session,
    update_soldier_damage,
    get_db_in,
)
from configs.config import settings
from configs.logging_config import faust_logger as logger
from datetime import datetime
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
import utils

# FastAPI app and MongoDB client initialization
fastapi_app = FastAPI()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db_in = client[settings.DB_in]

# WebSocket service for raw soldier data (port 8001)
class RawDataWebSocketService(Service):
    def __init__(self, app, bind: str = settings.WS_HOST, port: int = settings.WS_PORT, **kwargs):
        # Store app, bind address, port, and active connections
        self.app = app
        self.bind = bind
        self.port = port
        self.connections = []
        super().__init__(**kwargs)

    async def on_messages(self, websocket, path):
        # Add new websocket connection and listen for messages
        self.connections.append(websocket)
        try:
            async for message in websocket:
                await self.on_message(websocket, message)
        except ConnectionClosed:
            self.connections.remove(websocket)

    async def on_message(self, websocket, message):
        # Echo received message back to client
        await websocket.send(f"Received: {message}")

    @Service.task
    async def _background_server(self):
        # Start the WebSocket server
        import websockets
        await websockets.serve(self.on_messages, self.bind, self.port)

# WebSocket service for kill feed data (port 8002)
class KillFeedWebSocketService(Service):
    def __init__(self, app, bind: str = settings.WS_HOST, port: int = settings.KILL_FEED_WS_PORT, **kwargs):
        # Store app, bind address, port, and active connections
        self.app = app
        self.bind = bind
        self.port = port
        self.connections = []
        super().__init__(**kwargs)

    async def on_messages(self, websocket, path):
        # Add new websocket connection and listen for messages
        self.connections.append(websocket)
        try:
            async for message in websocket:
                await self.on_message(websocket, message)
        except ConnectionClosed:
            self.connections.remove(websocket)

    async def on_message(self, websocket, message):
        # Echo received message back to client
        await websocket.send(f"Received: {message}")

    @Service.task
    async def _background_server(self):
        # Start the WebSocket server
        import websockets
        await websockets.serve(self.on_messages, self.bind, self.port)

# WebSocket service for team stats data (port 8003)
class TeamStatsWebSocketService(Service):
    def __init__(self, app, bind: str = settings.WS_HOST, port: int = 8003, **kwargs):
        # Store app, bind address, port, and active connections
        self.app = app
        self.bind = bind
        self.port = port
        self.connections = []
        super().__init__(**kwargs)

    async def on_messages(self, websocket, path):
        # Add new websocket connection and listen for messages
        self.connections.append(websocket)
        try:
            async for message in websocket:
                await self.on_message(websocket, message)
        except ConnectionClosed:
            self.connections.remove(websocket)

    async def on_message(self, websocket, message):
        # Echo received message back to client
        await websocket.send(f"Received: {message}")

    @Service.task
    async def _background_server(self):
        # Start the WebSocket server
        import websockets
        await websockets.serve(self.on_messages, self.bind, self.port)


# Custom Faust App with WebSocket services and bullet counts
class App(faust.App):
    # Its overrides the default FastApi app to include WebSocket services
    def on_init(self):
        # Initialize WebSocket services and bullet counts
        self.ws_service_raw = RawDataWebSocketService(self, bind=settings.WS_HOST, port=8001)
        self.ws_service_kill_feed = KillFeedWebSocketService(self, bind=settings.WS_HOST, port=8002)
        self.ws_service_team_stats = TeamStatsWebSocketService(self, bind=settings.WS_HOST, port=8003)
        self.bullet_counts = {"team_red": 0, "team_blue": 0}  # Persistent bullet counts
        self.should_stop_realtime = False

    # It overrides the default on_start method to add WebSocket services as runtime dependencies
    async def on_start(self):
        # Add WebSocket services as runtime dependencies
        await self.add_runtime_dependency(self.ws_service_raw)
        await self.add_runtime_dependency(self.ws_service_kill_feed)
        await self.add_runtime_dependency(self.ws_service_team_stats)



# Define the Faust app (overrides FastAPI app above)
app = App(
    'soldiers-data',
    broker=settings.KAFKA_BROKER,
    store='memory://',
    value_serializer='json',
)

# Kafka topic to process incoming soldier data
soldier_topic = app.topic(settings.KAFKA_TOPIC, value_type=Soldier, partitions=1)

# Calculate and broadcast team statistics to WebSocket clients and store in DB
async def calculate_and_broadcast_team_stats(session_id):
    logger.info(f"calculate_and_broadcast_team_stats called for session {session_id}")
    try:
        # Fetch the latest session by session_id
        latest_session = await db_in["sessions"].find_one({"_id": session_id})
        if not latest_session:
            logger.error("No session found for team stats calculation")
            return

        # Initialize team stats with current bullet counts
        team_stats = {
            "team_red": {"total_killed": 0, "bullets_fired": app.bullet_counts["team_red"]},
            "team_blue": {"total_killed": 0, "bullets_fired": app.bullet_counts["team_blue"]}
        }

        # Calculate kills for each team from soldier stats
        for soldier in latest_session["participated_soldiers"]:
            team = soldier.get("team", "").lower()
            if team not in ["red", "blue"]:
                continue

            soldier_stats = soldier.get("stats", [])
            if soldier_stats:
                latest_stat = soldier_stats[-1]
                team_stats[f"team_{team}"]["total_killed"] += latest_stat.get("kill_count", 0)

        current_time = datetime.utcnow()

        # Create team stats event object for DB
        team_stats_event = {
            "team_red": {
                "total_killed": team_stats["team_red"]["total_killed"],
                "bullets_fired": team_stats["team_red"]["bullets_fired"],
                "timestamp": current_time
            },
            "team_blue": {
                "total_killed": team_stats["team_blue"]["total_killed"],
                "bullets_fired": team_stats["team_blue"]["bullets_fired"],
                "timestamp": current_time
            }
        }

        # Store team stats in session history in DB
        update_result = await db_in["sessions"].update_one(
            {"_id": session_id},
            {
                "$push": {
                    "team_stats_history": team_stats_event
                }
            }
        )

        if update_result.modified_count != 1:
            logger.error("Failed to store team stats in session history")

        # Prepare WebSocket message (convert timestamp to ISO string)
        websocket_message = {
            "team_red": {
                "total_killed": team_stats["team_red"]["total_killed"],
                "bullets_fired": team_stats["team_red"]["bullets_fired"],
                "timestamp": current_time.isoformat()
            },
            "team_blue": {
                "total_killed": team_stats["team_blue"]["total_killed"],
                "bullets_fired": team_stats["team_blue"]["bullets_fired"],
                "timestamp": current_time.isoformat()
            }
        }

        # Broadcast team stats through WebSocket to all connected clients
        team_stats_message = json.dumps(websocket_message)
        for websocket in app.ws_service_team_stats.connections:
            await websocket.send(team_stats_message)

        logger.info(f"Team stats updated and broadcasted for session {session_id}")

    except Exception as e:
        logger.error(f"Error calculating team stats: {e}", exc_info=True)



# Faust agent to process incoming soldier data from Kafka
@app.agent(soldier_topic)
async def process_soldiers(soldier_data_stream):
    # Start periodic stats update in the background
    # asyncio.create_task(periodic_stats_update())  (Removed)
    
    async for soldier_data in soldier_data_stream:
        try:
            # Log received soldier data
            logger.info(f"Received soldier data in Faust: {soldier_data}")
            
            # Transform and timestamp the incoming soldier data
            transformed_data = transform_soldier_data(soldier_data)
            transformed_data['timestamp'] = datetime.utcnow().isoformat()
            
            # Get the latest session from DB
            latest_session = await db_in["sessions"].find_one(
                sort=[("start_time", -1)]
            )
            
            if not latest_session:
                logger.error("No active session found")
                continue  # Use continue if inside async for loop, return if inside a function

            
            soldier_info = next(
                (s for s in latest_session["participated_soldiers"] 
                 if s["soldier_id"] == str(transformed_data['soldier_id'])),
                None
            )
            
            
            # Update bullet counts for the soldier's team
            if soldier_info:
                team = soldier_info.get("team", "").lower()
                if team in ["red", "blue"]:
                    new_bullets = transformed_data.get("bullet_count", 0)
                    if new_bullets > 0:  # Only update if there are new bullets
                        app.bullet_counts[f"team_{team}"] += new_bullets
            
            # Store the transformed soldier data in MongoDB
            await store_to_mongo(transformed_data)
            
            # Prepare new location object for the soldier
            new_location = {
                "latitude": transformed_data['gps']['latitude'],
                "longitude": transformed_data['gps']['longitude'],
                "timestamp": transformed_data['timestamp']
            }

            # Prepare new orientation object for the soldier
            new_orientation = {
                "roll": soldier_data.imu_data.roll,
                "pitch": soldier_data.imu_data.pitch,
                "yaw": soldier_data.imu_data.yaw,
                "timestamp": transformed_data['timestamp']
            }
            
            # Store location and orientation in the session document
            await db_in["sessions"].update_one(
                {"_id": latest_session["_id"], "participated_soldiers.soldier_id": transformed_data['soldier_id']},
                {
                    "$push": {
                        "participated_soldiers.$.location": new_location,
                        "participated_soldiers.$.orientation": new_orientation
                    }
                }
            )

            # Broadcast raw soldier data to all connected WebSocket clients
            raw_message = json.dumps(transformed_data)
            for websocket in app.ws_service_raw.connections:
                await websocket.send(raw_message)

            # Process damage and kill feed logic if hit_status is 1 or 2
            if transformed_data['hit_status'] in [1, 2]:
                attacker_id = transformed_data['ammo']['attacker_id']
                attacker_id_clean = str(attacker_id).strip()
                victim_id = transformed_data['soldier_id']
                victim_id_clean = str(victim_id).strip()

                if not latest_session:
                    logger.error("No active session found")
                    continue

                # Fetch attacker and victim data from the latest session
                attacker_data = await get_soldier_data_from_latest_session(attacker_id_clean)
                victim_data = await get_soldier_data_from_latest_session(victim_id_clean)

                if not attacker_data or not victim_data:
                    logger.error(f"Soldier data not found for attacker: {attacker_id}, victim: {victim_id}")
                    continue

                is_soldier_killed = False
                
                # Handle hit_status == 1 (first hit: 50%, second hit: killed)
                if transformed_data['hit_status'] == 1:
                    victim_damage = victim_data.get('damage', {})
                    if '50' not in victim_damage:
                        await update_soldier_damage(victim_id, 50)
                        logger.info(f"Updated health for soldier {victim_id} to 50%")
                    else:
                        await update_soldier_damage(victim_id, 100)
                        logger.info(f"Soldier {victim_id} marked as killed (health set to 100%)")
                        is_soldier_killed = True

                # Handle hit_status == 2 (direct death)
                elif transformed_data['hit_status'] == 2:
                    await update_soldier_damage(victim_id, 100)
                    logger.info(f"Soldier {victim_id} marked as killed (hit_status 2)")
                    is_soldier_killed = True

                # If soldier is killed, process kill feed and update stats
                if is_soldier_killed:
                    calculated_distance = await utils.calculate_distance_between_soldiers(attacker_id, victim_id)
                    
                    # Create kill feed event object
                    kill_event = {
                        "attacker_id": str(attacker_data['soldier_id']),
                        "attacker_call_sign": attacker_data['call_sign'],
                        "victim_id": str(victim_data['soldier_id']),
                        "victim_call_sign": victim_data['call_sign'],
                        "distance_to_victim (in meters)": calculated_distance,
                        "timestamp": transformed_data['timestamp'],
                    }

                    # Store kill event in session document
                    update_result = await db_in["sessions"].update_one(
                    {"_id": latest_session["_id"]},
                    {"$push": {"events": kill_event}}
                )
                if update_result.modified_count != 1:
                    logger.error("Failed to store kill event in session")

                # Broadcast kill feed event
                kill_feed_message_json = json.dumps(kill_event)
                for websocket in app.ws_service_kill_feed.connections:
                    await websocket.send(kill_feed_message_json)

                # Update attacker's stats in the session document
                attacker_index = next(
                    (index for (index, soldier) in enumerate(latest_session["participated_soldiers"])
                    if soldier["soldier_id"] == str(attacker_id_clean)),
                    None
                )
                if attacker_index is not None:
                    current_stats = latest_session["participated_soldiers"][attacker_index].get("stats", [])
                    current_kills = current_stats[-1].get("kill_count", 0) if current_stats else 0

                    new_stat = {
                        "kill_count": current_kills + 1,
                        "bullets_fired": transformed_data.get("bullet_count", 0),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    update_result = await db_in["sessions"].update_one(
                        {"_id": latest_session["_id"]},
                        {"$push": {f"participated_soldiers.{attacker_index}.stats": new_stat}}
                    )
                    if update_result.modified_count != 1:
                        logger.error(f"Failed to update stats for attacker {attacker_id}")
                else:
                    logger.error(f"Attacker index not found for attacker_id {attacker_id}")

                # <--- THIS IS CRUCIAL: Always call this after a kill event!
                await calculate_and_broadcast_team_stats(latest_session["_id"])

            logger.info(f"Processed soldier data: {transformed_data}")

        except Exception as e:
            logger.error(f"Error processing soldier data: {e}", exc_info=True)



# What: This is an infinite loop that runs forever, but pauses for 5 seconds each time using await asyncio.sleep(5).
# Why: It’s a background task that periodically updates stats, without blocking the rest of our app.
# How: Because it’s async, it yields control back to the event loop during sleep, letting other tasks run.
# async def periodic_stats_update():
#     while not app.should_stop_realtime:
#         try:
#             await asyncio.sleep(5)  # Update every 5 seconds
            
#             # Fetch the latest session from DB
#             latest_session = await db_in["sessions"].find_one(
#                 sort=[("start_time", -1)]
#             )

#             if not latest_session:
#                 logger.error("No active session found for periodic update")
#                 continue

#             # For each soldier, push a new stats entry with current values
#             for soldier_index, soldier in enumerate(latest_session["participated_soldiers"]):
#                 try:
#                     # Get current stats and last stat entry
#                     # This uses a conditional expression: A if condition else B.
#                     current_stats = soldier.get("stats", [])
#                     last_stat = current_stats[-1] if current_stats else {"kill_count": 0, "bullets_fired": 0}
                    
#                     # Get team for bullet count (not used here, but could be extended)
#                     team = soldier.get("team", "").lower()
#                     team_key = f"team_{team}" if team in ["red", "blue"] else None
                    
#                     # Create new stat entry with current values and timestamp
#                     new_stat = {
#                         "kill_count": last_stat.get("kill_count", 0),
#                         "bullets_fired": last_stat.get("bullets_fired", 0),
#                         "timestamp": datetime.utcnow().isoformat()
#                     }

#                     # Push new stat entry to the soldier's stats array in DB
#                     update_result = await db_in["sessions"].update_one(
#                         {"_id": latest_session["_id"]},
#                         {
#                             "$push": {
#                                 f"participated_soldiers.{soldier_index}.stats": new_stat
#                             }
#                         }
#                     )

#                     if update_result.modified_count != 1:
#                         logger.error(f"Failed to update stats for soldier {soldier.get('soldier_id')}")

#                 except Exception as e:
#                     logger.error(f"Error updating stats for soldier {soldier.get('soldier_id')}: {e}", exc_info=True)

#             # After updating all stats, calculate and broadcast team stats
#             await calculate_and_broadcast_team_stats(latest_session["_id"])

#             # Log successful update
#             logger.info("Periodic stats update completed successfully")

#         except Exception as e:
#             logger.error(f"Error in periodic stats update: {e}", exc_info=True)
#             await asyncio.sleep(1)  # Short sleep on error before retrying



# Entry point for running the Faust app
if __name__ == "__main__":
    app.main()