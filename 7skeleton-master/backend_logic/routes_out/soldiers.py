#backend_logic/routes_out/soldiers.py
from fastapi import Body, Depends, Response, status, HTTPException, APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import List, Optional
from db.mongodb_handler import get_db_out
from backend_logic.pydantic_responses_out import soldier_pydantic

router = APIRouter(
    prefix = "/api/soldiers",
    tags = ["soldier_outside_monitoring"]
)

@router.get("/{id}", status_code=status.HTTP_200_OK, response_model=soldier_pydantic.SoldierResponse)
async def get_soldiers(id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Query the database for the soldier with the given unique ID
    soldier = await db.soldiers.find_one({"soldier_id": id})

    # If no soldier is found, raise a 404 error
    if soldier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soldier not found")

    # Handle 'stats' properly if it's missing or None
    stats = soldier.get('stats')
    
    if stats:
        soldier_stats = soldier_pydantic.SoldierStats(**stats)
    else:
        soldier_stats = None

    # Structure the response data to match SoldierResponse model
    response_data = {
        "soldier": soldier_pydantic.SoldierBase(**soldier),  # Assuming soldier fields match SoldierBase model
        "stats": soldier_stats
    }

    return response_data





@router.post("/", response_model=soldier_pydantic.SoldierResponse, status_code=status.HTTP_201_CREATED)
async def create_soldier(soldier: soldier_pydantic.SoldierCreate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    
    # Check if soldier with the same ID already exists
    existing_soldier = await db.soldiers.find_one({"soldier_id": soldier.soldier_id})
    if existing_soldier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Soldier with this ID already exists")

    # Prepare the soldier data for insertion
    soldier_data = soldier.dict()
    
    # Insert the new soldier into the database
    result = await db.soldiers.insert_one(soldier_data)

    # Return the created soldier with its new ID
    return soldier_pydantic.SoldierResponse(soldier=soldier_data, stats=None) 



@router.put("/{soldier_id}", response_model=soldier_pydantic.SoldierResponse, status_code=status.HTTP_200_OK)
async def update_soldier(soldier_id: str, soldier_update: soldier_pydantic.SoldierUpdate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the soldier exists in the database using the client-defined soldier_id
    existing_soldier = await db.soldiers.find_one({"soldier_id": soldier_id})
    if existing_soldier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soldier not found")

    # Prepare the update data
    update_data = soldier_update.dict(exclude_unset=True)  # Only include fields that were provided

    # Update the soldier in the database
    await db.soldiers.update_one({"soldier_id": soldier_id}, {"$set": update_data})

    # Retrieve the updated soldier data to return it
    updated_soldier = await db.soldiers.find_one({"soldier_id": soldier_id})

    # return soldier_pydantic.SoldierResponse(soldier=soldier_pydantic.SoldierBase(**updated_soldier), stats=soldier_pydantic. SoldierStats(**updated_soldier.get('stats', {})))

    # Handle 'stats' properly if it's missing or None
    stats = updated_soldier.get('stats')
    
    if stats:
        soldier_stats = soldier_pydantic.SoldierStats(**stats)
    else:
        soldier_stats = None

    # Structure the response data to match SoldierResponse model
    response_data = {
        "soldier": soldier_pydantic.SoldierBase(**updated_soldier),  # Assuming soldier fields match SoldierBase model
        "stats": soldier_stats
    }

    return response_data


@router.delete("/{soldier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_soldier(soldier_id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the soldier exists in the database using the client-defined soldier_id
    existing_soldier = await db.soldiers.find_one({"soldier_id": soldier_id})
    if existing_soldier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soldier not found")

    # Delete the soldier from the database
    result = await db.soldiers.delete_one({"soldier_id": soldier_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Soldier not found")