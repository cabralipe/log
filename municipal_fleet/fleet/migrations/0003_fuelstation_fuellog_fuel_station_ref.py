from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0001_initial"),
        ("drivers", "0001_initial"),
        ("fleet", "0002_fuellog"),
    ]

    operations = [
        migrations.CreateModel(
            name="FuelStation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("cnpj", models.CharField(blank=True, max_length=18)),
                ("address", models.CharField(blank=True, max_length=255)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("municipality", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="fuel_stations", to="tenants.municipality")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("municipality", "name")},
            },
        ),
        migrations.AddField(
            model_name="fuellog",
            name="fuel_station_ref",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="fuel_logs", to="fleet.fuelstation"),
        ),
    ]
