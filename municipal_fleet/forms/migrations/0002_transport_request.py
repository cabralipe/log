from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("trips", "0009_freetripincident"),
        ("forms", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="formsubmission",
            name="linked_trip",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="form_submissions",
                to="trips.trip",
            ),
        ),
        migrations.AlterField(
            model_name="formtemplate",
            name="form_type",
            field=models.CharField(
                choices=[
                    ("STUDENT_CARD_APPLICATION", "Solicitação de Carteirinha"),
                    ("TRANSPORT_REQUEST", "Solicitação de Transporte"),
                    ("GENERIC", "Genérico"),
                ],
                default="STUDENT_CARD_APPLICATION",
                max_length=64,
            ),
        ),
    ]
