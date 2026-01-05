from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class PredictItem(BaseModel):
    fixtureId: str
    # This is your Firestore "features" object (nested is fine)
    features: Dict[str, Any] = Field(default_factory=dict)

class PredictBatchRequest(BaseModel):
    modelVersion: str = "lgbm_v1"
    items: List[PredictItem]

class MatchResultOut(BaseModel):
    H: float
    D: float
    A: float
    pick: str

class BinaryOut(BaseModel):
    Y: float
    N: float
    pick: str

class PredictionOut(BaseModel):
    fixtureId: str
    matchResult: MatchResultOut
    over25: Optional[BinaryOut] = None
    btts: Optional[BinaryOut] = None

class PredictBatchResponse(BaseModel):
    modelVersion: str
    predictions: List[PredictionOut]
