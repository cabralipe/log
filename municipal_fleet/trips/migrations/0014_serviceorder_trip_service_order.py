from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0002_municipality_fuel_contract_settings"),
        ("fleet", "0007_vehicle_image"),
        ("drivers", "0004_driver_geofence"),
        ("trips", "0013_plannedtrip_optimize_route"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=100)),
                ("service_type", models.CharField(blank=True, max_length=255)),
                ("planned_start", models.DateTimeField(blank=True, null=True)),
                ("planned_end", models.DateTimeField(blank=True, null=True)),
                ("executed_start", models.DateTimeField(blank=True, null=True)),
                ("executed_end", models.DateTimeField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PLANNED", "Planejada"),
                            ("IN_PROGRESS", "Em andamento"),
                            ("COMPLETED", "Concluida"),
                            ("CANCELLED", "Cancelada"),
                        ],
                        default="PLANNED",
                        max_length=20,
                    ),
                ),
                ("raw_payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "driver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="external_service_orders",
                        to="drivers.driver",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="external_service_orders",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "vehicle",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="external_service_orders",
                        to="fleet.vehicle",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="serviceorder",
            constraint=models.UniqueConstraint(
                fields=("municipality", "external_id"), name="unique_service_order_external_id"
            ),
        ),
        migrations.AddField(
            model_name="trip",
            name="service_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="trips",
                to="trips.serviceorder",
            ),
        ),
    ]
