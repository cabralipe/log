from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "password",
            "role",
            "municipality",
            "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def validate(self, attrs):
        request = self.context.get("request")
        request_user = getattr(request, "user", None)
        role = attrs.get("role", getattr(self.instance, "role", None))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))
        if role != User.Roles.SUPERADMIN and not municipality:
            if request_user and request_user.is_authenticated and request_user.role != User.Roles.SUPERADMIN:
                municipality = request_user.municipality
                attrs["municipality"] = municipality
        if role != User.Roles.SUPERADMIN and not municipality:
            raise serializers.ValidationError("Usuários não superadmin precisam de uma prefeitura.")
        if role == User.Roles.SUPERADMIN:
            attrs["municipality"] = None
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError("Senha obrigatória para criar usuário.")
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
