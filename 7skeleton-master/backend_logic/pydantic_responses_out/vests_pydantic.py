#backend_logic/pydantic_responses_out/vests_pydantic.py
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from bson import ObjectId

# Enum for protection level
class ProtectionLevel:
    STANDARD_LEVELS = [0, 1, 2, 3]  # For internal use or UI defaults


# Basic vest information
class VestBase(BaseModel):
    vest_id: str
    protection_level: int
    count: int # Tracks how many vests are available or allocated   

# Model for creating a new vest
class VestCreate(BaseModel):
    protection_level: int

# Model for updating an existing vest
class VestUpdate(BaseModel):
    protection_level: Optional[int]

# Model for vest data stored in MongoDB (includes mongo_id)
class VestInDB(VestBase):
    mongo_id: Optional[ObjectId] = Field(alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True

# Response model for vest queries
class VestResponse(BaseModel):
    vest: VestBase