from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query
from database import db

router = APIRouter(prefix="/api/detections", tags=["detections"])

@router.get("")
async def list_all_detections(
    object_class: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None)
) -> List[Dict[str, Any]]:
    return db.list_detections(object_class=object_class, min_confidence=min_confidence)
