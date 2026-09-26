import os

import httpx
from dotenv import load_dotenv

load_dotenv()

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")

MAPBOX_REVERSE_URL = (
    "https://api.mapbox.com/search/geocode/v6/reverse"
)


async def reverse_geocode(
    latitude: float,
    longitude: float,
) -> dict:
    """
    Convert latitude/longitude into a human-readable
    location using Mapbox Reverse Geocoding.
    """

    if not MAPBOX_ACCESS_TOKEN:
        return {
            "success": False,
            "error": "MAPBOX_ACCESS_TOKEN is not configured",
            "latitude": latitude,
            "longitude": longitude,
        }

    params = {
        "longitude": longitude,
        "latitude": latitude,
        "access_token": MAPBOX_ACCESS_TOKEN,
        "language": "en",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                MAPBOX_REVERSE_URL,
                params=params,
            )

        response.raise_for_status()

        data = response.json()

        features = data.get("features", [])

        if not features:
            return {
                "success": False,
                "error": "No location found for these coordinates",
                "latitude": latitude,
                "longitude": longitude,
            }

        feature = features[0]

        properties = feature.get("properties", {})
        context = properties.get("context", {})

        location_name = (
            properties.get("full_address")
            or properties.get("name")
            or properties.get("place_formatted")
            or "Unknown location"
        )

        place = (
            context.get("place", {}).get("name")
            or context.get("locality", {}).get("name")
            or ""
        )

        region = (
            context.get("region", {}).get("name")
            or ""
        )

        country = (
            context.get("country", {}).get("name")
            or ""
        )

        return {
            "success": True,
            "latitude": latitude,
            "longitude": longitude,
            "locationName": location_name,
            "place": place,
            "region": region,
            "country": country,
            "featureType": properties.get("feature_type"),
            "fullAddress": properties.get("full_address"),
            "placeFormatted": properties.get("place_formatted"),
        }

    except httpx.HTTPStatusError as error:
        return {
            "success": False,
            "error": (
                f"Mapbox API error: "
                f"{error.response.status_code}"
            ),
            "latitude": latitude,
            "longitude": longitude,
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
            "latitude": latitude,
            "longitude": longitude,
        }