from fastapi import Body, Depends, Response, status, HTTPException, APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import List, Optional
from db.mongodb_handler import get_db_out
from backend_logic.pydantic_responses_out import vests_pydantic

router = APIRouter(
    prefix = "/api/vests",
    tags = ["vests_outside_monitoring"]
)

@router.get("/{vest_id}", status_code=status.HTTP_200_OK, response_model=vests_pydantic.VestResponse)
async def get_vest(vest_id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Query the database for the vest with the given vest_id
    vest = await db.vests.find_one({"vest_id": vest_id})

    if vest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vest not found")

    return vests_pydantic.VestResponse(vest=vest)

# Fetch all protection levels
@router.get("/", response_model=List[dict], status_code=status.HTTP_200_OK)
async def get_protection_levels(db: AsyncIOMotorDatabase = Depends(get_db_out)):
    vests = await db.vests.find({}, {"_id": 0, "vest_id": 1, "protection_level": 1, "count": 1}).to_list(length=100)
    return vests

# Choose an existing protection level
@router.post("/choose", response_model=vests_pydantic.VestResponse, status_code=status.HTTP_200_OK)
async def choose_protection_level(payload: vests_pydantic.VestCreate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Extract protection level from the payload
    protection_level = payload.protection_level

    # Find the vest with the given protection level
    vest = await db.vests.find_one({"protection_level": protection_level})
    if not vest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protection level not found")

    # Increment the count
    await db.vests.update_one({"protection_level": protection_level}, {"$inc": {"count": 1}})

    # Fetch updated vest
    updated_vest = await db.vests.find_one({"protection_level": protection_level})
    return vests_pydantic.VestResponse(vest=updated_vest)

# Create a new vest
@router.post("/create", response_model=vests_pydantic.VestResponse, status_code=status.HTTP_201_CREATED)
async def create_vest(vest: vests_pydantic.VestCreate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if protection level already exists
    existing_vest = await db.vests.find_one({"protection_level": vest.protection_level})
    if existing_vest:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Protection level already exists")

    # Generate vest ID based on the latest vest ID
    last_vest = await db.vests.find_one({}, sort=[("vest_id", -1)])
    last_vest_id = int(last_vest["vest_id"]) if last_vest else 0
    vest_id = str(last_vest_id + 1)

    # Prepare vest data
    vest_data = {
        "vest_id": vest_id,
        "protection_level": vest.protection_level,
        "count": 1
    }

    # Insert the new vest into the database
    result = await db.vests.insert_one(vest_data)

    return vests_pydantic.VestResponse(vest=vest_data)

@router.put("/{vest_id}", response_model=vests_pydantic.VestResponse, status_code=status.HTTP_200_OK)
async def update_vest(vest_id: str, vest_update: vests_pydantic.VestUpdate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the vest exists in the database
    existing_vest = await db.vests.find_one({"vest_id": vest_id})
    if existing_vest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vest not found")

    # Prepare the update data
    update_data = vest_update.dict(exclude_unset=True)

    # Update the vest in the database
    await db.vests.update_one({"vest_id": vest_id}, {"$set": update_data})

    # Retrieve the updated vest data
    updated_vest = await db.vests.find_one({"vest_id": vest_id})

    return vests_pydantic.VestResponse(vest=updated_vest)

@router.delete("/{vest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vest(vest_id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the vest exists in the database
    existing_vest = await db.vests.find_one({"vest_id": vest_id})
    if existing_vest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vest not found")

    # Delete the vest from the database
    result = await db.vests.delete_one({"vest_id": vest_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vest not found")
