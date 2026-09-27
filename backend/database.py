import time
from typing import Optional, Dict, Any, List, BinaryIO

import pymongo
import gridfs
from pymongo.errors import PyMongoError
from bson import ObjectId

from config import settings


class DatabaseManager:
    """
    MongoDB persistence + MongoDB GridFS file storage.

    MongoDB stores:
    - scans
    - detections
    - AI analyses
    - reports
    - uploaded/generated image files through GridFS

    No Supabase.
    No local JSON fallback.
    """

    def __init__(self):
        self.client: Optional[pymongo.MongoClient] = None
        self.db = None
        self.fs = None

        self.connect()

    # =========================================================
    # CONNECTION
    # =========================================================

    def connect(self):
        try:
            self.client = pymongo.MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
            )

            self.client.admin.command("ping")

            self.db = self.client[settings.mongodb_db]

            # MongoDB GridFS bucket
            self.fs = gridfs.GridFS(
                self.db,
                collection="uploads",
            )

            print(
                f"[Database] Connected to MongoDB database "
                f"'{settings.mongodb_db}'."
            )

            print(
                "[Database] GridFS file storage enabled."
            )

        except Exception as exc:
            self.client = None
            self.db = None
            self.fs = None

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

        if self.fs is None:
            self.fs = gridfs.GridFS(
                self.db,
                collection="uploads",
            )

    # =========================================================
    # GRIDFS FILE STORAGE
    # =========================================================

    def save_file(
        self,
        file_data: BinaryIO,
        filename: str,
        content_type: Optional[str] = None,
        relative_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Store a file in MongoDB GridFS.

        Returns the GridFS file ObjectId as a string.
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        gridfs_metadata = {
            "filename": filename,
            "relative_path": relative_path or filename,
        }

        if metadata:
            gridfs_metadata.update(metadata)

        file_id = self.fs.put(
            file_data,
            filename=filename,
            content_type=content_type,
            metadata=gridfs_metadata,
        )

        return str(file_id)

    def save_file_from_path(
        self,
        file_path: str,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
        relative_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Read a local temporary file and store it in GridFS.
        """

        self._require_connection()

        path = str(file_path)

        if filename is None:
            filename = path.replace("\\", "/").split("/")[-1]

        with open(path, "rb") as file_handle:
            return self.save_file(
                file_data=file_handle,
                filename=filename,
                content_type=content_type,
                relative_path=relative_path,
                metadata=metadata,
            )

    def get_file(
        self,
        file_id: str,
    ):
        """
        Retrieve a GridFS file using its ObjectId string.
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        try:
            object_id = ObjectId(file_id)
        except Exception:
            return None

        try:
            return self.fs.get(object_id)
        except gridfs.errors.NoFile:
            return None

    def get_file_by_filename(
        self,
        filename: str,
    ):
        """
        Retrieve the most recent GridFS file matching filename.
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        file_document = (
            self.db["uploads.files"]
            .find_one(
                {"filename": filename},
                sort=[("uploadDate", -1)],
            )
        )

        if not file_document:
            return None

        try:
            return self.fs.get(
                file_document["_id"]
            )
        except gridfs.errors.NoFile:
            return None

    def get_file_by_relative_path(
        self,
        relative_path: str,
    ):
        """
        Retrieve a file using the path stored in GridFS metadata.

        Example:
            annotated/example.png
            example_preview.png
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        file_document = (
            self.db["uploads.files"]
            .find_one(
                {
                    "metadata.relative_path": relative_path
                },
                sort=[("uploadDate", -1)],
            )
        )

        if not file_document:
            return None

        try:
            return self.fs.get(
                file_document["_id"]
            )
        except gridfs.errors.NoFile:
            return None

    def delete_file(
        self,
        file_id: str,
    ) -> bool:
        """
        Delete a GridFS file by ObjectId string.
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        try:
            object_id = ObjectId(file_id)
        except Exception:
            return False

        try:
            self.fs.delete(object_id)
            return True
        except Exception:
            return False

    def delete_file_by_filename(
        self,
        filename: str,
    ) -> int:
        """
        Delete all GridFS files matching a filename.

        Returns number of deleted files.
        """

        self._require_connection()

        if self.fs is None:
            raise RuntimeError(
                "GridFS is not initialized."
            )

        files = self.db["uploads.files"].find(
            {"filename": filename},
            {"_id": 1},
        )

        deleted = 0

        for file_document in files:
            try:
                self.fs.delete(
                    file_document["_id"]
                )
                deleted += 1
            except Exception:
                pass

        return deleted

    def count_files(self) -> int:
        """
        Count files stored in GridFS.
        """

        if not self.is_connected():
            return 0

        try:
            return self.db["uploads.files"].count_documents({})

        except Exception:
            return 0

    # =========================================================
    # HEALTH
    # =========================================================

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
            "files_count": self.count_files()
            if connected
            else 0,
            "storage_type": "MongoDB GridFS",
        }

    # =========================================================
    # SCANS
    # =========================================================

    def insert_scan(
        self,
        scan_data: Dict[str, Any],
    ) -> str:
        """
        Insert a new scan or replace/update the existing scan
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

    # =========================================================
    # DETECTIONS
    # =========================================================

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

    # =========================================================
    # AI ANALYSIS
    # =========================================================

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

    # =========================================================
    # REPORTS
    # =========================================================

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

    # =========================================================
    # STATISTICS
    # =========================================================

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


# =============================================================
# SINGLE DATABASE INSTANCE
# =============================================================

db = DatabaseManager()