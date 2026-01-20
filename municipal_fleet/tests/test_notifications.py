from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from notifications.models import Notification, NotificationDevice
from tenants.models import Municipality


class NotificationViewSetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Pref A",
            cnpj="11.111.111/0001-11",
            address="Rua 1",
            city="Cidade",
            state="SP",
            phone="11999990000",
        )
        self.muni_b = Municipality.objects.create(
            name="Pref B",
            cnpj="22.222.222/0001-22",
            address="Rua 2",
            city="Cidade",
            state="SP",
            phone="11888880000",
        )
        self.admin_a = User.objects.create_user(
            email="admin@a.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.viewer_a = User.objects.create_user(
            email="viewer@a.com",
            password="pass123",
            role=User.Roles.VIEWER,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin@b.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )
        self.superadmin = User.objects.create_user(
            email="root@example.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )

    def test_list_notifications_filters_by_recipient_for_non_superadmin(self):
        Notification.objects.create(
            municipality=self.muni_a,
            recipient_user=self.admin_a,
            event_type="TRIP",
            title="Trip alert",
            message="Trip updated.",
        )
        Notification.objects.create(
            municipality=self.muni_a,
            recipient_user=self.viewer_a,
            event_type="MAINTENANCE",
            title="Maintenance alert",
            message="Maintenance due.",
        )
        Notification.objects.create(
            municipality=self.muni_b,
            recipient_user=self.admin_b,
            event_type="FUEL",
            title="Fuel alert",
            message="Fuel budget reached.",
        )

        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/notifications/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["recipient_user"], self.admin_a.id)

        self.client.force_authenticate(self.viewer_a)
        resp = self.client.get("/api/notifications/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["recipient_user"], self.viewer_a.id)

        self.client.force_authenticate(self.superadmin)
        resp = self.client.get("/api/notifications/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 3)

    def test_non_admin_cannot_patch_notification(self):
        notification = Notification.objects.create(
            municipality=self.muni_a,
            recipient_user=self.viewer_a,
            event_type="TRIP",
            title="Trip alert",
            message="Trip updated.",
        )
        self.client.force_authenticate(self.viewer_a)
        resp = self.client.patch(
            f"/api/notifications/{notification.id}/",
            {"is_read": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class NotificationDeviceViewSetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Pref A",
            cnpj="33.333.333/0001-33",
            address="Rua 3",
            city="Cidade",
            state="SP",
            phone="11777770000",
        )
        self.muni_b = Municipality.objects.create(
            name="Pref B",
            cnpj="44.444.444/0001-44",
            address="Rua 4",
            city="Cidade",
            state="SP",
            phone="11666660000",
        )
        self.admin_a = User.objects.create_user(
            email="admin@notif.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.viewer_a = User.objects.create_user(
            email="viewer@notif.com",
            password="pass123",
            role=User.Roles.VIEWER,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin@other.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )
        self.superadmin = User.objects.create_user(
            email="root@notif.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )

    def test_create_device_uses_request_user_and_municipality(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.post(
            "/api/notifications/devices/",
            {
                "device_type": "ANDROID",
                "token": "device-token-123",
                "user": self.admin_b.id,
                "municipality": self.muni_b.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["user"], self.admin_a.id)
        self.assertEqual(resp.data["municipality"], self.muni_a.id)

    def test_list_devices_filters_by_user_for_non_superadmin(self):
        NotificationDevice.objects.create(
            municipality=self.muni_a,
            user=self.admin_a,
            device_type="ANDROID",
            token="token-admin",
        )
        NotificationDevice.objects.create(
            municipality=self.muni_a,
            user=self.viewer_a,
            device_type="IOS",
            token="token-viewer",
        )
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/notifications/devices/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["token"], "token-admin")

    def test_superadmin_can_list_all_devices(self):
        NotificationDevice.objects.create(
            municipality=self.muni_a,
            user=self.admin_a,
            device_type="ANDROID",
            token="token-admin-2",
        )
        NotificationDevice.objects.create(
            municipality=self.muni_b,
            user=self.admin_b,
            device_type="IOS",
            token="token-admin-b",
        )
        self.client.force_authenticate(self.superadmin)
        resp = self.client.get("/api/notifications/devices/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 2)

    def test_duplicate_device_token_same_type_is_rejected(self):
        self.client.force_authenticate(self.admin_a)
        payload = {
            "device_type": "WEB",
            "token": "dup-token",
        }
        resp = self.client.post("/api/notifications/devices/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        resp = self.client.post("/api/notifications/devices/", payload, format="json")
        self.assertEqual(resp.status_code, 400)
