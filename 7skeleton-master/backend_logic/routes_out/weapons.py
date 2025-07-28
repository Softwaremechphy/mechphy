#backend_logic/routes_out/weapons.py
from fastapi import Body, Depends, Response, status, HTTPException, APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import List, Optional
from db.mongodb_handler import get_db_out
from backend_logic.pydantic_responses_out import weapons_pydantic

router = APIRouter(
    prefix = "/api/weapons",
    tags = ["weapons_outside_monitoring"]
)

# Fetch all weapon names
@router.get("/", response_model=List[dict], status_code=status.HTTP_200_OK)
async def get_weapon_names(db: AsyncIOMotorDatabase = Depends(get_db_out)):
    weapons = await db.weapons.find({}, {"_id": 0, "weapon_id": 1, "name": 1}).to_list(length=100)
    return weapons


# get a weapon
@router.get("/{weapon_id}", status_code=status.HTTP_200_OK, response_model=weapons_pydantic.WeaponResponse)
async def get_weapon(weapon_id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Query the database for the weapon with the given ID
    weapon = await db.weapons.find_one({"weapon_id": weapon_id})

    # If no weapon is found, raise a 404 error
    if weapon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weapon not found")

    # Return the found weapon
    return weapons_pydantic.WeaponResponse(weapon=weapon)


# Choose an existing weapon
@router.post("/choose", response_model=weapons_pydantic.WeaponResponse, status_code=status.HTTP_200_OK)
async def choose_weapon(payload: weapons_pydantic.ChooseWeaponRequest, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    normalized_name = payload.name.lower()
    weapon = await db.weapons.find_one({"name": {"$regex": f"^{normalized_name}$", "$options": "i"}})
    if not weapon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weapon not found")

    # Increment the count
    await db.weapons.update_one({"name": {"$regex": f"^{normalized_name}$", "$options": "i"}}, {"$inc": {"count": 1}})

    # Fetch updated weapon
    updated_weapon = await db.weapons.find_one({"name": {"$regex": f"^{normalized_name}$", "$options": "i"}})
    return weapons_pydantic.WeaponResponse(**updated_weapon)

# Create a new weapon
@router.post("/create", response_model=weapons_pydantic.WeaponResponse, status_code=status.HTTP_201_CREATED)
async def create_weapon(weapon: weapons_pydantic.WeaponCreate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    normalized_name = weapon.name.lower()
    # Check if weapon name already exists
    existing_weapon = await db.weapons.find_one({"name": {"$regex": f"^{normalized_name}$", "$options": "i"}})
    if existing_weapon:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Weapon with this name already exists")

    # Generate weapon ID based on the latest weapon ID
    last_weapon = await db.weapons.find_one({}, sort=[("weapon_id", -1)])
    last_weapon_id = int(last_weapon["weapon_id"]) if last_weapon else 0
    weapon_id = str(last_weapon_id + 1)

    # Prepare weapon data
    weapon_data = {
        "weapon_id": weapon_id,
        "name": weapon.name,
        "weapon_type": weapon.weapon_type,
        "bullet_type": weapon.bullet_type,
        "fire_rate": weapon.fire_rate,
        "range": weapon.range,
        "count": 1
    }

    # Insert into the database
    await db.weapons.insert_one(weapon_data)

    return weapons_pydantic.WeaponResponse(**weapon_data)



@router.put("/{weapon_id}", response_model=weapons_pydantic.WeaponResponse, status_code=status.HTTP_200_OK)
async def update_weapon(weapon_id: str, weapon_update: weapons_pydantic.WeaponUpdate, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the weapon exists in the database
    existing_weapon = await db.weapons.find_one({"weapon_id": weapon_id})
    if existing_weapon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weapon not found")

    # Prepare the update data
    update_data = weapon_update.dict(exclude_unset=True)

    # Update the weapon in the database
    await db.weapons.update_one({"weapon_id": weapon_id}, {"$set": update_data})

    # Retrieve the updated weapon data
    updated_weapon = await db.weapons.find_one({"weapon_id": weapon_id})

    return weapons_pydantic.WeaponResponse(weapon=updated_weapon)


@router.delete("/{weapon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weapon(weapon_id: str, db: AsyncIOMotorDatabase = Depends(get_db_out)):
    # Check if the weapon exists in the database
    existing_weapon = await db.weapons.find_one({"weapon_id": weapon_id})
    if existing_weapon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weapon not found")

    # Delete the weapon from the database
    result = await db.weapons.delete_one({"weapon_id": weapon_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Weapon not found")
