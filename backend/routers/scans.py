from pathlib import Path
import mimetypes
import tempfile
from datetime import datetime
from typing import Optional, Dict, Any
import numpy as np
import rasterio
from PIL import Image
from bson import ObjectId
from fastapi import APIRouter, UploadFile, File, HTTPException
from config import settings
from database import db
from yolo_service import yolo_service
from ai_service import ai_service
from geocoding_service import reverse_geocode
router = APIRouter(
    prefix="/api/scans",
    tags=["scans"],
)
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".tif",
    ".tiff",
}
def make_json_safe(value: Any) -> Any:
    """Convert MongoDB/Python values into JSON-safe API values."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            key: make_json_safe(item)
            for key, item in value.items()
            if key != "_id"
        }
    if isinstance(value, list):
        return [make_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [make_json_safe(item) for item in value]
    return value
def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()
def make_image_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    path = str(path).replace(chr(92), "/")
    if path.startswith("/uploads/"):
        return path
    return f"/uploads/{Path(path).name}"
def _content_type_for_path(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"
def store_gridfs_file(path: Path, scan_id: str, role: str) -> Optional[str]:
    if not path.exists() or path.stat().st_size <= 0:
        return None
    return db.save_file_from_path(str(path), filename=path.name, content_type=_content_type_for_path(path), relative_path=path.name, metadata={"scanId": scan_id, "role": role})
def restore_scan_file(scan: Dict[str, Any], work_dir: Path) -> Path:
    saved_filename = scan.get("savedFilename")
    if not saved_filename:
        raise FileNotFoundError("Scan does not have a saved filename.")
    local_path = Path(settings.upload_dir) / saved_filename
    if local_path.exists() and local_path.stat().st_size > 0:
        return local_path
    grid_file = db.get_file_by_filename(saved_filename)
    if grid_file is None:
        raise FileNotFoundError(f"Original scan file '{saved_filename}' was not found locally or in MongoDB GridFS.")
    work_dir.mkdir(parents=True, exist_ok=True)
    restored_path = work_dir / saved_filename
    with open(restored_path, "wb") as output:
        output.write(grid_file.read())
    return restored_path
def is_geotiff_file(path: str) -> bool:
    return Path(path).suffix.lower() in {
        ".tif",
        ".tiff",
    }
def create_geotiff_preview(
    original_path: Path,
    upload_dir: Path,
) -> tuple[Path, Dict[str, Any]]:
    """
    Create a deterministic PNG preview from the original GeoTIFF.
    The original TIFF is never modified. The preview filename is based
    on the actual saved TIFF filename, which prevents empty filenames
    such as '/uploads/.png'.
    """
    preview_path = (
        upload_dir / f"{original_path.stem}_preview.png"
    )
    try:
        geospatial = (
            yolo_service.extract_geotiff_metadata(
                str(original_path)
            )
        )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to read GeoTIFF metadata: {exc}"
        )
    # Reuse an existing valid preview.
    if preview_path.exists() and preview_path.stat().st_size > 0:
        return preview_path, geospatial or {}
    try:
        with rasterio.open(original_path) as src:
            band_count = src.count
            if band_count >= 3:
                # RGB GeoTIFF.
                data = src.read([1, 2, 3])
                # Convert arbitrary numeric dtype to uint8.
                if data.dtype != np.uint8:
                    data = np.asarray(data, dtype=np.float32)
                    low = np.nanpercentile(data, 2)
                    high = np.nanpercentile(data, 98)
                    if high <= low:
                        low = float(np.nanmin(data))
                        high = float(np.nanmax(data))
                    if high > low:
                        data = (
                            (data - low)
                            / (high - low)
                            * 255.0
                        )
                    else:
                        data = np.zeros_like(data)
                    data = np.clip(
                        data, 0, 255
                    ).astype(np.uint8)
                image_array = np.transpose(
                    data, (1, 2, 0)
                )
                image = Image.fromarray(
                    image_array,
                    mode="RGB",
                )
            else:
                # Single-band sonar / intensity GeoTIFF.
                data = src.read(1)
                if data.dtype != np.uint8:
                    data = np.asarray(
                        data,
                        dtype=np.float32,
                    )
                    low = np.nanpercentile(
                        data, 2
                    )
                    high = np.nanpercentile(
                        data, 98
                    )
                    if high <= low:
                        low = float(
                            np.nanmin(data)
                        )
                        high = float(
                            np.nanmax(data)
                        )
                    if high > low:
                        data = (
                            (data - low)
                            / (high - low)
                            * 255.0
                        )
                    else:
                        data = np.zeros_like(data)
                    data = np.clip(
                        data, 0, 255
                    ).astype(np.uint8)
                image = Image.fromarray(
                    data,
                    mode="L",
                )
                # YOLO generally expects 3-channel imagery.
                image = image.convert("RGB")
            image.save(
                preview_path,
                format="PNG",
            )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to create GeoTIFF PNG preview: {exc}"
        )
    if (
        not preview_path.exists()
        or preview_path.stat().st_size == 0
    ):
        raise RuntimeError(
            f"GeoTIFF preview was not created: {preview_path}"
        )
    return preview_path, geospatial or {}
def prepare_scan_image(
    original_path: Path,
    upload_dir: Path,
) -> tuple[Path, Dict[str, Any], bool]:
    """
    Return the actual image that should be sent to YOLO/browser.
    GeoTIFF -> deterministic PNG preview.
    JPG/PNG -> original file.
    """
    if is_geotiff_file(str(original_path)):
        preview_path, geospatial = (
            create_geotiff_preview(
                original_path,
                upload_dir,
            )
        )
        return (
            preview_path,
            geospatial,
            True,
        )
    return (
        original_path,
        {},
        False,
    )
def get_display_path(
    original_path: Path,
    prepared: Dict[str, Any],
) -> Path:
    """
    Return the browser-compatible image.
    GeoTIFF:
        original TIFF -> PNG preview
    JPG/PNG:
        original image
    """
    if is_geotiff_file(str(original_path)):
        detection_path = prepared.get(
            "detectionPath"
        )
        if detection_path:
            candidate = Path(
                str(detection_path)
            )
            if (
                candidate.exists()
                and candidate.suffix.lower()
                not in {".tif", ".tiff"}
            ):
                return candidate
        display_path = prepared.get(
            "displayPath"
        )
        if display_path:
            candidate = Path(
                str(display_path)
            )
            if (
                candidate.exists()
                and candidate.suffix.lower()
                not in {".tif", ".tiff"}
            ):
                return candidate
        # Final deterministic fallback.
        preview_path = (
            original_path.parent
            / f"{original_path.stem}_preview.png"
        )
        if preview_path.exists():
            return preview_path
        raise RuntimeError(
            "GeoTIFF preview was not generated correctly."
        )
    return original_path
def attach_detection_geolocations(
    detections: list,
    original_path: Path,
    geospatial: Optional[Dict[str, Any]],
    is_geotiff: bool,
) -> list:
    """Attach object-level geographic coordinates to YOLO detections."""
    if not (
        is_geotiff
        and geospatial
        and geospatial.get("hasGeodata")
    ):
        return detections
    original_width = int(geospatial.get("width", 0))
    original_height = int(geospatial.get("height", 0))
    if original_width <= 0 or original_height <= 0:
        print(
            "[GeoTIFF] Cannot geolocate detections: "
            "invalid original dimensions."
        )
        return detections
    for detection_index, detection in enumerate(detections, start=1):
        try:
            bounding_box = detection.get("boundingBox") or {}
            normalized_x = float(bounding_box.get("x", 0))
            normalized_y = float(bounding_box.get("y", 0))
            normalized_w = float(bounding_box.get("w", 0))
            normalized_h = float(bounding_box.get("h", 0))
            center_normalized_x = normalized_x + (normalized_w / 2.0)
            center_normalized_y = normalized_y + (normalized_h / 2.0)
            center_pixel_x = center_normalized_x * original_width
            center_pixel_y = center_normalized_y * original_height
            geo_location = yolo_service.pixel_to_geographic(
                str(original_path),
                center_pixel_x,
                center_pixel_y,
            )
            detection["geoLocation"] = geo_location
            print(
                "[GeoTIFF] Detection "
                f"{detection_index} "
                f"({detection.get('className', 'unknown')}) "
                f"center pixel=({center_pixel_x:.2f}, "
                f"{center_pixel_y:.2f}) "
                f"geo={geo_location}"
            )
        except Exception as exc:
            detection["geoLocation"] = None
            print(
                "[GeoTIFF] Detection "
                f"{detection_index} geolocation failed: {exc}"
            )
    return detections
def update_scan_record(
    scan_id: str,
    update_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Update a scan without depending on DatabaseManager.update_scan.
    This merges the existing MongoDB document and upserts it.
    """
    existing = db.get_scan(scan_id)
    if not existing:
        raise RuntimeError(
            f"Scan '{scan_id}' was not found."
        )
    existing.update(update_data)
    db.insert_scan(existing)
    return make_json_safe(existing)
# ============================================================
# UPLOAD SCAN
# ============================================================
@router.post("/upload")
async def upload_sonar_image(
    file: UploadFile = File(...)
):
    """
    Upload a sonar image.
    Supported:
    - JPG
    - JPEG
    - PNG
    - TIFF
    - GeoTIFF
    GeoTIFF:
    - Original TIFF is preserved.
    - CRS/geospatial metadata is extracted.
    - PNG preview is generated.
    - YOLO runs on the PNG preview.
    - Browser displays the PNG preview.
    - Detection coordinates are mapped back to the TIFF.
    """
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename was provided.",
        )
    extension = get_file_extension(
        file.filename
    )
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Supported formats: "
                ".jpg, .jpeg, .png, .tif, .tiff"
            ),
        )
    upload_dir = Path(
        settings.upload_dir
    )
    upload_dir.mkdir(
        parents=True,
        exist_ok=True,
    )
    timestamp = datetime.utcnow().strftime(
        "%Y%m%d_%H%M%S_%f"
    )
    original_filename = Path(
        file.filename
    ).name
    saved_filename = (
        f"{timestamp}_{original_filename}"
    )
    file_path = (
        upload_dir / saved_filename
    )
    # --------------------------------------------------------
    # Save original file
    # --------------------------------------------------------
    try:
        with open(
            file_path,
            "wb",
        ) as buffer:
            while True:
                chunk = await file.read(
                    1024 * 1024
                )
                if not chunk:
                    break
                buffer.write(chunk)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save uploaded file: {exc}"
            ),
        )
    # --------------------------------------------------------
    # Prepare image
    # --------------------------------------------------------
    try:
        detection_path, geospatial, is_geotiff = (
            prepare_scan_image(
                file_path,
                upload_dir,
            )
        )
        prepared = {
            "isGeoTIFF": is_geotiff,
            "geospatial": geospatial,
            "detectionPath": str(
                detection_path
            ),
            "displayPath": str(
                detection_path
            ),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to process uploaded image: "
                f"{exc}"
            ),
        )
    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Browser image must NEVER be the original TIFF.
    # --------------------------------------------------------
    try:
        display_path = get_display_path(
            file_path,
            prepared,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
    image_url = make_image_url(
        display_path
    )
    # --------------------------------------------------------
    # Extract metadata
    #
    # IMPORTANT:
    # GeoTIFF metadata comes from ORIGINAL TIFF.
    # --------------------------------------------------------
    try:
        if is_geotiff:
            metadata = (
                yolo_service.extract_image_metadata(
                    str(file_path)
                )
            )
            metadata["filename"] = (
                original_filename
            )
            metadata["format"] = (
                extension
                .lstrip(".")
                .upper()
            )
            metadata["isGeoTIFF"] = True
            metadata["geospatial"] = (
                geospatial
            )
            if geospatial:
                if geospatial.get("width"):
                    metadata["width"] = (
                        geospatial["width"]
                    )
                if geospatial.get("height"):
                    metadata["height"] = (
                        geospatial["height"]
                    )
                if geospatial.get("center"):
                    metadata["gps"] = (
                        geospatial["center"]
                    )
        else:
            metadata = (
                yolo_service.extract_image_metadata(
                    str(file_path)
                )
            )
            metadata["isGeoTIFF"] = False
            metadata["geospatial"] = None
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to extract image metadata: "
                f"{exc}"
            ),
        )
    # --------------------------------------------------------
    # Run YOLO
    # --------------------------------------------------------
    try:
        yolo_result = (
            yolo_service.run_inference(
                str(detection_path)
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "YOLO inference failed: "
                f"{exc}"
            ),
        )
    # --------------------------------------------------------
    # Generate scan ID
    # --------------------------------------------------------
    scan_id = (
        f"scan_"
        f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_"
        f"{timestamp[-6:]}"
    )
    # --------------------------------------------------------
    # Build detection records
    # --------------------------------------------------------
    detections = []
    raw_detections = yolo_result.get(
        "detections",
        [],
    )
    raw_detections = attach_detection_geolocations(
        detections=raw_detections,
        original_path=file_path,
        geospatial=geospatial,
        is_geotiff=is_geotiff,
    )
    for detection_index, detection in enumerate(
        raw_detections,
        start=1,
    ):
        detection_record = {
            **detection,
            # Every detection must have a globally unique id.
            # YOLO may return ids such as det_01 for every scan,
            # but MongoDB has a unique index on the detection id.
            "id": f"{scan_id}_det_{detection_index}",
            "scanId": scan_id,
            "filename": original_filename,
            "createdAt": (
                datetime.utcnow().isoformat()
            ),
        }
        detections.append(
            detection_record
        )
    # --------------------------------------------------------
    # Make sure every detection has scan ID
    # --------------------------------------------------------
    for detection in detections:
        detection["scanId"] = scan_id
    # --------------------------------------------------------
    # Location
    # --------------------------------------------------------
    location = None
    if (
        is_geotiff
        and geospatial
    ):
        location = geospatial.get(
            "center"
        )
    elif metadata.get("gps"):
        location = metadata.get(
            "gps"
        )
    # --------------------------------------------------------
    # Annotated image
    # --------------------------------------------------------
    annotated_image_url = (
        yolo_result.get(
            "annotatedImageUrl"
        )
    )
    # --------------------------------------------------------
    # Scan record
    # --------------------------------------------------------
    scan_record = {
        "scanId": scan_id,
        # ORIGINAL filename
        "filename": original_filename,
        # ORIGINAL physical upload filename
        "savedFilename": saved_filename,
        # IMPORTANT:
        # PNG preview for GeoTIFF,
        # original image for JPG/PNG.
        "imageUrl": image_url,
        "annotatedImageUrl": (
            annotated_image_url
        ),
        "timestamp": (
            datetime.utcnow().isoformat()
        ),
        "createdAt": (
            datetime.utcnow().isoformat()
        ),
        # Metadata describes ORIGINAL image.
        "metadata": metadata,
        "location": location,
        "isGeoTIFF": is_geotiff,
        "geospatial": geospatial,
        "modelVersion": (
            yolo_service.model_info.get(
                "name",
                "SONAR-X Object Detector",
            )
        ),
        "detectionCount": len(
            detections
        ),
        "highestConfidence": (
            yolo_result.get(
                "highestConfidence",
                0,
            )
        ),
        "detections": detections,
        "aiProvider": None,
        "aiAnalysis": None,
        "status": "Analyzed",
        "saved": True,
    }
    # --------------------------------------------------------
    # Persist original, display/preview, and annotated files in MongoDB GridFS.
    # The local files are only temporary processing artifacts.
    try:
        original_file_id = store_gridfs_file(file_path, scan_id, "original")
        display_file_id = store_gridfs_file(Path(display_path), scan_id, "display")
        annotated_file_id = None
        if annotated_image_url:
            annotated_name = Path(str(annotated_image_url).split("?", 1)[0]).name
            annotated_path = upload_dir / annotated_name
            annotated_file_id = store_gridfs_file(annotated_path, scan_id, "annotated")
        scan_record["storage"] = {
            "provider": "mongodb-gridfs",
            "originalFileId": original_file_id,
            "displayFileId": display_file_id,
            "annotatedFileId": annotated_file_id,
        }
        db.insert_scan(
            scan_record
        )
        if detections:
            db.insert_detections(
                detections
            )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save scan to database: "
                f"{exc}"
            ),
        )
    return make_json_safe(scan_record)
# ============================================================
# RE-DETECT
# ============================================================
@router.post("/{scan_id}/detect")
async def redetect_scan(
    scan_id: str
):
    scan = db.get_scan(
        scan_id
    )
    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )
    saved_filename = scan.get(
        "savedFilename"
    )
    if not saved_filename:
        raise HTTPException(
            status_code=400,
            detail=(
                "Scan does not have a saved filename."
            ),
        )
    temp_dir = Path(tempfile.mkdtemp(prefix="sonar_scan_"))
    try:
        original_path = restore_scan_file(scan, temp_dir)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to restore scan file: {exc}")
    try:
        redetect_path, _, _ = (
            prepare_scan_image(
                original_path,
                Path(settings.upload_dir),
            )
        )
        yolo_result = (
            yolo_service.run_inference(
                str(redetect_path)
            )
        )
        annotated_file_id = None
        annotated_url = yolo_result.get("annotatedImageUrl")
        if annotated_url:
            annotated_path = Path(settings.upload_dir) / Path(
                str(annotated_url).split("?", 1)[0]
            ).name
            annotated_file_id = store_gridfs_file(
                annotated_path, scan_id, "annotated"
            )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"YOLO re-detection failed: {exc}"
            ),
        )
    detections = []
    raw_detections = yolo_result.get(
        "detections",
        [],
    )
    raw_detections = attach_detection_geolocations(
        detections=raw_detections,
        original_path=original_path,
        geospatial=yolo_result.get("geospatial"),
        is_geotiff=yolo_result.get("isGeoTIFF", False),
    )
    for detection_index, detection in enumerate(
        raw_detections,
        start=1,
    ):
        detection_record = {
            **detection,
            # Every detection must have a globally unique id.
            # YOLO may return ids such as det_01 for every scan,
            # but MongoDB has a unique index on the detection id.
            "id": f"{scan_id}_det_{detection_index}",
            "scanId": scan_id,
            "filename": scan.get(
                "filename"
            ),
            "createdAt": (
                datetime.utcnow().isoformat()
            ),
        }
        detections.append(
            detection_record
        )
    db.insert_detections(
        detections
    )
    update_data = {
        "detections": detections,
        "detectionCount": len(
            detections
        ),
        "highestConfidence": (
            yolo_result.get(
                "highestConfidence",
                0,
            )
        ),
        "annotatedImageUrl": (
            yolo_result.get(
                "annotatedImageUrl"
            )
        ),
        "storage.annotatedFileId": annotated_file_id,
        "status": "Analyzed",
        "updatedAt": (
            datetime.utcnow().isoformat()
        ),
    }
    if yolo_result.get(
        "isGeoTIFF"
    ):
        update_data["isGeoTIFF"] = True
        update_data["geospatial"] = (
            yolo_result.get(
                "geospatial"
            )
        )
    try:
        updated_scan = update_scan_record(
            scan_id,
            update_data,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to update scan: {exc}"
            ),
        )
    return make_json_safe(updated_scan)
# ============================================================
# AI INTERPRETATION
# ============================================================
@router.post("/{scan_id}/interpret")
async def interpret_scan(
    scan_id: str,
    provider: Optional[str] = None,
):
    scan = db.get_scan(
        scan_id
    )
    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )
    saved_filename = scan.get(
        "savedFilename"
    )
    if not saved_filename:
        raise HTTPException(
            status_code=400,
            detail=(
                "Scan does not have a saved filename."
            ),
        )
    temp_dir = Path(tempfile.mkdtemp(prefix="sonar_scan_"))
    try:
        original_path = restore_scan_file(scan, temp_dir)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to restore scan file: {exc}")
    extension = (
        original_path.suffix.lower()
    )
    # --------------------------------------------------------
    # AI image
    # --------------------------------------------------------
    if extension in {
        ".tif",
        ".tiff",
    }:
        try:
            ai_image_path, _, _ = (
                prepare_scan_image(
                    original_path,
                    Path(settings.upload_dir),
                )
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to prepare GeoTIFF "
                    f"for AI interpretation: {exc}"
                ),
            )
    else:
        ai_image_path = str(
            original_path
        )
    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------
    metadata = (
        scan.get("metadata")
        or {}
    )
    if extension in {
        ".tif",
        ".tiff",
    }:
        geospatial = (
            scan.get("geospatial")
        )
        if not geospatial:
            try:
                geospatial = (
                    yolo_service.extract_geotiff_metadata(
                        str(original_path)
                    )
                )
            except Exception:
                geospatial = None
        metadata["filename"] = (
            scan.get(
                "filename",
                original_path.name,
            )
        )
        metadata["format"] = "TIFF"
        metadata["isGeoTIFF"] = True
        metadata["geospatial"] = (
            geospatial
        )
        if (
            geospatial
            and geospatial.get("center")
        ):
            metadata["gps"] = (
                geospatial["center"]
            )
    # --------------------------------------------------------
    # Reverse geocode verified survey coordinates
    # --------------------------------------------------------
    location_info = None
    try:
        verified_geospatial = metadata.get("geospatial") or {}
        verified_center = verified_geospatial.get("center") or {}
        latitude = verified_center.get("latitude")
        longitude = verified_center.get("longitude")
        # Fallback to the scan's existing location
        if latitude is None or longitude is None:
            existing_location = scan.get("location") or {}
            latitude = existing_location.get("latitude")
            longitude = existing_location.get("longitude")
        if latitude is not None and longitude is not None:
            location_info = await reverse_geocode(
                latitude=float(latitude),
                longitude=float(longitude),
            )
            if location_info.get("success"):
                metadata["location"] = location_info
            else:
                metadata["location"] = {
                    "success": False,
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                    "error": location_info.get(
                        "error",
                        "Reverse geocoding failed",
                    ),
                }
    except Exception as exc:
        print(
            "[Scans] Warning: reverse geocoding failed:",
            exc,
        )
    # --------------------------------------------------------
    # AI interpretation
    # --------------------------------------------------------
    try:
        interpretation = ai_service.generate_interpretation(
            image_path=ai_image_path,
            detections=scan.get(
                "detections",
                [],
            ),
            metadata=metadata,
            provider_override=provider,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI interpretation failed: {exc}",
        )
    # --------------------------------------------------------
    # Attach verified geospatial information
    # --------------------------------------------------------
    geospatial = metadata.get("geospatial")
    if geospatial:
        interpretation["geospatial"] = geospatial
    if location_info and location_info.get("success"):
        interpretation["location"] = {
            "name": location_info.get("locationName"),
            "fullAddress": location_info.get("fullAddress"),
            "place": location_info.get("place"),
            "region": location_info.get("region"),
            "country": location_info.get("country"),
            "latitude": location_info.get("latitude"),
            "longitude": location_info.get("longitude"),
        }
    elif geospatial and geospatial.get("center"):
        interpretation["location"] = geospatial.get("center")
    # --------------------------------------------------------
    # Save AI result
    # --------------------------------------------------------
    provider_name = (
        interpretation.get("provider")
        or provider
        or ai_service.active_provider
    )
    update_data = {
        "aiProvider": provider_name,
        "aiAnalysis": interpretation,
        "status": "Analyzed",
        "updatedAt": datetime.utcnow().isoformat(),
    }
    try:
        update_scan_record(
            scan_id,
            update_data,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save AI analysis: {exc}",
        )
    return {
        "scanId": scan_id,
        "aiProvider": provider_name,
        "aiAnalysis": interpretation,
    }
# ============================================================
# SAVE SCAN
# ============================================================
@router.post("/{scan_id}/save")
async def save_scan(
    scan_id: str
):
    scan = db.get_scan(
        scan_id
    )
    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )
    update_data = {
        "saved": True,
        "status": "Saved",
        "updatedAt": (
            datetime.utcnow().isoformat()
        ),
    }
    try:
        update_scan_record(
            scan_id,
            update_data,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save scan: {exc}"
            ),
        )
    return {
        "scanId": scan_id,
        "saved": True,
        "status": "Saved",
    }
# ============================================================
# LIST SCANS
# ============================================================
@router.get("")
async def list_scans():
    try:
        return db.list_scans()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to list scans: {exc}"
            ),
        )
# ============================================================
# GET SINGLE SCAN
# ============================================================
@router.get("/{scan_id}")
async def get_scan(
    scan_id: str
):
    scan = db.get_scan(
        scan_id
    )
    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )
    return scan
# ============================================================
# DELETE SCAN
# ============================================================
@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str
):
    scan = db.get_scan(
        scan_id
    )
    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )
    try:
        db.delete_scan(
            scan_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to delete scan: {exc}"
            ),
        )
    # --------------------------------------------------------
    # Best-effort GridFS + local cleanup
    storage = scan.get("storage") or {}
    for key in ("originalFileId", "displayFileId", "annotatedFileId"):
        file_id = storage.get(key)
        if file_id:
            try:
                db.delete_file(file_id)
            except Exception as exc:
                print(f"[Scans] Warning: could not delete GridFS file {file_id}: {exc}")
    saved_filename = scan.get("savedFilename")
    if saved_filename:
        original_file = Path(settings.upload_dir) / saved_filename
        try:
            if original_file.exists():
                original_file.unlink()
        except Exception as exc:
            print(f"[Scans] Warning: could not delete local file: {exc}")
    return {
        "scanId": scan_id,
        "deleted": True,
    }
