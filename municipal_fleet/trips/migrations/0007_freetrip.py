from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0003_driver_free_trip_enabled"),
        ("fleet", "0001_initial"),
        ("tenants", "0001_initial"),
        ("trips", "0006_alter_tripincident_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="FreeTrip",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("OPEN", "Em aberto"), ("CLOSED", "Encerrada")], default="OPEN", max_length=20)),
                ("odometer_start", models.PositiveIntegerField()),
                ("odometer_start_photo", models.FileField(blank=True, null=True, upload_to="free_trips/start/")),
                ("odometer_end", models.PositiveIntegerField(blank=True, null=True)),
                ("odometer_end_photo", models.FileField(blank=True, null=True, upload_to="free_trips/end/")),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "driver",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="free_trips", to="drivers.driver"),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="free_trips", to="tenants.municipality"
                    ),
                ),
                (
                    "vehicle",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="free_trips", to="fleet.vehicle"),
                ),
            ],
            options={"ordering": ["-started_at"]},
        ),
    ]
