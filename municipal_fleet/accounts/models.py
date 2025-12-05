from django.contrib.auth.models import AbstractUser
from django.db import models
from accounts.managers import UserManager


class User(AbstractUser):
    class Roles(models.TextChoices):
        SUPERADMIN = "SUPERADMIN", "Super Admin"
        ADMIN_MUNICIPALITY = "ADMIN_MUNICIPALITY", "Admin da Prefeitura"
        OPERATOR = "OPERATOR", "Operador"
        VIEWER = "VIEWER", "Visualizador"

    username = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.VIEWER)
    municipality = models.ForeignKey(
        "tenants.Municipality",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def save(self, *args, **kwargs):
        if self.role == self.Roles.SUPERADMIN:
            self.municipality = None
            self.is_staff = True
            self.is_superuser = True
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email
