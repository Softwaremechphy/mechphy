#backend_logic/pydantic_responses_out/soldier_pydantic.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from bson import ObjectId

# Model for soldier statistics to return upon search
class SoldierStats(BaseModel):
    kill_count: int
    sessions_participated: List[str]
    stats_data: Dict[str, str]  # Can include other dynamic stats information

# Basic soldier data for the outside monitoring environment
class SoldierBase(BaseModel):
    soldier_id: str  # Change to string if IDs can be alphanumeric
    call_sign: str   # Call sign for the soldier
    stats: Optional[SoldierStats]

# Model for creating a new soldier in the outside monitoring environment
class SoldierCreate(SoldierBase):
    pass

# Model for updating soldier in outside monitoring environment
class SoldierUpdate(BaseModel):
    call_sign: Optional[str]

# Model for soldier data stored in MongoDB (includes mongo_id)
class SoldierInDB(SoldierBase):
    mongo_id: Optional[ObjectId] = Field(alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True  # Allow arbitrary types like ObjectId

# Response model when searching for a soldier in outside monitoring environment
class SoldierResponse(BaseModel):
    soldier: SoldierBase
    stats: Optional[SoldierStats]
