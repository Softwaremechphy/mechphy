    #backend_logic/routes_in/session.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from backend_logic.pydantic_responses_in import sessions_pydantic  # Assume this file contains your pydantic models
from db.mongodb_handler import get_db_in, get_db_out
from configs.config import settings
from typing import Optional

router = APIRouter(
    prefix="/api/sessions",
    tags = ["sessions_inside_monitoring"]
)

# Get all roles 
@router.get("/enum/roles", response_model=List[str])
async def get_roles():
    """
    Fetch all roles from the hardcoded RoleEnum.
    """
    return [role.value for role in sessions_pydantic.RoleEnum]

# Get all equipments
@router.get("/enum/equipments", response_model=List[str])
async def get_equipment():
    """
    Fetch all equipment from the hardcoded EquipmentEnum.
    """
    return [equipment.value for equipment in sessions_pydantic.EquipmentEnum]


# Creation of session in the database
@router.post("/", response_model=sessions_pydantic.SessionBase, status_code=status.HTTP_201_CREATED)
async def create_session(db: AsyncIOMotorDatabase = Depends(get_db_in)):
    
    # Find the latest added session document based on session_id
    latest_session = await db.sessions.find_one(
        sort=[("start_time", -1)]  # Sort by session_id in descending order
    )
    
    # Determine the new session ID
    if latest_session and "session_id" in latest_session:
        new_session_id = str(int(latest_session["session_id"]) + 1)
    else:
        new_session_id = "1"  # If no sessions exist, start with ID "1"

    # Create the session data
    session_data = {
        "session_id": new_session_id,
        "start_time": datetime.utcnow(),
        "participated_soldiers": [],  # Initially empty, filled during resource allocation
        "events": []
    }

    # Insert the new session into the database
    result = await db.sessions.insert_one(session_data)

    # Return the created session
    return sessions_pydantic.SessionInDB(**session_data, mongo_id=result.inserted_id)



# Resource allocation
@router.put("/{session_id}/allocate", response_model=sessions_pydantic.SessionBase, status_code=status.HTTP_200_OK)
async def allocate_resources(
    session_id: str, 
    allocation_data: sessions_pydantic.ResourceAllocation,  # Use the new Pydantic model here
    db: AsyncIOMotorDatabase = Depends(get_db_in),
    db_out: AsyncIOMotorDatabase = Depends(get_db_out)
):
    # Retrieve the session
    session = await db.sessions.find_one({"session_id": session_id})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Parse team/squad/soldier data from the frontend
    for team_name, team in allocation_data.dict().items():  
        team_identifier = team_name.split('_')[1]  # This will give 'blue' or 'red'

        for squad_name, squad in team.items():
            for soldier in squad['soldiers']:
                soldier_id = soldier["soldier_id"]

                soldier_collection = db_out[settings.SOLDIER_COLLECTION]
                weapons_collection = db_out[settings.WEAPONS_COLLECTION]
                vests_collection = db_out[settings.VEST_COLLECTION]

                # Fetch the call_sign from db_out using soldier_id
                soldier_data_from_out = await soldier_collection.find_one({"soldier_id": soldier_id})
                if not soldier_data_from_out:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Soldier with ID {soldier_id} not found")

                call_sign = soldier_data_from_out.get("call_sign", "Unknown")

                # Validate weapon_id and vest_id
                weapon_id = soldier["weapon_id"]
                vest_id = soldier["vest_id"]

                # Check if the weapon_id exists in db_out
                weapon_exists = await weapons_collection.find_one({"weapon_id": weapon_id})
                if not weapon_exists:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Weapon with ID {weapon_id} not found")

                # Check if the vest_id exists in db_out
                vest_exists = await vests_collection.find_one({"vest_id": vest_id})
                if not vest_exists:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Vest with ID {vest_id} not found")

                # Ensure role and equipment values are valid
                try:
                    role = soldier["role"].strip().lower()  # Normalize to lowercase
                    equipment = soldier["equipment"].strip().lower()  # Normalize to lowercase
                except KeyError as e:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing field: {str(e)}")

                # Ensure role is valid (case-insensitive check)
                valid_roles = {role.lower(): role for role in sessions_pydantic.RoleEnum.__members__}  # Create a case-insensitive mapping
                if role not in valid_roles:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid role: {role}. Must be one of {list(valid_roles.keys())}."
                    )
                normalized_role = valid_roles[role]  # Use the normalized valid role

                # Ensure equipment is valid (case-insensitive check)
                valid_equipments = {equipment.lower(): equipment for equipment in sessions_pydantic.EquipmentEnum.__members__}
                if equipment not in valid_equipments:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid equipment: {equipment}. Must be one of {list(valid_equipments.keys())}."
                    )
                normalized_equipment = valid_equipments[equipment]  # Use the normalized valid equipment

                # Create soldier data with the fetched call_sign
                soldier_data = sessions_pydantic.SoldierInSession(
                    soldier_id=soldier_id,
                    call_sign=call_sign,  # Use fetched call_sign
                    weapon_id=weapon_id,
                    vest_id=vest_id,
                    role=normalized_role,
                    equipment=normalized_equipment,
                    team=team_identifier,  # Include team name
                    squad=int(squad_name.split("_")[1]),  # Parse squad number from squad name (e.g., squad_1 -> 1)
                    location=[],
                    orientation=[],
                    event_data=[],
                    died=None
                )
                # Add the soldier to the session's participated_soldiers list
                session["participated_soldiers"].append(soldier_data.dict())

    # Add received_data to the session
    session["received_data"] = allocation_data.dict()

    # Update the session in the database
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"participated_soldiers": session["participated_soldiers"], "received_data": session["received_data"]}}
    )

    # Retrieve the updated session and return it
    updated_session = await db.sessions.find_one({"session_id": session_id})
    return sessions_pydantic.SessionInDB(**updated_session)




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



# Deleting a session by session_id 
#----------------------------------------------CURRENTLY-------NOT---------WORKING---------FIX---------BUGG-----------------
@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db_in)):
    
    # Debugging - Print or log the session_id received
    print(f"Deleting session with ID: {session_id}")
    
    # Check if the session exists
    session = await db.sessions.find_one({"session_id": session_id})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Delete the session from the database
    delete_result = await db[settings.DB_in].sessions.delete_one({"session_id": session_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Return success message or no content (204)
    return {"detail": "Session deleted successfully"}