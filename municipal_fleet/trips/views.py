import urllib.parse
from datetime import timedelta, datetime
from django.utils import timezone
from rest_framework import viewsets, permissions, response, decorators, filters, status, views
from trips.models import Trip, FreeTrip, TripGpsPing, PlannedTrip, TripExecution, TripManifest, TripExecutionStop
from drivers.models import DriverGeofence
from trips.serializers import (
    TripSerializer,
    FreeTripSerializer,
    FreeTripIncidentSerializer,
    PlannedTripSerializer,
    TripExecutionSerializer,
    TripManifestSerializer,
)
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly
from trips.gps import resolve_status, STATUS_LABELS
from trips.services import generate_executions
from trips.routing import optimize_destinations, build_route_geometry, route_summary


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

    @decorators.action(detail=True, methods=["get"], url_path="gps/history")
    def gps_history(self, request, pk=None):
        trip = self.get_object()
        points_qs = TripGpsPing.objects.filter(trip=trip).order_by("recorded_at", "id")
        limit = request.query_params.get("limit")
        if limit:
            try:
                limit_value = max(1, min(int(limit), 5000))
            except (TypeError, ValueError):
                limit_value = 2000
            points_qs = points_qs.order_by("-recorded_at", "-id")[:limit_value]
            points_qs = reversed(list(points_qs))
        payload = [
            {
                "lat": float(item.lat),
                "lng": float(item.lng),
                "accuracy": item.accuracy,
                "speed": item.speed,
                "recorded_at": item.recorded_at,
            }
            for item in points_qs
        ]
        return response.Response({"trip_id": trip.id, "points": payload})


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


class TripMapStateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ("SUPERADMIN", "ADMIN_MUNICIPALITY", "OPERATOR"):
            return response.Response({"detail": "Permissão negada."}, status=status.HTTP_403_FORBIDDEN)
        include_history = request.query_params.get("include_history", "true").lower() != "false"
        history_limit = request.query_params.get("history_limit")
        if history_limit:
            try:
                history_limit = max(1, min(int(history_limit), 5000))
            except (TypeError, ValueError):
                history_limit = 2000
        else:
            history_limit = 2000

        trip_qs = Trip.objects.filter(status=Trip.Status.IN_PROGRESS).select_related("driver", "vehicle")
        if user.role != "SUPERADMIN":
            trip_qs = trip_qs.filter(municipality=user.municipality)
        trips = list(trip_qs)
        if not trips:
            return response.Response({"drivers": []})

        trip_ids = [trip.id for trip in trips]
        ping_qs = (
            TripGpsPing.objects.filter(trip_id__in=trip_ids)
            .select_related("driver", "trip", "trip__vehicle")
            .order_by("trip_id", "-recorded_at", "-id")
        )
        latest_by_trip = {}
        for ping in ping_qs:
            if ping.trip_id not in latest_by_trip:
                latest_by_trip[ping.trip_id] = ping

        history_by_trip = {}
        if include_history:
            history_qs = (
                TripGpsPing.objects.filter(trip_id__in=trip_ids)
                .order_by("trip_id", "-recorded_at", "-id")
            )
            for ping in history_qs:
                points = history_by_trip.setdefault(ping.trip_id, [])
                if len(points) >= history_limit:
                    continue
                points.append(
                    {
                        "lat": float(ping.lat),
                        "lng": float(ping.lng),
                        "accuracy": ping.accuracy,
                        "speed": ping.speed,
                        "recorded_at": ping.recorded_at,
                    }
                )
            for trip_id, points in history_by_trip.items():
                points.reverse()

        now = timezone.now()
        geofence_qs = DriverGeofence.objects.filter(driver_id__in=[trip.driver_id for trip in trips])
        geofence_by_driver = {geofence.driver_id: geofence for geofence in geofence_qs}
        drivers_payload = []
        for trip in trips:
            ping = latest_by_trip.get(trip.id)
            status_code = resolve_status(ping, now=now, offline_after=timedelta(minutes=2))
            geofence = geofence_by_driver.get(trip.driver_id)
            payload = {
                "trip_id": trip.id,
                "driver_id": trip.driver_id,
                "driver_name": trip.driver.name,
                "vehicle_id": trip.vehicle_id,
                "vehicle_plate": trip.vehicle.license_plate,
                "status": status_code,
                "status_label": STATUS_LABELS.get(status_code, status_code),
                "geofence": None,
                "last_point": None,
                "history": history_by_trip.get(trip.id, []),
            }
            if geofence:
                payload["geofence"] = {
                    "center_lat": float(geofence.center_lat),
                    "center_lng": float(geofence.center_lng),
                    "radius_m": geofence.radius_m,
                    "is_active": geofence.is_active,
                    "alert_active": geofence.alert_active,
                }
            if ping:
                payload["last_point"] = {
                    "lat": float(ping.lat),
                    "lng": float(ping.lng),
                    "accuracy": ping.accuracy,
                    "speed": ping.speed,
                    "recorded_at": ping.recorded_at,
                }
            drivers_payload.append(payload)

        return response.Response({"drivers": drivers_payload})


class PlannedTripViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = PlannedTrip.objects.select_related("vehicle", "driver", "municipality").prefetch_related(
        "stops__destination",
        "passengers",
    )
    serializer_class = PlannedTripSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "vehicle__license_plate", "driver__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get("module")
        vehicle_id = self.request.query_params.get("vehicle_id")
        driver_id = self.request.query_params.get("driver_id")
        active = self.request.query_params.get("active")
        if module:
            qs = qs.filter(module=module)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if active is not None:
            qs = qs.filter(active=active.lower() == "true")
        return qs

    def perform_update(self, serializer):
        apply_to_future = self.request.query_params.get("apply_to_future") == "true"
        instance = serializer.save()
        if not apply_to_future:
            return
        now = timezone.now()
        instance.executions.filter(
            status=TripExecution.Status.PLANNED,
            scheduled_departure__gte=now,
            is_manual_override=False,
        ).update(
            vehicle=instance.vehicle,
            driver=instance.driver,
            planned_capacity=instance.planned_capacity,
            module=instance.module,
        )

    @decorators.action(detail=True, methods=["post"], url_path="generate-executions")
    def generate_executions_action(self, request, pk=None):
        plan = self.get_object()
        start = request.data.get("start_date")
        end = request.data.get("end_date")
        if not start or not end:
            return response.Response(
                {"detail": "Informe start_date e end_date no formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d").date()
            end_date = datetime.strptime(end, "%Y-%m-%d").date()
        except ValueError:
            return response.Response(
                {"detail": "Datas inválidas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            created = generate_executions(plan, start_date, end_date)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = TripExecutionSerializer(created, many=True)
        return response.Response({"created": len(created), "executions": serializer.data})


class TripExecutionViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = TripExecution.objects.select_related("vehicle", "driver", "municipality", "planned_trip").prefetch_related(
        "stops__destination",
        "manifest__passengers",
    )
    serializer_class = TripExecutionSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["vehicle__license_plate", "driver__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get("module")
        vehicle_id = self.request.query_params.get("vehicle_id")
        driver_id = self.request.query_params.get("driver_id")
        status_param = self.request.query_params.get("status")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if module:
            qs = qs.filter(module=module)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if start_date:
            qs = qs.filter(scheduled_departure__date__gte=start_date)
        if end_date:
            qs = qs.filter(scheduled_departure__date__lte=end_date)
        return qs

    def perform_create(self, serializer):
        execution = serializer.save()
        self._ensure_route(execution)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance and instance.planned_trip_id:
            execution = serializer.save(is_manual_override=True)
        else:
            execution = serializer.save()
        self._ensure_route(execution)

    def _ensure_route(self, execution: TripExecution):
        if execution.route_geometry:
            return
        stops = list(execution.stops.select_related("destination").order_by("order"))
        destinations = [stop.destination for stop in stops]
        if not destinations:
            return
        distance_km, duration_minutes = route_summary(destinations)
        execution.route_geometry = build_route_geometry(destinations)
        execution.route_distance_km = round(distance_km, 2)
        execution.route_duration_minutes = duration_minutes
        execution.save(update_fields=["route_geometry", "route_distance_km", "route_duration_minutes"])

    @decorators.action(detail=True, methods=["post"], url_path="optimize-route")
    def optimize_route(self, request, pk=None):
        execution = self.get_object()
        stops = list(execution.stops.select_related("destination").order_by("order"))
        destinations = [stop.destination for stop in stops]
        if not destinations:
            return response.Response({"detail": "Sem destinos para otimizar."}, status=status.HTTP_400_BAD_REQUEST)
        ordered = optimize_destinations(destinations)
        stop_map = {}
        for stop in stops:
            stop_map.setdefault(stop.destination_id, []).append(stop)
        for idx, destination in enumerate(ordered):
            candidates = stop_map.get(destination.id, [])
            if not candidates:
                continue
            stop = candidates.pop(0)
            stop.order = idx + 1
            stop.save(update_fields=["order"])
        distance_km, duration_minutes = route_summary(ordered)
        execution.route_geometry = build_route_geometry(ordered)
        execution.route_distance_km = round(distance_km, 2)
        execution.route_duration_minutes = duration_minutes
        execution.save(update_fields=["route_geometry", "route_distance_km", "route_duration_minutes"])
        return response.Response({"detail": "Rota otimizada com sucesso."})


class TripManifestViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = TripManifest.objects.select_related("trip_execution", "trip_execution__municipality").prefetch_related(
        "passengers"
    )
    serializer_class = TripManifestSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    municipality_field = "trip_execution__municipality"

    def get_queryset(self):
        qs = super().get_queryset()
        execution_id = self.request.query_params.get("trip_execution_id")
        if execution_id:
            qs = qs.filter(trip_execution_id=execution_id)
        return qs
