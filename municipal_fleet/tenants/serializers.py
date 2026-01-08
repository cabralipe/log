from rest_framework import serializers
from tenants.models import Municipality


class MunicipalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipality
        fields = "__all__"


class MunicipalitySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipality
        fields = ["id", "name", "fuel_contract_limit", "fuel_contract_period"]
        read_only_fields = ["id", "name"]
