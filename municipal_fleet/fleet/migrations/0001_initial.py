from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("license_plate", models.CharField(max_length=10)),
                ("model", models.CharField(max_length=100)),
                ("brand", models.CharField(max_length=100)),
                ("year", models.PositiveIntegerField()),
                ("max_passengers", models.PositiveIntegerField()),
                ("odometer_current", models.PositiveIntegerField(default=0)),
                ("odometer_initial", models.PositiveIntegerField(default=0)),
                ("odometer_monthly_limit", models.PositiveIntegerField(default=0)),
                ("last_service_date", models.DateField(blank=True, null=True)),
                ("next_service_date", models.DateField(blank=True, null=True)),
                ("last_oil_change_date", models.DateField(blank=True, null=True)),
                ("next_oil_change_date", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("AVAILABLE", "Disponivel"),
                            ("IN_USE", "Em uso"),
                            ("MAINTENANCE", "Manutencao"),
                            ("INACTIVE", "Inativo"),
                        ],
                        default="AVAILABLE",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vehicles",
                        to="tenants.municipality",
                    ),
                ),
            ],
            options={"ordering": ["license_plate"], "unique_together": {("municipality", "license_plate")}},
        ),
        migrations.CreateModel(
            name="VehicleMaintenance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.TextField()),
                ("date", models.DateField()),
                ("mileage", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "vehicle",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="maintenances", to="fleet.vehicle"
                    ),
                ),
            ],
            options={"ordering": ["-date"]},
        ),
    ]
