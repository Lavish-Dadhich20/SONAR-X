import os

from pathlib import Path

from typing import Dict, Any, List, Optional, Tuple



from PIL import Image, ExifTags



import cv2

import numpy as np



from ultralytics import YOLO



from config import settings





# GeoTIFF dependencies

import rasterio

from rasterio.enums import Resampling

from pyproj import Transformer





class YOLOService:

    def __init__(self):

        self.model: Optional[YOLO] = None

        self.classes: Dict[int, str] = {}

        self.model_info: Dict[str, Any] = {}



        self.load_model()



    # =========================================================

    # MODEL LOADING

    # =========================================================



    def load_model(self):

        model_path = Path(settings.model_path)



        if not model_path.exists():

            print(

                f"[YOLO] Warning: Model file not found at {model_path}"

            )

            return



        try:

            print(

                f"[YOLO] Loading model from {model_path}..."

            )



            self.model = YOLO(str(model_path))



            self.classes = {

                int(k): str(v)

                for k, v in self.model.names.items()

            }



            # Parameter count

            params = (

                sum(

                    p.numel()

                    for p in self.model.model.parameters()

                )

                if hasattr(self.model, "model")

                else 0

            )



            self.model_info = {

                "name": "SONAR-X Object Detector",

                "weights_file": model_path.name,

                "task": getattr(

                    self.model,

                    "task",

                    "detect",

                ),

                "classes": self.classes,

                "classes_count": len(self.classes),

                "parameters": params,

                "loaded": True,

            }



            print(

                f"[YOLO] Successfully loaded model "

                f"with {len(self.classes)} classes: "

                f"{self.classes}"

            )



        except Exception as e:

            print(

                f"[YOLO] Error loading model: {e}"

            )



            self.model = None



            self.model_info = {

                "loaded": False,

                "error": str(e),

            }



    # =========================================================

    # BASIC MODEL INFO

    # =========================================================



    def is_loaded(self) -> bool:

        return self.model is not None



    def get_classes(self) -> List[Dict[str, Any]]:

        if not self.classes:

            return []



        return [

            {

                "id": k,

                "name": v,

            }

            for k, v in sorted(

                self.classes.items()

            )

        ]



    # =========================================================

    # STANDARD IMAGE METADATA

    # =========================================================



    def extract_image_metadata(

        self,

        image_path: str

    ) -> Dict[str, Any]:

        """

        Extract real dimensions, file size, format,

        EXIF date and genuine EXIF GPS coordinates.



        This is used for normal JPG/JPEG/PNG images.



        GeoTIFF geospatial information is handled separately

        by extract_geotiff_metadata().

        """



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

                else f"{file_size_bytes / (1024 * 1024):.2f} MB"

            ),



            "width": 0,



            "height": 0,



            "format": "Unknown",



            "captureDate": None,



            "gps": None,



            "isGeoTIFF": False,



            "geospatial": None,

        }



        try:

            with Image.open(image_path) as img:



                meta["width"], meta["height"] = img.size



                meta["format"] = (

                    img.format

                    or "Unknown"

                )



                # ---------------------------------------------

                # EXIF

                # ---------------------------------------------



                exif_data = None



                try:

                    exif_data = img.getexif()

                except Exception:

                    exif_data = None



                if exif_data:



                    for tag_id, value in exif_data.items():



                        tag_name = ExifTags.TAGS.get(

                            tag_id,

                            tag_id,

                        )



                        if tag_name in {

                            "DateTimeOriginal",

                            "DateTime",

                        }:



                            meta["captureDate"] = str(

                                value

                            )



                        elif tag_name == "GPSInfo":



                            gps_coords = (

                                self._extract_gps_coords(

                                    value

                                )

                            )



                            if gps_coords:

                                meta["gps"] = gps_coords



        except Exception as e:



            print(

                f"[Metadata] Warning parsing image metadata: {e}"

            )



        return meta



    # =========================================================

    # EXIF GPS

    # =========================================================



    def _extract_gps_coords(

        self,

        gps_info: Dict[int, Any]

    ) -> Optional[Dict[str, float]]:

        """

        Extract genuine decimal latitude/longitude

        from EXIF GPS information.

        """



        try:



            gps_tags = {}



            for tag_id in gps_info:



                sub_name = ExifTags.GPSTAGS.get(

                    tag_id,

                    tag_id,

                )



                gps_tags[sub_name] = gps_info[

                    tag_id

                ]



            def _convert_to_degrees(value):



                d = float(value[0])

                m = float(value[1])

                s = float(value[2])



                return (

                    d

                    + (m / 60.0)

                    + (s / 3600.0)

                )



            lat_val = gps_tags.get(

                "GPSLatitude"

            )



            lat_ref = gps_tags.get(

                "GPSLatitudeRef"

            )



            lon_val = gps_tags.get(

                "GPSLongitude"

            )



            lon_ref = gps_tags.get(

                "GPSLongitudeRef"

            )



            if (

                lat_val

                and lat_ref

                and lon_val

                and lon_ref

            ):



                lat = _convert_to_degrees(

                    lat_val

                )



                if str(lat_ref).upper() != "N":

                    lat = -lat



                lon = _convert_to_degrees(

                    lon_val

                )



                if str(lon_ref).upper() != "E":

                    lon = -lon



                return {

                    "latitude": round(

                        lat,

                        6,

                    ),

                    "longitude": round(

                        lon,

                        6,

                    ),

                }



        except Exception:

            pass



        return None



    # =========================================================

    # GEOTIFF METADATA

    # =========================================================



    def extract_geotiff_metadata(

        self,

        image_path: str

    ) -> Dict[str, Any]:

        """

        Extract real geospatial information from a GeoTIFF.



        This includes:



        - CRS

        - raster dimensions

        - band count

        - pixel resolution

        - projected bounds

        - projected center

        - WGS84 latitude/longitude center

        - affine transform

        """



        path = Path(image_path)



        result = {

            "isGeoTIFF": True,

            "hasGeodata": False,



            "filename": path.name,



            "crs": None,



            "width": 0,

            "height": 0,



            "bandCount": 0,



            "resolution": None,



            "bounds": None,



            "centerProjected": None,



            "center": None,



            "transform": None,

        }



        try:



            with rasterio.open(

                str(path)

            ) as src:



                result["width"] = int(

                    src.width

                )



                result["height"] = int(

                    src.height

                )



                result["bandCount"] = int(

                    src.count

                )



                result["resolution"] = {

                    "x": float(src.res[0]),

                    "y": float(src.res[1]),

                }



                bounds = src.bounds



                result["bounds"] = {

                    "left": float(bounds.left),

                    "bottom": float(bounds.bottom),

                    "right": float(bounds.right),

                    "top": float(bounds.top),

                }



                result["transform"] = [

                    float(value)

                    for value in src.transform

                ]



                center_x = (

                    bounds.left

                    + bounds.right

                ) / 2.0



                center_y = (

                    bounds.bottom

                    + bounds.top

                ) / 2.0



                result[

                    "centerProjected"

                ] = {

                    "x": float(center_x),

                    "y": float(center_y),

                }



                # -------------------------------------------------

                # CRS

                # -------------------------------------------------



                if src.crs:



                    result["hasGeodata"] = True



                    result["crs"] = (

                        src.crs.to_string()

                    )



                    # ---------------------------------------------

                    # Convert projected center -> WGS84

                    # ---------------------------------------------



                    try:



                        transformer = (

                            Transformer.from_crs(

                                src.crs,

                                "EPSG:4326",

                                always_xy=True,

                            )

                        )



                        longitude, latitude = (

                            transformer.transform(

                                center_x,

                                center_y,

                            )

                        )



                        result["center"] = {

                            "latitude": float(

                                latitude

                            ),

                            "longitude": float(

                                longitude

                            ),

                        }



                    except Exception as e:



                        print(

                            "[GeoTIFF] "

                            f"Coordinate conversion failed: {e}"

                        )



        except Exception as e:



            print(

                "[GeoTIFF] Error reading GeoTIFF metadata: "

                f"{e}"

            )



            result["error"] = str(e)



        return result



    # =========================================================

    # GEOTIFF PREVIEW

    # =========================================================



    def create_geotiff_preview(

        self,

        image_path: str,

        output_path: str,

        max_size: int = 2048,

    ) -> str:

        """

        Convert a GeoTIFF into a PNG preview.



        The original GeoTIFF remains untouched.



        The preview is used by:

        - YOLO

        - browser

        - Gemini/Groq



        The original GeoTIFF remains the source

        of truth for geospatial metadata.

        """



        print(

            f"[GeoTIFF] Creating preview for {image_path}"

        )



        with rasterio.open(

            image_path

        ) as src:



            original_width = src.width

            original_height = src.height



            scale = min(

                1.0,

                max_size

                / max(

                    original_width,

                    original_height,

                ),

            )



            output_width = max(

                1,

                int(

                    original_width

                    * scale

                ),

            )



            output_height = max(

                1,

                int(

                    original_height

                    * scale

                ),

            )



            # -----------------------------------------------------

            # Single band

            # -----------------------------------------------------



            if src.count == 1:



                data = src.read(

                    1,

                    out_shape=(

                        output_height,

                        output_width,

                    ),

                    resampling=Resampling.bilinear,

                )



                data = data.astype(

                    np.float32

                )



                finite_values = data[

                    np.isfinite(data)

                ]



                if finite_values.size:



                    min_value = float(

                        finite_values.min()

                    )



                    max_value = float(

                        finite_values.max()

                    )



                    if max_value > min_value:



                        data = (

                            (

                                data

                                - min_value

                            )

                            / (

                                max_value

                                - min_value

                            )

                            * 255.0

                        )



                    else:



                        data = np.zeros_like(

                            data

                        )



                else:



                    data = np.zeros_like(

                        data

                    )



                data = np.nan_to_num(

                    data,

                    nan=0.0,

                    posinf=255.0,

                    neginf=0.0,

                )



                data = np.clip(

                    data,

                    0,

                    255,

                ).astype(

                    np.uint8

                )



                image = Image.fromarray(

                    data,

                    mode="L",

                )



                # Convert grayscale to RGB

                # so YOLO/Gemini/browser all have

                # predictable image handling.

                image = image.convert(

                    "RGB"

                )



            # -----------------------------------------------------

            # Multiple bands

            # -----------------------------------------------------



            else:



                band_count = min(

                    src.count,

                    3,

                )



                data = src.read(

                    list(

                        range(

                            1,

                            band_count + 1,

                        )

                    ),

                    out_shape=(

                        band_count,

                        output_height,

                        output_width,

                    ),

                    resampling=Resampling.bilinear,

                )



                data = data.astype(

                    np.float32

                )



                normalized_bands = []



                for band in data:



                    finite_values = band[

                        np.isfinite(band)

                    ]



                    if finite_values.size:



                        min_value = float(

                            finite_values.min()

                        )



                        max_value = float(

                            finite_values.max()

                        )



                        if max_value > min_value:



                            normalized = (

                                (

                                    band

                                    - min_value

                                )

                                / (

                                    max_value

                                    - min_value

                                )

                                * 255.0

                            )



                        else:



                            normalized = (

                                np.zeros_like(

                                    band

                                )

                            )



                    else:



                        normalized = (

                            np.zeros_like(

                                band

                            )

                        )



                    normalized = np.nan_to_num(

                        normalized,

                        nan=0.0,

                        posinf=255.0,

                        neginf=0.0,

                    )



                    normalized = np.clip(

                        normalized,

                        0,

                        255,

                    ).astype(

                        np.uint8

                    )



                    normalized_bands.append(

                        normalized

                    )



                # If only 2 bands exist,

                # duplicate the second band.

                while len(

                    normalized_bands

                ) < 3:



                    normalized_bands.append(

                        normalized_bands[-1]

                    )



                rgb_array = np.stack(

                    normalized_bands[:3],

                    axis=-1,

                )



                image = Image.fromarray(

                    rgb_array,

                    mode="RGB",

                )



        output = Path(

            output_path

        )



        output.parent.mkdir(

            parents=True,

            exist_ok=True,

        )



        image.save(

            str(output),

            format="PNG",

        )



        print(

            f"[GeoTIFF] Preview created: {output}"

        )



        return str(output)



    # =========================================================

    # PREPARE IMAGE FOR DETECTION

    # =========================================================



    def prepare_image_for_detection(

        self,

        image_path: str,

    ) -> Dict[str, Any]:

        """

        Prepare an uploaded image for YOLO.



        Normal image:

            JPG / JPEG / PNG

            -> use original image



        GeoTIFF:

            TIF / TIFF

            -> extract geospatial metadata

            -> create PNG preview

            -> YOLO uses preview

            -> original GeoTIFF remains source of truth

        """



        path = Path(

            image_path

        )



        extension = (

            path.suffix.lower()

        )



        # -----------------------------------------------------

        # Normal image

        # -----------------------------------------------------



        if extension not in {

            ".tif",

            ".tiff",

        }:



            metadata = (

                self.extract_image_metadata(

                    str(path)

                )

            )



            return {

                "originalPath": str(path),



                "detectionPath": str(path),



                "displayPath": str(path),



                "isGeoTIFF": False,



                "geospatial": None,



                "originalWidth": metadata[

                    "width"

                ],



                "originalHeight": metadata[

                    "height"

                ],

            }



        # -----------------------------------------------------

        # GeoTIFF

        # -----------------------------------------------------



        geospatial = (

            self.extract_geotiff_metadata(

                str(path)

            )

        )



        preview_path = (

            path.parent

            / f"{path.stem}_preview.png"

        )



        self.create_geotiff_preview(

            str(path),

            str(preview_path),

        )



        return {

            "originalPath": str(path),



            "detectionPath": str(

                preview_path

            ),



            "displayPath": str(

                preview_path

            ),



            "isGeoTIFF": True,



            "geospatial": geospatial,



            "originalWidth": geospatial.get(

                "width",

                0,

            ),



            "originalHeight": geospatial.get(

                "height",

                0,

            ),

        }



    # =========================================================

    # PIXEL -> GEOGRAPHIC LOCATION

    # =========================================================



    def pixel_to_geographic(

        self,

        image_path: str,

        pixel_x: float,

        pixel_y: float,

    ) -> Optional[Dict[str, float]]:

        """

        Convert a GeoTIFF pixel coordinate into

        WGS84 latitude/longitude.



        pixel_x and pixel_y refer to the ORIGINAL

        GeoTIFF pixel coordinates.

        """



        try:



            with rasterio.open(

                image_path

            ) as src:



                if not src.crs:

                    return None



                projected_x, projected_y = (

                    src.transform

                    * (

                        pixel_x,

                        pixel_y,

                    )

                )



                transformer = (

                    Transformer.from_crs(

                        src.crs,

                        "EPSG:4326",

                        always_xy=True,

                    )

                )



                longitude, latitude = (

                    transformer.transform(

                        projected_x,

                        projected_y,

                    )

                )



                return {

                    "latitude": round(

                        float(latitude),

                        6,

                    ),



                    "longitude": round(

                        float(longitude),

                        6,

                    ),



                    "projectedX": round(

                        float(projected_x),

                        3,

                    ),



                    "projectedY": round(

                        float(projected_y),

                        3,

                    ),

                }



        except Exception as e:



            print(

                "[GeoTIFF] Pixel-to-coordinate "

                f"conversion failed: {e}"

            )



            return None



    # =========================================================

    # YOLO INFERENCE

    # =========================================================



    def run_inference(

        self,

        image_path: str,

        conf_thresh: Optional[float] = None,

        iou_thresh: Optional[float] = None,

    ) -> Dict[str, Any]:



        if not self.model:



            raise RuntimeError(

                "YOLO model is not loaded."

            )



        conf = (

            conf_thresh

            if conf_thresh is not None

            else settings.confidence_threshold

        )



        iou = (

            iou_thresh

            if iou_thresh is not None

            else settings.iou_threshold

        )



        original_path = Path(

            image_path

        )



        extension = (

            original_path.suffix.lower()

        )



        # -----------------------------------------------------

        # Prepare image

        # -----------------------------------------------------



        preparation = (

            self.prepare_image_for_detection(

                str(original_path)

            )

        )



        detection_path = Path(

            preparation["detectionPath"]

        )



        is_geotiff = preparation[

            "isGeoTIFF"

        ]



        geospatial = preparation[

            "geospatial"

        ]



        original_width = int(

            preparation.get(

                "originalWidth",

                0,

            )

        )



        original_height = int(

            preparation.get(

                "originalHeight",

                0,

            )

        )



        # -----------------------------------------------------

        # Metadata

        # -----------------------------------------------------



        if is_geotiff:

            # IMPORTANT:
            # The PNG preview is only a processing/display image.
            # Metadata must describe the ORIGINAL GeoTIFF.
            metadata = (
                self.extract_image_metadata(
                    str(original_path)
                )
            )

            metadata[
                "filename"
            ] = original_path.name

            # Preserve the original source format.
            metadata[
                "format"
            ] = original_path.suffix.lstrip(
                "."
            ).upper()

            metadata[
                "isGeoTIFF"
            ] = True

            metadata[
                "geospatial"
            ] = geospatial

            metadata[
                "width"
            ] = original_width

            metadata[
                "height"
            ] = original_height

            # GeoTIFF location is the raster center,
            # not a claimed vessel/GPS location.
            if (
                geospatial
                and geospatial.get(
                    "center"
                )
            ):

                metadata[
                    "gps"
                ] = geospatial[
                    "center"
                ]

        else:

            metadata = (
                self.extract_image_metadata(
                    str(detection_path)
                )
            )



        # -----------------------------------------------------

        # Dimensions used by YOLO preview

        # -----------------------------------------------------



        detection_metadata = (

            self.extract_image_metadata(

                str(detection_path)

            )

        )



        detection_width = int(

            detection_metadata.get(

                "width",

                0,

            )

        )



        detection_height = int(

            detection_metadata.get(

                "height",

                0,

            )

        )



        if detection_width <= 0:

            detection_width = (

                original_width

            )



        if detection_height <= 0:

            detection_height = (

                original_height

            )



        # -----------------------------------------------------

        # Run YOLO

        # -----------------------------------------------------



        print(

            f"[YOLO] Running inference on "

            f"{detection_path}"

        )



        results = self.model.predict(
    source=str(detection_path),
    conf=conf,
    iou=iou,
    imgsz=320,
    device="cpu",
    verbose=False,
)



        if not results:



            raise RuntimeError(

                "YOLO returned no inference result."

            )



        result = results[0]



        boxes = result.boxes



        # -----------------------------------------------------

        # Annotated image

        # -----------------------------------------------------



        annotated_img = result.plot()



        upload_dir = Path(

            settings.upload_dir

        )



        upload_dir.mkdir(

            parents=True,

            exist_ok=True,

        )



        annotated_filename = (

            f"annotated_"

            f"{detection_path.stem}.png"

        )



        annotated_path = (

            upload_dir

            / annotated_filename

        )



        cv2.imwrite(

            str(annotated_path),

            annotated_img,

        )



        # -----------------------------------------------------

        # Original/preview image for crops

        # -----------------------------------------------------



        orig_img_cv = cv2.imread(

            str(detection_path)

        )



        crop_dir = (

            upload_dir

            / "crops"

        )



        crop_dir.mkdir(

            parents=True,

            exist_ok=True,

        )



        detections: List[

            Dict[str, Any]

        ] = []



        # -----------------------------------------------------

        # DETECTIONS

        # -----------------------------------------------------



        if (

            boxes is not None

            and len(boxes) > 0

        ):



            for idx, box in enumerate(

                boxes

            ):



                # ---------------------------------------------

                # Class

                # ---------------------------------------------



                cls_id = int(

                    box.cls[0].item()

                )



                class_name = (

                    self.classes.get(

                        cls_id,

                        f"class_{cls_id}",

                    )

                )



                # ---------------------------------------------

                # Confidence

                # ---------------------------------------------



                confidence = float(

                    box.conf[0].item()

                )



                # ---------------------------------------------

                # Pixel coordinates on

                # detection image / preview

                # ---------------------------------------------



                x1, y1, x2, y2 = [

                    float(value)

                    for value in

                    box.xyxy[0].tolist()

                ]



                # ---------------------------------------------

                # Normalize

                # ---------------------------------------------



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

                    / detection_width

                    if detection_width

                    else 0

                )



                norm_h = (

                    (y2 - y1)

                    / detection_height

                    if detection_height

                    else 0

                )



                # ---------------------------------------------

                # Original GeoTIFF pixel coordinates

                #

                # Because the preview may be smaller than

                # the original GeoTIFF, use normalized

                # coordinates to map back to original pixels.

                # ---------------------------------------------



                original_x1 = (

                    norm_x

                    * original_width

                    if original_width

                    else x1

                )



                original_y1 = (

                    norm_y

                    * original_height

                    if original_height

                    else y1

                )



                original_x2 = (

                    (norm_x + norm_w)

                    * original_width

                    if original_width

                    else x2

                )



                original_y2 = (

                    (norm_y + norm_h)

                    * original_height

                    if original_height

                    else y2

                )



                # ---------------------------------------------

                # Crop

                # ---------------------------------------------



                crop_filename = (

                    f"crop_"

                    f"{detection_path.stem}_"

                    f"{idx}_"

                    f"{class_name}.jpg"

                )



                crop_path = (

                    crop_dir

                    / crop_filename

                )



                cx1 = max(

                    0,

                    int(x1),

                )



                cy1 = max(

                    0,

                    int(y1),

                )



                cx2 = min(

                    detection_width,

                    int(x2),

                )



                cy2 = min(

                    detection_height,

                    int(y2),

                )



                if (

                    cx2 > cx1

                    and cy2 > cy1

                    and orig_img_cv is not None

                ):



                    crop_cv = (

                        orig_img_cv[

                            cy1:cy2,

                            cx1:cx2,

                        ]

                    )



                    cv2.imwrite(

                        str(crop_path),

                        crop_cv,

                    )



                    crop_url = (

                        f"/uploads/crops/"

                        f"{crop_filename}"

                    )



                else:



                    crop_url = None



                # ---------------------------------------------

                # Confidence flag

                # ---------------------------------------------



                is_low_confidence = (

                    confidence < 0.50

                )



                # ---------------------------------------------

                # Detection geographic location

                #

                # Use the center of the detected bounding

                # box, mapped back to the original GeoTIFF.

                # ---------------------------------------------



                geo_location = None



                if (

                    is_geotiff

                    and geospatial

                    and geospatial.get(

                        "hasGeodata"

                    )

                ):



                    center_pixel_x = (

                        (

                            original_x1

                            + original_x2

                        )

                        / 2.0

                    )



                    center_pixel_y = (

                        (

                            original_y1

                            + original_y2

                        )

                        / 2.0

                    )



                    geo_location = (

                        self.pixel_to_geographic(

                            str(

                                original_path

                            ),

                            center_pixel_x,

                            center_pixel_y,

                        )

                    )



                # ---------------------------------------------

                # Build detection

                # ---------------------------------------------



                detection = {

                    "id": (

                        f"det_"

                        f"{idx + 1:02d}"

                    ),



                    "detectionIndex": (

                        idx + 1

                    ),



                    "classId": cls_id,



                    "className": class_name,



                    "confidence": round(

                        confidence,

                        4,

                    ),



                    "confidencePercent": round(

                        confidence * 100,

                        1,

                    ),



                    "isLowConfidence": (

                        is_low_confidence

                    ),



                    "boundingBox": {

                        # Normalized values

                        "x": round(

                            norm_x,

                            4,

                        ),



                        "y": round(

                            norm_y,

                            4,

                        ),



                        "w": round(

                            norm_w,

                            4,

                        ),



                        "h": round(

                            norm_h,

                            4,

                        ),



                        # Original GeoTIFF pixel

                        # coordinates when available

                        "pixel": {

                            "x1": round(

                                original_x1,

                                1,

                            ),



                            "y1": round(

                                original_y1,

                                1,

                            ),



                            "x2": round(

                                original_x2,

                                1,

                            ),



                            "y2": round(

                                original_y2,

                                1,

                            ),



                            "width": round(

                                original_x2

                                - original_x1,

                                1,

                            ),



                            "height": round(

                                original_y2

                                - original_y1,

                                1,

                            ),

                        },

                    },



                    "cropUrl": crop_url,



                    "geoLocation": (

                        geo_location

                    ),

                }



                detections.append(

                    detection

                )



        # -----------------------------------------------------

        # Highest confidence

        # -----------------------------------------------------



        highest_conf = max(

            (

                d["confidence"]

                for d in detections

            ),

            default=0.0,

        )



        # -----------------------------------------------------

        # Final result

        # -----------------------------------------------------



        result_data = {

            "detectionCount": len(

                detections

            ),



            "highestConfidence": round(

                highest_conf,

                4,

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

            ),

        }



        print(

            f"[YOLO] Detection complete: "

            f"{len(detections)} object(s)"

        )



        if is_geotiff:



            print(

                "[GeoTIFF] Geospatial processing: "

                f"{'available' if geospatial and geospatial.get('hasGeodata') else 'not available'}"

            )



        return result_data



    # =========================================================

    # MODEL EVALUATION METRICS

    # =========================================================



    def get_evaluation_metrics(

        self

    ) -> Dict[str, Any]:

        """

        Return only metrics actually stored

        in the checkpoint, when available.

        """



        if not self.model:



            return {

                "available": False,

                "message": (

                    "YOLO model is not loaded."

                ),

            }



        checkpoint = (

            getattr(

                self.model,

                "ckpt",

                {},

            )

            or {}

        )



        candidates = [

            checkpoint.get(

                "metrics"

            ),

            checkpoint.get(

                "results"

            ),

            checkpoint.get(

                "results_dict"

            ),

        ]



        metrics = next(

            (

                item

                for item in candidates

                if isinstance(

                    item,

                    dict,

                )

                and item

            ),

            None,

        )



        if not metrics:



            return {

                "available": False,



                "message": (

                    "Evaluation metrics are not embedded "

                    "in the loaded best.pt checkpoint."

                ),



                "modelName": self.model_info.get(

                    "name",

                    "SONAR-X Object Detector",

                ),



                "weights": self.model_info.get(

                    "weights_file",

                    "best.pt",

                ),



                "classes": self.get_classes(),

            }



        return {

            "available": True,



            "modelName": self.model_info.get(

                "name",

                "SONAR-X Object Detector",

            ),



            "weights": self.model_info.get(

                "weights_file",

                "best.pt",

            ),



            "task": self.model_info.get(

                "task",

                "detect",

            ),



            "classes": self.get_classes(),



            "metrics": metrics,

        }





# =============================================================

# GLOBAL SERVICE INSTANCE

# =============================================================



yolo_service = YOLOService()
