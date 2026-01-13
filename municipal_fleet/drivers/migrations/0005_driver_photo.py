from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0004_driver_geofence"),
    ]

    operations = [
        migrations.AddField(
            model_name="driver",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="driver_photos/"),
        ),
    ]
