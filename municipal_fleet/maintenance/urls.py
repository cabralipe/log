from rest_framework.routers import DefaultRouter

from maintenance import views

router = DefaultRouter()
router.register(r"service-orders", views.ServiceOrderViewSet, basename="service-order")
router.register(r"inventory/parts", views.InventoryPartViewSet, basename="inventory-part")
router.register(r"inventory/movements", views.InventoryMovementViewSet, basename="inventory-movement")
router.register(r"maintenance-plans", views.MaintenancePlanViewSet, basename="maintenance-plan")
router.register(r"tires", views.TireViewSet, basename="tire")
router.register(r"vehicle-tires", views.VehicleTireViewSet, basename="vehicle-tire")

urlpatterns = router.urls
