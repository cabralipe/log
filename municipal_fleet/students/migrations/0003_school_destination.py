from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("destinations", "0001_initial"),
        ("students", "0002_classgroup_student_class_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="destination",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="schools",
                to="destinations.destination",
            ),
        ),
    ]
