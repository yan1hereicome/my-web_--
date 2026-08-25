FROM python:3.11-slim

WORKDIR /app

# opencv-python-headless and onnxruntime still dynamically link against
# a handful of X11/graphics shared libs even without GUI support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    libxcb1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# Pre-download + cache the buffalo_s model at build time so the first real
# request doesn't pay this cost and trip Render's proxy timeout. buffalo_s
# (not buffalo_l) + landmark modules excluded keeps this fitting inside
# free-tier hosting's 512MB RAM ceiling — see backend/utils/face_utils.py.
RUN python -c "\
from insightface.app import FaceAnalysis; \
app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'], allowed_modules=['detection', 'recognition', 'genderage']); \
app.prepare(ctx_id=-1, det_size=(640, 640)); \
print('buffalo_s cached OK')"

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
