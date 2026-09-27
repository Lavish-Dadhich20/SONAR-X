import os
import json
import base64
from typing import Dict, Any, List, Optional

from config import settings


class AIService:
    """
    SONAR-X AI interpretation service.

    Responsibilities:
    - Send the actual sonar image to Gemini/Groq.
    - Provide YOLO detection information.
    - Provide verified GeoTIFF metadata when available.
    - Provide verified Mapbox reverse-geocoded location when available.
    - Never invent GPS, depth, dimensions, or detections.
    """

    def __init__(self):
        self.gemini_key = settings.gemini_api_key
        self.groq_key = settings.groq_api_key

        self.active_provider = (
            settings.active_ai_provider or "gemini"
        ).lower()

        self.gemini_model = os.getenv(
            "GEMINI_MODEL",
            "gemini-3.8-flash",
        )

        self.groq_vision_model = os.getenv(
            "GROQ_VISION_MODEL",
            "qwen/qwen3.8-27b",
        )

    # =========================================================
    # STATUS
    # =========================================================

    def get_status(self) -> Dict[str, Any]:
        return {
            "activeProvider": self.active_provider,

            "geminiAvailable": bool(
                self.gemini_key
                and len(self.gemini_key) > 5
            ),

            "groqAvailable": bool(
                self.groq_key
                and len(self.groq_key) > 5
            ),

            "geminiKeyConfigured": bool(
                self.gemini_key
            ),

            "groqKeyConfigured": bool(
                self.groq_key
            ),

            "geminiModel": self.gemini_model,
            "groqVisionModel": self.groq_vision_model,
        }

    # =========================================================
    # PROVIDER SETTINGS
    # =========================================================

    def set_active_provider(
        self,
        provider: str,
        gemini_key: Optional[str] = None,
        groq_key: Optional[str] = None,
    ):
        provider = provider.lower().strip()

        if provider in {"gemini", "groq"}:
            self.active_provider = provider
            settings.active_ai_provider = provider

        if gemini_key is not None:
            self.gemini_key = gemini_key.strip()
            settings.gemini_api_key = self.gemini_key

        if groq_key is not None:
            self.groq_key = groq_key.strip()
            settings.groq_api_key = self.groq_key

    # =========================================================
    # MAIN INTERPRETATION
    # =========================================================

    def generate_interpretation(
        self,
        image_path: str,
        detections: List[Dict[str, Any]],
        metadata: Dict[str, Any],
        provider_override: Optional[str] = None,
    ) -> Dict[str, Any]:

        provider = (
            provider_override or self.active_provider
        ).lower()

        if provider not in {"gemini", "groq"}:
            raise RuntimeError(
                "Unsupported AI provider. Choose Gemini or Groq."
            )

        prompt = self._build_prompt(
            detections=detections,
            metadata=metadata,
        )

        if provider == "gemini":
            return self._call_gemini(
                image_path=image_path,
                prompt=prompt,
            )

        return self._call_groq(
            image_path=image_path,
            prompt=prompt,
        )

    # =========================================================
    # PROMPT
    # =========================================================

    def _build_prompt(
        self,
        detections: List[Dict[str, Any]],
        metadata: Dict[str, Any],
    ) -> str:

        # -----------------------------------------------------
        # YOLO detections
        # -----------------------------------------------------

        detection_lines = []

        for index, detection in enumerate(detections):
            bbox = (
                detection.get("boundingBox")
                or {}
            )

            class_name = (
                detection.get("className")
                or "Unknown"
            )

            confidence = detection.get(
                "confidencePercent"
            )

            if confidence is None:
                raw_confidence = (
                    detection.get("confidence")
                )

                if raw_confidence is not None:
                    try:
                        confidence = round(
                            float(raw_confidence) * 100,
                            2,
                        )
                    except Exception:
                        confidence = "Unknown"

            if confidence is None:
                confidence = "Unknown"

            geo_location = (
                detection.get("geoLocation")
            )

            geo_text = ""

            if geo_location:
                geo_text = f"""
- Detection geographic center supplied by backend:
  latitude={geo_location.get("latitude")}
  longitude={geo_location.get("longitude")}
"""

            detection_lines.append(
                f"""
Detection {index + 1}:

- Class: {class_name}
- Confidence: {confidence}%
- Normalized bounding box:
  x={bbox.get("x")}
  y={bbox.get("y")}
  w={bbox.get("w")}
  h={bbox.get("h")}

{geo_text}
"""
            )

        if detection_lines:
            detections_text = "\n".join(
                detection_lines
            )
        else:
            detections_text = (
                "No objects were detected by YOLO "
                "above the configured confidence threshold."
            )

        # -----------------------------------------------------
        # Image metadata
        # -----------------------------------------------------

        geospatial = metadata.get(
            "geospatial"
        )

        # This will contain the result from our Mapbox
        # reverse-geocoding service.
        location = metadata.get("location") or {}

        # -----------------------------------------------------
        # VERIFIED GEOSPATIAL INFORMATION
        # -----------------------------------------------------

        if (
            geospatial
            and geospatial.get("hasGeodata")
        ):
            center = (
                geospatial.get("center")
                or {}
            )

            bounds = (
                geospatial.get("bounds")
                or {}
            )

            resolution = (
                geospatial.get("resolution")
                or {}
            )

            geospatial_text = f"""
VERIFIED GEOSPATIAL INFORMATION

The following information was extracted from the
GeoTIFF by the SONAR-X backend.

Do NOT calculate a different location.

CRS:
{geospatial.get("crs")}

Raster dimensions:
{geospatial.get("width")} x {geospatial.get("height")}

Band count:
{geospatial.get("bandCount")}

Pixel resolution:
X = {resolution.get("x")}
Y = {resolution.get("y")}

Projected bounds:
Left = {bounds.get("left")}
Bottom = {bounds.get("bottom")}
Right = {bounds.get("right")}
Top = {bounds.get("top")}

Raster center:
Latitude = {center.get("latitude")}
Longitude = {center.get("longitude")}

These coordinates describe the geographic center of the
GeoTIFF raster.

They must NOT be described as the exact physical position
of an individual detected object unless the metadata
supports that conclusion.
"""

        else:
            geospatial_text = """
GEOSPATIAL INFORMATION

No verified GeoTIFF geospatial metadata is available.

Do NOT invent:
- latitude
- longitude
- GPS position
- geographic region
- projected coordinates
"""

        # -----------------------------------------------------
        # VERIFIED HUMAN-READABLE LOCATION
        # -----------------------------------------------------

        if location.get("success"):
            location_text = f"""
VERIFIED HUMAN-READABLE SURVEY LOCATION

The following location information was obtained by
reverse geocoding the verified survey coordinates
using Mapbox.

Location name:
{location.get("locationName") or "Unknown"}

Full address:
{location.get("fullAddress") or "Unknown"}

Place / City:
{location.get("place") or "Unknown"}

Region / State:
{location.get("region") or "Unknown"}

Country:
{location.get("country") or "Unknown"}

Latitude:
{location.get("latitude")}

Longitude:
{location.get("longitude")}

Feature type:
{location.get("featureType") or "Unknown"}

IMPORTANT LOCATION RULES:

1. Treat this as verified geocoded metadata.
2. Do not invent a different location.
3. Do not change the supplied coordinates.
4. Do not claim the address is the exact physical
   position of a detected object.
5. The coordinates represent the supplied survey
   coordinate / GeoTIFF center.
6. If discussing the location, clearly identify it
   as the survey location.
"""

        else:
            location_text = """
VERIFIED HUMAN-READABLE LOCATION

No reverse-geocoded location name is currently available.

Do NOT invent:
- street name
- address
- city
- district
- state
- country

If coordinates are available, report the coordinates
as verified metadata only.
"""

        # -----------------------------------------------------
        # FINAL AI PROMPT
        # -----------------------------------------------------

        return f"""
You are the SONAR-X technical sonar-image interpreter.

Analyze the ACTUAL sonar image supplied with this request,
together with the ACTUAL YOLO detections and verified metadata.

Your response is intended for a technical sonar-analysis
dashboard.

============================================================
IMPORTANT RULES
============================================================

1. Be objective and concise.

2. YOLO is the object detector.

3. Do not invent additional detected objects.

4. If YOLO detected nothing, explicitly state that no object
   was detected by YOLO.

5. Do not invent:
   - depth
   - physical dimensions
   - GPS coordinates
   - geographic location
   - vessel identity
   - seabed type
   - environmental conditions
   - object identity beyond available evidence

6. Discuss visual sonar evidence such as:
   - acoustic highlight
   - acoustic shadow
   - contrast
   - shape
   - texture
   - spatial arrangement

   only when supported by the actual image.

7. Never treat model confidence as certainty.

8. Use terms such as:
   - possible
   - probable
   - consistent with
   - uncertain

   when appropriate.

9. Verified GeoTIFF metadata comes from the backend
   and may be reported as metadata.

10. Never pretend geographic coordinates were visually
    inferred from the sonar image.

11. The human-readable location comes from Mapbox
    reverse geocoding of verified coordinates.
    Do not invent or modify it.

12. Do not provide generic statements such as:
    "area clear"

    or

    "no threat detected"

    unless directly supported by the available evidence.

13. Return ONLY valid JSON.

14. Use exactly these keys:

{{
    "objectIdentification": "...",
    "modelConfidence": "...",
    "sonarInterpretation": "...",
    "confidenceInterpretation": "...",
    "visualEvidence": "...",
    "operationalObservation": "...",
    "certaintyLevel": "...",
    "location": {{
        "name": "...",
        "fullAddress": "...",
        "place": "...",
        "region": "...",
        "country": "...",
        "latitude": 0,
        "longitude": 0
    }}
}}

============================================================
IMAGE INFORMATION
============================================================

Filename:
{metadata.get("filename", "Unknown")}

Image width:
{metadata.get("width", "Unknown")}

Image height:
{metadata.get("height", "Unknown")}

Format:
{metadata.get("format", "Unknown")}

Capture timestamp:
{metadata.get("captureDate") or "Not embedded"}

EXIF GPS:
{"Available" if metadata.get("gps") else "Not available"}

============================================================
{geospatial_text}

============================================================
{location_text}

============================================================
YOLO DETECTIONS

{detections_text}

============================================================
FINAL INSTRUCTION
============================================================

Analyze the supplied image.

Use the YOLO data as detection evidence.

Use GeoTIFF metadata only as verified metadata.

Use the reverse-geocoded location only as verified
location metadata supplied by the backend.

Do not hallucinate missing information.

Return valid JSON only.
"""

    # =========================================================
    # JSON CLEANING
    # =========================================================

    @staticmethod
    def _clean_json(
        text: str
    ) -> Dict[str, Any]:

        if not text:
            raise RuntimeError(
                "AI returned an empty response."
            )

        text = text.strip()

        # Remove Markdown code fences.
        if text.startswith("```"):
            lines = text.splitlines()

            if lines:
                lines = lines[1:]

            if (
                lines
                and lines[-1].strip() == "```"
            ):
                lines = lines[:-1]

            text = "\n".join(
                lines
            ).strip()

        # Locate JSON object.
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise RuntimeError(
                "AI response did not contain a JSON object."
            )

        json_text = text[
            start : end + 1
        ]

        try:
            return json.loads(
                json_text
            )

        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"AI returned invalid JSON: {exc}"
            ) from exc

    # =========================================================
    # NORMALIZE RESULT
    # =========================================================

    @staticmethod
    def _normalize_result(
        result: Dict[str, Any]
    ) -> Dict[str, Any]:

        required_fields = [
            "objectIdentification",
            "modelConfidence",
            "sonarInterpretation",
            "confidenceInterpretation",
            "visualEvidence",
            "operationalObservation",
            "certaintyLevel",
            "location",
        ]

        normalized = {}

        for field in required_fields:
            value = result.get(field)

            if value is None:
                if field == "location":
                    value = {}
                else:
                    value = ""

            # Keep location as an object.
            # Do NOT convert it into a string.
            if (
                field == "location"
                and isinstance(value, dict)
            ):
                normalized[field] = value
            else:
                normalized[field] = str(
                    value
                )

        return normalized

    # =========================================================
    # GEMINI
    # =========================================================

    def _call_gemini(
        self,
        image_path: str,
        prompt: str,
    ) -> Dict[str, Any]:

        if not self.gemini_key:
            raise RuntimeError(
                "Gemini API key is not configured."
            )

        try:
            import google.generativeai as genai
            from PIL import Image

            genai.configure(
                api_key=self.gemini_key
            )

            model = genai.GenerativeModel(
                self.gemini_model
            )

            image = Image.open(
                image_path
            )

            response = model.generate_content(
                [
                    prompt
                    + "\nReturn JSON only.",
                    image,
                ],
                generation_config={
                    "temperature": 0.2,
                    "response_mime_type": "application/json",
                },
            )

            raw_text = getattr(
                response,
                "text",
                None,
            )

            result = self._clean_json(
                raw_text
            )

            result = self._normalize_result(
                result
            )

            result["provider"] = "gemini"

            result["providerModel"] = (
                self.gemini_model
            )

            return result

        except Exception as exc:
            raise RuntimeError(
                f"Gemini interpretation failed: {exc}"
            ) from exc

    # =========================================================
    # GROQ
    # =========================================================

    def _call_groq(
        self,
        image_path: str,
        prompt: str,
    ) -> Dict[str, Any]:

        if not self.groq_key:
            raise RuntimeError(
                "Groq API key is not configured."
            )

        try:
            from groq import Groq

            client = Groq(
                api_key=self.groq_key
            )

            with open(
                image_path,
                "rb",
            ) as image_file:

                image_bytes = (
                    image_file.read()
                )

            encoded_image = (
                base64.b64encode(
                    image_bytes
                ).decode(
                    "utf-8"
                )
            )

            extension = (
                os.path.splitext(
                    image_path
                )[1]
                .lower()
            )

            if extension in {
                ".jpg",
                ".jpeg",
            }:
                mime_type = "image/jpeg"

            elif extension == ".webp":
                mime_type = "image/webp"

            else:
                mime_type = "image/png"

            response = (
                client.chat.completions.create(
                    model=self.groq_vision_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        prompt
                                        + "\nReturn JSON only."
                                    ),
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": (
                                            f"data:{mime_type};base64,"
                                            f"{encoded_image}"
                                        )
                                    },
                                },
                            ],
                        }
                    ],
                    temperature=0.2,
                    max_completion_tokens=900,
                )
            )

            raw_text = (
                response
                .choices[0]
                .message
                .content
            )

            result = self._clean_json(
                raw_text
            )

            result = self._normalize_result(
                result
            )

            result["provider"] = "groq"

            result["providerModel"] = (
                self.groq_vision_model
            )

            return result

        except Exception as exc:
            raise RuntimeError(
                f"Groq interpretation failed: {exc}"
            ) from exc


# =============================================================
# GLOBAL INSTANCE
# =============================================================

ai_service = AIService()