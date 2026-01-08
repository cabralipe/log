from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("drivers", "0003_driver_free_trip_enabled"),
        ("tenants", "0002_municipality_fuel_contract_settings"),
        ("accounts", "0002_alter_user_options_alter_user_email"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel", models.CharField(choices=[("IN_APP", "In-app"), ("EMAIL", "Email"), ("PUSH", "Push")], default="IN_APP", max_length=12)),
                ("event_type", models.CharField(max_length=50)),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("delivery_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "municipality",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="tenants.municipality"),
                ),
                (
                    "recipient_driver",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="drivers.driver",
                    ),
                ),
                (
                    "recipient_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="NotificationDevice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device_type", models.CharField(choices=[("ANDROID", "Android"), ("IOS", "iOS"), ("WEB", "Web")], max_length=12)),
                ("token", models.CharField(max_length=255)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "driver",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_devices",
                        to="drivers.driver",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_devices",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_devices",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "unique_together": {("token", "device_type")},
            },
        ),
    ]
