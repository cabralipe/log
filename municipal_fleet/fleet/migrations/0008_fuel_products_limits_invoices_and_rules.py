from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0002_municipality_fuel_contract_settings"),
        ("contracts", "0001_initial"),
        ("trips", "0014_serviceorder_trip_service_order"),
        ("fleet", "0007_vehicle_image"),
    ]

    operations = [
        migrations.CreateModel(
            name="FuelProduct",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                (
                    "unit",
                    models.CharField(
                        choices=[("LITER", "Litro"), ("UNIT", "Unidade")], default="LITER", max_length=10
                    ),
                ),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_products",
                        to="tenants.municipality",
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("municipality", "name")},
            },
        ),
        migrations.CreateModel(
            name="FuelStationLimit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "period",
                    models.CharField(
                        choices=[("DAILY", "Diario"), ("WEEKLY", "Semanal"), ("MONTHLY", "Mensal")],
                        max_length=10,
                    ),
                ),
                ("max_quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "contract",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="fuel_station_limits",
                        to="contracts.contract",
                    ),
                ),
                (
                    "fuel_station",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="limits",
                        to="fleet.fuelstation",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_station_limits",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="station_limits",
                        to="fleet.fuelproduct",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="FuelRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "scope",
                    models.CharField(
                        choices=[
                            ("MUNICIPALITY", "Municipio"),
                            ("VEHICLE", "Veiculo"),
                            ("CONTRACT", "Contrato"),
                        ],
                        default="MUNICIPALITY",
                        max_length=20,
                    ),
                ),
                ("allowed_weekdays", models.JSONField(blank=True, default=list)),
                ("allowed_start_time", models.TimeField(blank=True, null=True)),
                ("allowed_end_time", models.TimeField(blank=True, null=True)),
                ("min_interval_minutes", models.PositiveIntegerField(blank=True, null=True)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "contract",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_rules",
                        to="contracts.contract",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_rules",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "vehicle",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_rules",
                        to="fleet.vehicle",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="FuelAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("alert_type", models.CharField(max_length=50)),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("LOW", "Baixa"),
                            ("MEDIUM", "Media"),
                            ("HIGH", "Alta"),
                            ("CRITICAL", "Critica"),
                        ],
                        default="MEDIUM",
                        max_length=10,
                    ),
                ),
                ("message", models.TextField()),
                ("reference_type", models.CharField(blank=True, max_length=50)),
                ("reference_id", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "fuel_log",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alerts",
                        to="fleet.fuellog",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_alerts",
                        to="tenants.municipality",
                    ),
                ),
                (
                    "service_order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="fuel_alerts",
                        to="trips.serviceorder",
                    ),
                ),
                (
                    "trip",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="fuel_alerts",
                        to="trips.trip",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="FuelInvoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("total_value", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("uploaded_file", models.FileField(blank=True, null=True, upload_to="fuel_invoices/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "fuel_station",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="invoices",
                        to="fleet.fuelstation",
                    ),
                ),
                (
                    "municipality",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fuel_invoices",
                        to="tenants.municipality",
                    ),
                ),
            ],
            options={
                "ordering": ["-period_start"],
            },
        ),
        migrations.CreateModel(
            name="FuelInvoiceItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticket_number", models.CharField(blank=True, max_length=100)),
                ("occurred_at", models.DateTimeField(blank=True, null=True)),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("unit_price", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("total_value", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                (
                    "invoice",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="fleet.fuelinvoice",
                    ),
                ),
                (
                    "matched_fuel_log",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="invoice_items",
                        to="fleet.fuellog",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="invoice_items",
                        to="fleet.fuelproduct",
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-id"],
            },
        ),
        migrations.AddField(
            model_name="fuellog",
            name="odometer",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="fuel_logs",
                to="fleet.fuelproduct",
            ),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="quantity",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="service_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="fuel_logs",
                to="trips.serviceorder",
            ),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="ticket_number",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="ticket_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="fuellog",
            name="trip",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="fuel_logs",
                to="trips.trip",
            ),
        ),
        migrations.AddConstraint(
            model_name="fuelstationlimit",
            constraint=models.UniqueConstraint(
                fields=("fuel_station", "contract", "product", "period"), name="unique_station_limit_per_period"
            ),
        ),
    ]
