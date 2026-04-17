import cv2


def detect_faces(file_path: str) -> dict:
    image = cv2.imread(file_path)

    if image is None:
        return {
            "facesDetected": 0,
            "faceBoxes": [],
        }

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    classifier = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = classifier.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )

    face_boxes = []
    for (x, y, w, h) in faces:
        face_boxes.append(
            {
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
            }
        )

    return {
        "facesDetected": len(face_boxes),
        "faceBoxes": face_boxes,
    }