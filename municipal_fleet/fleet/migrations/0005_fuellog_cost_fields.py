from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("fleet", "0004_vehicle_current_contract_vehicle_ownership_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="fuellog",
            name="price_per_liter",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="total_cost",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
