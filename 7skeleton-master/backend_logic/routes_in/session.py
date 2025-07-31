#     #backend_logic/routes_in/session.py

# backend_logic/routes_in/session.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

from backend_logic.pydantic_responses_in import sessions_pydantic
from db.mongodb_handler import get_db_in, get_db_out
from configs.config import settings

router = APIRouter(
    prefix="/api/sessions",
    tags=["sessions_inside_monitoring"]
)

# ─────────────────────────────── ENUM LOOK-UPS ──────────────────────────────
@router.get("/enum/roles", response_model=List[str])
async def get_roles() -> List[str]:
    """Return all allowed role values."""
    return [role.value for role in sessions_pydantic.RoleEnum]


@router.get("/enum/equipments", response_model=List[str])
async def get_equipment() -> List[str]:
    """Return all allowed equipment values."""
    return [equip.value for equip in sessions_pydantic.EquipmentEnum]

# ───────────────────────────── SESSION CREATE ───────────────────────────────
@router.post("/", response_model=sessions_pydantic.SessionBase,
             status_code=status.HTTP_201_CREATED)
async def create_session(db: AsyncIOMotorDatabase = Depends(get_db_in)):
    """
    Create a new session, auto-incrementing session_id and resetting
    in-memory bullet counters.
    """
    # Find the latest session to determine next ID
    latest_session = await db.sessions.find_one(sort=[("start_time", -1)])
    next_id = str(int(latest_session["session_id"]) + 1) if latest_session else "1"

    session_data = {
        "session_id": next_id,
        "start_time": datetime.utcnow(),
        "participated_soldiers": [],
        "events": []
    }
    result = await db.sessions.insert_one(session_data)

    # RESET bullet counters (borrowed from Code 2)
    from backend_logic.backendConnection.faust_app_v1 import app
    app.bullet_counts = {"team_red": 0, "team_blue": 0}

    return sessions_pydantic.SessionInDB(**session_data, mongo_id=result.inserted_id)

# ─────────────────────────── RESOURCE ALLOCATION ────────────────────────────
@router.put("/{session_id}/allocate",
            response_model=sessions_pydantic.SessionBase,
            status_code=status.HTTP_200_OK)
async def allocate_resources(
    session_id: str,
    allocation_data: sessions_pydantic.ResourceAllocation,
    db: AsyncIOMotorDatabase = Depends(get_db_in),
    db_out: AsyncIOMotorDatabase = Depends(get_db_out)
):
    """
    Add soldiers to a session, assigning *both* external soldier_id and an
    internal sequential session_soldier_id (skip 69).
    """
    session = await db.sessions.find_one({"session_id": session_id})
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # ── flatten soldiers so we can assign sequential IDs ──
    flattened = []  # (team_identifier, squad_name, soldier_dict)
    for team_name, team in allocation_data.dict().items():
        team_id = team_name.split("_")[1]  # 'blue' or 'red'
        for squad_name, squad in team.items():
            for soldier in squad["soldiers"]:
                flattened.append((team_id, squad_name, soldier))

    total = len(flattened)
    seq = 1
    session["participated_soldiers"] = []

    for idx, (team_id, squad_name, soldier) in enumerate(flattened):
        if seq == 69:
            seq += 1               # skip unlucky 69
        session_soldier_id = 70 if (idx == total - 1 and total == 69) else seq

        soldier_id = soldier["soldier_id"]

        # ── look up refs in OUT DB ──
        soldier_doc = await db_out[settings.SOLDIER_COLLECTION].find_one({"soldier_id": soldier_id})
        if not soldier_doc:
            raise HTTPException(status_code=404, detail=f"Soldier {soldier_id} not found")
        call_sign = soldier_doc.get("call_sign", "Unknown")

        # validate weapon, vest
        if not await db_out[settings.WEAPONS_COLLECTION].find_one({"weapon_id": soldier["weapon_id"]}):
            raise HTTPException(status_code=400, detail=f"Weapon {soldier['weapon_id']} not found")
        if not await db_out[settings.VEST_COLLECTION].find_one({"vest_id": soldier["vest_id"]}):
            raise HTTPException(status_code=400, detail=f"Vest {soldier['vest_id']} not found")

        # validate enums (case-insensitive)
        role_key = soldier["role"].strip().lower()
        equip_key = soldier["equipment"].strip().lower()
        if role_key not in {r.lower(): r for r in sessions_pydantic.RoleEnum.__members__}:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role_key}")
        if equip_key not in {e.lower(): e for e in sessions_pydantic.EquipmentEnum.__members__}:
            raise HTTPException(status_code=400, detail=f"Invalid equipment: {equip_key}")

        # build soldier entry
        soldier_entry = sessions_pydantic.SoldierInSession(
            session_soldier_id=session_soldier_id,
            soldier_id=soldier_id,
            call_sign=call_sign,
            weapon_id=soldier["weapon_id"],
            vest_id=soldier["vest_id"],
            role=role_key,
            equipment=equip_key,
            team=team_id,
            squad=int(squad_name.split("_")[1]),
            location=[],
            orientation=[],
            event_data=[],
            died=None
        )
        session["participated_soldiers"].append(soldier_entry.dict())
        seq += 1

    session["received_data"] = allocation_data.dict()
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "participated_soldiers": session["participated_soldiers"],
            "received_data": session["received_data"]
        }}
    )
    updated = await db.sessions.find_one({"session_id": session_id})
    return sessions_pydantic.SessionInDB(**updated)

# ──────────────────────────── SET MAP NAME ──────────────────────────────────
@router.put("/{session_id}/map-name",
            response_model=sessions_pydantic.SessionBase)
async def update_map_name(
    session_id: str,
    map_name: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    """Attach or change the map_name for a session."""
    if not (session := await db.sessions.find_one({"session_id": session_id})):
        raise HTTPException(status_code=404, detail="Session not found")

    await db.sessions.update_one({"session_id": session_id},
                                 {"$set": {"map_name": map_name}})
    updated = await db.sessions.find_one({"session_id": session_id})
    return sessions_pydantic.SessionInDB(**updated)

# ───────────────────── remaining helper endpoints (unchanged) ───────────────
# … get_received_data, get_latest_soldier_stat, get_start_end_time, delete_session …






















# from fastapi import APIRouter, Depends, HTTPException, status
# from typing import List
# from motor.motor_asyncio import AsyncIOMotorDatabase
# from datetime import datetime
# from backend_logic.pydantic_responses_in import sessions_pydantic  # Assume this file contains your pydantic models
# from db.mongodb_handler import get_db_in, get_db_out
# from configs.config import settings
# from typing import Optional

# router = APIRouter(
#     prefix="/api/sessions",
#     tags = ["sessions_inside_monitoring"]
# )

# # Get all roles 
# @router.get("/enum/roles", response_model=List[str])
# async def get_roles():
#     """
#     Fetch all roles from the hardcoded RoleEnum.
#     """
#     return [role.value for role in sessions_pydantic.RoleEnum]

# # Get all equipments
# @router.get("/enum/equipments", response_model=List[str])
# async def get_equipment():
#     """
#     Fetch all equipment from the hardcoded EquipmentEnum.
#     """
#     return [equipment.value for equipment in sessions_pydantic.EquipmentEnum]


# Creation of session in the database
# @router.post("/", response_model=sessions_pydantic.SessionBase, status_code=status.HTTP_201_CREATED)
# async def create_session(db: AsyncIOMotorDatabase = Depends(get_db_in)):
    
#     # Find the latest added session document based on session_id
#     latest_session = await db.sessions.find_one(
#         sort=[("start_time", -1)]  # Sort by session_id in descending order
#     )
    
#     # Determine the new session ID
#     if latest_session and "session_id" in latest_session:
#         new_session_id = str(int(latest_session["session_id"]) + 1)
#     else:
#         new_session_id = "1"  # If no sessions exist, start with ID "1"

#     # Create the session data
#     session_data = {
#         "session_id": new_session_id,
#         "start_time": datetime.utcnow(),
#         "participated_soldiers": [],  # Initially empty, filled during resource allocation
#         "events": []
#     }

#     # Insert the new session into the database
#     result = await db.sessions.insert_one(session_data)

#     # Reset bullet counts for the new session
#     from backend_logic.backendConnection.faust_app_v1 import app  # Import your Faust app instance if needed
#     app.bullet_counts = {"team_red": 0, "team_blue": 0}
    
#     # Return the created session
#     return sessions_pydantic.SessionInDB(**session_data, mongo_id=result.inserted_id)



# # Resource allocation
# @router.put("/{session_id}/allocate", response_model=sessions_pydantic.SessionBase, status_code=status.HTTP_200_OK)
# async def allocate_resources(
#     session_id: str, 
#     allocation_data: sessions_pydantic.ResourceAllocation,  # Use the new Pydantic model here
#     db: AsyncIOMotorDatabase = Depends(get_db_in),
#     db_out: AsyncIOMotorDatabase = Depends(get_db_out)
# ):
#     # Retrieve the session
#     session = await db.sessions.find_one({"session_id": session_id})
#     if session is None:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

#     # Parse team/squad/soldier data from the frontend
#     for team_name, team in allocation_data.dict().items():  
#         team_identifier = team_name.split('_')[1]  # This will give 'blue' or 'red'

#         for squad_name, squad in team.items():
#             for soldier in squad['soldiers']:
#                 soldier_id = soldier["soldier_id"]

#                 soldier_collection = db_out[settings.SOLDIER_COLLECTION]
#                 weapons_collection = db_out[settings.WEAPONS_COLLECTION]
#                 vests_collection = db_out[settings.VEST_COLLECTION]

#                 # Fetch the call_sign from db_out using soldier_id
#                 soldier_data_from_out = await soldier_collection.find_one({"soldier_id": soldier_id})
#                 if not soldier_data_from_out:
#                     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Soldier with ID {soldier_id} not found")

#                 call_sign = soldier_data_from_out.get("call_sign", "Unknown")

#                 # Validate weapon_id and vest_id
#                 weapon_id = soldier["weapon_id"]
#                 vest_id = soldier["vest_id"]

#                 # Check if the weapon_id exists in db_out
#                 weapon_exists = await weapons_collection.find_one({"weapon_id": weapon_id})
#                 if not weapon_exists:
#                     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Weapon with ID {weapon_id} not found")

#                 # Check if the vest_id exists in db_out
#                 vest_exists = await vests_collection.find_one({"vest_id": vest_id})
#                 if not vest_exists:
#                     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Vest with ID {vest_id} not found")

#                 # Ensure role and equipment values are valid
#                 try:
#                     role = soldier["role"].strip().lower()  # Normalize to lowercase
#                     equipment = soldier["equipment"].strip().lower()  # Normalize to lowercase
#                 except KeyError as e:
#                     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing field: {str(e)}")

#                 # Ensure role is valid (case-insensitive check)
#                 valid_roles = {role.lower(): role for role in sessions_pydantic.RoleEnum.__members__}  # Create a case-insensitive mapping
#                 if role not in valid_roles:
#                     raise HTTPException(
#                         status_code=status.HTTP_400_BAD_REQUEST,
#                         detail=f"Invalid role: {role}. Must be one of {list(valid_roles.keys())}."
#                     )
#                 normalized_role = valid_roles[role]  # Use the normalized valid role

#                 # Ensure equipment is valid (case-insensitive check)
#                 valid_equipments = {equipment.lower(): equipment for equipment in sessions_pydantic.EquipmentEnum.__members__}
#                 if equipment not in valid_equipments:
#                     raise HTTPException(
#                         status_code=status.HTTP_400_BAD_REQUEST,
#                         detail=f"Invalid equipment: {equipment}. Must be one of {list(valid_equipments.keys())}."
#                     )
#                 normalized_equipment = valid_equipments[equipment]  # Use the normalized valid equipment

#                 # Create soldier data with the fetched call_sign
#                 soldier_data = sessions_pydantic.SoldierInSession(
#                     soldier_id=soldier_id,
#                     call_sign=call_sign,  # Use fetched call_sign
#                     weapon_id=weapon_id,
#                     vest_id=vest_id,
#                     role=normalized_role,
#                     equipment=normalized_equipment,
#                     team=team_identifier,  # Include team name
#                     squad=int(squad_name.split("_")[1]),  # Parse squad number from squad name (e.g., squad_1 -> 1)
#                     location=[],
#                     orientation=[],
#                     event_data=[],
#                     died=None
#                 )
#                 # Add the soldier to the session's participated_soldiers list
#                 session["participated_soldiers"].append(soldier_data.dict())

#     # Add received_data to the session
#     session["received_data"] = allocation_data.dict()

#     # Update the session in the database
#     await db.sessions.update_one(
#         {"session_id": session_id},
#         {"$set": {"participated_soldiers": session["participated_soldiers"], "received_data": session["received_data"]}}
#     )

#     # Retrieve the updated session and return it
#     updated_session = await db.sessions.find_one({"session_id": session_id})
#     return sessions_pydantic.SessionInDB(**updated_session)




# Access received_data from forntend
@router.get("/{session_id}/received-data")
async def get_received_data(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db_in)):
    """
    Endpoint to fetch the received_data for a given session.

    Args:
        session_id (str): The session ID to fetch received_data for.

    Returns:
        dict: The received_data stored for the session.
    
    Raises:
        HTTPException: If session is not found or another error occurs.
    """
    try:
        # Fetch the session document
        session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0, "received_data": 1})
        
        if not session:
            raise HTTPException(
                status_code=404, 
                detail=f"Session with ID {session_id} not found."
            )
        
        # Extract and return received_data
        return session.get("received_data", {})
    
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {str(e)}"
        )



# Fetch latest stat of a soldier in a particular session
@router.get("/{session_id}/soldiers/{soldier_id}/latest_stats", response_model=dict)
async def get_latest_soldier_stat(
    session_id: str,
    soldier_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    # Retrieve the session
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Find the soldier within the session's participated soldiers
    soldier_data = next((s for s in session["participated_soldiers"] if s["soldier_id"] == soldier_id), None)
    if not soldier_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soldier not found in session")

    # Check if the soldier has any stats data
    if not soldier_data.get("stats"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No stats available for this soldier")

    # Retrieve the latest stats entry
    latest_stat = soldier_data["stats"][-1]  # Assuming stats are appended chronologically

    return {"latest_stat": latest_stat}

 

# Fetch start and end time of a session
@router.get("/{session_id}/start_end_time")
async def get_start_end_time(session_id: str, db:AsyncIOMotorDatabase = Depends(get_db_in)):
    """
    Fetch the start and end time of a session by comparing the earliest and latest
    location timestamps of all participated soldiers.

    Args:
        session_id (str): The session ID to fetch start and end time for.

    Returns:
        dict: A dictionary containing the earliest and latest timestamps.

    Raises:
        HTTPException: If session is not found or no location data is available.
    """
    
    # Fetch the session document
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0, "participated_soldiers": 1})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session with ID {session_id} not found")

    participated_soldiers = session.get("participated_soldiers", [])
    if not participated_soldiers:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No participated soldiers found in session")

    earliest_time: Optional[str] = None
    latest_time: Optional[str] = None

    # Iterate through each soldier's location data to find the earliest and latest timestamps 
    # It is optimizable as i dont think it is needed to iterate evey soldier location as first will be earliest and last will be max(time)
    for soldier in participated_soldiers:
        locations = soldier.get("location", [])
        if not locations:
            continue

        # Extract timestamps from location objects
        timestamps = [location.get("timestamp") for location in locations if "timestamp" in location]

        if not timestamps:
            continue

        # Find the earliest and latest timestamps for the current soldier
        soldier_earliest = min(timestamps)
        soldier_latest = max(timestamps)

        # Update the overall earliest and latest timestamps
        if earliest_time is None or soldier_earliest < earliest_time:
            earliest_time = soldier_earliest

        if latest_time is None or soldier_latest > latest_time:
            latest_time = soldier_latest

    if not earliest_time or not latest_time:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No valid location timestamps found for soldiers")

    return {
        "start_time": earliest_time,
        "end_time": latest_time
    }




# Return a list of all sessions with session_id, start_time, and the earliest/latest location timestamps.
@router.get("/all_sessions", response_model=List[dict])
async def get_all_sessions(db: AsyncIOMotorDatabase = Depends(get_db_in)):
    """
    Return a list of all sessions with session_id, start_time, and end_time.
    
    This function loops through each session and each soldier's location data to find the true earliest and latest
    timestamps, rather than assuming the data is ordered. This is necessary because, even if you intend to store
    location data in chronological order, there is no guarantee that the array remains sorted due to possible
    out-of-order ingestion, manual updates, or bugs. Using min() and max() ensures correctness regardless of order.
    """
    sessions_cursor = db.sessions.find({}, {"_id": 0, "session_id": 1, "start_time": 1, "end_time": 1, "participated_soldiers": 1})
    sessions = []
    async for session in sessions_cursor:
        # Find earliest and latest timestamps from all soldiers' location data
        earliest_time = None
        latest_time = None
        for soldier in session.get("participated_soldiers", []):
            locations = soldier.get("location", [])
            timestamps = [loc.get("timestamp") for loc in locations if "timestamp" in loc]
            if timestamps:
                soldier_earliest = min(timestamps)
                soldier_latest = max(timestamps)
                if earliest_time is None or soldier_earliest < earliest_time:
                    earliest_time = soldier_earliest
                if latest_time is None or soldier_latest > latest_time:
                    latest_time = soldier_latest
        sessions.append({
            "session_id": session.get("session_id"),
            "start_time": session.get("start_time"),
            "end_time": session.get("end_time"),
            "earliest_location_time": earliest_time,
            "latest_location_time": latest_time
        })
    return sessions





from fastapi import BackgroundTasks
@router.post("/start", status_code=200)
async def start_realtime_monitoring(
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    """
    Start real-time monitoring for the latest session (by start_time).
    """
    # Fetch the latest session by start_time
    latest_session = await db.sessions.find_one(sort=[("start_time", -1)])
    if not latest_session:
        raise HTTPException(status_code=404, detail="No session found")

    session_id = latest_session["session_id"]

    # Start real-time services (see main.py changes below)
    from main import start_realtime_services
    background_tasks.add_task(start_realtime_services, session_id)

    return {"detail": "Real-time monitoring started", "session_id": session_id}


# @router.post("/{session_id}/start", status_code=200)
# async def start_realtime_monitoring(
#     session_id: str,
#     background_tasks: BackgroundTasks,
#     db: AsyncIOMotorDatabase = Depends(get_db_in)
# ):
#     """
#     Start real-time monitoring for a session.
#     """
#     session = await db.sessions.find_one({"session_id": session_id})
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")

#     # Start real-time services (see main.py changes below)
#     from main import start_realtime_services
#     background_tasks.add_task(start_realtime_services, session_id)

#     return {"detail": "Real-time monitoring started", "session_id": session_id}



# Cumulate session stats into outside monitoring stats when session ends
# (To be added inside the /end endpoint after marking session as ended)
# For each soldier in the session, fetch their latest session stats and
# add (cumulate) them to their persistent stats in the outside monitoring DB.
# This ensures that after every session, the overall stats for each soldier
# (such as kill_count, bullets_fired, sessions_participated, etc.)
# are updated and reflect all sessions played.
@router.put("/{session_id}/end", status_code=status.HTTP_200_OK)
async def mark_session_end_and_cumulate_stats(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in),
    db_out: AsyncIOMotorDatabase = Depends(get_db_out)
):
    """
    Mark the session as ended and cumulate session stats into outside monitoring stats.
    """
    end_time = datetime.utcnow()
    result = await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"end_time": end_time}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found or not updated")

    # Fetch session data
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Cumulate stats for each soldier
    try:
        for soldier in session.get("participated_soldiers", []):
            soldier_id = soldier["soldier_id"]
            stats_list = soldier.get("stats", [])
            if not stats_list:
                continue
            latest_stat = stats_list[-1]  # Get latest stats

            # Fetch outside soldier record
            outside_soldier = await db_out[settings.SOLDIER_COLLECTION].find_one({"soldier_id": soldier_id})
            if not outside_soldier:
                continue

            # Cumulate stats
            outside_stats = outside_soldier.get("stats") or {}
            outside_kills = outside_stats.get("kill_count", 0)
            outside_sessions = outside_stats.get("sessions_participated", [])
            outside_bullets = outside_stats.get("stats_data", {}).get("bullets_fired", 0)

            # Update stats
            new_kills = outside_kills + latest_stat.get("kill_count", 0)
            new_bullets = outside_bullets + latest_stat.get("bullets_fired", 0)
            new_sessions = list(set(outside_sessions + [session_id]))

            new_stats = {
                "kill_count": new_kills,
                "sessions_participated": new_sessions,
                "stats_data": {"bullets_fired": new_bullets}
            }

            await db_out[settings.SOLDIER_COLLECTION].update_one(
                {"soldier_id": soldier_id},
                {"$set": {"stats": new_stats}}
            )
    except Exception as e:
        print(f"Error cumulating stats for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error cumulating stats: {e}")

    # Stop real-time services (see main.py changes below)
    from main import stop_realtime_services
    await stop_realtime_services()

    return {"session_id": session_id, "end_time": end_time, "realtime_stopped": True}



@router.get("/{session_id}/team_squad_soldiers", response_model=dict)
async def get_team_squad_soldiers(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    """
    Returns team-wise and squad-wise soldiers for a session,
    including soldier_id, session_soldier_id, and call_sign.
    """
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0, "participated_soldiers": 1})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = {"team_red": {}, "team_blue": {}}
    for soldier in session.get("participated_soldiers", []):
        team = f"team_{soldier.get('team', '').lower()}"
        squad = f"squad_{soldier.get('squad')}"
        entry = {
            "soldier_id": soldier.get("soldier_id"),
            "session_soldier_id": soldier.get("session_soldier_id"),
            "call_sign": soldier.get("call_sign"),
        }
        if team not in result:
            result[team] = {}
        if squad not in result[team]:
            result[team][squad] = []
        result[team][squad].append(entry)
    return result



@router.get("/{session_id}/latest_team_stats", response_model=dict)
async def get_latest_team_stats(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    """
    Fetch the latest team stats for a session from team_stats_history.
    """
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0, "team_stats_history": 1})
    if not session or "team_stats_history" not in session or not session["team_stats_history"]:
        raise HTTPException(status_code=404, detail="No team stats found for this session")

    latest_stats = session["team_stats_history"][-1]  # Get the last entry (latest)
    return {"latest_team_stats": latest_stats}


# Deleting a session by session_id 
@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db_in)
):
    """
    Delete a session and all its embedded data by session_id.
    """
    # Debug: Print the session_id being deleted
    print(f"Deleting session with ID: {session_id}")

    # Check if the session exists
    session = await db.sessions.find_one({"session_id": session_id})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Delete the session document (removes everything inside it)
    delete_result = await db.sessions.delete_one({"session_id": session_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Success: No content to return
    return {"detail": "Session deleted successfully"}