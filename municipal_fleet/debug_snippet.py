import sys
from fleet.serializers import FuelStationLimitSerializer
from fleet.models import FuelStation, FuelProduct, FuelStationLimit
from accounts.models import User
import json

print("Starting debug...")
station = FuelStation.objects.first()
product = FuelProduct.objects.first()

if not station or not product:
    print("ERROR: Missing data.")
else:
    print(f"Station: {station.id}, Product: {product.id}")

    # Check existing
    existing = FuelStationLimit.objects.filter(fuel_station=station, product=product, period="MONTHLY", contract__isnull=True)
    print(f"Existing count: {existing.count()}")

    data = {
        "fuel_station": station.id,
        "product": product.id,
        "period": "MONTHLY",
        "max_quantity": "150.00"
    }
    serializer = FuelStationLimitSerializer(data=data)
    if serializer.is_valid():
        print("Valid")
    else:
        print("Invalid")
        print(json.dumps(serializer.errors))
