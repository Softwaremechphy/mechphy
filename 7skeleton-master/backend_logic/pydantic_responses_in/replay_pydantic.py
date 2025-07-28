#backend_logic/pydantic_responses_in/replay_pydantic.py

from pydantic import BaseModel
from typing import Optional

class ReplayControlRequest(BaseModel):
    command: str  # 'pause', 'resume', 'stop', 'speed', 'skip', or 'go_back'
    speed: Optional[float] = None  # Used only for 'speed' command
    n_seconds: Optional[int] = None  # Used only for 'skip' and 'go_back' commands
