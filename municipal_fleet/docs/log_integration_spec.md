# LOG - Integracao de Servicos, Abastecimento, Inteligencia e Controle

Este documento define o escopo funcional e tecnico para integrar o sistema LOG
com OS existentes e controle de abastecimento, com foco em governanca, auditoria
e prevencao de fraudes. O objetivo e criar uma camada unificada sem duplicar os
sistemas atuais.

## 1) Integracao com Ordem de Servico (OS)

### Dados consumidos da OS (via API/Webhook)
- os_id (identificador externo)
- service_type
- vehicle_id
- driver_id
- planned_start / planned_end
- executed_start / executed_end
- status

### Comportamento
- A OS e consumida e persistida como referencia externa, sem recriar a OS.
- Cada OS pode gerar viagens no LOG.
- Cada OS pode consumir recursos (combustivel, oleo, outros).
- O LOG deve manter vinculo OS -> Viagens -> Consumos, com historico completo.

### Entidades sugeridas
- ServiceOrder (referencia externa, read-only no LOG)
  - municipality_id
  - external_id (os_id)
  - service_type
  - vehicle_id
  - driver_id
  - planned_start / planned_end
  - executed_start / executed_end
  - status
  - raw_payload (JSON)
  - created_at / updated_at

- Vinculo com viagens e consumos:
  - Trip.service_order (FK opcional)
  - FuelLog.service_order (FK opcional)

## 2) Postos e Controle de Limites

### Configuracao por posto/contrato/cliente
Permitir limites por produto e periodo:
- produtos: combustivel, oleo, outros (parametrizavel)
- periodos: diario, semanal, mensal

### Entidades sugeridas
- FuelProduct
  - name (Combustivel, Oleo, Outro)
  - unit (L, UN, etc.)
  - active

- FuelStationLimit
  - fuel_station_id
  - contract_id (ou cliente/contrato)
  - product_id
  - period (DAILY/WEEKLY/MONTHLY)
  - max_quantity

### Comportamento
- Ao registrar consumo, o limite vigente e abatido automaticamente.
- Ao exceder, o sistema bloqueia ou alerta conforme regra de negocio.

## 3) Consumo Operacional (Abastecimento)

### Dados do abastecimento
- fuel_station_id / nome do posto
- vehicle_id
- driver_id
- datetime
- product_id
- quantity
- odometer
- ticket_number / ticket_value
- receipt_image

### Vinculos
- Vinculo a ServiceOrder (quando existir)
- Vinculo a Trip (quando existir)

### Ajustes sugeridos no FuelLog
- product_id (FK)
- quantity (Decimal)
- odometer (int)
- ticket_number / ticket_value
- service_order_id (FK opcional)
- trip_id (FK opcional)

Regra de compatibilidade:
- manter "liters" para combustivel legado
- se quantity estiver vazio e product for combustivel, copiar de liters

## 4) Inteligencia e Prevencao de Fraudes

### Calculo automatico
- KM rodado por veiculo (odometro e viagens)
- Media KM/L por veiculo
- Media KM/L da frota
- Alertas quando veiculo foge do padrao da frota

### Regras parametrizaveis
- Permitir abastecimento apenas:
  - em dias uteis
  - em horario comercial
- Regras configuraveis por veiculo/contrato
- Intervalo minimo entre abastecimentos

### Detecao de anomalias
- Abastecimento fora de rota planejada
- Consumo incompatível com KM rodado
- Abastecimentos repetidos em curto periodo
- Consumo acima do limite do posto/contrato
- Divergencia entre ticket e fatura do posto

### Entidades sugeridas
- FuelRule (parametrizavel)
  - scope (vehicle/contract/municipality)
  - allowed_days
  - allowed_hours
  - min_interval_minutes
  - active

- FuelAlert
  - alert_type
  - severity
  - message
  - reference_type (FuelLog/Trip/Invoice)
  - reference_id
  - created_at
  - resolved_at / resolved_by

## 5) Auditoria de Faturas

### Fluxo
- Importacao de fatura da rede de postos
- Conciliacao automatica com FuelLogs (ticket_number + valores + data + posto)
- Relatorio de inconsistencias

### Entidades sugeridas
- FuelInvoice
  - fuel_station_id
  - period_start / period_end
  - total_value
  - uploaded_file
  - created_at

- FuelInvoiceItem
  - invoice_id
  - ticket_number
  - datetime
  - product_id
  - quantity
  - unit_price
  - total_value
  - matched_fuel_log_id (FK opcional)

## 6) Relatorios Gerenciais

Indicadores:
- Custo por KM rodado
- Consumo total por veiculo, motorista, posto, contrato
- Ranking de motoristas (economicos e maior consumo)
- Utilizacao de frota
- Consumo por tipo de servico

Filtros obrigatorios:
- periodo, veiculo, motorista, posto, OS, contrato

Exportacoes:
- CSV / XLSX
- Relatorios mensais consolidados

## 7) Governanca e Seguranca

- Logs de quem registrou e quando
- Trilha de auditoria imutavel
- Perfis: administrador, operador, financeiro, auditor

## 8) Integracoes tecnicas (CodeX-friendly)

- API REST + Webhooks (quando aplicavel)
- Regras centralizadas em services (camada de negocio)
- Preparado para multiplos contratos e crescimento de frota

### Endpoints sugeridos
- POST /api/integrations/os/ingest (ou webhook)
- GET /api/service_orders/
- POST /api/fuel_logs/ (com validacoes de limites/regras)
- GET /api/fuel_limits/
- POST /api/fuel_invoices/import
- GET /api/fuel_alerts/

## 9) Observacoes de implementacao

- Separar ingestao (integracoes) das regras de negocio.
- Usar jobs assincronos para conciliacao de faturas e calculo de alertas.
- Garantir rastreabilidade completa por OS, viagem e consumo.
