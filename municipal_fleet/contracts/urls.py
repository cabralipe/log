from rest_framework.routers import DefaultRouter
from contracts.views import ContractViewSet, ContractVehicleViewSet, RentalPeriodViewSet

router = DefaultRouter()
router.register(r"contracts", ContractViewSet, basename="contract")
router.register(r"contract-vehicles", ContractVehicleViewSet, basename="contract-vehicle")
router.register(r"rental-periods", RentalPeriodViewSet, basename="rental-period")

urlpatterns = router.urls
