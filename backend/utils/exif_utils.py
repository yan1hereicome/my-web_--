from typing import Optional
import exifread
from geopy.geocoders import Nominatim


def ratio_to_float(ratio) -> float:
    return float(ratio.num) / float(ratio.den)


def dms_to_decimal(values, ref) -> float:
    degrees = ratio_to_float(values[0])
    minutes = ratio_to_float(values[1])
    seconds = ratio_to_float(values[2])

    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)

    if ref in ["S", "W"]:
        decimal = -decimal

    return decimal


def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    try:
        geolocator = Nominatim(user_agent="travel-lens-app")
        location = geolocator.reverse(f"{latitude}, {longitude}", language="en")
        if location:
            return location.address
    except Exception:
        return None

    return None


def extract_exif_info(file_path: str) -> dict:
    with open(file_path, "rb") as image_file:
        tags = exifread.process_file(image_file, details=False)

    capture_date = None
    capture_time = None
    latitude = None
    longitude = None
    location_name = None

    date_tag = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
    if date_tag:
        date_time_str = str(date_tag)
        parts = date_time_str.split(" ")
        if len(parts) == 2:
            capture_date = parts[0].replace(":", "-")
            capture_time = parts[1]

    gps_latitude = tags.get("GPS GPSLatitude")
    gps_latitude_ref = tags.get("GPS GPSLatitudeRef")
    gps_longitude = tags.get("GPS GPSLongitude")
    gps_longitude_ref = tags.get("GPS GPSLongitudeRef")

    if gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref:
        latitude = dms_to_decimal(gps_latitude.values, str(gps_latitude_ref))
        longitude = dms_to_decimal(gps_longitude.values, str(gps_longitude_ref))
        location_name = reverse_geocode(latitude, longitude)

    return {
        "captureDate": capture_date,
        "captureTime": capture_time,
        "latitude": latitude,
        "longitude": longitude,
        "location": location_name,
    }