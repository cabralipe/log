import urllib.parse
from rest_framework import viewsets, permissions, response, decorators, filters
from trips.models import Trip
from trips.serializers import TripSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly


class TripViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Trip.objects.select_related("vehicle", "driver", "municipality")
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["origin", "destination", "vehicle__license_plate", "driver__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        vehicle_id = self.request.query_params.get("vehicle_id")
        driver_id = self.request.query_params.get("driver_id")
        status_param = self.request.query_params.get("status")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if start_date:
            qs = qs.filter(departure_datetime__date__gte=start_date)
        if end_date:
            qs = qs.filter(departure_datetime__date__lte=end_date)
        return qs

    @decorators.action(detail=True, methods=["get"], url_path="whatsapp_message")
    def whatsapp_message(self, request, pk=None):
        trip = self.get_object()
        message_lines = [
            f"Olá {trip.driver.name}, segue sua viagem:",
            f"Data: {trip.departure_datetime.strftime('%d/%m/%Y')}",
            f"Horário de saída: {trip.departure_datetime.strftime('%H:%M')}",
            f"Origem: {trip.origin}",
            f"Destino: {trip.destination}",
            f"Pontos de parada: {trip.stops_description or '—'}",
            f"Veículo: {trip.vehicle.brand} {trip.vehicle.model} ({trip.vehicle.license_plate})",
        ]
        message = "\n".join(message_lines)
        phone_digits = "".join(filter(str.isdigit, trip.driver.phone))
        wa_link = f"https://wa.me/{phone_digits}?text={urllib.parse.quote(message)}"
        return response.Response({"message": message, "wa_link": wa_link})
