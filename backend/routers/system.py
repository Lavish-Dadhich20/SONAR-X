from typing import Dict, Any
from fastapi import APIRouter, Body
from config import settings
from database import db
from yolo_service import yolo_service
from ai_service import ai_service

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/status")
async def get_system_status() -> Dict[str, Any]:
    db_health = db.health_check()
    yolo_loaded = yolo_service.is_loaded()
    ai_status = ai_service.get_status()

    return {
        "timestamp": db_health.get("timestamp"),
        "yolo": {
            "online": yolo_loaded,
            "modelName": yolo_service.model_info.get("name", "SONAR-X Object Detector"),
            "weights": yolo_service.model_info.get("weights_file", "best.pt"),
            "classesCount": len(yolo_service.classes)
        },
        "ai": {
            "online": ai_status["geminiAvailable"] or ai_status["groqAvailable"],
            "activeProvider": ai_status["activeProvider"],
            "geminiConfigured": ai_status["geminiKeyConfigured"],
            "groqConfigured": ai_status["groqKeyConfigured"],
            "geminiAvailable": ai_status["geminiAvailable"],
            "groqAvailable": ai_status["groqAvailable"]
        },
        "database": {
            "online": db_health["online"],
            "storageType": db_health["storage_type"],
            "latencyMs": db_health.get("latency_ms"),
            "databaseName": db_health.get("database_name"),
            "scansCount": db_health.get("scans_count", 0),
            "detectionsCount": db_health.get("detections_count", 0)
        }
    }

@router.get("/stats")
async def get_dashboard_stats() -> Dict[str, Any]:
    return db.get_statistics()

@router.post("/settings")
async def update_settings(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    if "activeAiProvider" in payload:
        ai_service.set_active_provider(payload["activeAiProvider"])
    if "geminiApiKey" in payload:
        ai_service.set_active_provider(ai_service.active_provider, gemini_key=payload["geminiApiKey"])
    if "groqApiKey" in payload:
        ai_service.set_active_provider(ai_service.active_provider, groq_key=payload["groqApiKey"])
    if "confidenceThreshold" in payload:
        settings.confidence_threshold = float(payload["confidenceThreshold"])
    if "iouThreshold" in payload:
        settings.iou_threshold = float(payload["iouThreshold"])

    return {
        "success": True,
        "activeAiProvider": ai_service.active_provider,
        "confidenceThreshold": settings.confidence_threshold,
        "iouThreshold": settings.iou_threshold,
        "geminiConfigured": bool(ai_service.gemini_key),
        "groqConfigured": bool(ai_service.groq_key)
    }
