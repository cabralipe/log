class MunicipalityQuerysetMixin:
    municipality_field = "municipality"

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if getattr(user, "role", None) == "SUPERADMIN":
            return qs
        return qs.filter(**{f"{self.municipality_field}": user.municipality})
