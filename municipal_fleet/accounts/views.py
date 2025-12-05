from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from accounts.permissions import IsSuperAdmin, IsMunicipalityAdmin, IsSelfOrMunicipalityAdmin
from accounts.serializers import UserSerializer
from tenants.mixins import MunicipalityQuerysetMixin

User = get_user_model()


class LoginView(TokenObtainPairView):
    throttle_scope = "login"


class UserViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()

    def get_permissions(self):
        if self.action in ["create", "destroy", "update", "partial_update", "list"]:
            return [permissions.IsAuthenticated(), IsMunicipalityAdmin()]
        if self.action in ["retrieve"]:
            return [permissions.IsAuthenticated(), IsSelfOrMunicipalityAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == User.Roles.SUPERADMIN:
            return qs
        return qs.filter(municipality=user.municipality).exclude(role=User.Roles.SUPERADMIN)

    def perform_create(self, serializer):
        user = self.request.user
        role = serializer.validated_data.get("role")
        if user.role != User.Roles.SUPERADMIN and role == User.Roles.SUPERADMIN:
            raise PermissionDenied("Apenas superadmin pode criar outro superadmin.")
        if user.role != User.Roles.SUPERADMIN:
            serializer.save(municipality=user.municipality)
        else:
            serializer.save()


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response({"detail": "refresh token obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except Exception:
        return Response({"detail": "refresh token inválido"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "logout realizado"})
