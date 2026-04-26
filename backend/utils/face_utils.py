"""
face_utils.py
=============

Two-stage face analysis pipeline:

  Stage ①  Detection  — OpenCV DNN + SSD MobileNetV1 (Caffe model)
  Stage ②  Recognition — dlib ResNet-34  (via `face_recognition` library)

  Usage:
      result = detect_faces("photo.jpg")
      result["facesDetected"]   # int
      result["faceBoxes"]       # list of box dicts (pixel + normalised coords)
      result["descriptors"]     # list of 128-float lists, one per face

      idx = match_face(new_descriptor, stored_descriptors)
      # returns the index of the matching stored face, or None
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from sklearn.cluster import DBSCAN

# face_recognition wraps dlib's ResNet-34 face recognition model.
# Install: pip install face-recognition
# (dlib requires cmake: brew install cmake  /  apt-get install cmake)
try:
    import face_recognition

    _DLIB_AVAILABLE = True
except ImportError:
    _DLIB_AVAILABLE = False


# ── Model paths ───────────────────────────────────────────────
_MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
_PROTOTXT = str(_MODEL_DIR / "deploy.prototxt")
_CAFFEMODEL = str(_MODEL_DIR / "res10_300x300_ssd_iter_140000.caffemodel")

# Load the SSD network once at import time (loading is expensive).
_ssd_net = cv2.dnn.readNetFromCaffe(_PROTOTXT, _CAFFEMODEL)


# ── Tuneable constants ────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.50  # SSD detections below this score are ignored
AREA_RATIO_THRESHOLD = 0.12  # faces < 12 % of the largest face area → background
MATCH_THRESHOLD = 0.60  # dlib Euclidean distance: below = same person


# ── Stage ①: SSD face detection ──────────────────────────────
def _run_ssd(image: np.ndarray) -> list[tuple[int, int, int, int, float]]:
    """
    Run SSD MobileNetV1 on an image.

    Returns ALL detections (no confidence filter here — filtering is done once
    in detect_faces() so the caller's threshold is the only gate applied).
    """
    h, w = image.shape[:2]

    blob = cv2.dnn.blobFromImage(
        cv2.resize(image, (300, 300)),
        scalefactor=1.0,
        size=(300, 300),
        mean=(104.0, 177.0, 123.0),
    )
    _ssd_net.setInput(blob)
    output = _ssd_net.forward()  # shape: (1, 1, N, 7)

    boxes: list[tuple[int, int, int, int, float]] = []
    for i in range(output.shape[2]):
        confidence = float(output[0, 0, i, 2])

        x1 = int(output[0, 0, i, 3] * w)
        y1 = int(output[0, 0, i, 4] * h)
        x2 = int(output[0, 0, i, 5] * w)
        y2 = int(output[0, 0, i, 6] * h)

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        bw, bh = x2 - x1, y2 - y1
        if bw > 0 and bh > 0:
            boxes.append((x1, y1, bw, bh, confidence))

    return boxes


# ── Size heuristic filter ─────────────────────────────────────
def _apply_size_filter(
    boxes: list[tuple[int, int, int, int, float]],
    area_ratio_threshold: float = AREA_RATIO_THRESHOLD,
) -> list[tuple[int, int, int, int, float]]:
    """
    Professor's suggestion #1:
    The main subject's face is large; background people's faces are small.
    Drop any face whose area is less than area_ratio_threshold × max_area.
    """
    if not boxes:
        return boxes
    areas = [bw * bh for (_, _, bw, bh, _) in boxes]
    max_area = max(areas)
    return [
        box
        for box, area in zip(boxes, areas)
        if area / max_area >= area_ratio_threshold
    ]


# ── Image quality gate ───────────────────────────────────────
def _image_quality_ok(image: np.ndarray, blur_threshold: float = 50.0) -> bool:
    """Return False if image is likely too blurry to produce good descriptors."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    return blur_score > blur_threshold


# ── Stage ②: dlib 128-dim descriptor ─────────────────────────
def _compute_descriptor(
    rgb_image: np.ndarray,
    x: int,
    y: int,
    bw: int,
    bh: int,
) -> list[float]:
    """
    Ask dlib's ResNet-34 for the 128-dim encoding of the face at (x, y, bw, bh).

    face_recognition expects locations as (top, right, bottom, left) —
    the opposite corner order from OpenCV's (x, y, w, h).
    """
    if not _DLIB_AVAILABLE:
        return []

    # Convert OpenCV box → face_recognition location tuple
    location = (y, x + bw, y + bh, x)  # (top, right, bottom, left)
    encodings = face_recognition.face_encodings(
        rgb_image,
        known_face_locations=[location],
        num_jitters=3,   # 3 jitters: better accuracy without too much overhead
        model="large",   # 68-point landmarks: noticeably better recognition
    )
    return encodings[0].tolist() if encodings else []


# ── Public API ────────────────────────────────────────────────
def detect_faces(
    file_path: str,
    confidence_threshold: float = CONFIDENCE_THRESHOLD,
    area_ratio_threshold: float = AREA_RATIO_THRESHOLD,
) -> dict:
    """
    Full pipeline: SSD detection → size filter → dlib descriptors.

    Parameters
    ----------
    file_path            : path to the image file
    confidence_threshold : minimum SSD confidence to keep a detection
    area_ratio_threshold : minimum area fraction relative to the largest face

    Returns
    -------
    {
        "facesDetected": int,
        "faceBoxes": [
            {
                "x": int, "y": int, "w": int, "h": int,
                "confidence": float,
                "x_norm": float,   # normalised 0-1 (matches frontend)
                "y_norm": float,
                "w_norm": float,
                "h_norm": float,
            },
            ...
        ],
        "descriptors": [[float * 128], ...]  # one per face; [] if dlib unavailable
    }
    """
    image = cv2.imread(file_path)
    if image is None:
        return {"facesDetected": 0, "faceBoxes": [], "descriptors": []}

    if not _image_quality_ok(image):
        return {"facesDetected": 0, "faceBoxes": [], "descriptors": [], "quality": "too_blurry"}

    img_h, img_w = image.shape[:2]

    # ① Detect — confidence filter applied once here (not inside _run_ssd)
    raw_boxes = _run_ssd(image)
    raw_boxes = [b for b in raw_boxes if b[4] >= confidence_threshold]

    # Apply size heuristic (pass the caller's threshold, not the global default)
    raw_boxes = _apply_size_filter(raw_boxes, area_ratio_threshold)

    # ② Compute dlib descriptors on the filtered set
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    face_boxes: list[dict] = []
    descriptors: list[list[float]] = []

    for x, y, bw, bh, conf in raw_boxes:
        descriptor = _compute_descriptor(rgb, x, y, bw, bh)
        face_boxes.append(
            {
                "x": x,
                "y": y,
                "w": bw,
                "h": bh,
                "confidence": round(conf, 4),
                # Normalised coordinates are scale-independent and match the
                # frontend's stored format.
                "x_norm": round(x / img_w, 6),
                "y_norm": round(y / img_h, 6),
                "w_norm": round(bw / img_w, 6),
                "h_norm": round(bh / img_h, 6),
            }
        )
        descriptors.append(descriptor)

    return {
        "facesDetected": len(face_boxes),
        "faceBoxes": face_boxes,
        "descriptors": descriptors,
    }


def match_face(
    descriptor: list[float],
    known_descriptors: list[list[float]],
    threshold: float = MATCH_THRESHOLD,
) -> Optional[int]:
    """
    Professor's suggestion #2: find the stored face most similar to `descriptor`.

    Computes the Euclidean distance in 128-dim space between `descriptor`
    and every vector in `known_descriptors`.  The dlib model was trained so
    that distances below 0.6 reliably indicate the same person.

    Parameters
    ----------
    descriptor        : 128-float list for the query face
    known_descriptors : list of 128-float lists from previously seen faces
    threshold         : maximum distance to count as a match (default 0.6)

    Returns
    -------
    Index of the best-matching descriptor, or None if no match is close enough.
    """
    if not descriptor or not known_descriptors:
        return None

    probe = np.array(descriptor, dtype=np.float64)
    gallery = np.array(known_descriptors, dtype=np.float64)  # (N, 128)
    distances = np.linalg.norm(gallery - probe, axis=1)  # (N,)

    best_idx = int(np.argmin(distances))
    return best_idx if distances[best_idx] < threshold else None


def cluster_faces(
    descriptors: list[list[float]],
    threshold: float = MATCH_THRESHOLD,
) -> list[int]:
    """
    Assign each descriptor to a person cluster using DBSCAN.

    DBSCAN avoids centroid drift and order-dependence that plagued the old
    greedy nearest-centroid approach.

    Returns a list of cluster IDs (ints), one per input descriptor.
    Descriptors with an empty list ([]) are assigned -1 (unknown).
    """
    valid = [(i, d) for i, d in enumerate(descriptors) if d]
    result = [-1] * len(descriptors)

    if not valid:
        return result

    indices, vecs = zip(*valid)
    matrix = np.array(vecs, dtype=np.float64)
    labels = DBSCAN(eps=threshold, min_samples=1, metric="euclidean").fit_predict(matrix)

    for i, label in zip(indices, labels):
        result[i] = int(label)

    return result
