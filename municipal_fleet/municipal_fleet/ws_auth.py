from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken, AccessToken


@database_sync_to_async
def get_user(user_id):
    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JwtAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        instance = JwtAuthMiddlewareInstance(scope, self.inner)
        return await instance(receive, send)


class JwtAuthMiddlewareInstance:
    def __init__(self, scope, inner):
        self.scope = scope
        self.inner = inner

    async def __call__(self, receive, send):
        token = None
        query_params = parse_qs(self.scope.get("query_string", b"").decode())
        if query_params.get("token"):
            token = query_params["token"][0]
        if not token:
            for header, value in self.scope.get("headers", []):
                if header == b"authorization":
                    auth_value = value.decode()
                    if auth_value.lower().startswith("bearer "):
                        token = auth_value.split(" ", 1)[1]
                        break
        self.scope["user"] = AnonymousUser()
        if token:
            try:
                UntypedToken(token)
                access = AccessToken(token)
                user_id = access.get("user_id")
                if user_id:
                    self.scope["user"] = await get_user(user_id)
            except Exception:
                self.scope["user"] = AnonymousUser()
        return await self.inner(self.scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)
