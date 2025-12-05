import logging

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)


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
