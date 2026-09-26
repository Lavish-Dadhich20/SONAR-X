import os

from dotenv import load_dotenv
from supabase import create_client


load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET_NAME = os.getenv("SUPABASE_STORAGE_BUCKET", "sonar-files")


print("=" * 50)
print("SONAR-X SUPABASE CONNECTION TEST")
print("=" * 50)

if not SUPABASE_URL:
    print("ERROR: SUPABASE_URL is missing")
    raise SystemExit(1)

if not SUPABASE_SECRET_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY is missing")
    raise SystemExit(1)

print("Supabase URL found: YES")
print("Supabase secret key found: YES")
print(f"Storage bucket: {BUCKET_NAME}")

try:
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY,
    )

    buckets = supabase.storage.list_buckets()

    print()
    print("Connection: SUCCESS")
    print("Available buckets:")

    for bucket in buckets:
        bucket_name = getattr(bucket, "name", None)

        if bucket_name is None and isinstance(bucket, dict):
            bucket_name = bucket.get("name")

        print(f"  - {bucket_name}")

    bucket_exists = any(
        (
            getattr(bucket, "name", None)
            if not isinstance(bucket, dict)
            else bucket.get("name")
        )
        == BUCKET_NAME
        for bucket in buckets
    )

    print()

    if bucket_exists:
        print(f"Bucket '{BUCKET_NAME}': FOUND")
        print("Supabase is ready for SONAR-X.")
    else:
        print(f"Bucket '{BUCKET_NAME}': NOT FOUND")
        print("Check the bucket name in Supabase.")

except Exception as exc:
    print()
    print("Connection: FAILED")
    print("Error:", exc)