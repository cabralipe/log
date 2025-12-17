from rest_framework import permissions


class DriverAvailabilityBlockPermission(permissions.BasePermission):
    """
    SUPERADMIN: total acesso.
    ADMIN_MUNICIPALITY e OPERATOR: criar/editar/cancelar dentro da própria prefeitura.
    VIEWER: somente leitura.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return user.role in ("SUPERADMIN", "ADMIN_MUNICIPALITY", "OPERATOR")

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.role == "SUPERADMIN":
            return True
        return getattr(obj, "municipality_id", None) == getattr(request.user, "municipality_id", None)
