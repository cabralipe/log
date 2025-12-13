from rest_framework import permissions


class IsMaintenanceEditor(permissions.BasePermission):
    """
    Allows write access to SUPERADMIN, ADMIN_MUNICIPALITY and OPERATOR roles.
    VIEWER is read-only.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role in ("SUPERADMIN", "ADMIN_MUNICIPALITY", "OPERATOR")

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.role == "SUPERADMIN":
            return True
        return getattr(obj, "municipality_id", None) == request.user.municipality_id
