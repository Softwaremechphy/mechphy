from motor.motor_asyncio import AsyncIOMotorClient
from configs.config import settings
from bson import ObjectId
from backend_logic.pydantic_responses_out import soldier_pydantic
from datetime import datetime

# Initialize MongoDB client and database
client = AsyncIOMotorClient(settings.MONGODB_URI)
db_out = client[settings.DB_out]
db_in = client[settings.DB_in]
db_real = client[settings.DB_real]
geo_collection = db_out[settings.GEO_COLLECTION]
soldier_collection = db_out[settings.SOLDIER_COLLECTION]
weapons_collection = db_out[settings.WEAPONS_COLLECTION]
vests_collection = db_out[settings.VEST_COLLECTION]
explosives_collection = db_out[settings.EXPLOSIVE_COLLECTION]
vehicle_collection = db_out[settings.VEHICLE_COLLECTION]
incoming_soldiers_collection = db_real[settings.INCOMING_SOLDIER_COLLECTION]

# Function to access database anywhere
async def get_db_out():
    return db_out

async def get_db_in():
    return db_in

async def get_db_real():
    return db_real

# Function to store geographic data (such as soldier positions)
async def insert_geo_data(data: dict):
    try:
        await geo_collection.insert_one(data)
    except Exception as e:
        print(f"Error inserting geo data: {e}")

# Function to retrieve latest soldier positions for a session
async def get_latest_soldier_positions(session_id: str):
    try:
        cursor = geo_collection.find({'session_id': session_id}).sort('timestamp', -1).limit(100)
        return await cursor.to_list(length=100)
    except Exception as e:
        print(f"Error fetching soldier positions: {e}")
        return []


# Function to store soldier data
async def store_to_mongo(data: dict):
    try:
        result = await incoming_soldiers_collection.insert_one(data)
        # Convert MongoDB ObjectId to string
        data['_id'] = str(result.inserted_id)
    except Exception as e:
        print(f"Error inserting soldier data: {e}")
        
        
        
# Function to find soldier data from db_out via id
# Function to find soldier data from db_out via id and handle None type objects
# Modified function with debug statements
async def get_soldier_data_from_db(soldier_id: int):
    try:
        # Convert soldier_id to string explicitly (if not already)
        soldier_id_str = str(soldier_id)
        
        # Debugging line to check the value of soldier_id_str
        print(f"Querying for soldier_id: {soldier_id_str}")  
        
        # Fetch soldier data from the MongoDB collection using the soldier_id
        soldier_data = await soldier_collection.find_one({"soldier_id": soldier_id_str})
        print(f"MongoDB query result: {soldier_data}")  # <-- Add this
        
        if soldier_data:
            # Debugging line to show the data returned from MongoDB
            print(f"Soldier found: {soldier_data}")  
            
            # Convert the MongoDB ObjectId to string for better JSON compatibility
            soldier_data['_id'] = str(soldier_data['_id'])
            
            # Handle 'stats' field if it exists, otherwise set it to None
            stats = soldier_data.get('stats', None)
            
            if stats:
                # Initialize the stats using Pydantic model SoldierStats
                soldier_stats = soldier_pydantic.SoldierStats(**stats)
            else:
                soldier_stats = None

            # Prepare the response data to match the expected format
            response_data = {
                "soldier": soldier_pydantic.SoldierBase(**soldier_data),  # Assuming soldier fields match SoldierBase model
                "stats": soldier_stats
            }
            
            # Return the prepared response data
            return response_data
        
        else:
            # If no soldier is found, print a message
            print(f"No soldier found with soldier_id: {soldier_id_str}")
            return {"soldier": None, "stats": None}

    except Exception as e:
        # Print any errors encountered during the process
        print(f"Error fetching soldier data: {e}")
        return None


async def get_soldier_data_from_latest_session(soldier_id: str):
    
    # Convert soldier_id to string explicitly
    soldier_id_str = str(soldier_id).strip()  
    
    # Get the latest session sorted by start_time
    latest_session = await db_in["sessions"].find_one(
        sort=[("start_time", -1)]
    )
    
    if latest_session:
        # Search for the soldier in the latest session
        for soldier in latest_session["participated_soldiers"]:
            if soldier["soldier_id"] == soldier_id_str:
                return soldier
    return None



# Function to update soldier damage with a dictionary
async def update_soldier_damage(soldier_id: int, damage: int):
    try:
        soldier_id_str = str(soldier_id)

        # Get the latest session sorted by start_time
        latest_session = await db_in["sessions"].find_one(
            sort=[("start_time", -1)]
        )

        if latest_session:
            # Search for the soldier in the latest session
            for soldier in latest_session["participated_soldiers"]:
                if soldier["soldier_id"] == soldier_id_str:
                    # Initialize damage if not present
                    if 'damage' not in soldier:
                        soldier['damage'] = {"0": datetime.utcnow().isoformat()}
                    
                    # Update the damage based on the hit
                    if damage == 50 and "50" not in soldier['damage']:
                        soldier['damage']["50"] = datetime.utcnow().isoformat()
                    elif damage == 100 and "100" not in soldier['damage']:
                        soldier['damage']["100"] = datetime.utcnow().isoformat()

                    # Save the updated soldier data back to the session in the database
                    await db_in["sessions"].update_one(
                        {"_id": latest_session["_id"], "participated_soldiers.soldier_id": soldier_id_str},
                        {"$set": {"participated_soldiers.$": soldier}}
                    )
                    print(f"Updated damage for soldier {soldier_id_str} to {damage}%")
                    return soldier

        return None

    except Exception as e:
        print(f"Error updating soldier damage: {e}")
        return None


# Function to update soldier's death in the latest session (archival environment)
async def update_soldier_death(soldier_id: int):
    try:
        soldier_id_str = str(soldier_id)

        # Get the latest session sorted by start_time
        latest_session = await db_in["sessions"].find_one(
            sort=[("start_time", -1)]
        )

        if latest_session:
            # Search for the soldier in the latest session
            for soldier in latest_session["participated_soldiers"]:
                if soldier["soldier_id"] == soldier_id_str:
                    # Update the soldier's death status
                    soldier['died'] = datetime.utcnow().isoformat()

                    # Save the updated soldier data back to the session in the database
                    await db_in["sessions"].update_one(
                        {"_id": latest_session["_id"], "participated_soldiers.soldier_id": soldier_id_str},
                        {"$set": {"participated_soldiers.$": soldier}}
                    )
                    print(f"Marked soldier {soldier_id_str} as killed")
                    return soldier

        return None

    except Exception as e:
        print(f"Error updating soldier death: {e}")
        return None
