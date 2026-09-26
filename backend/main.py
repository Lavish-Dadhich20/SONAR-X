import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import settings
from database import db
from routers import scans, detections, model, system, reports


app = FastAPI(
    title="SONAR-X API",
    description="Underwater Sonar Image Analysis & Acoustic Object Detection Platform",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # Production frontend
        "https://sonar-x-seven.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# GRIDFS IMAGE STORAGE
# ============================================================

@app.get("/uploads/{file_path:path}")
async def get_uploaded_file(file_path: str):
    """
    Serve uploaded/generated images directly from MongoDB GridFS.

    The frontend can continue using URLs such as:

        /uploads/example.png
        /uploads/example_preview.png
        /uploads/crops/crop_001.png
    """

    # Normalize the requested path.
    relative_path = file_path.replace("\\", "/").lstrip("/")

    if not relative_path:
        raise HTTPException(
            status_code=404,
            detail="File not found.",
        )

    # --------------------------------------------------------
    # First: exact relative-path lookup
    # --------------------------------------------------------

    grid_file = db.get_file_by_relative_path(
        relative_path
    )

    # --------------------------------------------------------
    # Second: filename fallback
    #
    # This keeps compatibility with older scan records
    # whose URLs contain only the filename.
    # --------------------------------------------------------

    if grid_file is None:
        filename = Path(relative_path).name

        grid_file = db.get_file_by_filename(
            filename
        )

    if grid_file is None:
        raise HTTPException(
            status_code=404,
            detail="File not found in MongoDB GridFS.",
        )

    content_type = (
        getattr(grid_file, "content_type", None)
        or "application/octet-stream"
    )

    return StreamingResponse(
        grid_file,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


# ============================================================
# ROUTERS
# ============================================================

app.include_router(scans.router)
app.include_router(detections.router)
app.include_router(model.router)
app.include_router(system.router)
app.include_router(reports.router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "product": "SONAR-X",
        "tagline": "Intelligent Sonar. Clearer Decisions.",
        "status": "Online",
        "version": "1.0.0",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "database": db.is_connected(),
        "storage": "MongoDB GridFS",
    }


# ============================================================
# LOCAL DEVELOPMENT
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )