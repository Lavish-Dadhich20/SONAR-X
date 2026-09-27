import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from PIL import Image, ExifTags
import cv2
import numpy as np
import onnxruntime as ort

from config import settings

import rasterio
from rasterio.enums import Resampling
from pyproj import Transformer


class YOLOService:

    def __init__(self):
        self.model = None
        self.input_name: Optional[str] = None
        self.output_name: Optional[str] = None

        self.input_width = 320
        self.input_height = 320

        self.classes: Dict[int, str] = {
            0: "submarine_pipeline",
            1: "shipwreck",
            2: "ghost_net",
            3: "mine_cylinder",
            4: "aircraft",
            5: "other"
        }

        self.model_info: Dict[str, Any] = {}

        self.load_model()

    # ============================================================
    # MODEL LOADING
    # ============================================================

    def load_model(self):

        model_path = Path(settings.model_path)

        if model_path.suffix.lower() != ".onnx":
            onnx_path = model_path.with_suffix(".onnx")

            if onnx_path.exists():
                model_path = onnx_path

        if not model_path.exists():

            print(
                f"[ONNX] Warning: Model file not found at {model_path}"
            )

            self.model_info = {
                "loaded": False,
                "error": f"Model file not found: {model_path}",
                "weights_file": model_path.name
            }

            return

        try:

            print(
                f"[ONNX] Loading model from {model_path}..."
            )

            options = ort.SessionOptions()

            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

            self.model = ort.InferenceSession(
                str(model_path),
                sess_options=options,
                providers=["CPUExecutionProvider"]
            )

            model_input = self.model.get_inputs()[0]
            model_output = self.model.get_outputs()[0]

            self.input_name = model_input.name
            self.output_name = model_output.name

            shape = model_input.shape

            if len(shape) == 4:

                if isinstance(shape[2], int):
                    self.input_height = int(shape[2])

                if isinstance(shape[3], int):
                    self.input_width = int(shape[3])

            self.model_info = {
                "name": "SONAR-X Object Detector",
                "weights_file": model_path.name,
                "task": "detect",
                "classes": self.classes,
                "classes_count": len(self.classes),
                "parameters": 0,
                "loaded": True,
                "runtime": "ONNX Runtime",
                "providers": self.model.get_providers(),
                "input_name": self.input_name,
                "input_shape": model_input.shape,
                "output_name": self.output_name,
                "output_shape": model_output.shape
            }

            print(
                f"[ONNX] Successfully loaded model with "
                f"{len(self.classes)} classes: {self.classes}"
            )

            print(
                f"[ONNX] Provider: "
                f"{self.model.get_providers()[0]}"
            )

            print(
                f"[ONNX] Input: {model_input.shape}"
            )

            print(
                f"[ONNX] Output: {model_output.shape}"
            )

        except Exception as e:

            print(
                f"[ONNX] Error loading model: {e}"
            )

            self.model = None

            self.model_info = {
                "loaded": False,
                "error": str(e),
                "weights_file": model_path.name,
                "runtime": "ONNX Runtime"
            }

    # ============================================================
    # BASIC MODEL INFORMATION
    # ============================================================

    def is_loaded(self) -> bool:
        return self.model is not None

    def get_classes(self) -> List[Dict[str, Any]]:

        return [
            {
                "id": k,
                "name": v
            }

            for k, v in sorted(self.classes.items())
        ]

    # ============================================================
    # EXIF GPS EXTRACTION
    # ============================================================

    def _extract_gps_coords(
        self,
        gps_info: Dict[int, Any]
    ) -> Optional[Dict[str, float]]:

        try:

            gps_tags = {}

            for tag_id in gps_info:

                name = ExifTags.GPSTAGS.get(
                    tag_id,
                    tag_id
                )

                gps_tags[name] = gps_info[tag_id]

            def to_float(value):

                try:
                    return float(value)

                except Exception:

                    try:
                        return (
                            float(value.numerator)
                            /
                            float(value.denominator)
                        )

                    except Exception:

                        return (
                            float(value[0])
                            /
                            float(value[1])
                        )

            def convert(value):

                if (
                    isinstance(value, (list, tuple))
                    and len(value) >= 3
                ):

                    return (
                        to_float(value[0])
                        +
                        to_float(value[1]) / 60.0
                        +
                        to_float(value[2]) / 3600.0
                    )

                return to_float(value)

            if (
                "GPSLatitude" not in gps_tags
                or
                "GPSLongitude" not in gps_tags
            ):

                return None

            lat = convert(
                gps_tags["GPSLatitude"]
            )

            lon = convert(
                gps_tags["GPSLongitude"]
            )

            if (
                str(
                    gps_tags.get(
                        "GPSLatitudeRef",
                        "N"
                    )
                ).upper() == "S"
            ):

                lat = -lat

            if (
                str(
                    gps_tags.get(
                        "GPSLongitudeRef",
                        "E"
                    )
                ).upper() == "W"
            ):

                lon = -lon

            return {
                "latitude": round(lat, 6),
                "longitude": round(lon, 6)
            }

        except Exception as e:

            print(
                f"[Metadata] GPS parsing warning: {e}"
            )

            return None

    # ============================================================
    # IMAGE METADATA
    # ============================================================

    def extract_image_metadata(
        self,
        image_path: str
    ) -> Dict[str, Any]:

        path = Path(image_path)

        try:

            file_size_bytes = path.stat().st_size

        except Exception:

            file_size_bytes = 0

        meta = {
            "filename": path.name,

            "fileSizeBytes": file_size_bytes,

            "fileSizeFormatted": (
                f"{file_size_bytes / 1024:.1f} KB"
                if file_size_bytes < 1024 * 1024

                else
                f"{file_size_bytes / (1024 * 1024):.2f} MB"
            ),

            "width": 0,
            "height": 0,

            "format": "Unknown",

            "captureDate": None,

            "gps": None,

            "isGeoTIFF": False,

            "geospatial": None
        }

        try:

            with Image.open(image_path) as img:

                meta["width"], meta["height"] = img.size

                meta["format"] = img.format or "Unknown"

                # =================================================
                # PNG CUSTOM METADATA
                # =================================================
                #
                # Your generated PNG files contain:
                #
                # latitude = "15.0"
                # longitude = "65.0"
                #
                # inside PNG text metadata.
                #
                # This is NOT EXIF GPS metadata.
                #
                if img.format == "PNG":

                    latitude = img.info.get(
                        "latitude"
                    )

                    longitude = img.info.get(
                        "longitude"
                    )

                    if (
                        latitude is not None
                        and
                        longitude is not None
                    ):

                        try:

                            meta["gps"] = {
                                "latitude": round(
                                    float(latitude),
                                    6
                                ),

                                "longitude": round(
                                    float(longitude),
                                    6
                                )
                            }

                            print(
                                "[Metadata] PNG GPS found: "
                                f"{meta['gps']}"
                            )

                        except (
                            ValueError,
                            TypeError
                        ):

                            print(
                                "[Metadata] Invalid PNG "
                                "latitude/longitude"
                            )

                # =================================================
                # EXISTING EXIF METADATA
                # =================================================

                try:

                    exif_data = img.getexif()

                except Exception:

                    exif_data = None

                if exif_data:

                    for tag_id, value in exif_data.items():

                        tag_name = ExifTags.TAGS.get(
                            tag_id,
                            tag_id
                        )

                        # Capture date
                        if tag_name in {
                            "DateTimeOriginal",
                            "DateTime"
                        }:

                            meta["captureDate"] = str(
                                value
                            )

                        # EXIF GPS
                        elif tag_name == "GPSInfo":

                            if isinstance(
                                value,
                                dict
                            ):

                                gps = (
                                    self._extract_gps_coords(
                                        value
                                    )
                                )

                                if gps:

                                    meta["gps"] = gps

        except Exception as e:

            print(
                f"[Metadata] Warning parsing image "
                f"metadata: {e}"
            )

        return meta

    # ============================================================
    # GEOTIFF METADATA
    # ============================================================

    def extract_geotiff_metadata(
        self,
        image_path: str
    ) -> Dict[str, Any]:

        path = Path(image_path)

        try:

            with rasterio.open(image_path) as src:

                bounds = src.bounds

                transform = src.transform

                center_x = (
                    bounds.left
                    +
                    bounds.right
                ) / 2.0

                center_y = (
                    bounds.bottom
                    +
                    bounds.top
                ) / 2.0

                center = None

                if src.crs:

                    try:

                        transformer = (
                            Transformer.from_crs(
                                src.crs,
                                "EPSG:4326",
                                always_xy=True
                            )
                        )

                        lon, lat = transformer.transform(
                            center_x,
                            center_y
                        )

                        center = {
                            "latitude": round(
                                float(lat),
                                6
                            ),

                            "longitude": round(
                                float(lon),
                                6
                            )
                        }

                    except Exception:

                        center = None

                return {
                    "hasGeodata": bool(src.crs),

                    "crs": (
                        str(src.crs)
                        if src.crs
                        else None
                    ),

                    "width": int(src.width),

                    "height": int(src.height),

                    "bandCount": int(src.count),

                    "bounds": {
                        "left": float(bounds.left),
                        "bottom": float(bounds.bottom),
                        "right": float(bounds.right),
                        "top": float(bounds.top)
                    },

                    "center": center,

                    "resolution": {
                        "x": float(transform.a),
                        "y": float(transform.e)
                    }
                }

        except Exception as e:

            print(
                f"[GeoTIFF] Metadata extraction failed: {e}"
            )

            return {
                "hasGeodata": False,
                "error": str(e)
            }

    # ============================================================
    # GEOTIFF PREVIEW
    # ============================================================

    def create_geotiff_preview(
        self,
        image_path: str
    ) -> str:

        path = Path(image_path)

        preview_path = (
            path.parent
            /
            f"{path.stem}_preview.png"
        )

        with rasterio.open(image_path) as src:

            if src.count >= 3:

                indexes = [1, 2, 3]

            else:

                indexes = [1]

            scale = max(
                src.width,
                src.height
            ) / 2048.0

            out_width = max(
                1,
                int(src.width / scale)
            )

            out_height = max(
                1,
                int(src.height / scale)
            )

            data = src.read(
                indexes,
                out_shape=(
                    len(indexes),
                    out_height,
                    out_width
                ),
                resampling=Resampling.bilinear
            )

            data = np.moveaxis(
                data,
                0,
                -1
            )

            if data.shape[2] == 1:

                data = np.repeat(
                    data,
                    3,
                    axis=2
                )

            data = data.astype(
                np.float32
            )

            for c in range(3):

                channel = data[:, :, c]

                if np.any(
                    np.isfinite(channel)
                ):

                    lo, hi = np.percentile(
                        channel,
                        [2, 98]
                    )

                else:

                    lo, hi = 0, 1

                if hi > lo:

                    data[:, :, c] = np.clip(
                        (
                            channel - lo
                        )
                        *
                        255.0
                        /
                        (
                            hi - lo
                        ),

                        0,
                        255
                    )

                else:

                    data[:, :, c] = 0

            data = data.astype(
                np.uint8
            )

            cv2.imwrite(
                str(preview_path),
                cv2.cvtColor(
                    data,
                    cv2.COLOR_RGB2BGR
                )
            )

        return str(preview_path)

    # ============================================================
    # PREPARE IMAGE FOR DETECTION
    # ============================================================

    def prepare_image_for_detection(
        self,
        image_path: str
    ) -> Dict[str, Any]:

        path = Path(image_path)

        extension = path.suffix.lower()

        # =========================================================
        # GEOTIFF
        # =========================================================

        if extension in {
            ".tif",
            ".tiff"
        }:

            geospatial = (
                self.extract_geotiff_metadata(
                    str(path)
                )
            )

            preview_path = (
                self.create_geotiff_preview(
                    str(path)
                )
            )

            return {
    "detectionPath": str(path),
    "displayPath": preview_path,
    "isGeoTIFF": True,
    "geospatial": geospatial,
    "originalWidth": geospatial.get("width", 0),
    "originalHeight": geospatial.get("height", 0),
}

        # =========================================================
        # PNG / JPG / JPEG
        # =========================================================

        try:

            with Image.open(path) as img:

                width, height = img.size

        except Exception:

            width = height = 0

        return {
            "detectionPath": str(path),

            "displayPath": str(path),

            "isGeoTIFF": False,

            "geospatial": None,

            "originalWidth": width,

            "originalHeight": height
        }

    # ============================================================
    # PIXEL → GEOGRAPHIC COORDINATE
    # ============================================================

    def pixel_to_geographic(
        self,
        image_path: str,
        pixel_x: float,
        pixel_y: float
    ) -> Optional[Dict[str, float]]:

        try:

            with rasterio.open(
                image_path
            ) as src:

                if not src.crs:

                    return None

                projected_x, projected_y = (
                    src.transform
                    *
                    (
                        pixel_x,
                        pixel_y
                    )
                )

                transformer = (
                    Transformer.from_crs(
                        src.crs,
                        "EPSG:4326",
                        always_xy=True
                    )
                )

                longitude, latitude = (
                    transformer.transform(
                        projected_x,
                        projected_y
                    )
                )

                return {
                    "latitude": round(
                        float(latitude),
                        6
                    ),

                    "longitude": round(
                        float(longitude),
                        6
                    ),

                    "projectedX": round(
                        float(projected_x),
                        3
                    ),

                    "projectedY": round(
                        float(projected_y),
                        3
                    )
                }

        except Exception as e:

            print(
                "[GeoTIFF] Pixel-to-coordinate "
                f"conversion failed: {e}"
            )

            return None

    # ============================================================
    # LETTERBOX
    # ============================================================

    def _letterbox(
        self,
        image: np.ndarray,
        new_size: Tuple[int, int] = (320, 320)
    ) -> Tuple[
        np.ndarray,
        float,
        int,
        int
    ]:

        new_w, new_h = new_size

        h, w = image.shape[:2]

        scale = min(
            new_w / w,
            new_h / h
        )

        resized_w = max(
            1,
            int(round(w * scale))
        )

        resized_h = max(
            1,
            int(round(h * scale))
        )

        resized = cv2.resize(
            image,
            (
                resized_w,
                resized_h
            ),
            interpolation=cv2.INTER_LINEAR
        )

        canvas = np.full(
            (
                new_h,
                new_w,
                3
            ),
            114,
            dtype=np.uint8
        )

        pad_x = (
            new_w - resized_w
        ) // 2

        pad_y = (
            new_h - resized_h
        ) // 2

        canvas[
            pad_y:
            pad_y + resized_h,
            pad_x:
            pad_x + resized_w
        ] = resized

        return (
            canvas,
            scale,
            pad_x,
            pad_y
        )

    # ============================================================
    # CLASS-AWARE NMS
    # ============================================================

    def _class_aware_nms(
        self,
        boxes: List[List[float]],
        scores: List[float],
        class_ids: List[int],
        iou: float
    ) -> List[int]:

        keep = []

        for class_id in sorted(
            set(class_ids)
        ):

            indices = [
                i
                for i, c
                in enumerate(class_ids)
                if c == class_id
            ]

            class_boxes = [
                boxes[i]
                for i in indices
            ]

            class_scores = [
                scores[i]
                for i in indices
            ]

            selected = cv2.dnn.NMSBoxes(
                class_boxes,
                class_scores,
                0.0,
                iou
            )

            if len(selected):

                selected = (
                    np.asarray(selected)
                    .reshape(-1)
                    .tolist()
                )

                keep.extend(
                    indices[int(i)]
                    for i in selected
                )

        return sorted(keep)

    # ============================================================
    # ONNX OUTPUT DECODING
    # ============================================================

    def _decode_onnx(
        self,
        output: np.ndarray,
        original_width: int,
        original_height: int,
        conf: float,
        iou: float,
        pad_x: int,
        pad_y: int,
        scale: float
    ) -> List[Dict[str, Any]]:

        raw = np.asarray(output)

        if raw.ndim == 3:

            raw = raw[0]

        if raw.ndim != 2:

            raise RuntimeError(
                f"Unexpected ONNX output shape: "
                f"{raw.shape}"
            )

        # =========================================================
        # OUTPUT FORMAT: x1 y1 x2 y2 score class
        # =========================================================

        if raw.shape[1] == 6:

            detections = []

            for row in raw:

                (
                    x1,
                    y1,
                    x2,
                    y2,
                    score,
                    class_id
                ) = [
                    float(v)
                    for v in row
                ]

                if score < conf:

                    continue

                x1 = (
                    x1 - pad_x
                ) / scale

                y1 = (
                    y1 - pad_y
                ) / scale

                x2 = (
                    x2 - pad_x
                ) / scale

                y2 = (
                    y2 - pad_y
                ) / scale

                x1 = max(
                    0.0,
                    min(
                        float(original_width),
                        x1
                    )
                )

                y1 = max(
                    0.0,
                    min(
                        float(original_height),
                        y1
                    )
                )

                x2 = max(
                    0.0,
                    min(
                        float(original_width),
                        x2
                    )
                )

                y2 = max(
                    0.0,
                    min(
                        float(original_height),
                        y2
                    )
                )

                if x2 <= x1 or y2 <= y1:

                    continue

                detections.append({
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "confidence": score,
                    "classId": int(class_id)
                })

            print(
                "[ONNX] Processed detections "
                f"above threshold: {len(detections)}"
            )

            return detections

        # =========================================================
        # TRANSPOSE IF NEEDED
        # =========================================================

        if (
            raw.shape[0] == 6
            and raw.shape[1] != 6
        ):

            raw = raw.T

        if raw.shape[1] < 5:

            raise RuntimeError(
                f"Unsupported ONNX output shape: "
                f"{raw.shape}"
            )

        class_count = min(
            len(self.classes),
            raw.shape[1] - 4
        )

        boxes = []
        scores = []
        class_ids = []

        for row in raw:

            class_scores = row[
                4:
                4 + class_count
            ]

            class_id = int(
                np.argmax(class_scores)
            )

            score = float(
                class_scores[class_id]
            )

            if score < conf:

                continue

            cx, cy, bw, bh = [
                float(v)
                for v in row[:4]
            ]

            x1 = (
                cx
                -
                bw / 2.0
                -
                pad_x
            ) / scale

            y1 = (
                cy
                -
                bh / 2.0
                -
                pad_y
            ) / scale

            x2 = (
                cx
                +
                bw / 2.0
                -
                pad_x
            ) / scale

            y2 = (
                cy
                +
                bh / 2.0
                -
                pad_y
            ) / scale

            x1 = max(
                0.0,
                min(
                    float(original_width),
                    x1
                )
            )

            y1 = max(
                0.0,
                min(
                    float(original_height),
                    y1
                )
            )

            x2 = max(
                0.0,
                min(
                    float(original_width),
                    x2
                )
            )

            y2 = max(
                0.0,
                min(
                    float(original_height),
                    y2
                )
            )

            if x2 <= x1 or y2 <= y1:

                continue

            boxes.append([
                x1,
                y1,
                x2 - x1,
                y2 - y1
            ])

            scores.append(score)

            class_ids.append(class_id)

        print(
            f"[ONNX] Detection candidates: "
            f"{len(boxes)}"
        )

        keep = self._class_aware_nms(
            boxes,
            scores,
            class_ids,
            iou
        )

        print(
            f"[ONNX] Detections after NMS: "
            f"{len(keep)}"
        )

        detections = []

        for idx in keep:

            x, y, w, h = boxes[idx]

            detections.append({
                "x1": x,
                "y1": y,
                "x2": x + w,
                "y2": y + h,
                "confidence": scores[idx],
                "classId": class_ids[idx]
            })

        return detections

    # ============================================================
    # MAIN INFERENCE
    # ============================================================

    def run_inference(
        self,
        image_path: str,
        conf_thresh: Optional[float] = None,
        iou_thresh: Optional[float] = None
    ) -> Dict[str, Any]:

        if not self.model:

            raise RuntimeError(
                "YOLO ONNX model is not loaded."
            )

        conf = float(
            conf_thresh
            if conf_thresh is not None
            else settings.confidence_threshold
        )

        iou = float(
            iou_thresh
            if iou_thresh is not None
            else settings.iou_threshold
        )

        original_path = Path(
            image_path
        )

        preparation = (
            self.prepare_image_for_detection(
                str(original_path)
            )
        )

        detection_path = Path(
            preparation["detectionPath"]
        )

        is_geotiff = bool(
            preparation["isGeoTIFF"]
        )

        geospatial = preparation.get(
            "geospatial"
        )

        original_width = int(
            preparation.get(
                "originalWidth",
                0
            )
        )

        original_height = int(
            preparation.get(
                "originalHeight",
                0
            )
        )

        # =========================================================
        # READ ORIGINAL IMAGE METADATA
        # =========================================================

        metadata = (
            self.extract_image_metadata(
                str(original_path)
            )
        )

        # =========================================================
        # GEOTIFF OVERRIDE
        # =========================================================

        if is_geotiff:

            metadata["filename"] = (
                original_path.name
            )

            metadata["format"] = (
                original_path
                .suffix
                .lstrip(".")
                .upper()
            )

            metadata["isGeoTIFF"] = True

            metadata["geospatial"] = (
                geospatial
            )

            metadata["width"] = (
                original_width
            )

            metadata["height"] = (
                original_height
            )

            if (
                geospatial
                and
                geospatial.get("center")
            ):

                metadata["gps"] = (
                    geospatial["center"]
                )

        # =========================================================
        # READ DETECTION IMAGE METADATA
        # =========================================================

        detection_metadata = (
            self.extract_image_metadata(
                str(detection_path)
            )
        )

        detection_width = int(
            detection_metadata.get(
                "width",
                0
            )
        ) or original_width

        detection_height = int(
            detection_metadata.get(
                "height",
                0
            )
        ) or original_height

        print(
            f"[ONNX] Running inference on "
            f"{detection_path}"
        )

        image = cv2.imread(
            str(detection_path),
            cv2.IMREAD_COLOR
        )

        if image is None:

            raise RuntimeError(
                f"Could not read image: "
                f"{detection_path}"
            )

        # =========================================================
        # PREPROCESS
        # =========================================================

        (
            letterboxed,
            scale,
            pad_x,
            pad_y
        ) = self._letterbox(
            image,
            (
                self.input_width,
                self.input_height
            )
        )

        rgb = cv2.cvtColor(
            letterboxed,
            cv2.COLOR_BGR2RGB
        )

        tensor = (
            rgb.astype(
                np.float32
            )
            /
            255.0
        )

        tensor = np.transpose(
            tensor,
            (2, 0, 1)
        )[None, ...]

        # =========================================================
        # ONNX INFERENCE
        # =========================================================

        outputs = self.model.run(
            [self.output_name],
            {
                self.input_name: tensor
            }
        )

        decoded = self._decode_onnx(
            outputs[0],
            detection_width,
            detection_height,
            conf,
            iou,
            pad_x,
            pad_y,
            scale
        )

        # =========================================================
        # ANNOTATIONS
        # =========================================================

        annotated = image.copy()

        crop_dir = (
            Path(settings.upload_dir)
            /
            "crops"
        )

        crop_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        detections = []

        # =========================================================
        # PROCESS EACH DETECTION
        # =========================================================

        for idx, box in enumerate(
            decoded
        ):

            cls_id = int(
                box["classId"]
            )

            class_name = self.classes.get(
                cls_id,
                f"class_{cls_id}"
            )

            confidence = float(
                box["confidence"]
            )

            x1 = float(
                box["x1"]
            )

            y1 = float(
                box["y1"]
            )

            x2 = float(
                box["x2"]
            )

            y2 = float(
                box["y2"]
            )

            # -----------------------------------------------------
            # DRAW BOX
            # -----------------------------------------------------

            cv2.rectangle(
                annotated,
                (
                    int(x1),
                    int(y1)
                ),
                (
                    int(x2),
                    int(y2)
                ),
                (0, 255, 0),
                2
            )

            label = (
                f"{class_name} "
                f"{confidence * 100:.1f}%"
            )

            cv2.putText(
                annotated,
                label,
                (
                    int(x1),
                    max(
                        20,
                        int(y1) - 8
                    )
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2,
                cv2.LINE_AA
            )

            # -----------------------------------------------------
            # NORMALIZED BOUNDING BOX
            # -----------------------------------------------------

            norm_x = (
                x1 / detection_width
                if detection_width
                else 0
            )

            norm_y = (
                y1 / detection_height
                if detection_height
                else 0
            )

            norm_w = (
                (x2 - x1)
                /
                detection_width
                if detection_width
                else 0
            )

            norm_h = (
                (y2 - y1)
                /
                detection_height
                if detection_height
                else 0
            )

            # -----------------------------------------------------
            # MAP BACK TO ORIGINAL IMAGE
            # -----------------------------------------------------

            original_x1 = (
                norm_x * original_width
                if original_width
                else x1
            )

            original_y1 = (
                norm_y * original_height
                if original_height
                else y1
            )

            original_x2 = (
                (norm_x + norm_w)
                *
                original_width
                if original_width
                else x2
            )

            original_y2 = (
                (norm_y + norm_h)
                *
                original_height
                if original_height
                else y2
            )

            # -----------------------------------------------------
            # CROP COORDINATES
            # -----------------------------------------------------

            cx1 = max(
                0,
                min(
                    detection_width,
                    int(x1)
                )
            )

            cy1 = max(
                0,
                min(
                    detection_height,
                    int(y1)
                )
            )

            cx2 = max(
                0,
                min(
                    detection_width,
                    int(x2)
                )
            )

            cy2 = max(
                0,
                min(
                    detection_height,
                    int(y2)
                )
            )

            crop_filename = (
                f"crop_"
                f"{detection_path.stem}_"
                f"{idx}_"
                f"{class_name}.jpg"
            )

            crop_path = (
                crop_dir
                /
                crop_filename
            )

            crop_url = None

            if (
                cx2 > cx1
                and
                cy2 > cy1
            ):

                crop_cv = image[
                    cy1:cy2,
                    cx1:cx2
                ]

                if crop_cv.size:

                    cv2.imwrite(
                        str(crop_path),
                        crop_cv
                    )

                    crop_url = (
                        f"/uploads/crops/"
                        f"{crop_filename}"
                    )

            # =====================================================
            # DETECTION GEOLOCATION
            # =====================================================

            geo_location = None

            if (
                is_geotiff
                and
                geospatial
                and
                geospatial.get(
                    "hasGeodata"
                )
            ):

                center_pixel_x = (
                    original_x1
                    +
                    original_x2
                ) / 2.0

                center_pixel_y = (
                    original_y1
                    +
                    original_y2
                ) / 2.0

                geo_location = (
                    self.pixel_to_geographic(
                        str(original_path),
                        center_pixel_x,
                        center_pixel_y
                    )
                )

            # =====================================================
            # DETECTION RESULT
            # =====================================================

            detections.append({

                "id": (
                    f"det_{idx + 1:02d}"
                ),

                "detectionIndex": (
                    idx + 1
                ),

                "classId": cls_id,

                "className": class_name,

                "confidence": round(
                    confidence,
                    4
                ),

                "confidencePercent": round(
                    confidence * 100,
                    1
                ),

                "isLowConfidence": (
                    confidence < 0.50
                ),

                "boundingBox": {

                    "x": round(
                        norm_x,
                        4
                    ),

                    "y": round(
                        norm_y,
                        4
                    ),

                    "w": round(
                        norm_w,
                        4
                    ),

                    "h": round(
                        norm_h,
                        4
                    ),

                    "pixel": {

                        "x1": round(
                            original_x1,
                            1
                        ),

                        "y1": round(
                            original_y1,
                            1
                        ),

                        "x2": round(
                            original_x2,
                            1
                        ),

                        "y2": round(
                            original_y2,
                            1
                        ),

                        "width": round(
                            original_x2
                            -
                            original_x1,
                            1
                        ),

                        "height": round(
                            original_y2
                            -
                            original_y1,
                            1
                        )
                    }
                },

                "cropUrl": crop_url,

                "geoLocation": geo_location
            })

        # ============================================================
        # SAVE ANNOTATED IMAGE
        # ============================================================

        upload_dir = Path(
            settings.upload_dir
        )

        upload_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        annotated_filename = (
            f"annotated_"
            f"{detection_path.stem}.png"
        )

        annotated_path = (
            upload_dir
            /
            annotated_filename
        )

        if not cv2.imwrite(
            str(annotated_path),
            annotated
        ):

            raise RuntimeError(
                "Failed to save annotated "
                f"image: {annotated_path}"
            )

        # ============================================================
        # FINAL RESULT
        # ============================================================

        highest_conf = max(
            (
                d["confidence"]
                for d in detections
            ),
            default=0.0
        )

        print(
            f"[YOLO] Detection complete: "
            f"{len(detections)} object(s)"
        )

        return {

            "detectionCount": len(
                detections
            ),

            "highestConfidence": round(
                highest_conf,
                4
            ),

            "detections": detections,

            "annotatedImageUrl": (
                f"/uploads/"
                f"{annotated_filename}"
            ),

            "confThresholdUsed": conf,

            "iouThresholdUsed": iou,

            "metadata": metadata,

            "isGeoTIFF": is_geotiff,

            "geospatial": geospatial,

            "originalImagePath": str(
                original_path
            ),

            "detectionImagePath": str(
                detection_path
            )
        }

    # ============================================================
    # EVALUATION METRICS
    # ============================================================

    def get_evaluation_metrics(
        self
    ) -> Dict[str, Any]:

        if not self.model:

            return {
                "available": False,
                "message": (
                    "YOLO ONNX model is not loaded."
                )
            }

        return {

            "available": False,

            "message": (
                "Evaluation metrics are not "
                "embedded in the ONNX model file."
            ),

            "modelName": self.model_info.get(
                "name",
                "SONAR-X Object Detector"
            ),

            "weights": self.model_info.get(
                "weights_file",
                "best.onnx"
            ),

            "task": "detect",

            "classes": self.get_classes()
        }


# ================================================================
# GLOBAL SERVICE INSTANCE
# ================================================================

yolo_service = YOLOService()