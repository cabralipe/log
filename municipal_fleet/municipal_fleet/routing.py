from django.urls import path
from trips.consumers import OperationsMapConsumer

websocket_urlpatterns = [
    path("ws/operations/map/", OperationsMapConsumer.as_asgi()),
]
