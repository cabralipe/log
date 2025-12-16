import urllib.parse
from rest_framework import viewsets, permissions, response, decorators, filters, status
from trips.models import Trip, FreeTrip, FreeTripIncident
from trips.serializers import TripSerializer, FreeTripSerializer, FreeTripIncidentSerializer
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
        category = self.request.query_params.get("category")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if category:
            qs = qs.filter(category=category)
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


class FreeTripViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FreeTrip.objects.select_related("vehicle", "driver", "municipality").prefetch_related("incidents")
    serializer_class = FreeTripSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["driver__name", "vehicle__license_plate"]
    ordering_fields = ["started_at", "ended_at", "odometer_start", "odometer_end"]

    def get_queryset(self):
        qs = super().get_queryset()
        driver_id = self.request.query_params.get("driver_id")
        vehicle_id = self.request.query_params.get("vehicle_id")
        status_param = self.request.query_params.get("status")
        started_from = self.request.query_params.get("started_from")
        started_to = self.request.query_params.get("started_to")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if started_from:
            qs = qs.filter(started_at__date__gte=started_from)
        if started_to:
            qs = qs.filter(started_at__date__lte=started_to)
        return qs

    @decorators.action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        open_trips = qs.filter(status=FreeTrip.Status.OPEN)
        open_list = open_trips.values(
            "id",
            "driver_id",
            "driver__name",
            "vehicle_id",
            "vehicle__license_plate",
            "odometer_start",
            "started_at",
        )
        return response.Response(
            {
                "open_count": open_trips.count(),
                "open_trips": list(open_list),
            }
        )

    @decorators.action(detail=True, methods=["get", "post"], url_path="incidents")
    def incidents(self, request, pk=None):
        free_trip = self.get_object()
        if request.method == "GET":
            incidents = free_trip.incidents.all()
            serializer = FreeTripIncidentSerializer(incidents, many=True)
            return response.Response(serializer.data)
        serializer = FreeTripIncidentSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        incident = serializer.save(
            free_trip=free_trip, driver=free_trip.driver, municipality=free_trip.municipality
        )
        return response.Response(FreeTripIncidentSerializer(incident).data, status=status.HTTP_201_CREATED)
