import logging

from django.conf import settings
from django.http import HttpResponse, JsonResponse

logger = logging.getLogger(__name__)


class DevCorsMiddleware:
    """Lightweight CORS handler for local development."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_origins = set(
            origin.strip()
            for origin in getattr(settings, "DEV_CORS_ORIGINS", [])
            if origin.strip()
        )

    def __call__(self, request):
        origin = request.headers.get("Origin")
        if request.method == "OPTIONS" and origin and self._is_allowed(origin):
            response = HttpResponse(status=200)
            self._add_headers(response, origin)
            return response

        response = self.get_response(request)
        if origin and self._is_allowed(origin):
            self._add_headers(response, origin)
        return response

    def _is_allowed(self, origin: str) -> bool:
        return "*" in self.allowed_origins or origin in self.allowed_origins

    def _add_headers(self, response, origin: str) -> None:
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Allow-Headers"] = (
            "Authorization, Content-Type, X-Requested-With, X-Driver-Token"
        )
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"


class JsonErrorMiddleware:
    """Return JSON for uncaught errors in non-debug environments."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception:  # noqa: BLE001
            if settings.DEBUG:
                raise
            logger.exception("Unhandled error")
            return JsonResponse({"detail": "Internal server error"}, status=500)
