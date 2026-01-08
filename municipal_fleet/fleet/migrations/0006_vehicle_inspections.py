from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0003_driver_free_trip_enabled"),
        ("fleet", "0005_fuellog_cost_fields"),
        ("tenants", "0002_municipality_fuel_contract_settings"),
    ]

    operations = [
        migrations.CreateModel(
            name="VehicleInspection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("inspection_date", models.DateField()),
                ("inspected_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("odometer", models.PositiveIntegerField(blank=True, null=True)),
                ("checklist_items", models.JSONField(blank=True, default=list)),
                ("notes", models.TextField(blank=True)),
                (
                    "condition_status",
                    models.CharField(
                        choices=[("OK", "Aprovado"), ("ATTENTION", "Atenção")],
                        default="OK",
                        max_length=20,
                    ),
                ),
                ("signature_name", models.CharField(blank=True, max_length=255)),
                ("signature_image", models.FileField(blank=True, null=True, upload_to="inspection_signatures/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "driver",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="inspections", to="drivers.driver"),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="vehicle_inspections", to="tenants.municipality"
                    ),
                ),
                (
                    "vehicle",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="inspections", to="fleet.vehicle"),
                ),
            ],
            options={
                "ordering": ["-inspection_date", "-inspected_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="VehicleInspectionDamagePhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.FileField(upload_to="inspection_damages/")),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "inspection",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="damage_photos",
                        to="fleet.vehicleinspection",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="vehicleinspection",
            constraint=models.UniqueConstraint(fields=("vehicle", "inspection_date"), name="unique_vehicle_inspection_per_day"),
        ),
    ]
