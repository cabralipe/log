from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("fleet", "0001_initial"),
        ("drivers", "0001_initial"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MonthlyOdometer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.IntegerField()),
                ("month", models.IntegerField()),
                ("kilometers", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "vehicle",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="odometer_monthly", to="fleet.vehicle"
                    ),
                ),
            ],
            options={"ordering": ["-year", "-month"], "unique_together": {("vehicle", "year", "month")}},
        ),
        migrations.CreateModel(
            name="Trip",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("origin", models.CharField(max_length=255)),
                ("destination", models.CharField(max_length=255)),
                ("departure_datetime", models.DateTimeField()),
                ("return_datetime_expected", models.DateTimeField()),
                ("return_datetime_actual", models.DateTimeField(blank=True, null=True)),
                ("odometer_start", models.PositiveIntegerField()),
                ("odometer_end", models.PositiveIntegerField(blank=True, null=True)),
                ("passengers_count", models.PositiveIntegerField(default=0)),
                ("stops_description", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("PLANNED", "Planejada"), ("IN_PROGRESS", "Em andamento"), ("COMPLETED", "Concluida"), ("CANCELLED", "Cancelada")], default="PLANNED", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "driver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, related_name="trips", to="drivers.driver"
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trips",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "vehicle",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, related_name="trips", to="fleet.vehicle"
                    ),
                ),
            ],
            options={"ordering": ["-departure_datetime"]},
        ),
    ]
