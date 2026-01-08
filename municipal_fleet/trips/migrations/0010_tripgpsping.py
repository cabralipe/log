from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("trips", "0009_freetripincident"),
    ]

    operations = [
        migrations.CreateModel(
            name="TripGpsPing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("lat", models.DecimalField(decimal_places=6, max_digits=9)),
                ("lng", models.DecimalField(decimal_places=6, max_digits=9)),
                ("accuracy", models.FloatField(blank=True, null=True)),
                ("speed", models.FloatField(blank=True, null=True)),
                ("recorded_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "driver",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="gps_pings", to="drivers.driver"),
                ),
                (
                    "trip",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="gps_pings", to="trips.trip"),
                ),
            ],
            options={
                "ordering": ["-recorded_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="tripgpsping",
            index=models.Index(fields=["trip", "recorded_at"], name="trips_trip_trip_id_1b7d7f_idx"),
        ),
        migrations.AddIndex(
            model_name="tripgpsping",
            index=models.Index(fields=["driver", "recorded_at"], name="trips_trip_driver__a1c2d9_idx"),
        ),
    ]
