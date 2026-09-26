from typing import Dict, Any, List
from fastapi import APIRouter
from yolo_service import yolo_service

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("")
async def get_model_info() -> Dict[str, Any]:
    return yolo_service.model_info


@router.get("/classes")
async def get_model_classes() -> List[Dict[str, Any]]:
    return yolo_service.get_classes()


@router.get("/metrics")
async def get_model_metrics() -> Dict[str, Any]:
    """
    Return only metrics genuinely present in the loaded checkpoint.
    best.pt normally contains training configuration, not a complete evaluation table.
    """
    if not yolo_service.is_loaded():
        return {
            "available": False,
            "message": "YOLO model is not loaded.",
        }

    info = yolo_service.get_evaluation_metrics()
    return info
