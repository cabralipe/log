from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0002_driver_access_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="driver",
            name="free_trip_enabled",
            field=models.BooleanField(default=False),
        ),
    ]
