import os
from pathlib import Path
from pydantic import BaseModel

# Load .env file if present
_env_file = Path(__file__).resolve().parent / ".env"
if _env_file.exists():
    with open(_env_file, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                _key = _key.strip()
                _val = _val.strip()
                if _val and not os.environ.get(_key):
                    os.environ[_key] = _val
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = BASE_DIR / "best.pt"

class Settings(BaseModel):
    model_path: str = str(MODEL_FILE)
    upload_dir: str = str(UPLOAD_DIR)
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    mongodb_db: str = os.getenv("MONGODB_DB", "sonar_x")
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    groq_api_key: Optional[str] = os.getenv("GROQ_API_KEY", "")
    active_ai_provider: str = os.getenv("ACTIVE_AI_PROVIDER", "gemini")  # "gemini" or "groq"
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
    iou_threshold: float = float(os.getenv("IOU_THRESHOLD", "0.45"))

settings = Settings()
