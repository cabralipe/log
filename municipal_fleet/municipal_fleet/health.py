from django.db import DatabaseError, connection
from django.http import JsonResponse


def health_view(_request):
    try:
        connection.ensure_connection()
        db_ok = True
    except DatabaseError:
        db_ok = False
    status = 200 if db_ok else 503
    return JsonResponse({"status": "ok" if db_ok else "degraded", "database": db_ok}, status=status)

