from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("fleet", "0008_fuel_products_limits_invoices_and_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="category",
            field=models.CharField(
                choices=[
                    ("PASSENGER", "Transporte de passageiros"),
                    ("CARGO", "Carga"),
                    ("SERVICE", "Serviço"),
                    ("HOSPITAL", "Hospitalar"),
                ],
                default="PASSENGER",
                max_length=20,
            ),
        ),
    ]
