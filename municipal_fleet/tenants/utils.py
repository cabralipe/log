from tenants.models import Municipality


def resolve_municipality(request, explicit=None):
    if explicit:
        return explicit
    if request is None:
        return None
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "role", None) == "SUPERADMIN":
        query_params = getattr(request, "query_params", {})
        municipality_id = request.headers.get("X-Municipality-Id") or query_params.get("municipality_id")
        if municipality_id:
            try:
                municipality_id = int(municipality_id)
            except (TypeError, ValueError):
                return None
            municipality = Municipality.objects.filter(id=municipality_id).first()
            if municipality:
                return municipality
        return getattr(user, "active_municipality", None)
    return getattr(user, "municipality", None)
