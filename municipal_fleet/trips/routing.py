from math import radians, cos, sin, sqrt, atan2


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lng = radians(lng2 - lng1)
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return radius_km * c


def optimize_destinations(destinations):
    """
    Offline nearest-neighbor heuristic using destination coordinates.
    Expects a list of objects with latitude/longitude attributes.
    """
    if len(destinations) <= 2:
        return list(destinations)

    remaining = list(destinations)
    ordered = [remaining.pop(0)]
    while remaining:
        last = ordered[-1]
        next_idx = min(
            range(len(remaining)),
            key=lambda idx: haversine_km(
                float(last.latitude), float(last.longitude),
                float(remaining[idx].latitude), float(remaining[idx].longitude)
            ),
        )
        ordered.append(remaining.pop(next_idx))
    return ordered


def build_route_geometry(destinations):
    return [
        {"lat": float(dest.latitude), "lng": float(dest.longitude)}
        for dest in destinations
    ]


def route_summary(destinations, average_speed_kmh: float = 35.0):
    distance_km = 0.0
    for idx in range(1, len(destinations)):
        prev = destinations[idx - 1]
        curr = destinations[idx]
        distance_km += haversine_km(
            float(prev.latitude),
            float(prev.longitude),
            float(curr.latitude),
            float(curr.longitude),
        )
    duration_minutes = int((distance_km / average_speed_kmh) * 60) if average_speed_kmh else 0
    return distance_km, duration_minutes
