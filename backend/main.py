from pathlib import Path
import uuid
import shutil

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from utils.face_utils import detect_faces as ssd_detect_faces
    from utils.exif_utils import extract_exif_info
    _UTILS_OK = True
except Exception:
    _UTILS_OK = False

try:
    from utils.places_utils import get_nearby_places
    _PLACES_OK = True
except Exception:
    _PLACES_OK = False


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
    return {"status": "ok", "utils_available": _UTILS_OK, "places_available": _PLACES_OK}


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
    }



