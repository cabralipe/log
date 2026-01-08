from .base import *

DEBUG = True
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# Dev-friendly CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = []

DEV_CORS_ORIGINS = os.environ.get(
    "DEV_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
MIDDLEWARE = ["municipal_fleet.middleware.DevCorsMiddleware", *MIDDLEWARE]
