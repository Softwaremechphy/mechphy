from motor.motor_asyncio import AsyncIOMotorClient
from configs.config import settings

client = AsyncIOMotorClient(settings.MONGODB_URI)
db_in = client[settings.DB_in]

from geopy.distance import geodesic

async def calculate_distance_between_soldiers(attack_id, vict_id):
    
    # Converting parameters to string if they are not
    attacker_id = str(attack_id)
    victim_id = str(vict_id)
    
    # Get the latest session
    latest_session = await db_in["sessions"].find_one(sort=[("start_time", -1)])
    
    if not latest_session:
        return None

    attacker_location, victim_location = None, None

   # Print attacker and victim IDs for debugging
    print(f"Attacker ID: {attacker_id}, Victim ID: {victim_id}")

    # Print only the IDs of participated soldiers for debugging
    participated_ids = [soldier["soldier_id"] for soldier in latest_session["participated_soldiers"]]
    print("Participated Soldiers IDs:", participated_ids)


    # Retrieve attacker and victim location from the latest session
    for soldier in latest_session["participated_soldiers"]:
        print(f"Checking soldier: {soldier['soldier_id']}")
        if soldier["soldier_id"] == attacker_id:
            if soldier["location"]:
                attacker_location = (float(soldier["location"][-1]["latitude"]), float(soldier["location"][-1]["longitude"]))
                print(f"Found attacker location: {attacker_location}")
        elif soldier["soldier_id"] == victim_id:
            if soldier["location"]:
                victim_location = (float(soldier["location"][-1]["latitude"]), float(soldier["location"][-1]["longitude"]))
                print(f"Found victim location: {victim_location}")

        # Exit loop if both locations are found
        if attacker_location and victim_location:
            break

    # Log the attacker and victim locations
    print(f"Final Attacker location: {attacker_location}, Final Victim location: {victim_location}")

    # Check if both locations are available
    if attacker_location and victim_location:
        calculated_distance = geodesic(attacker_location, victim_location).meters
        return calculated_distance
    else:
        return None

