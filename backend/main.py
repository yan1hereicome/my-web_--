from pathlib import Path
import os
import uuid
import shutil

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv()  # reads backend/.env (e.g. ANTHROPIC_API_KEY) into the environment
except Exception:
    pass

try:
    from utils.face_utils import detect_faces as ssd_detect_faces
    from utils.exif_utils import extract_exif_info
    _UTILS_OK = True
except Exception:
    import traceback
    print("[startup] utils.face_utils / utils.exif_utils failed to import:")
    traceback.print_exc()
    _UTILS_OK = False

try:
    from utils.places_utils import get_nearby_places
    _PLACES_OK = True
except Exception:
    _PLACES_OK = False

try:
    from utils.claude_utils import generate_travel_diary, recognize_landmark
    _CLAUDE_OK = True
except Exception:
    _CLAUDE_OK = False


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")



@app.get("/")
def root():
    return {"message": "FastAPI face detection server running"}


@app.get("/health")
def health():
    """Frontend polls this to decide whether to use API mode or browser mode."""
    return {
        "status": "ok",
        "utils_available": _UTILS_OK,
        "places_available": _PLACES_OK,
        "claude_available": _CLAUDE_OK and bool(os.environ.get("ANTHROPIC_API_KEY")),
    }


@app.get("/nearby-places")
def nearby_places(lat: float, lng: float, radius: int = 500):
    """Return restaurants, cafes, and bars near the given coordinates."""
    if not _PLACES_OK:
        return {"places": [], "error": "places service unavailable — run: pip install requests"}
    places = get_nearby_places(lat, lng, radius)
    return {"places": places}


@app.post("/analyze")
async def analyze_photo(file: UploadFile = File(...)):
    """
    Combined endpoint used by the frontend:
      1. Save uploaded photo
      2. Extract EXIF  (date, time, GPS → reverse-geocoded location)
      3. Detect faces  (SSD MobileNetV1 + size filter + dlib 128-dim descriptors)
      4. Return everything in one JSON response
    """
    photo_id = str(uuid.uuid4())
    ext = Path(file.filename or "upload").suffix or ".jpg"
    saved_path = UPLOAD_DIR / f"{photo_id}{ext}"

    with saved_path.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)

    if not _UTILS_OK:
        return {
            "photoId": photo_id,
            "error": "utils not ready — run: pip install -r requirements.txt",
            "captureDate": None, "captureTime": None,
            "latitude": None,   "longitude": None, "location": None,
            "faceCount": 0,     "faceBoxes": [],   "descriptors": [],
        }

    exif  = extract_exif_info(str(saved_path))
    faces = ssd_detect_faces(str(saved_path))

    lat = exif.get("latitude")
    lng = exif.get("longitude")

    return {
        "photoId":     photo_id,
        "captureDate": exif.get("captureDate"),
        "captureTime": exif.get("captureTime"),
        "latitude":    lat,
        "longitude":   lng,
        "location":    exif.get("location"),
        "faceCount":   faces["facesDetected"],
        "faceBoxes":   faces["faceBoxes"],
        "descriptors": faces["descriptors"],
        "ages":        faces.get("ages", []),
        "genders":     faces.get("genders", []),
        "confidences": faces.get("confidences", []),
    }


class DiaryEntry(BaseModel):
    fileName: str
    location: str | None = None
    captureDate: str | None = None
    captureTime: str | None = None
    faceCount: int | None = None


class DiaryRequest(BaseModel):
    entries: list[DiaryEntry]
    language: str = "ko"


@app.post("/generate-diary")
def generate_diary(body: DiaryRequest):
    """AI-generated travel diary entry summarizing a set of photos (by metadata only)."""
    if not _CLAUDE_OK:
        return {"diary": None, "error": "anthropic package not installed — run: pip install -r requirements.txt"}
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {"diary": None, "error": "ANTHROPIC_API_KEY not set — see utils/claude_utils.py"}
    try:
        diary = generate_travel_diary([e.model_dump() for e in body.entries], language=body.language)
        return {"diary": diary}
    except Exception as e:
        return {"diary": None, "error": str(e)}


@app.post("/recognize-landmark")
async def recognize_landmark_endpoint(file: UploadFile = File(...), lat: float | None = None, lng: float | None = None):
    """AI landmark recognition for a single photo, via Claude Vision."""
    if not _CLAUDE_OK:
        return {"landmark": None, "error": "anthropic package not installed — run: pip install -r requirements.txt"}
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {"landmark": None, "error": "ANTHROPIC_API_KEY not set — see utils/claude_utils.py"}
    try:
        image_bytes = await file.read()
        result = recognize_landmark(image_bytes, file.content_type or "image/jpeg", lat, lng)
        return result.model_dump()
    except Exception as e:
        return {"landmark": None, "error": str(e)}



