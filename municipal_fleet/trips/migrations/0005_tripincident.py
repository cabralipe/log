from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("drivers", "0001_initial"),
        ("tenants", "0001_initial"),
        ("trips", "0004_trip_contract_trip_rental_period"),
    ]

    operations = [
        migrations.CreateModel(
            name="TripIncident",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "driver",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trip_incidents", to="drivers.driver"),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trip_incidents",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "trip",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incidents", to="trips.trip"),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]

