# from faust import Record

# class GPS(Record):
#     latitude: float
#     longitude: float

# class IMU(Record):
#     roll: float
#     pitch: float
#     yaw: float

# class Hit(Record):
#     is_hit: int  # Keep as int since you have 0 or 1

# class Ammo(Record):
#     attacker_id: str
#     fire_mode: int
#     weapon_id: int

# class Soldier(Record):
#     soldier_id: str
#     gps_data: GPS
#     imu_data: IMU
#     hit_data: Hit
#     ammo_data: Ammo
#     weapon_id: int
#     fire_mode: int
#     trigger_event: int
#     bullet_count: int

from faust import Record

class GPS(Record):
    latitude: float
    longitude: float

class IMU(Record):
    roll: float
    pitch: float
    yaw: float

class Hit(Record):
    hit_status: int  # Renamed from is_hit to hit_status to reflect values 0, 1, or 2

class Ammo(Record):
    attacker_id: str
    fire_mode: int
    weapon_id: int

class Soldier(Record):
    soldier_id: str
    gps_data: GPS
    imu_data: IMU
    hit_data: Hit
    ammo_data: Ammo
    weapon_id: int
    fire_mode: int
    trigger_event: int
    bullet_count: int