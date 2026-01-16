from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class InventoryPart(TimestampedModel):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="inventory_parts")
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64)
    unit = models.CharField(max_length=16)
    minimum_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    average_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("municipality", "sku")
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"


class InventoryMovement(TimestampedModel):
    class MovementType(models.TextChoices):
        IN = "IN", "Entrada"
        OUT = "OUT", "Saída"
        LOAN = "LOAN", "Empréstimo"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="inventory_movements"
    )
    part = models.ForeignKey(InventoryPart, on_delete=models.PROTECT, related_name="movements")
    type = models.CharField(max_length=8, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reference = models.CharField(max_length=255, blank=True)
    responsible_name = models.CharField(max_length=255, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="inventory_movements"
    )
    performed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-performed_at", "-id"]

    def save(self, *args, **kwargs):
        with transaction.atomic():
            self._validate_municipality()
            delta = self._stock_delta()
            part = InventoryPart.objects.select_for_update().get(id=self.part_id)
            previous_stock = Decimal(part.current_stock or 0)
            new_stock = previous_stock + Decimal(delta)
            if new_stock < 0:
                raise ValidationError("Estoque insuficiente para a movimentação.")
            super().save(*args, **kwargs)
            if delta:
                InventoryPart.objects.filter(id=part.id).update(current_stock=F("current_stock") + Decimal(delta))
                part.refresh_from_db(fields=["current_stock", "average_cost"])
            if self.type == self.MovementType.IN and self.quantity > 0:
                self._update_average_cost(part, previous_stock)

    def _update_average_cost(self, part: InventoryPart, previous_stock: Decimal):
        total_cost = Decimal(part.average_cost or 0) * previous_stock
        incoming_cost = Decimal(self.unit_cost or 0) * Decimal(self.quantity or 0)
        total_qty = previous_stock + Decimal(self.quantity or 0)
        if total_qty > 0:
            part.average_cost = (total_cost + incoming_cost) / total_qty
            part.save(update_fields=["average_cost"])

    def _stock_delta(self) -> Decimal:
        new_delta = Decimal(self.quantity if self.type == self.MovementType.IN else -self.quantity)
        if not self.pk:
            return new_delta
        previous = InventoryMovement.objects.get(id=self.pk)
        previous_delta = Decimal(previous.quantity if previous.type == self.MovementType.IN else -previous.quantity)
        return new_delta - previous_delta

    def _validate_municipality(self):
        if self.part.municipality_id != self.municipality_id:
            raise ValidationError("Peça e movimentação precisam ser da mesma prefeitura.")

    def __str__(self):
        return f"{self.get_type_display()} {self.part.name} ({self.quantity})"


class MaintenancePlan(TimestampedModel):
    class TriggerType(models.TextChoices):
        KM = "KM", "Quilometragem"
        TIME = "TIME", "Tempo"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="maintenance_plans")
    vehicle = models.ForeignKey(
        "fleet.Vehicle", on_delete=models.CASCADE, null=True, blank=True, related_name="maintenance_plans"
    )
    name = models.CharField(max_length=255)
    trigger_type = models.CharField(max_length=8, choices=TriggerType.choices)
    interval_km = models.PositiveIntegerField(null=True, blank=True)
    interval_days = models.PositiveIntegerField(null=True, blank=True)
    last_service_odometer = models.PositiveIntegerField(null=True, blank=True)
    last_service_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def clean(self):
        if self.trigger_type == self.TriggerType.KM and not self.interval_km:
            raise ValidationError("interval_km é obrigatório para plano por KM.")
        if self.trigger_type == self.TriggerType.TIME and not self.interval_days:
            raise ValidationError("interval_days é obrigatório para plano por tempo.")

    def __str__(self):
        target = self.vehicle.license_plate if self.vehicle else "Todos"
        return f"{self.name} ({target})"


class ServiceOrder(TimestampedModel):
    class Type(models.TextChoices):
        CORRECTIVE = "CORRECTIVE", "Corretiva"
        PREVENTIVE = "PREVENTIVE", "Preventiva"
        TIRE = "TIRE", "Pneus"

    class Priority(models.TextChoices):
        LOW = "LOW", "Baixa"
        MEDIUM = "MEDIUM", "Média"
        HIGH = "HIGH", "Alta"
        CRITICAL = "CRITICAL", "Crítica"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Aberta"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        WAITING_PARTS = "WAITING_PARTS", "Aguardando peças"
        COMPLETED = "COMPLETED", "Concluída"
        CANCELLED = "CANCELLED", "Cancelada"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="service_orders")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="service_orders")
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_orders_opened",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_orders_assigned",
    )
    provider_name = models.CharField(max_length=255, blank=True)
    type = models.CharField(max_length=20, choices=Type.choices)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    description = models.TextField()
    opened_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    vehicle_odometer_open = models.PositiveIntegerField(null=True, blank=True)
    vehicle_odometer_close = models.PositiveIntegerField(null=True, blank=True)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-opened_at", "-id"]

    def __str__(self):
        return f"OS #{self.id} - {self.vehicle.license_plate} ({self.get_type_display()})"

    def update_totals(self):
        totals = self.items.aggregate(total=Sum("total_cost"))
        labor_totals = self.labor.aggregate(total=Sum("total_cost"))
        total = Decimal(totals["total"] or 0) + Decimal(labor_totals["total"] or 0)
        if total != self.total_cost:
            self.total_cost = total
            self.save(update_fields=["total_cost", "updated_at"])

    def sync_vehicle_status(self):
        from fleet.models import Vehicle

        vehicle = self.vehicle
        if not getattr(vehicle, "id", None):
            return
        has_open = vehicle.service_orders.exclude(status__in=[self.Status.COMPLETED, self.Status.CANCELLED]).exists()
        vehicle_status = Vehicle.Status.MAINTENANCE if has_open else Vehicle.Status.AVAILABLE
        if vehicle.status != vehicle_status:
            vehicle.status = vehicle_status
            vehicle.save(update_fields=["status", "updated_at"])

    def mark_started(self):
        if self.status == self.Status.COMPLETED:
            return
        self.status = self.Status.IN_PROGRESS
        if not self.started_at:
            self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at", "updated_at"])
        self.sync_vehicle_status()

    def mark_completed(self, odometer_close: Optional[int] = None):
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        if odometer_close is not None:
            self.vehicle_odometer_close = odometer_close
        elif not self.vehicle_odometer_close:
            self.vehicle_odometer_close = self.vehicle.odometer_current
        self.save(update_fields=["status", "completed_at", "vehicle_odometer_close", "updated_at"])
        self.sync_vehicle_status()
        self.update_totals()


class ServiceOrderItem(TimestampedModel):
    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="items")
    part = models.ForeignKey(InventoryPart, on_delete=models.PROTECT, related_name="service_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        previous_qty = Decimal("0")
        if not creating:
            previous_qty = ServiceOrderItem.objects.get(id=self.pk).quantity
        self.total_cost = Decimal(self.quantity) * Decimal(self.unit_cost)
        with transaction.atomic():
            self._validate_municipality()
            super().save(*args, **kwargs)
            delta = Decimal(self.quantity) - previous_qty
            if delta:
                InventoryMovement.objects.create(
                    municipality=self.service_order.municipality,
                    part=self.part,
                    type=InventoryMovement.MovementType.OUT if delta > 0 else InventoryMovement.MovementType.IN,
                    quantity=abs(delta),
                    unit_cost=self.unit_cost,
                    reference=f"OS #{self.service_order_id}",
                    performed_by=self.service_order.opened_by,
                )
            self.service_order.update_totals()

    def _validate_municipality(self):
        if self.part.municipality_id != self.service_order.municipality_id:
            raise ValidationError("Peça precisa ser da mesma prefeitura da OS.")


class ServiceOrderLabor(TimestampedModel):
    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="labor")
    description = models.CharField(max_length=255)
    hours = models.DecimalField(max_digits=8, decimal_places=2)
    hourly_rate = models.DecimalField(max_digits=12, decimal_places=2)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        self.total_cost = Decimal(self.hours) * Decimal(self.hourly_rate)
        super().save(*args, **kwargs)
        self.service_order.update_totals()


class Tire(TimestampedModel):
    class Status(models.TextChoices):
        STOCK = "STOCK", "Em estoque"
        IN_USE = "IN_USE", "Em uso"
        RETREADED = "RETREADED", "Recapado"
        SCRAPPED = "SCRAPPED", "Descartado"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="tires")
    code = models.CharField(max_length=64)
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100, blank=True)
    size = models.CharField(max_length=50)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STOCK)
    total_km = models.PositiveIntegerField(default=0)
    km_since_last_retread = models.PositiveIntegerField(default=0)
    max_km_life = models.PositiveIntegerField(default=50000)
    retread_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("municipality", "code")
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.brand})"


class VehicleTire(TimestampedModel):
    class Position(models.TextChoices):
        FRONT_LEFT = "FRONT_LEFT", "Dianteiro Esquerdo"
        FRONT_RIGHT = "FRONT_RIGHT", "Dianteiro Direito"
        REAR_LEFT = "REAR_LEFT", "Traseiro Esquerdo"
        REAR_RIGHT = "REAR_RIGHT", "Traseiro Direito"
        SPARE = "SPARE", "Estepe"

    tire = models.ForeignKey(Tire, on_delete=models.PROTECT, related_name="vehicle_positions")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.CASCADE, related_name="vehicle_tires")
    position = models.CharField(max_length=32, choices=Position.choices)
    installed_at = models.DateTimeField(default=timezone.now)
    installed_odometer = models.PositiveIntegerField(default=0)
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_odometer = models.PositiveIntegerField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["vehicle", "position"],
                condition=Q(active=True),
                name="unique_active_tire_position",
            )
        ]
        ordering = ["vehicle_id", "position"]

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.tire.municipality_id != self.vehicle.municipality_id:
                raise ValidationError("Pneu e veículo precisam ser da mesma prefeitura.")
            if self.active:
                self.removed_at = None
                self.removed_odometer = None
                self.tire.status = Tire.Status.IN_USE
            else:
                if not self.removed_at:
                    self.removed_at = timezone.now()
                self.tire.status = Tire.Status.STOCK
            super().save(*args, **kwargs)
            self.tire.save(update_fields=["status", "updated_at"])

    def mark_removed(self, odometer: Optional[int] = None):
        if not self.active:
            return
        self.active = False
        if odometer is not None:
            self.removed_odometer = odometer
        self.save(update_fields=["active", "removed_at", "removed_odometer", "updated_at"])
