from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0002_municipality_fuel_contract_settings"),
        ("accounts", "0002_alter_user_options_alter_user_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="active_municipality",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="active_superadmins",
                to="tenants.municipality",
            ),
        ),
    ]
