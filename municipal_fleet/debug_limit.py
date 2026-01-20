import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'municipal_fleet.settings.dev')
django.setup()

from fleet.serializers import FuelStationLimitSerializer
from fleet.models import FuelStation, FuelProduct
from accounts.models import User

def debug_create():
    print("Starting debug...")
    
    # Fetch required related objects
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    station = FuelStation.objects.first()
    product = FuelProduct.objects.first()
    
    if not station or not product:
        print("ERROR: No Station or Product found in DB to test with.")
        return

    print(f"Testing with Station: {station.id} ({station.name})")
    print(f"Testing with Product: {product.id} ({product.name})")

    # Simulate frontend payload
    data = {
        "fuel_station": station.id,
        "product": product.id,
        "period": "MONTHLY",
        "max_quantity": "150.00"
    }
    
    # Initialize serializer with data
    serializer = FuelStationLimitSerializer(data=data)
    
    # Check validation
    if serializer.is_valid():
        print("Serializer is VALID.")
        # Try to save (dry run conceptually, but we can try actual save if we provide context)
        # We need to simulate the view's perform_create action
        try:
             # Pass municipality explicitly as the view would
             instance = serializer.save(municipality=station.municipality) 
             print(f"Successfully created Limit ID: {instance.id}")
             # Cleanup
             instance.delete()
             print("Cleaned up test record.")
        except Exception as e:
            print(f"Save FAILED with exception: {e}")
    else:
        print("Serializer is INVALID.")
        print("Errors:", serializer.errors)

if __name__ == "__main__":
    debug_create()
