import math
import requests

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_nearby_places(lat: float, lng: float, radius_m: int = 500) -> list[dict]:
    """
    Query OpenStreetMap Overpass API for nearby restaurants, cafes, and bars.
    Returns up to 8 results sorted by distance. No API key required.
    """
    query = f"""
[out:json][timeout:10];
(
  node["amenity"~"^(restaurant|cafe|bar)$"](around:{radius_m},{lat},{lng});
  way["amenity"~"^(restaurant|cafe|bar)$"](around:{radius_m},{lat},{lng});
);
out center 20;
"""
    try:
        resp = requests.post(_OVERPASS_URL, data={"data": query}, timeout=12)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception:
        return []

    places: list[dict] = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:en")
        if not name:
            continue

        if el["type"] == "node":
            p_lat, p_lng = el["lat"], el["lon"]
        else:
            center = el.get("center", {})
            p_lat = center.get("lat", lat)
            p_lng = center.get("lon", lng)

        places.append({
            "name": name,
            "type": tags.get("amenity", "place"),
            "cuisine": tags.get("cuisine", ""),
            "distance_m": round(_haversine_m(lat, lng, p_lat, p_lng)),
        })

    places.sort(key=lambda p: p["distance_m"])
    return places[:8]
