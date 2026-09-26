import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
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
# STATIC FILES
# ============================================================

upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(upload_dir)),
    name="uploads",
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
    return {"status": "ok"}


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