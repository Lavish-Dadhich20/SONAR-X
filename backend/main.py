from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse,FileResponse

from config import settings
from database import db
from routers import scans, detections, model, system, reports

import mimetypes

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
async def serve_uploaded_file(file_path: str):
    normalized_path = str(file_path).replace("\\", "/").lstrip("/")
    filename = Path(normalized_path).name
    if not filename:
        raise HTTPException(status_code=404, detail="File not found")
    grid_file = None
    try:
        grid_file = db.get_file_by_relative_path(normalized_path)
    except Exception as exc:
        print(f"[GridFS] Relative-path lookup failed for '{normalized_path}': {exc}")
    if grid_file is None:
        try:
            grid_file = db.get_file_by_filename(filename)
        except Exception as exc:
            print(f"[GridFS] Filename lookup failed for '{filename}': {exc}")
    if grid_file is None:
        local_path = Path(settings.upload_dir) / normalized_path
        if local_path.exists() and local_path.is_file():
            media_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
            return FileResponse(
                str(local_path),
                media_type=media_type,
                filename=local_path.name,
            )
        raise HTTPException(
            status_code=404,
            detail=f"Uploaded file '{normalized_path}' was not found",
        )
    media_type = getattr(grid_file, "content_type", None)
    if not media_type:
        media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return StreamingResponse(
        grid_file,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )

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