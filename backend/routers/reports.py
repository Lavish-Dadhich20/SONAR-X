import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body
from database import db
from yolo_service import yolo_service

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("")
async def generate_report(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    scan_id = payload.get("scanId")
    if not scan_id:
        raise HTTPException(status_code=400, detail="scanId is required.")

    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    report_id = f"REP-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    report_record = {
        "reportId": report_id,
        "scanId": scan_id,
        "title": f"SONAR-X Acoustic Intelligence Report: {scan_id}",
        "generatedAt": datetime.utcnow().isoformat(),
        "createdAt": datetime.utcnow().isoformat(),
        "scan": {
            "scanId": scan["scanId"],
            "filename": scan["filename"],
            "imageUrl": scan["imageUrl"],
            "annotatedImageUrl": scan.get("annotatedImageUrl"),
            "timestamp": scan.get("timestamp"),
            "metadata": scan.get("metadata", {}),
            "location": scan.get("location")
        },
        "detections": scan.get("detections", []),
        "detectionCount": len(scan.get("detections", [])),
        "highestConfidence": scan.get("highestConfidence", 0.0),
        "aiInterpretation": scan.get("aiAnalysis"),
        "aiProvider": scan.get("aiProvider"),
        "modelInfo": {
            "name": yolo_service.model_info.get("name", "SONAR-X Object Detector"),
            "weights": yolo_service.model_info.get("weights_file", "best.pt"),
            "task": "Object Detection",
            "threshold": scan.get("metadata", {}).get("confThresholdUsed", 0.25)
        }
    }

    db.insert_report(report_record)
    return report_record

@router.get("")
async def list_reports() -> List[Dict[str, Any]]:
    return db.list_reports()

@router.get("/{report_id}")
async def get_report(report_id: str) -> Dict[str, Any]:
    rep = db.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    return rep
