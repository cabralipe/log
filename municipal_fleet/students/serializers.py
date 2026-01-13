from rest_framework import serializers
from students.models import School, Student, StudentCard, StudentTransportRegistration, ClassGroup


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}


class StudentCardSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = StudentCard
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}


class StudentTransportRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentTransportRegistration
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}


class ClassGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassGroup
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}
