#!/usr/bin/env bash
# Downloads face-api.js model weights needed for SSD MobileNetV1 detection
# + face landmarks + face recognition (128-dim descriptors for clustering).
#
# Run from the project root:
#   bash _scripts/download-models.sh
#
# Total download: ~21 MB

set -e

BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
DEST="./public/models"

echo "Downloading face-api.js model weights → $DEST"
echo ""

files=(
  # SSD MobileNetV1  (better detection accuracy than TinyFaceDetector)
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"

  # Face Landmarks 68-point  (required before computing descriptors)
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"

  # Face Recognition Net  (128-dim descriptor for person clustering)
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

for f in "${files[@]}"; do
  printf "  %-62s" "$f"
  if [ -f "$DEST/$f" ]; then
    echo "already exists, skipping"
  else
    curl -fsSL "$BASE/$f" -o "$DEST/$f"
    echo "done"
  fi
done

echo ""
echo "All model files ready. Restart the dev server and the app will"
echo "automatically switch to high-accuracy detection mode."
