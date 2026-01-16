from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventorymovement",
            name="responsible_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="inventorymovement",
            name="expected_return_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="inventorymovement",
            name="notes",
            field=models.TextField(blank=True),
        ),
    ]
