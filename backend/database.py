import time
from typing import Optional, Dict, Any, List

import pymongo
from pymongo.errors import PyMongoError

from config import settings


class DatabaseManager:
    """MongoDB-only persistence. No local JSON fallback or synthetic data."""

    def __init__(self):
        self.client: Optional[pymongo.MongoClient] = None
        self.db = None
        self.connect()

    def connect(self):
        try:
            self.client = pymongo.MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=2500,
                connectTimeoutMS=2500,
            )

            self.client.admin.command("ping")

            self.db = self.client[settings.mongodb_db]

            print(
                f"[Database] Connected to MongoDB database "
                f"'{settings.mongodb_db}'."
            )

        except Exception as exc:
            self.client = None
            self.db = None

            print(
                f"[Database] MongoDB unavailable: {exc}"
            )

    def is_connected(self) -> bool:
        if self.client is None or self.db is None:
            self.connect()

        if self.client is None:
            return False

        try:
            self.client.admin.command("ping")
            return True

        except Exception:
            return False

    def _require_connection(self):
        if not self.is_connected():
            raise RuntimeError(
                "MongoDB is unavailable. Configure MONGODB_URI "
                "and ensure the database is reachable."
            )

    # ---------------------------------------------------------
    # HEALTH
    # ---------------------------------------------------------

    def health_check(self) -> Dict[str, Any]:
        start = time.time()

        connected = self.is_connected()

        latency = (time.time() - start) * 1000

        return {
            "online": connected,
            "latency_ms": round(latency, 2)
            if connected
            else None,
            "database_name": settings.mongodb_db,
            "scans_count": self.count_scans()
            if connected
            else 0,
            "detections_count": self.count_detections()
            if connected
            else 0,
            "storage_type": "MongoDB",
        }

    # ---------------------------------------------------------
    # SCANS
    # ---------------------------------------------------------

    def insert_scan(
        self,
        scan_data: Dict[str, Any],
    ) -> str:
        """
        Insert a new scan or replace the existing scan
        with the same scanId.
        """

        self._require_connection()

        self.db.scans.update_one(
            {"scanId": scan_data["scanId"]},
            {"$set": scan_data},
            upsert=True,
        )

        return scan_data["scanId"]

    def update_scan(
        self,
        scan_id: str,
        update_data: Dict[str, Any],
    ) -> bool:
        """
        Update fields belonging to an existing scan.

        Used after AI interpretation to attach the AI result
        and related metadata to the scan document.
        """

        self._require_connection()

        if not update_data:
            return False

        result = self.db.scans.update_one(
            {"scanId": scan_id},
            {"$set": update_data},
        )

        return result.matched_count > 0

    def get_scan(
        self,
        scan_id: str,
    ) -> Optional[Dict[str, Any]]:
        self._require_connection()

        return self.db.scans.find_one(
            {"scanId": scan_id},
            {"_id": 0},
        )

    def list_scans(
        self,
        search: Optional[str] = None,
        object_class: Optional[str] = None,
        min_confidence: Optional[float] = None,
        ai_provider: Optional[str] = None,
    ) -> List[Dict[str, Any]]:

        self._require_connection()

        query: Dict[str, Any] = {}

        if search:
            query["$or"] = [
                {
                    "scanId": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
                {
                    "filename": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
            ]

        if object_class:
            query["detections.className"] = object_class

        if min_confidence is not None:
            query["highestConfidence"] = {
                "$gte": min_confidence
            }

        if ai_provider:
            query["aiProvider"] = ai_provider

        return list(
            self.db.scans.find(
                query,
                {"_id": 0},
            ).sort(
                "createdAt",
                -1,
            )
        )

    def delete_scan(
        self,
        scan_id: str,
    ) -> bool:

        self._require_connection()

        result = self.db.scans.delete_one(
            {"scanId": scan_id}
        )

        self.db.detections.delete_many(
            {"scanId": scan_id}
        )

        self.db.ai_analyses.delete_many(
            {"scanId": scan_id}
        )

        self.db.reports.delete_many(
            {"scanId": scan_id}
        )

        return result.deleted_count > 0

    def count_scans(self) -> int:
        if not self.is_connected():
            return 0

        try:
            return self.db.scans.count_documents({})

        except PyMongoError:
            return 0

    # ---------------------------------------------------------
    # DETECTIONS
    # ---------------------------------------------------------

    def insert_detections(
        self,
        detections: List[Dict[str, Any]],
    ):
        if not detections:
            return

        self._require_connection()

        scan_ids = list(
            {
                d["scanId"]
                for d in detections
            }
        )

        for scan_id in scan_ids:
            self.db.detections.delete_many(
                {"scanId": scan_id}
            )

        self.db.detections.insert_many(
            detections
        )

    def list_detections(
        self,
        object_class: Optional[str] = None,
        min_confidence: Optional[float] = None,
    ) -> List[Dict[str, Any]]:

        self._require_connection()

        query: Dict[str, Any] = {}

        if object_class:
            query["className"] = object_class

        if min_confidence is not None:
            query["confidence"] = {
                "$gte": min_confidence
            }

        return list(
            self.db.detections.find(
                query,
                {"_id": 0},
            ).sort(
                "createdAt",
                -1,
            )
        )

    def count_detections(self) -> int:
        if not self.is_connected():
            return 0

        try:
            return self.db.detections.count_documents({})

        except PyMongoError:
            return 0

    # ---------------------------------------------------------
    # AI ANALYSIS
    # ---------------------------------------------------------

    def insert_ai_analysis(
        self,
        analysis_data: Dict[str, Any],
    ) -> str:

        self._require_connection()

        self.db.ai_analyses.update_one(
            {"scanId": analysis_data["scanId"]},
            {"$set": analysis_data},
            upsert=True,
        )

        return analysis_data["scanId"]

    # ---------------------------------------------------------
    # REPORTS
    # ---------------------------------------------------------

    def insert_report(
        self,
        report_data: Dict[str, Any],
    ) -> str:

        self._require_connection()

        self.db.reports.update_one(
            {
                "reportId": report_data["reportId"]
            },
            {
                "$set": report_data
            },
            upsert=True,
        )

        return report_data["reportId"]

    def get_report(
        self,
        report_id: str,
    ) -> Optional[Dict[str, Any]]:

        self._require_connection()

        return self.db.reports.find_one(
            {"reportId": report_id},
            {"_id": 0},
        )

    def list_reports(
        self,
    ) -> List[Dict[str, Any]]:

        self._require_connection()

        return list(
            self.db.reports.find(
                {},
                {"_id": 0},
            ).sort(
                "createdAt",
                -1,
            )
        )

    # ---------------------------------------------------------
    # STATISTICS
    # ---------------------------------------------------------

    def get_statistics(
        self,
    ) -> Dict[str, Any]:

        self._require_connection()

        total_scans = (
            self.db.scans.count_documents({})
        )

        total_detections = (
            self.db.detections.count_documents({})
        )

        ai_analyses_count = (
            self.db.ai_analyses.count_documents({})
        )

        high_conf_count = (
            self.db.detections.count_documents(
                {
                    "confidence": {
                        "$gte": 0.70
                    }
                }
            )
        )

        class_distribution: Dict[str, int] = {}

        for row in self.db.detections.aggregate(
            [
                {
                    "$group": {
                        "_id": "$className",
                        "count": {
                            "$sum": 1
                        },
                    }
                },
                {
                    "$sort": {
                        "count": -1
                    }
                },
            ]
        ):
            class_distribution[
                row["_id"]
            ] = row["count"]

        return {
            "totalScans": total_scans,
            "objectsDetected": total_detections,
            "aiAnalyses": ai_analyses_count,
            "highConfidenceDetections": high_conf_count,
            "classDistribution": class_distribution,
        }


db = DatabaseManager()