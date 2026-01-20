from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from contracts.models import Contract, ContractVehicle, RentalPeriod
from fleet.models import Vehicle
from tenants.utils import resolve_municipality


class ContractSerializer(serializers.ModelSerializer):
    vehicle_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Contract
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        status = attrs.get("status", getattr(self.instance, "status", Contract.Status.ACTIVE))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("Data final deve ser após a inicial.")

        if end_date and end_date < timezone.localdate():
            attrs["status"] = Contract.Status.EXPIRED
        elif status == Contract.Status.ACTIVE and end_date and end_date < timezone.localdate():
            attrs["status"] = Contract.Status.EXPIRED

        if user and user.is_authenticated and user.role != "SUPERADMIN":
            attrs["municipality"] = user.municipality
        elif user and user.is_authenticated and user.role == "SUPERADMIN":
            municipality = resolve_municipality(request, attrs.get("municipality"))
            if not municipality:
                raise serializers.ValidationError({"municipality": "Prefeitura é obrigatória."})
            attrs["municipality"] = municipality
        return attrs

    def _sync_contract_vehicles(self, contract: Contract, vehicle_ids: list[int]):
        if contract.status != Contract.Status.ACTIVE:
            raise serializers.ValidationError("Apenas contratos ativos podem receber veículos.")

        vehicles = Vehicle.objects.filter(id__in=vehicle_ids)
        if vehicles.count() != len(set(vehicle_ids)):
            raise serializers.ValidationError({"vehicle_ids": "Um ou mais veículos informados não existem."})

        for vehicle in vehicles:
            if vehicle.municipality_id != contract.municipality_id:
                raise serializers.ValidationError("Contrato e veículo devem ser da mesma prefeitura.")

        existing_links = {link.vehicle_id for link in contract.vehicles.all()}
        incoming = set(vehicle_ids)
        to_remove = existing_links - incoming
        if to_remove:
            contract.vehicles.filter(vehicle_id__in=to_remove).delete()

        for vehicle in vehicles:
            if vehicle.id in existing_links:
                continue
            ContractVehicle.objects.create(
                contract=contract,
                municipality=contract.municipality,
                vehicle=vehicle,
                start_date=contract.start_date,
                end_date=contract.end_date,
            )

    def create(self, validated_data):
        vehicle_ids = validated_data.pop("vehicle_ids", [])
        with transaction.atomic():
            contract = super().create(validated_data)
            if vehicle_ids:
                self._sync_contract_vehicles(contract, vehicle_ids)
        return contract

    def update(self, instance, validated_data):
        vehicle_ids = validated_data.pop("vehicle_ids", None)
        with transaction.atomic():
            contract = super().update(instance, validated_data)
            if vehicle_ids is not None:
                self._sync_contract_vehicles(contract, vehicle_ids)
        return contract


class ContractVehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractVehicle
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))

        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError("Data final do veículo deve ser após a inicial.")

        if contract:
            if contract.status != Contract.Status.ACTIVE:
                raise serializers.ValidationError("Apenas contratos ativos podem receber veículos.")
            if start_date and start_date < contract.start_date:
                raise serializers.ValidationError("Início do veículo deve estar dentro do contrato.")
            if end_date and end_date > contract.end_date:
                raise serializers.ValidationError("Término do veículo excede o prazo do contrato.")

        if contract and vehicle and contract.municipality_id != vehicle.municipality_id:
            raise serializers.ValidationError("Contrato e veículo devem ser da mesma prefeitura.")

        if user and user.is_authenticated and user.role != "SUPERADMIN":
            if contract and contract.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Contrato precisa pertencer à sua prefeitura.")
            attrs["municipality"] = user.municipality
        elif contract:
            attrs["municipality"] = contract.municipality

        return attrs


class RentalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = RentalPeriod
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality", "billed_km", "billed_amount"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        start = attrs.get("start_datetime", getattr(self.instance, "start_datetime", None))
        end = attrs.get("end_datetime", getattr(self.instance, "end_datetime", None))
        status = attrs.get("status", getattr(self.instance, "status", RentalPeriod.Status.OPEN))
        odometer_start = attrs.get("odometer_start", getattr(self.instance, "odometer_start", None))
        odometer_end = attrs.get("odometer_end", getattr(self.instance, "odometer_end", None))

        if start and end and end <= start:
            raise serializers.ValidationError("Data/hora final deve ser após a inicial.")
        if contract:
            if contract.status != Contract.Status.ACTIVE:
                raise serializers.ValidationError("Apenas contratos ativos podem ser usados.")
            if start and start.date() < contract.start_date:
                raise serializers.ValidationError("Período deve respeitar o início do contrato.")
            if end and end.date() > contract.end_date:
                raise serializers.ValidationError("Período excede a vigência do contrato.")
            if vehicle and start:
                link_exists = contract.vehicles.filter(
                    vehicle=vehicle,
                    start_date__lte=start.date(),
                ).filter(Q(end_date__isnull=True) | Q(end_date__gte=start.date())).exists()
                if not link_exists:
                    raise serializers.ValidationError("Veículo não está coberto pelo contrato nas datas informadas.")

        if contract and vehicle and vehicle.municipality_id != contract.municipality_id:
            raise serializers.ValidationError("Contrato e veículo devem ser da mesma prefeitura.")
        if user and user.is_authenticated and user.role != "SUPERADMIN":
            if contract and contract.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Contrato precisa pertencer à sua prefeitura.")
            attrs["municipality"] = user.municipality
        elif contract and not attrs.get("municipality"):
            attrs["municipality"] = contract.municipality

        needs_odometer = contract and contract.billing_model in (
            Contract.BillingModel.PER_KM,
            Contract.BillingModel.MONTHLY_WITH_KM,
        )
        if status == RentalPeriod.Status.CLOSED and needs_odometer:
            if odometer_start is None or odometer_end is None:
                raise serializers.ValidationError("Informe odômetro inicial e final para encerrar.")
            if odometer_end < odometer_start:
                raise serializers.ValidationError("Odômetro final não pode ser menor que o inicial.")

        return attrs

    def create(self, validated_data):
        contract = validated_data.get("contract")
        if contract and "municipality" not in validated_data:
            validated_data["municipality"] = contract.municipality
        return super().create(validated_data)


class RentalPeriodCloseSerializer(serializers.ModelSerializer):
    class Meta:
        model = RentalPeriod
        fields = ["end_datetime", "odometer_end", "status", "odometer_start"]

    def validate(self, attrs):
        instance: RentalPeriod = self.instance
        contract = instance.contract
        end = attrs.get("end_datetime") or instance.end_datetime
        start = instance.start_datetime
        odometer_start = attrs.get("odometer_start", instance.odometer_start)
        odometer_end = attrs.get("odometer_end", instance.odometer_end)

        if not end:
            raise serializers.ValidationError({"end_datetime": "Informe a data/hora de término."})
        if end <= start:
            raise serializers.ValidationError({"end_datetime": "Término deve ser após o início."})

        needs_odometer = contract.billing_model in (
            Contract.BillingModel.PER_KM,
            Contract.BillingModel.MONTHLY_WITH_KM,
        )
        if needs_odometer:
            if odometer_start is None or odometer_end is None:
                raise serializers.ValidationError("Informe odômetro inicial e final.")
            if odometer_end < odometer_start:
                raise serializers.ValidationError("Odômetro final não pode ser menor que o inicial.")

        attrs["end_datetime"] = end
        attrs["odometer_start"] = odometer_start
        attrs["odometer_end"] = odometer_end
        return attrs

    def save(self, **kwargs):
        instance: RentalPeriod = super().save(**kwargs)
        contract = instance.contract
        vehicle = instance.vehicle

        billed_km = None
        billed_amount = Decimal("0.00")
        if instance.odometer_end is not None and instance.odometer_start is not None:
            billed_km = Decimal(instance.odometer_end - instance.odometer_start)

        rate = None
        if vehicle:
            link = contract.vehicles.filter(
                vehicle=vehicle,
                start_date__lte=instance.start_datetime.date(),
            ).filter(Q(end_date__isnull=True) | Q(end_date__gte=instance.start_datetime.date())).order_by("-start_date").first()
            if link and link.custom_rate is not None:
                rate = link.custom_rate
        if rate is None:
            rate = contract.extra_km_rate or contract.base_value

        if contract.billing_model == Contract.BillingModel.PER_KM:
            billed_amount = (billed_km or Decimal("0.00")) * (rate or Decimal("0.00"))
        elif contract.billing_model == Contract.BillingModel.PER_DAY:
            days = (instance.end_datetime.date() - instance.start_datetime.date()).days + 1
            billed_amount = Decimal(days) * (rate or Decimal("0.00"))
        elif contract.billing_model in (Contract.BillingModel.FIXED, Contract.BillingModel.MONTHLY_WITH_KM):
            billed_amount = contract.base_value or Decimal("0.00")

        instance.billed_km = billed_km
        instance.billed_amount = billed_amount
        instance.status = RentalPeriod.Status.CLOSED
        instance.save(update_fields=["billed_km", "billed_amount", "status", "end_datetime", "odometer_end", "odometer_start"])
        return instance
