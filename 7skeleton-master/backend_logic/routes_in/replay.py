#bqckend_logic/routes_in/replay.py
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI, HTTPException
from typing import List, Dict, Any
from datetime import datetime
from backend_logic.pydantic_responses_in import replay_pydantic

app = FastAPI()

# MongoDB connection
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["archival_monitoring"]
sessions_collection = db["sessions"]

@app.get("/replay/{session_id}", response_model=replay_pydantic.ReplayData)
async def get_replay_data(session_id: str):
    session = await sessions_collection.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Collect and interleave all soldier data based on timestamp
    interleaved_data = []
    for soldier in session["participated_soldiers"]:
        soldier_id = soldier["soldier_id"]
        call_sign = soldier["call_sign"]

        # Combine location and orientation entries with soldier ID and call sign
        for loc, ori in zip(soldier["location"], soldier["orientation"]):
            interleaved_data.append({
                "soldier_id": soldier_id,
                "call_sign": call_sign,
                "timestamp": loc["timestamp"],
                "location": loc,
                "orientation": ori
            })

    # Sort all entries by timestamp to achieve a unified, time-sequenced structure
    interleaved_data = sorted(interleaved_data, key=lambda x: x["timestamp"])

    # Constructing the final replay data
    replay_data = replay_pydantic.ReplayData(
        session_id=session["session_id"],
        start_time=session["start_time"],
        replay_soldiers=[replay_pydantic.SoldierReplayData(**data) for data in interleaved_data]
    )

    return replay_data
