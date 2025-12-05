# Municipal Fleet API (Django + DRF + PostgreSQL)

## Setup rápido
1. `python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. Configure `.env` (exemplo abaixo) e exporte as variáveis.
4. `python manage.py makemigrations && python manage.py migrate`
5. `python manage.py createsuperuser`
6. `python manage.py runserver`

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
