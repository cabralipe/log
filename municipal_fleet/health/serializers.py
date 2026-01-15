from rest_framework import serializers
from health.models import Patient, Companion


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]
        extra_kwargs = {}


class CompanionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Companion
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]
        extra_kwargs = {}
