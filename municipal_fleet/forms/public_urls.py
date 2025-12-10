from django.urls import path
from forms.views import PublicFormDetailView, PublicFormSubmitView, PublicFormStatusView

urlpatterns = [
    path("<slug:slug>/", PublicFormDetailView.as_view(), name="public-form-detail"),
    path("<slug:slug>/submit/", PublicFormSubmitView.as_view(), name="public-form-submit"),
    path("<slug:slug>/status/", PublicFormStatusView.as_view(), name="public-form-status"),
]
