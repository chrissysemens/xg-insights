from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class PredictItem(BaseModel):
    fixtureId: str
    features: Dict[str, Any] = Field(default_factory=dict)

class PredictBatchRequest(BaseModel):
    modelVersion: str = "epl-v3"
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

class FeatureContributionOut(BaseModel):
    feature: str
    value: float
    contribution: float

class PredictionOut(BaseModel):
    fixtureId: str
    matchResult: MatchResultOut
    over25: Optional[BinaryOut] = None
    btts: Optional[BinaryOut] = None
    resultExplain: Optional[List[FeatureContributionOut]] = None
    resultBias: Optional[float] = None

class PredictBatchResponse(BaseModel):
    modelVersion: str
    predictions: List[PredictionOut]
