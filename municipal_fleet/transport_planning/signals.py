from django.db.models.signals import post_save
from django.dispatch import receiver
from forms.models import FormSubmission
from transport_planning.models import ServiceApplication, TransportService, Person
from transport_planning.services import evaluate_eligibility


@receiver(post_save, sender=FormSubmission)
def create_service_application_from_submission(sender, instance: FormSubmission, created: bool, **kwargs):
    """
    When a form submission is created for a transport service template, create a ServiceApplication.
    """
    if not created:
        return
    try:
        service = TransportService.objects.get(form_template=instance.form_template, active=True)
    except TransportService.DoesNotExist:
        return
    cpf = instance.cpf
    municipality = instance.municipality
    person, _ = Person.objects.get_or_create(
        municipality=municipality,
        cpf=cpf,
        defaults={"full_name": cpf, "status": Person.Status.ACTIVE},
    )
    status, notes = evaluate_eligibility(service, None)
    ServiceApplication.objects.create(
        municipality=municipality,
        person=person,
        transport_service=service,
        form_submission=instance,
        status=status,
        status_notes=notes,
    )
