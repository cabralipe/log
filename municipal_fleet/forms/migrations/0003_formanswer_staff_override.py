from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("forms", "0002_transport_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="formanswer",
            name="modified_by_staff",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="formanswer",
            name="staff_value_text",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="formanswer",
            name="staff_value_json",
            field=models.JSONField(blank=True, null=True),
        ),
    ]

