# from db.schemas.incoming_soldier import Soldier

# def transform_soldier_data(soldier_data: Soldier) -> dict:
#     return {
#         'soldier_id': soldier_data.soldier_id,
#         'gps': {
#             'latitude': soldier_data.gps_data.latitude,
#             'longitude': soldier_data.gps_data.longitude
#         },
#         'imu': {
#             'roll': soldier_data.imu_data.roll,
#             'pitch': soldier_data.imu_data.pitch,
#             'yaw': soldier_data.imu_data.yaw
#         },
#         'hit_status': bool(soldier_data.hit_data.is_hit),  # Convert int to bool
#         'ammo': {
#             'attacker_id': soldier_data.ammo_data.attacker_id,
#             'fire_mode': soldier_data.ammo_data.fire_mode,
#             'weapon_id': soldier_data.ammo_data.weapon_id
#         },
#         'weapon_id': soldier_data.weapon_id,
#         'fire_mode': soldier_data.fire_mode,
#         'trigger_event': soldier_data.trigger_event,
#         'bullet_count': soldier_data.bullet_count
#     }
from db.schemas.incoming_soldier import Soldier

def transform_soldier_data(soldier_data: Soldier) -> dict:
    return {
        'soldier_id': soldier_data.soldier_id,
        'gps': {
            'latitude': soldier_data.gps_data.latitude,
            'longitude': soldier_data.gps_data.longitude
        },
        'imu': {
            'roll': soldier_data.imu_data.roll,
            'pitch': soldier_data.imu_data.pitch,
            'yaw': soldier_data.imu_data.yaw
        },
        'hit_status': soldier_data.hit_data.hit_status,  # Now an int
        'ammo': {
            'attacker_id': soldier_data.ammo_data.attacker_id,
            'fire_mode': soldier_data.ammo_data.fire_mode,
            'weapon_id': soldier_data.ammo_data.weapon_id
        },
        'weapon_id': soldier_data.weapon_id,
        'fire_mode': soldier_data.fire_mode,
        'trigger_event': soldier_data.trigger_event,
        'bullet_count': soldier_data.bullet_count
    }