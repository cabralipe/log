from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Driver",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("cpf", models.CharField(max_length=14)),
                ("cnh_number", models.CharField(max_length=20)),
                ("cnh_category", models.CharField(max_length=5)),
                ("cnh_expiration_date", models.DateField()),
                ("phone", models.CharField(max_length=20)),
                ("status", models.CharField(choices=[("ACTIVE", "Ativo"), ("INACTIVE", "Inativo")], default="ACTIVE", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("municipality", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="drivers", to="tenants.municipality")),
            ],
            options={"ordering": ["name"], "unique_together": {("municipality", "cpf")}},
        ),
    ]
