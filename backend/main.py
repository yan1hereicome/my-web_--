from pathlib import Path
import uuid
import shutil

import cv2
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
FACE_DIR = UPLOAD_DIR / "faces"

UPLOAD_DIR.mkdir(exist_ok=True)
FACE_DIR.mkdir(exist_ok=True)

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


def detect_and_save_faces(image_path: Path, photo_id: str):
    image = cv2.imread(str(image_path))
    if image is None:
        return []

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )

    saved_faces = []
    photo_face_dir = FACE_DIR / photo_id
    photo_face_dir.mkdir(exist_ok=True)

    for idx, (x, y, w, h) in enumerate(faces, start=1):
        crop = image[y:y+h, x:x+w]
        face_filename = f"face_{idx}.jpg"
        face_path = photo_face_dir / face_filename
        cv2.imwrite(str(face_path), crop)

        saved_faces.append({
            "face_id": f"{photo_id}_{idx}",
            "x": int(x),
            "y": int(y),
            "w": int(w),
            "h": int(h),
            "face_image_url": f"/uploads/faces/{photo_id}/{face_filename}"
        })

    return saved_faces


@app.get("/")
def root():
    return {"message": "FastAPI face detection server running"}


@app.post("/detect-faces")
async def detect_faces(file: UploadFile = File(...)):
    photo_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".jpg"
    saved_filename = f"{photo_id}{ext}"
    saved_path = UPLOAD_DIR / saved_filename

    with saved_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    faces = detect_and_save_faces(saved_path, photo_id)

    return {
        "photo_id": photo_id,
        "original_file_name": file.filename,
        "image_url": f"/uploads/{saved_filename}",
        "face_count": len(faces),
        "faces": faces,
    }