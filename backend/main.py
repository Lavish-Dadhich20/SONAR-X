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
    version="1.0.0"
)

# CORS
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# Include Routers
app.include_router(scans.router)
app.include_router(detections.router)
app.include_router(model.router)
app.include_router(system.router)
app.include_router(reports.router)

@app.get("/")
async def root():
    return {
        "product": "SONAR-X",
        "tagline": "Intelligent Sonar. Clearer Decisions.",
        "status": "Online",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
