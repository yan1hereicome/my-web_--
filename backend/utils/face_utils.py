"""
face_utils.py
=============

Two-stage face analysis pipeline:

  Stage ①  Detection  — OpenCV DNN + SSD MobileNetV1 (Caffe model)
           Unlike the old Haar Cascade, SSD:
             • Detects non-frontal and partially-occluded faces
             • Returns a confidence score (0.0 – 1.0) per detection
             • Works well under varied lighting conditions

  Stage ②  Recognition — dlib ResNet-34  (via `face_recognition` library)
           Encodes each detected face as a 128-dimensional float vector.
           The model was trained so that:
             • Same person  →  Euclidean distance < 0.6
             • Different    →  Euclidean distance ≥ 0.6
           These vectors let us cluster "the same person" across many photos
           without ever needing labelled training data for new faces.

  Size heuristic filter  (professor's suggestion #1)
           After detection, faces whose pixel area is less than
           AREA_RATIO_THRESHOLD × (largest detected face area) are dropped.
           This removes background bystanders whose faces appear small in
           the photo compared with the main subject(s).

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

    Returns a list of (x, y, w, h, confidence) tuples for every detection
    that exceeds CONFIDENCE_THRESHOLD, clamped to the image boundaries.
    """
    h, w = image.shape[:2]

    # SSD expects a 300×300 blob normalised with the training-set BGR mean.
    blob = cv2.dnn.blobFromImage(
        cv2.resize(image, (300, 300)),
        scalefactor=1.0,
        size=(300, 300),
        mean=(104.0, 177.0, 123.0),  # BGR mean used during Caffe training
    )
    _ssd_net.setInput(blob)
    output = _ssd_net.forward()  # shape: (1, 1, N, 7)

    boxes: list[tuple[int, int, int, int, float]] = []
    for i in range(output.shape[2]):
        confidence = float(output[0, 0, i, 2])
        if confidence < CONFIDENCE_THRESHOLD:
            continue

        # The SSD head outputs normalised [0, 1] coordinates.
        x1 = int(output[0, 0, i, 3] * w)
        y1 = int(output[0, 0, i, 4] * h)
        x2 = int(output[0, 0, i, 5] * w)
        y2 = int(output[0, 0, i, 6] * h)

        # Clamp to image bounds and skip degenerate boxes.
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
        num_jitters=1,  # 1 = fast; increase to 10 for higher accuracy
        model="small",  # "small" = 5-point landmarks (fast)
        # "large" = 68-point landmarks (more accurate)
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

    img_h, img_w = image.shape[:2]

    # ① Detect
    raw_boxes = _run_ssd(image)

    # Apply tuneable confidence threshold (caller may override the default)
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
    Assign each descriptor to a person cluster using greedy nearest-centroid.

    This mirrors the frontend clustering logic so the backend and frontend
    produce consistent groupings.

    Returns
    -------
    A list of cluster IDs (integers), one per input descriptor.
    Descriptors with an empty list ([]) are assigned cluster ID -1 (unknown).
    """
    centroids: list[np.ndarray] = []
    cluster_ids: list[int] = []
    cluster_sizes: list[int] = []

    for desc in descriptors:
        if not desc:
            cluster_ids.append(-1)
            continue

        probe = np.array(desc, dtype=np.float64)

        if not centroids:
            centroids.append(probe.copy())
            cluster_sizes.append(1)
            cluster_ids.append(0)
            continue

        gallery = np.array(centroids, dtype=np.float64)
        distances = np.linalg.norm(gallery - probe, axis=1)
        best_idx = int(np.argmin(distances))

        if distances[best_idx] < threshold:
            # Update centroid as running average
            n = cluster_sizes[best_idx]
            centroids[best_idx] = (centroids[best_idx] * n + probe) / (n + 1)
            cluster_sizes[best_idx] += 1
            cluster_ids.append(best_idx)
        else:
            centroids.append(probe.copy())
            cluster_sizes.append(1)
            cluster_ids.append(len(centroids) - 1)

    return cluster_ids
