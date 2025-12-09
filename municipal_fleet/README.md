# Municipal Fleet API (Django + DRF + PostgreSQL)

## Setup rápido
1. `python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. Configure `.env` (exemplo em `.env.example`) e exporte as variáveis.
4. `python manage.py makemigrations && python manage.py migrate`
5. `python manage.py createsuperuser`
6. (Opcional) Popular usuários/municípios de teste: `python manage.py seed_demo_users`
7. `python manage.py runserver` (usa `municipal_fleet.settings.dev` por padrão)

### Variáveis de ambiente
```
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
POSTGRES_DB=municipal_fleet
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
CORS_ALLOW_ALL=True
```

Config prod sugerida (override variáveis):
```
DJANGO_SETTINGS_MODULE=municipal_fleet.settings.prod
DJANGO_ALLOWED_HOSTS=seu-dominio.com
CORS_ALLOW_ALL=False
CORS_ALLOWED_ORIGINS=https://frontend.seu-dominio.com
DJANGO_SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
THROTTLE_LOGIN_RATE=5/min
```

### Healthcheck
- `/api/health/` retorna 200 se o banco responder; 503 se não. Inclui `version`/`commit` se `APP_VERSION`/`APP_COMMIT` estiverem no ambiente.

### Ambientes (settings)
- Dev: `municipal_fleet.settings.dev` (default) — CORS liberado.
- Prod: `municipal_fleet.settings.prod` — CORS restrito (`CORS_ALLOW_ALL=False`, `CORS_ALLOWED_ORIGINS`), headers de segurança (`SECURE_SSL_REDIRECT`, cookies `Secure`, HSTS).
- Troque o settings definindo `DJANGO_SETTINGS_MODULE`.
- Erros não tratados retornam JSON 500 quando `DEBUG=False`.
- Login limitado via throttle (`THROTTLE_LOGIN_RATE`, padrão `5/min`).

## Endpoints principais
- Auth: `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/`, `/api/auth/users/`
- Prefeituras: `/api/municipalities/`
- Veículos: `/api/vehicles/`, `/api/vehicles/maintenance/`
- Motoristas: `/api/drivers/`
- Viagens: `/api/trips/`, `/api/trips/{id}/whatsapp_message/`
- Relatórios: `/api/reports/dashboard/`, `/api/reports/odometer/`, `/api/reports/trips/`
- Docs: `/api/schema/` e `/api/docs/`

## Notas
- Multi-tenant lógico: usuários não superadmin são sempre filtrados por `request.user.municipality`.
- JWT com blacklist ativada para logout via refresh token.
- Permissões de escrita restritas a `SUPERADMIN` e `ADMIN_MUNICIPALITY`; operadores/visualizadores têm leitura.
- Validações: capacidade de passageiros, conflito de agenda, datas coerentes, CNH não expirada, unicidade de CPF/placa por prefeitura, odômetro atualizado ao concluir viagens.

## Usuários de teste (comando `seed_demo_users`)
- Atalho a partir da raiz do projeto: `python seed_demo_users.py` (env `DJANGO_SETTINGS_MODULE` pode sobrepor).
- `superadmin@example.com` (Super Admin) — senha `pass123`
- `admin@central.gov` (Admin prefeitura Central) — senha `pass123`
- `operador@central.gov` / `visualizador@central.gov` — senha `pass123`
- `admin@interior.gov` (Admin prefeitura Interior) — senha `pass123`
- `operador@interior.gov` / `visualizador@interior.gov` — senha `pass123`

## Testes
- Backend (SQLite para evitar configurar Postgres): `USE_SQLITE_FOR_TESTS=True python manage.py test`
- Recalcular odômetro mensal (apoio/virada de mês): `python manage.py rebuild_monthly_odometer`

## Docker / docker-compose (dev)
1. `docker compose up --build`
2. Backend em `http://localhost:8000` (docs em `/api/docs/`, health em `/api/health/`).
3. Frontend em `http://localhost:5173` (env `VITE_API_URL` já apontando para o backend do compose).
4. Volumes: `pgdata` (DB), `staticfiles`, `media`. `collectstatic` roda no start do backend.
5. Para servir frontend buildado + proxy reverso: suba `frontend-build` e `nginx` (`docker compose up frontend-build nginx backend db`). Nginx expõe em `http://localhost:8080`, proxyando `/api/` para o backend e servindo `dist` em `/`.
6. Nginx envia cabeçalhos de segurança básicos (X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Ajuste conforme necessidade de CSP.

## CI
- Workflow em `.github/workflows/ci.yml` roda `ruff check .`, `python manage.py test` com SQLite e `npm run build` no frontend em pushes/PRs.

## Ferramentas locais
- Pre-commit disponível (`.pre-commit-config.yaml`) com ruff lint/format (`pre-commit install`).
- Frontend: `.env.example` em `frontend/` com `VITE_API_URL`.
- Build frontend: `cd frontend && npm run build` (usa config do Vite).

## Operação/segredos
- Defina `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS` e credenciais de DB reais em produção (não use defaults do compose).
- Mantenha `CORS_ALLOW_ALL=False` e liste domínios do frontend em `CORS_ALLOWED_ORIGINS`.
- Para HTTPS atrás de proxy, mantenha `SECURE_PROXY_SSL_HEADER` (já configurado no settings.prod) e force SSL com `DJANGO_SECURE_SSL_REDIRECT=True`.
- Faça backup do Postgres (ex.: `pg_dump`) e preserve volumes `pgdata`/`media`/`staticfiles` conforme estratégia de backup .
