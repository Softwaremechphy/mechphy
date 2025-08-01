#backend_logic/pydantic_responses_in/sessions_pydantic.py
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime
from typing import Any

# Enum for team names and squad numbers
class TeamEnum(str, Enum):
    BLUE = "blue"
    RED = "red"

class SquadEnum(int, Enum):
    SQUAD_1 = 1
    SQUAD_2 = 2
    SQUAD_3 = 3
    SQUAD_4 = 4
    SQUAD_5 = 5
    SQUAD_6 = 6

# Enum for roles and equipment
class RoleEnum(str, Enum):
    ASSAULT = "Assault"
    SNIPER = "Sniper"
    MEDIC = "Medic"
    ENGINEER = "Engineer"
    
class EquipmentEnum(str, Enum):
    RADIO = "Radio"
    MEDICAL_KIT = "Medical_Kit"
    COMMUNICATION = "Communication"
    MISCELLANEOUS = "Miscellaneous"


# Model for location data
class Location(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime

class Orientation(BaseModel):
    roll: float
    pitch: float
    yaw: float
    timestamp: datetime

    class Config:
        schema_extra = {
            "example": {
                "roll": 1.2,
                "pitch": 1.5,
                "yaw": 1.4,
                "timestamp": "2024-12-06T11:07:18.403916"
            }
        }



# Soldier allocation input model (for resource allocation)
class SoldierAllocation(BaseModel):
    soldier_id: str
    # call_sign: str
    weapon_id: str
    vest_id: str
    role: RoleEnum
    equipment: EquipmentEnum

    class Config:
        schema_extra = {
            "example": {
                "soldier_id": "S123",
                # "call_sign": "Alpha",
                "weapon_id": "W1",
                "vest_id": "V2",
                "role": "Sniper",
                "equipment": "Radio"
            }
        }

# Squad model containing a list of soldiers
class SquadAllocation(BaseModel):
    soldiers: List[SoldierAllocation]

# Team model containing multiple squads
class TeamAllocation(BaseModel):
    squad_1: SquadAllocation
    squad_2: SquadAllocation
    squad_3: SquadAllocation
    squad_4: SquadAllocation
    squad_5: SquadAllocation
    squad_6: SquadAllocation

# Main allocation model containing both teams
class ResourceAllocation(BaseModel):
    team_blue: TeamAllocation
    team_red: TeamAllocation

    class Config:
        schema_extra = {
            "example": {
               
                "team_blue": {
                    "squad_1": {
                    "soldiers": [
                        {
                        "soldier_id": "1",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_2": {
                    "soldiers": [
                        {
                        "soldier_id": "2",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    },
                    "squad_3": {
                    "soldiers": [
                        {
                        "soldier_id": "3",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_4": {
                    "soldiers": [
                        {
                        "soldier_id": "4",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                    },
                    "squad_5": {
                    "soldiers": [
                        {
                        "soldier_id": "5",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_6": {
                    "soldiers": [
                        {
                        "soldier_id": "6",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    }
                },
                "team_red": {
                    "squad_1": {
                    "soldiers": [
                        {
                        "soldier_id": "7",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_2": {
                    "soldiers": [
                        {
                        "soldier_id": "8",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                    },
                    "squad_3": {
                    "soldiers": [
                        {
                        "soldier_id": "9",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_4": {
                    "soldiers": [
                        {
                        "soldier_id": "10",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    },
                    "squad_5": {
                    "soldiers": [
                        {
                        "soldier_id": "11",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_6": {
                    "soldiers": [
                        {
                        "soldier_id": "12",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                }
            }
            
            }
        }

# Model for soldier stats during a session
class SoldierInSession(BaseModel):
    session_soldier_id: int
    soldier_id: str
    call_sign: str
    weapon_id: str
    vest_id: str
    team: TeamEnum  # Team information
    squad: SquadEnum  # Squad information
    location: Optional[List[Location]] = []
    orientation: Optional[List[Orientation]] = []
    event_data: Optional[List[Dict[str, str]]] = []
    died: Optional[datetime] = None  # Time when the soldier died (if applicable)
    damage: Optional[Dict[str, datetime]] = {}  # Damage as a dictionary
    stats: Optional[List[Dict[str, Any]]] = []  # List to hold stats data like kill_count, bullets_fired, and timestamp

    def __init__(self, **data):
        super().__init__(**data)
        if 'damage' not in data or not data['damage']:
            self.damage = {"0": datetime.utcnow()}
        if 'stats' not in data or not data['stats']:
            self.stats = []

    class Config:
        schema_extra = {
            "example": {
               
                "team_blue": {
                    "squad_1": {
                    "soldiers": [
                        {
                        "soldier_id": "1",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_2": {
                    "soldiers": [
                        {
                        "soldier_id": "2",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    },
                    "squad_3": {
                    "soldiers": [
                        {
                        "soldier_id": "3",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_4": {
                    "soldiers": [
                        {
                        "soldier_id": "4",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                    },
                    "squad_5": {
                    "soldiers": [
                        {
                        "soldier_id": "5",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_6": {
                    "soldiers": [
                        {
                        "soldier_id": "6",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    }
                },
                "team_red": {
                    "squad_1": {
                    "soldiers": [
                        {
                        "soldier_id": "7",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_2": {
                    "soldiers": [
                        {
                        "soldier_id": "8",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                    },
                    "squad_3": {
                    "soldiers": [
                        {
                        "soldier_id": "9",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Assault",
                        "equipment": "Radio"
                        }
                    ]
                    },
                    "squad_4": {
                    "soldiers": [
                        {
                        "soldier_id": "10",
                        "weapon_id": "1",
                        "vest_id": "1",
                        "role": "Sniper",
                        "equipment": "Medical_Kit"
                        }
                    ]
                    },
                    "squad_5": {
                    "soldiers": [
                        {
                        "soldier_id": "11",
                        "weapon_id": "2",
                        "vest_id": "2",
                        "role": "Medic",
                        "equipment": "Communication"
                        }
                    ]
                    },
                    "squad_6": {
                    "soldiers": [
                        {
                        "soldier_id": "12",
                        "weapon_id": "3",
                        "vest_id": "3",
                        "role": "Engineer",
                        "equipment": "Miscellaneous"
                        }
                    ]
                }
            }
            
            }
        }


class TeamStats(BaseModel):
    total_killed: int = 0
    bullets_fired: int = 0
    timestamp: datetime

class TeamStatsEvent(BaseModel):
    team_red: TeamStats
    team_blue: TeamStats


class KillEvent(BaseModel):
    attacker_id: str
    attacker_call_sign: str
    victim_id: str
    victim_call_sign: str
    distance_to_victim: float
    timestamp: str  # Use ISO format for timestamps


# Model for the session document
class SessionBase(BaseModel):
    session_id: str  # Given by the client
    start_time: datetime  # Time when the session is created
    end_time: Optional[datetime] = None  # Time when the session ends
    participated_soldiers: List[SoldierInSession]  # List of soldiers in the session
    events: Optional[List[KillEvent]] = []  # Logs of events like who killed whom, with timestamps
    team_stats_history: Optional[List[TeamStatsEvent]] = []
    received_data: Optional[Dict[str, Any]] = None # To store allocation_data received from the frontend

# Model for creating a session
class SessionCreate(BaseModel):
    pass

# Model for session in MongoDB (includes _id)
class SessionInDB(SessionBase):
    mongo_id: Optional[ObjectId] = Field(alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True
