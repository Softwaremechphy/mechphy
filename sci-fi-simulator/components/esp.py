import serial
import json
import asyncio
import websockets
import re
from datetime import datetime
import threading
import time

# Simple ObjectId replacement
def generate_object_id():
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=24))

class COM13DeviceConverter:
    def __init__(self):
        self.running = True
        self.serial_connections = {}  # Store multiple serial connections
        self.soldier_clients = set()
        self.kill_feed_clients = set()
        self.stats_clients = set()
        
        self.port_configs = [
            {'port': '/dev/ttyUSB0', 'baud': 9600}  # Updated to exact port; try 115200 if 9600 fails
        ]
        
        # Store latest soldier positions for distance calculation
        self.soldier_positions = {}
        
        # Track hit states to prevent duplicate notifications
        self.soldier_hit_states = {}  # soldier_id -> last_hit_status
        self.processed_hits = set()  # Track processed hit events to avoid duplicates
        self.last_packet_time = {}  # Track timing to ensure fresh data
        
        # Statistics tracking
        self.team_stats = {
            "team_red": {"total_killed": 0, "bullets_fired": 0},
            "team_blue": {"total_killed": 0, "bullets_fired": 0}
        }
        
        # Indian military call signs
        self.call_signs = {
            1: "tiger", 2: "falcon", 3: "eagle", 4: "panther", 5: "cobra",
            6: "lion", 7: "shark", 8: "hawk", 9: "leopard", 10: "wolf",
            11: "viper", 12: "phoenix", 13: "warrior", 14: "thunder", 15: "storm"
        }
        
        # Team assignments - alternating Red/Blue
        self.team_assignments = {
            1: "team_red", 2: "team_blue", 3: "team_red", 4: "team_blue", 5: "team_red",
            6: "team_blue", 7: "team_red", 8: "team_blue", 9: "team_red", 10: "team_blue",
            11: "team_red", 12: "team_blue", 13: "team_red", 14: "team_blue", 15: "team_red"
        }

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates in kilometers (optimized)"""
        import math
        
        # Quick distance calculation
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth radius in kilometers
        distance_km = 6371 * c
        return round(distance_km, 3)  # Return in kilometers with 3 decimal places

    def convert_gps_coordinates(self, raw_lat, raw_lng):
        """Convert GPS from various formats to DD.DDDDDD format"""
        try:
            # Handle different GPS formats
            if raw_lat == 0.0 or raw_lng == 0.0 or raw_lat == 99.99 or raw_lng == 99.99:
                # Invalid GPS, return default Gurugram coordinates
                return 28.4595, 77.0266
            
            # If already in decimal degrees (small numbers)
            if -180 <= raw_lat <= 180 and -180 <= raw_lng <= 180:
                return round(raw_lat, 6), round(raw_lng, 6)
            
            # Convert from DDMM.MMMM format
            lat_degrees = int(raw_lat / 100)
            lat_minutes = raw_lat - (lat_degrees * 100)
            decimal_lat = lat_degrees + (lat_minutes / 60)
            
            lng_degrees = int(raw_lng / 100)
            lng_minutes = raw_lng - (lng_degrees * 100)
            decimal_lng = lng_degrees + (lng_minutes / 60)
            
            return round(decimal_lat, 6), round(decimal_lng, 6)
            
        except Exception:
            # Return default coordinates if conversion fails
            return 28.4595, 77.0266

    def list_available_ports(self):
        """List all available COM ports"""
        import serial.tools.list_ports
        
        print("🔍 Scanning available COM ports...")
        ports = serial.tools.list_ports.comports()
        
        if not ports:
            print("❌ No COM ports found!")
            return []
        
        available_ports = []
        for port in ports:
            print(f"   📡 {port.device}: {port.description}")
            available_ports.append(port.device)
        
        return available_ports

    def connect_to_device(self, port, baud_rate):
        """Connect to device on specified port and baud rate with better error handling"""
        try:
            connection_key = f"{port}_{baud_rate}"
            
            # Close existing connection if any
            if connection_key in self.serial_connections:
                try:
                    self.serial_connections[connection_key].close()
                    time.sleep(1)  # Give more time for port to close
                except:
                    pass
                del self.serial_connections[connection_key]
            
            print(f"🔌 Connecting to {port} @ {baud_rate} baud...")
            
            # Check if port exists first
            available_ports = self.list_available_ports()
            if port not in available_ports:
                print(f"❌ Port {port} not found in system!")
                print(f"💡 Available ports: {available_ports}")
                return False
            
            serial_conn = serial.Serial(
                port=port,
                baudrate=baud_rate,
                bytesize=8,
                parity='N',
                stopbits=1,
                timeout=0.1,
                xonxoff=False,
                rtscts=False,
                dsrdtr=False
            )
            
            time.sleep(1)  # Give more time for connection to stabilize
            serial_conn.flushInput()
            serial_conn.flushOutput()
            
            # Test if device is sending data
            test_start = time.time()
            test_data = ""
            print(f"🧪 Testing {port} for data (5 seconds)...")
            
            while time.time() - test_start < 5:  # Test for 5 seconds
                if serial_conn.in_waiting > 0:
                    chunk = serial_conn.read(serial_conn.in_waiting).decode('utf-8', errors='ignore')
                    test_data += chunk
                    print(f"📥 Received: {chunk[:50]}...")
                    
                    if len(test_data) > 20:  # If we get decent amount of data
                        break
                time.sleep(0.1)
            
            if test_data and len(test_data) > 5:
                self.serial_connections[connection_key] = serial_conn
                print(f"✅ Successfully connected to {port} @ {baud_rate} baud!")
                print(f"📊 Sample data ({len(test_data)} bytes): {test_data[:100]}...")
                return True
            else:
                print(f"⚠️ Connected to {port} but no data received")
                print("💡 Device might not be sending data or using different settings")
                serial_conn.close()
                return False
                
        except PermissionError:
            print(f"❌ Permission denied for {port}")
            print("💡 Possible solutions:")
            print("   • Close any other applications using this port (Arduino IDE, PuTTY, etc.)")
            print("   • Run this script as Administrator")
            print("   • Check if another instance of this script is running")
            print("   • Unplug and replug the device")
            return False
            
        except serial.SerialException as e:
            print(f"❌ Serial connection error for {port}: {e}")
            if "could not open port" in str(e):
                print("💡 Port might be in use by another application")
            return False
            
        except Exception as e:
            print(f"❌ Unexpected error connecting to {port}: {e}")
            return False

    def scan_and_connect_devices(self):
        """Scan all port/baud combinations and connect to active ones"""
        print("🔍 Scanning for devices...")
        
        # First, list all available ports
        available_ports = self.list_available_ports()
        if not available_ports:
            print("❌ No COM ports detected!")
            return False
        
        active_connections = 0
        
        for config in self.port_configs:
            if config['port'] in available_ports:
                if self.connect_to_device(config['port'], config['baud']):
                    active_connections += 1
            else:
                print(f"⚠️ {config['port']} not available in system")
        
        if active_connections > 0:
            print(f"✅ Connected to {active_connections} device(s)")
            return True
        else:
            print("❌ No active devices found")
            print("💡 Troubleshooting tips:")
            print("   • Make sure your device is plugged in")
            print("   • Check if the device is working (LED indicators)")
            print("   • Try a different USB cable")
            print("   • Check Device Manager for COM port issues")
            print("   • Restart the device")
            return False

    def is_new_hit(self, soldier_id, is_hit, attacker_id):
        """Check if this is a new hit event to prevent duplicates"""
        # Check if this soldier's hit status actually changed
        previous_hit_status = self.soldier_hit_states.get(soldier_id, 0)
        
        print(f"🔍 HIT CHECK: Soldier {soldier_id} - Previous: {previous_hit_status}, Current: {is_hit}")
        
        # Only process if hit status changed from 0 to 1 (new hit)
        if is_hit == 1 and previous_hit_status == 0:
            self.soldier_hit_states[soldier_id] = 1
            print(f"✅ NEW HIT CONFIRMED: Soldier {soldier_id} from {previous_hit_status} to {is_hit}")
            return True
        elif is_hit == 1 and previous_hit_status == 1:
            print(f"⚠️ DUPLICATE HIT IGNORED: Soldier {soldier_id} already hit")
            return False
        
        # Update hit state but don't process as new hit
        if is_hit != previous_hit_status:
            self.soldier_hit_states[soldier_id] = is_hit
            if is_hit == 0:
                print(f"🔄 Soldier {soldier_id} status reset to alive")
        
        return False

    def parse_esp_data(self, raw_data):
        """Parse ESP data packets with strict validation for 12-field format"""
        parsed_packets = []
        
        # Find all complete packets between { and }
        i = 0
        while i < len(raw_data):
            # Look for opening bracket
            start = raw_data.find('{', i)
            if start == -1:
                break
                
            # Look for closing bracket after opening
            end = raw_data.find('}', start)
            if end == -1:
                # No closing bracket found - this is an error
                print(f"❌ ERROR: Incomplete packet - missing closing bracket: {raw_data[start:start+50]}...")
                break
            
            # Extract packet content between brackets
            packet_content = raw_data[start+1:end]  # Remove { and }
            
            try:
                values = [x.strip() for x in packet_content.split(',')]
                print(f"🔍 Raw packet: {packet_content}")
                print(f"📊 Field count: {len(values)}")
                
                # Handle packets with exactly 12 fields as per your specification
                if len(values) == 12:
                    try:
                        # Parse according to your STM32 data structure
                        soldier_id = int(values[0])
                        
                        # Parse GPS coordinates (handle invalid GPS gracefully)
                        try:
                            raw_lat = float(values[1]) if values[1] and values[1] not in ['V', '', '0'] else 0.0
                            raw_lng = float(values[2]) if values[2] and values[2] not in ['V', '', '0'] else 0.0
                        except ValueError:
                            raw_lat, raw_lng = 0.0, 0.0
                        
                        # Convert GPS coordinates or use defaults
                        if raw_lat != 0.0 and raw_lng != 0.0:
                            converted_lat, converted_lng = self.convert_gps_coordinates(raw_lat, raw_lng)
                        else:
                            # Use default coordinates if GPS is invalid
                            converted_lat, converted_lng = 28.4595, 77.0266  # Gurugram default
                            print(f"⚠️ Using default GPS coordinates for soldier {soldier_id}")
                        
                        # Parse IMU data
                        try:
                            roll = float(values[3]) if values[3] and values[3] != '' else 0.0
                            pitch = float(values[4]) if values[4] and values[4] != '' else 0.0
                            yaw = float(values[5]) if values[5] and values[5] != '' else 0.0
                        except ValueError:
                            roll, pitch, yaw = 0.0, 0.0, 0.0
                        
                        # Parse combat data
                        try:
                            is_hit = int(values[6]) if values[6] and values[6] in ['0', '1'] else 0
                            attacker_id = int(values[7]) if values[7] and values[7].isdigit() else 0
                            fire_mode = int(values[8]) if values[8] and values[8].isdigit() else 0
                            weapon_id = int(values[9]) if values[9] and values[9].isdigit() else 1
                            trigger_event = int(values[10]) if values[10] and values[10] in ['0', '1'] else 0
                            bullet_count = int(values[11]) if values[11] and values[11].isdigit() else 0
                        except ValueError:
                            is_hit, attacker_id, fire_mode, weapon_id, trigger_event, bullet_count = 0, 0, 0, 1, 0, 0
                        
                        # Handle different combat scenarios
                        if is_hit == 1:
                            if attacker_id == 0:
                                # No attacker specified, set to self (suicide)
                                attacker_id = soldier_id
                                print(f"💀 SUICIDE DETECTED: Soldier {soldier_id} eliminated themselves!")
                            elif attacker_id == soldier_id:
                                # Self-kill (suicide)
                                print(f"💀 SUICIDE DETECTED: Soldier {soldier_id} eliminated themselves!")
                            else:
                                # Regular kill by another soldier - verify attacker exists and is from opposite team
                                victim_team = self.team_assignments.get(soldier_id, "team_red")
                                attacker_team = self.team_assignments.get(attacker_id, "team_red")
                                
                                if attacker_team == victim_team:
                                    # Same team, find opposite team attacker
                                    opposite_team = "team_blue" if victim_team == "team_red" else "team_red"
                                    potential_attackers = [sid for sid, team in self.team_assignments.items() 
                                                         if team == opposite_team and sid != soldier_id]
                                    
                                    if potential_attackers:
                                        attacker_id = potential_attackers[0]
                                        print(f"🎯 ENEMY KILL: Soldier {soldier_id} ({victim_team}) hit by Soldier {attacker_id} ({opposite_team})")
                                    else:
                                        # Fallback to suicide if no opposite team found
                                        attacker_id = soldier_id
                                        print(f"💀 FALLBACK SUICIDE: Soldier {soldier_id} eliminated themselves!")
                                else:
                                    print(f"🎯 ENEMY KILL: Soldier {soldier_id} ({victim_team}) hit by Soldier {attacker_id} ({attacker_team})")
                        
                        # Check if this is a new hit (prevent duplicates)
                        is_new_hit_event = self.is_new_hit(soldier_id, is_hit, attacker_id)
                        
                        # Only log and process new hits
                        if is_new_hit_event:
                            print(f"🎯 NEW HIT DETECTED! Soldier {soldier_id} hit by Soldier {attacker_id}")
                        
                        # If trigger event detected
                        if trigger_event == 1:
                            if is_hit == 0:  # Shot fired, not a hit
                                print(f"🔫 SHOT FIRED! Soldier {soldier_id} fired {bullet_count} rounds")
                        
                        # Create packet with parsed data
                        packet = {
                            'soldier_id': soldier_id,
                            'latitude': converted_lat,
                            'longitude': converted_lng,
                            'roll': roll,
                            'pitch': pitch,
                            'yaw': yaw,
                            'is_hit': is_hit,
                            'attacker_id': attacker_id,
                            'fire_mode': fire_mode,
                            'weapon_id': weapon_id,
                            'trigger_event': trigger_event,
                            'bullet_count': bullet_count,
                            'is_new_hit': is_new_hit_event  # Flag for new hits only
                        }
                        
                        parsed_packets.append(packet)
                        
                        # Get team for logging
                        team = self.team_assignments.get(soldier_id, "team_red")
                        print(f"✅ Valid packet: Soldier {packet['soldier_id']} ({team}) at ({packet['latitude']:.6f}, {packet['longitude']:.6f})")
                        
                        # Log hits with detailed info (only new hits)
                        if is_new_hit_event:
                            attacker_team = self.team_assignments.get(packet['attacker_id'], "team_red")
                            victim_team = self.team_assignments.get(packet['soldier_id'], "team_blue")
                            attacker_name = self.call_signs.get(packet['attacker_id'], f"soldier_{packet['attacker_id']}")
                            victim_name = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
                            
                            if packet['attacker_id'] == packet['soldier_id']:
                                print(f"💀 SUICIDE CONFIRMED: {victim_name} ({victim_team}) committed suicide")
                            else:
                                print(f"💥 KILL CONFIRMED: {attacker_name} ({attacker_team}) → {victim_name} ({victim_team})")
                            
                        # Log shots fired
                        if packet['trigger_event'] == 1 and packet['is_hit'] == 0:
                            soldier_name = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
                            print(f"🔫 SHOT: {soldier_name} ({team}) fired {packet['bullet_count']} rounds")
                            
                    except (ValueError, IndexError) as e:
                        print(f"❌ ERROR: Invalid data in packet {packet_content}: {e}")
                        
                else:
                    print(f"❌ ERROR: Invalid packet length ({len(values)} fields, expected 12): {packet_content}")
                    print(f"📋 Fields received: {values}")
                    
            except Exception as e:
                print(f"❌ ERROR: Failed to parse packet {packet_content}: {e}")
            
            # Move to next potential packet
            i = end + 1
        
        return parsed_packets

    def format_soldier_data(self, packet):
        """Format data for soldier WebSocket"""
        team = self.team_assignments.get(packet['soldier_id'], "team_red")
        call_sign = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
        
        return {
            "soldier_id": str(packet['soldier_id']),
            "call_sign": call_sign,
            "team": team,
            "gps": {
                "latitude": packet['latitude'],
                "longitude": packet['longitude']
            },
            "imu": {
                "roll": packet['roll'],
                "pitch": packet['pitch'],
                "yaw": packet['yaw']
            },
            "hit_status": packet['is_hit'],
            "ammo": {
                "attacker_id": str(packet['attacker_id']),
                "fire_mode": packet['fire_mode'],
                "weapon_id": packet['weapon_id']
            },
            "weapon_id": packet['weapon_id'],
            "fire_mode": packet['fire_mode'],
            "trigger_event": packet['trigger_event'],
            "bullet_count": packet['bullet_count'],
            "timestamp": datetime.now().isoformat(),
            "_id": generate_object_id()
        }

    def format_kill_feed_data(self, packet):
        """Format data for kill feed WebSocket with clear suicide detection"""
        if packet['is_hit'] == 1 and packet.get('is_new_hit', False):  # Only send for new hits
            victim_call_sign = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
            victim_team = self.team_assignments.get(packet['soldier_id'], "team_blue")
            
            # Check for suicide
            is_suicide = packet['attacker_id'] == packet['soldier_id']
            
            print(f"🔍 KILL FEED DEBUG:")
            print(f"   Victim: {packet['soldier_id']} ({victim_call_sign})")
            print(f"   Attacker: {packet['attacker_id']}")
            print(f"   Is Suicide: {is_suicide}")
            
            if is_suicide:
                # Suicide case - make it crystal clear
                kill_feed_data = {
                    "attacker_id": str(packet['soldier_id']),
                    "attacker_call_sign": victim_call_sign,
                    "attacker_team": victim_team,
                    "victim_id": str(packet['soldier_id']),
                    "victim_call_sign": victim_call_sign,
                    "victim_team": victim_team,
                    "distance_to_victim (in meters)": 0.0,
                    "timestamp": datetime.now().isoformat(),
                    "weapon_id": packet['weapon_id'],
                    "kill_confirmed": True,
                    "kill_type": "suicide",
                    "kill_message": f"{victim_call_sign} committed suicide",
                    "is_suicide": True,
                    "display_message": f"💀 {victim_call_sign} committed suicide"  # Clear display message
                }
                print(f"   💀 SUICIDE DATA: {kill_feed_data['display_message']}")
                return kill_feed_data
            else:
                # Regular kill
                attacker_call_sign = self.call_signs.get(packet['attacker_id'], f"soldier_{packet['attacker_id']}")
                attacker_team = self.team_assignments.get(packet['attacker_id'], "team_red")
                
                # Calculate distance
                distance_km = 0.0
                if packet['attacker_id'] in self.soldier_positions:
                    attacker_pos = self.soldier_positions[packet['attacker_id']]
                    distance_km = self.calculate_distance(
                        attacker_pos['latitude'], attacker_pos['longitude'],
                        packet['latitude'], packet['longitude']
                    )
                
                kill_feed_data = {
                    "attacker_id": str(packet['attacker_id']),
                    "attacker_call_sign": attacker_call_sign,
                    "attacker_team": attacker_team,
                    "victim_id": str(packet['soldier_id']),
                    "victim_call_sign": victim_call_sign,
                    "victim_team": victim_team,
                    "distance_to_victim (in meters)": distance_km,
                    "timestamp": datetime.now().isoformat(),
                    "weapon_id": packet['weapon_id'],
                    "kill_confirmed": True,
                    "kill_type": "elimination",
                    "kill_message": f"{attacker_call_sign} eliminated {victim_call_sign}",
                    "is_suicide": False,
                    "display_message": f"💥 {attacker_call_sign} eliminated {victim_call_sign} from {distance_km:.2f} km"
                }
                print(f"   💥 KILL DATA: {kill_feed_data['display_message']}")
                return kill_feed_data
        return None

    def update_stats(self, packet):
        """Update team statistics - bullets fired and kills"""
        soldier_team = self.team_assignments.get(packet['soldier_id'], "team_red")
        
        print(f"🔍 STATS UPDATE: Packet data - Hit: {packet['is_hit']}, New Hit: {packet.get('is_new_hit', False)}, Trigger: {packet['trigger_event']}, Bullets: {packet['bullet_count']}")
        
        # Update bullets fired when trigger is pulled
        if packet['trigger_event'] > 0 and packet['bullet_count'] > 0:
            old_bullets = self.team_stats[soldier_team]["bullets_fired"]
            self.team_stats[soldier_team]["bullets_fired"] += packet['bullet_count']
            new_bullets = self.team_stats[soldier_team]["bullets_fired"]
            print(f"📊 BULLETS UPDATED: {soldier_team} {old_bullets} → {new_bullets} (+{packet['bullet_count']})")
        
        # Update kill count for NEW hits only
        if packet['is_hit'] == 1 and packet.get('is_new_hit', False):
            attacker_team = self.team_assignments.get(packet['attacker_id'], "team_red")
            victim_team = self.team_assignments.get(packet['soldier_id'], "team_blue")
            
            is_suicide = packet['attacker_id'] == packet['soldier_id']
            
            if is_suicide:
                # Suicide - no team gets kill credit
                attacker_name = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
                print(f"💀 SUICIDE: {attacker_name} ({victim_team}) eliminated themselves")
                print(f"📊 SUICIDE RECORDED: {victim_team} member down (no kill credit awarded)")
            else:
                # Regular kill - attacker's team gets credit
                old_kills = self.team_stats[attacker_team]["total_killed"]
                self.team_stats[attacker_team]["total_killed"] += 1
                new_kills = self.team_stats[attacker_team]["total_killed"]
                
                attacker_name = self.call_signs.get(packet['attacker_id'], f"soldier_{packet['attacker_id']}")
                victim_name = self.call_signs.get(packet['soldier_id'], f"soldier_{packet['soldier_id']}")
                
                print(f"💥 KILL CONFIRMED: {attacker_name} ({attacker_team}) eliminated {victim_name} ({victim_team})")
                print(f"📊 KILLS UPDATED: {attacker_team} {old_kills} → {new_kills} (+1)")
            
            # Always show current stats after any hit
            print(f"📊 CURRENT TEAM STATS:")
            print(f"   🔴 Red Team  - Kills: {self.team_stats['team_red']['total_killed']}, Bullets: {self.team_stats['team_red']['bullets_fired']}")
            print(f"   🔵 Blue Team - Kills: {self.team_stats['team_blue']['total_killed']}, Bullets: {self.team_stats['team_blue']['bullets_fired']}")
        else:
            print(f"📊 NO KILL UPDATE: Hit={packet['is_hit']}, NewHit={packet.get('is_new_hit', False)}")

    def format_stats_data(self):
        """Format data for stats WebSocket"""
        timestamp = datetime.now().isoformat()
        return {
            "team_red": {
                "total_killed": self.team_stats["team_red"]["total_killed"],
                "bullets_fired": self.team_stats["team_red"]["bullets_fired"],
                "timestamp": timestamp
            },
            "team_blue": {
                "total_killed": self.team_stats["team_blue"]["total_killed"],
                "bullets_fired": self.team_stats["team_blue"]["bullets_fired"],
                "timestamp": timestamp
            }
        }

    async def broadcast_to_clients(self, clients, data):
        """Broadcast data to WebSocket clients"""
        if clients:
            message = json.dumps(data)
            clients_copy = clients.copy()
            for client in clients_copy:
                try:
                    await client.send(message)
                except:
                    clients.discard(client)

    async def soldier_data_handler(self, websocket, path=None):
        """Handle soldier data connections"""
        self.soldier_clients.add(websocket)
        print(f"🔗 Soldier client connected. Total: {len(self.soldier_clients)}")
        try:
            await websocket.wait_closed()
        finally:
            self.soldier_clients.discard(websocket)
            print(f"📤 Soldier client disconnected. Total: {len(self.soldier_clients)}")

    async def kill_feed_handler(self, websocket, path=None):
        """Handle kill feed connections"""
        self.kill_feed_clients.add(websocket)
        print(f"🔗 Kill feed client connected. Total: {len(self.kill_feed_clients)}")
        try:
            await websocket.wait_closed()
        finally:
            self.kill_feed_clients.discard(websocket)
            print(f"📤 Kill feed client disconnected. Total: {len(self.kill_feed_clients)}")

    async def stats_handler(self, websocket, path=None):
        """Handle stats connections"""
        self.stats_clients.add(websocket)
        print(f"🔗 Stats client connected. Total: {len(self.stats_clients)}")
        try:
            await websocket.wait_closed()
        finally:
            self.stats_clients.discard(websocket)
            print(f"📤 Stats client disconnected. Total: {len(self.stats_clients)}")

    def multi_port_reader_thread(self):
        """Read data from multiple devices simultaneously"""
        buffers = {}  # Separate buffer for each connection
        packet_count = 0
        
        print("📡 Multi-port reader started")
        
        while self.running:
            try:
                # Check if we have any connections, if not try to reconnect
                if not self.serial_connections:
                    print("🔄 No active connections, scanning for devices...")
                    if self.scan_and_connect_devices():
                        # Initialize buffers for new connections
                        for conn_key in self.serial_connections:
                            buffers[conn_key] = ""
                    else:
                        print("⏳ Waiting 10 seconds before retry...")
                        time.sleep(10)  # Wait longer between retries
                        continue
                
                # Read from all active connections
                connections_to_remove = []
                
                for conn_key, serial_conn in self.serial_connections.items():
                    try:
                        if not serial_conn.is_open:
                            connections_to_remove.append(conn_key)
                            continue
                            
                        # Initialize buffer if not exists
                        if conn_key not in buffers:
                            buffers[conn_key] = ""
                        
                        # Read data if available
                        if serial_conn.in_waiting > 0:
                            try:
                                raw_data = serial_conn.read(serial_conn.in_waiting).decode('utf-8', errors='ignore')
                                buffers[conn_key] += raw_data
                                
                                # Process packets from this connection's buffer
                                while '{' in buffers[conn_key] and '}' in buffers[conn_key]:
                                    start = buffers[conn_key].find('{')
                                    end = buffers[conn_key].find('}', start)
                                    
                                    if start != -1 and end != -1 and end > start:
                                        # Extract complete packet including brackets
                                        packet_str = buffers[conn_key][start:end+1]
                                        buffers[conn_key] = buffers[conn_key][end+1:]
                                        
                                        # Validate packet format
                                        if packet_str.startswith('{') and packet_str.endswith('}'):
                                            packets = self.parse_esp_data(packet_str)
                                            for packet in packets:
                                                packet_count += 1
                                                print(f"📦 Packet #{packet_count} from {conn_key}: Soldier {packet['soldier_id']}")
                                                
                                                # Process packet immediately
                                                if hasattr(self, 'loop') and self.loop:
                                                    asyncio.run_coroutine_threadsafe(
                                                        self.process_packet(packet), 
                                                        self.loop
                                                    )
                                        else:
                                            print(f"❌ ERROR: Invalid packet format: {packet_str}")
                                    else:
                                        # No complete packet found, wait for more data
                                        break
                            
                            except Exception as e:
                                print(f"❌ Read error from {conn_key}: {e}")
                                connections_to_remove.append(conn_key)
                    
                    except Exception as e:
                        print(f"❌ Connection error {conn_key}: {e}")
                        connections_to_remove.append(conn_key)
                
                # Remove failed connections
                for conn_key in connections_to_remove:
                    if conn_key in self.serial_connections:
                        try:
                            self.serial_connections[conn_key].close()
                        except:
                            pass
                        del self.serial_connections[conn_key]
                        if conn_key in buffers:
                            del buffers[conn_key]
                        print(f"🗑️ Removed failed connection: {conn_key}")
                
                time.sleep(0.01)  # Fast polling
                
            except Exception as e:
                print(f"❌ Thread error: {e}")
                time.sleep(1)

    async def process_packet(self, packet):
        """Process and broadcast packet data with enhanced hit detection"""
        try:
            print(f"\n🔄 PROCESSING PACKET: Soldier {packet['soldier_id']}")
            print(f"   📊 Packet details: Hit={packet['is_hit']}, Attacker={packet['attacker_id']}, Trigger={packet['trigger_event']}, Bullets={packet['bullet_count']}")
            print(f"   🏷️ New Hit Flag: {packet.get('is_new_hit', False)}")
            
            # Quick position update
            self.soldier_positions[packet['soldier_id']] = {
                'latitude': packet['latitude'],
                'longitude': packet['longitude']
            }
            
            # Send soldier data to all clients (always)
            soldier_data = self.format_soldier_data(packet)
            await self.broadcast_to_clients(self.soldier_clients, soldier_data)
            print(f"   📡 Soldier data sent to {len(self.soldier_clients)} clients")
            
            # Update stats for this packet
            self.update_stats(packet)
            
            # Send updated stats to all clients (always send current stats)
            stats_data = self.format_stats_data()
            await self.broadcast_to_clients(self.stats_clients, stats_data)
            print(f"   📊 Stats data sent to {len(self.stats_clients)} clients")
            print(f"   📊 Stats content: {json.dumps(stats_data, indent=2)}")
            
            # Send kill feed for new hits only
            if packet['is_hit'] == 1 and packet.get('is_new_hit', False):
                kill_data = self.format_kill_feed_data(packet)
                if kill_data:
                    await self.broadcast_to_clients(self.kill_feed_clients, kill_data)
                    print(f"   🎯 Kill feed sent to {len(self.kill_feed_clients)} clients")
                    
                    if kill_data['is_suicide']:
                        print(f"   💀 SUICIDE FEED: {kill_data['kill_message']}")
                    else:
                        distance = kill_data['distance_to_victim (in meters)']
                        print(f"   💥 KILL FEED: {kill_data['kill_message']} ({distance} km)")
            
            print(f"✅ PACKET PROCESSING COMPLETE for Soldier {packet['soldier_id']}\n")
            
        except Exception as e:
            print(f"❌ Process error: {e}")
            import traceback
            traceback.print_exc()

    async def keep_alive(self):
        """Keep servers running (faster heartbeat)"""
        while self.running:
            await asyncio.sleep(0.1)  # Faster heartbeat

    async def start_servers(self):
        """Start all WebSocket servers"""
        print("🚀 Starting servers...")
        
        soldier_server = websockets.serve(self.soldier_data_handler, "localhost", 8001)
        kill_feed_server = websockets.serve(self.kill_feed_handler, "localhost", 8002)
        stats_server = websockets.serve(self.stats_handler, "localhost", 8003)
        keep_alive = self.keep_alive()
        
        print("✅ Servers running:")
        print("   📡 ws://localhost:8001/ws (soldier data)")
        print("   🎯 ws://localhost:8002/ws (kill feed)")
        print("   📊 ws://localhost:8003/ws (team stats)")
        print("\n🎮 Ready for device data!")
        print("🔌 Monitoring COM at 9600 baud")
        print("🚫 Duplicate hit prevention enabled")
        print("Press Ctrl+C to stop\n")
        
        await asyncio.gather(
            soldier_server,
            kill_feed_server,
            stats_server,
            keep_alive,
            return_exceptions=True
        )

    def run(self):
        """Main run method"""
        print("=" * 60)
        print("🎯 COM13 Device WebSocket Converter")
        print("📡 Monitoring COM @ 9600 baud")
        print("🔒 Strict packet validation { }")
        print("🚫 Duplicate hit prevention")
        print("🇮🇳 Indian call signs")
        print("🗺️ GPS coordinate conversion")
        print("=" * 60)
        
        # Create event loop
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        
        # Start multi-port reader
        reader_thread = threading.Thread(target=self.multi_port_reader_thread, daemon=True)
        reader_thread.start()
        
        try:
            self.loop.run_until_complete(self.start_servers())
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
        except Exception as e:
            print(f"❌ Error: {e}")
        finally:
            self.running = False
            
            # Close all serial connections
            for conn_key, serial_conn in self.serial_connections.items():
                try:
                    serial_conn.close()
                    print(f"🔌 Closed {conn_key}")
                except Exception:
                    pass
            
            try:
                pending = asyncio.all_tasks(self.loop)
                for task in pending:
                    task.cancel()
                if pending:
                    self.loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                self.loop.close()
            except Exception:
                pass
            
            print("✅ Stopped")

if __name__ == "__main__":
    converter = COM13DeviceConverter()
    converter.run()