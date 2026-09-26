import asyncio

from geocoding_service import reverse_geocode


async def main():
    result = await reverse_geocode(
        latitude=24.58545,
        longitude=73.712474,
    )

    print("\n==============================")
    print("SONAR-X GEOCODING TEST")
    print("==============================")

    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())