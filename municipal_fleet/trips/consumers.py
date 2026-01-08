from channels.generic.websocket import AsyncJsonWebsocketConsumer


class OperationsMapConsumer(AsyncJsonWebsocketConsumer):
    group_name = "operations_map"

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close()
            return
        if user.role not in ("SUPERADMIN", "ADMIN_MUNICIPALITY", "OPERATOR"):
            await self.close()
            return
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def gps_ping(self, event):
        await self.send_json({"event": "gps_ping", "payload": event.get("data", {})})
