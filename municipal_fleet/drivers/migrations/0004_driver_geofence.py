from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0003_driver_free_trip_enabled"),
    ]

    operations = [
        migrations.CreateModel(
            name="DriverGeofence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("center_lat", models.DecimalField(decimal_places=6, max_digits=9)),
                ("center_lng", models.DecimalField(decimal_places=6, max_digits=9)),
                ("radius_m", models.PositiveIntegerField(default=500)),
                ("is_active", models.BooleanField(default=True)),
                ("alert_active", models.BooleanField(default=False)),
                ("last_alerted_at", models.DateTimeField(blank=True, null=True)),
                ("cleared_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "driver",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="geofence",
                        to="drivers.driver",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
    ]
