from rest_framework.routers import DefaultRouter
from django.urls import path, include
from forms.views import FormTemplateViewSet, FormQuestionViewSet, FormOptionViewSet, FormSubmissionViewSet

router = DefaultRouter()
router.register(r"templates", FormTemplateViewSet, basename="form-template")
router.register(r"questions", FormQuestionViewSet, basename="form-question")
router.register(r"options", FormOptionViewSet, basename="form-option")
router.register(r"submissions", FormSubmissionViewSet, basename="form-submission")

urlpatterns = [
    path("", include(router.urls)),
]
