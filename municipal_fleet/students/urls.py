from rest_framework.routers import DefaultRouter
from django.urls import path, include
from students.views import (
    SchoolViewSet,
    StudentViewSet,
    StudentCardViewSet,
    StudentTransportRegistrationViewSet,
    StudentCardValidateView,
)

router = DefaultRouter()
router.register(r"schools", SchoolViewSet, basename="school")
router.register(r"students", StudentViewSet, basename="student")
router.register(r"student-cards", StudentCardViewSet, basename="student-card")
router.register(r"transport-registrations", StudentTransportRegistrationViewSet, basename="student-transport-registration")

urlpatterns = [
    path("student-cards/validate/", StudentCardValidateView.as_view(), name="student-card-validate"),
    path("", include(router.urls)),
]
