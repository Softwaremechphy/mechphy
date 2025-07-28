#backend_logic/pydantic_responses_out/weapons_pydantic.py
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from bson import ObjectId

# Enum for weapon types
class WeaponType(str, Enum):
    assault = "assault" # AK-47, Tar-21, sig-716
    lmg = "lmg" # negev
    sniper = "sniper" # balil ace
    pistol = "pistol" # glock 26

# Enum for bullet types
class BulletType(str, Enum):
    mm_556 = "5.56 mm"
    mm_762 = "7.62 mm"
    mm_9 = "9 mm"


# Models for weapon details 
# Assuming if fire_rate = 0 -> guns only in single mode
# if(fire_rate > 0) -> guns have burst mode which fires 3 bullets at a time and also works auto mode
class WeaponBase(BaseModel):
    weapon_type: WeaponType
    bullet_type: BulletType
    fire_rate: int
    range: int
    
# Model for creating a new weapon
class WeaponCreate(WeaponBase):
    name: str

class ChooseWeaponRequest(BaseModel):
    name: str

# Model for updating an existing weapon
class WeaponUpdate(BaseModel):
    weapon_type: Optional[WeaponType]
    bullet_type: Optional[BulletType]
    burst_mode: Optional[int]
    fire_rate: Optional[int]
    range: Optional[int]

# Model for weapon data stored in MongoDB (includes mongo_id)
class WeaponInDB(WeaponBase):
    mongo_id: Optional[ObjectId] = Field(alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True

# Response model when querying weapon information
class WeaponResponse(BaseModel):
    weapon_id: str
    name: str
    count: int
    weapon_type: WeaponType
    bullet_type: BulletType
    fire_rate: int
    range: int
