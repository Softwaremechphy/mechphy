from pydantic import BaseModel
from faust import Record
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from bson import ObjectId  # For MongoDB ObjectId

# Additional data models for vest, explosives, objects, vehicles, etc.
class VestData(Record):
    vest_id: int
    damage_percentage: float
    timestamp: datetime

class ExplosiveData(Record):
    explosive_id: int
    damage_percentage: float
    radius: int
    timestamp: datetime

class ObjectData(Record):
    object_id: int
    name: str
    damage_percentage: float
    timestamp: datetime

class VehicleData(Record):
    vehicle_id: int
    name: str
    damage_percentage: float
    timestamp: datetime

# Core data models
class GPSData(Record):
    latitude: float
    longitude: float
    timestamp: datetime

class AccelerationData(Record):
    x: float
    y: float
    z: float
    timestamp: datetime

class RotationData(Record):
    x: float
    y: float
    z: float
    timestamp: datetime

class IMUData(Record):
    acceleration: AccelerationData
    rotation: RotationData
    timestamp: datetime

class HitData(Record):
    is_hit: int
    timestamp: datetime

class AmmoData(Record):
    attacker_id: int
    fire_mode: int
    weapon_id: int
    trigger_event: int
    timestamp: datetime

# SoldierData with both client and MongoDB IDs
class SoldierData(Record):
    soldier_id: str  # Client-provided soldier ID
    mongo_id: Optional[ObjectId]  # MongoDB-generated ID
    gps_data: GPSData
    imu_data: IMUData
    hit_data: HitData
    ammo_data: AmmoData
    weapon_id: int
    fire_mode: int
    vest: Optional[VestData]
    explosives: Optional[ExplosiveData]
    vehicle: Optional[VehicleData]
    object: Optional[ObjectData]
    timestamp: datetime

# Built-up area information with both client and MongoDB IDs
class BuiltUpAreaData(BaseModel):
    area_id: UUID  # Client-provided unique ID
    mongo_id: Optional[ObjectId]  # MongoDB-generated unique ID
    name: str
    image_url: str
    gps_data: GPSData
    timestamp: datetime

# Event data
class EventData(Record):
    event_id: UUID
    event_type: str
    event_description: str
    timestamp: datetime

# Session data includes soldiers, built-up areas, and events
class SessionData(Record):
    session_id: str
    start_time: datetime
    end_time: Optional[datetime]
    location: GPSData
    participants: List[SoldierData]
    built_up_areas: List[BuiltUpAreaData]
    events: List[EventData]
