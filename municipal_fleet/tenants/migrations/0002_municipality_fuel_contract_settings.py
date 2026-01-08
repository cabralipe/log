from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="municipality",
            name="fuel_contract_limit",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
        migrations.AddField(
            model_name="municipality",
            name="fuel_contract_period",
            field=models.CharField(
                blank=True,
                choices=[("WEEKLY", "Semanal"), ("MONTHLY", "Mensal"), ("QUARTERLY", "Trimestral")],
                max_length=12,
                null=True,
            ),
        ),
    ]
