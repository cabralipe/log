from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == "SUPERADMIN"


class IsMunicipalityAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("SUPERADMIN", "ADMIN_MUNICIPALITY")
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == "SUPERADMIN":
            return True
        return getattr(obj, "municipality_id", None) == request.user.municipality_id


class IsMunicipalityAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ("SUPERADMIN", "ADMIN_MUNICIPALITY")

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.role == "SUPERADMIN":
            return True
        return getattr(obj, "municipality_id", None) == request.user.municipality_id


class IsSelfOrMunicipalityAdmin(permissions.BasePermission):
    """
    Allows access to the requesting user or municipality admins/superadmin.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == "SUPERADMIN":
            return True
        if request.user.role == "ADMIN_MUNICIPALITY":
            return getattr(obj, "municipality_id", None) == request.user.municipality_id
        return obj == request.user


class IsSameMunicipalityOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.role == "SUPERADMIN":
            return True
        return getattr(obj, "municipality_id", None) == request.user.municipality_id
