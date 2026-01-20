from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status, filters
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from accounts.permissions import IsSuperAdmin, IsMunicipalityAdmin, IsSelfOrMunicipalityAdmin
from accounts.serializers import UserSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from tenants.models import Municipality

User = get_user_model()


class LoginView(TokenObtainPairView):
    throttle_scope = "login"


class UserViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ["email", "role"]

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

    def perform_update(self, serializer):
        user = self.request.user
        role = serializer.validated_data.get("role", serializer.instance.role)
        if user.role != User.Roles.SUPERADMIN and role == User.Roles.SUPERADMIN:
            raise PermissionDenied("Apenas superadmin pode criar outro superadmin.")
        if user.role != User.Roles.SUPERADMIN:
            serializer.save(municipality=user.municipality)
        else:
            serializer.save()

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[IsSuperAdmin])
    def active_municipality(self, request):
        municipality_id = request.data.get("municipality_id")
        if municipality_id in ("", None):
            request.user.active_municipality = None
            request.user.save(update_fields=["active_municipality"])
            return Response({"active_municipality": None})
        try:
            municipality_id = int(municipality_id)
        except (TypeError, ValueError):
            return Response({"detail": "municipality_id inválido."}, status=status.HTTP_400_BAD_REQUEST)
        municipality = Municipality.objects.filter(id=municipality_id).first()
        if not municipality:
            return Response({"detail": "Prefeitura não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        request.user.active_municipality = municipality
        request.user.save(update_fields=["active_municipality"])
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
)
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
