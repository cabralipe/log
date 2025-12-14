from typing import Tuple, Optional
from django.db import models
from transport_planning.models import EligibilityPolicy, ServiceApplication, TransportService, Route


def evaluate_eligibility(service: TransportService, route: Optional[Route]) -> Tuple[str, str]:
    """
    Returns (status, notes) based on the first matching eligibility policy.
    """
    policies = EligibilityPolicy.objects.filter(transport_service=service, active=True)
    if route:
        policies = policies.filter(models.Q(route=route) | models.Q(route__isnull=True))
    else:
        policies = policies.filter(route__isnull=True)
    policy = policies.order_by("-route_id").first()
    if not policy:
        return ServiceApplication.Status.PENDING, ""

    if policy.decision_mode == EligibilityPolicy.DecisionMode.AUTO_APPROVE:
        return ServiceApplication.Status.APPROVED, "Elegibilidade automática aprovada."
    if policy.decision_mode == EligibilityPolicy.DecisionMode.AUTO_DENY:
        return ServiceApplication.Status.REJECTED, "Elegibilidade automática negada."
    if policy.decision_mode == EligibilityPolicy.DecisionMode.AUTO_THEN_REVIEW:
        return ServiceApplication.Status.PENDING, "Pré-aprovada para revisão."
    return ServiceApplication.Status.PENDING, ""
