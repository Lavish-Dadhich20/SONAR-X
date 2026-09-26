# SONAR-X setup

## 1. Backend

Open a terminal in `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` from `.env.example`.

Set your real values:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=sonar_x

GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

ACTIVE_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

CONFIDENCE_THRESHOLD=0.25
IOU_THRESHOLD=0.45
```

Do not commit `.env`.

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

The included `best.pt` is loaded automatically from the project root.

## 2. Frontend

Open another terminal in `frontend/`:

```powershell
npm install
npm run dev
```

The Vite frontend expects the API at:

`http://localhost:8000`

## 3. Important

- MongoDB is the only persistent data store.
- There is no local JSON fallback.
- There is no synthetic/demo data.
- AI interpretation fails clearly if the selected provider is unavailable; it does not generate a fabricated fallback explanation.
- The UI reads the actual class registry from `best.pt`.
- GPS is shown only when real image metadata contains GPS.
- Model metrics are shown only when genuine evaluation values are available.
- Keep your API keys private.
