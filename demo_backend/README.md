# EFHC DEMO_BACKEND — локальный серверный контур поверх Neon TEST

**Статус:** локальная реализация / сборка с модульными проверками. Production не менялся.  
**Назначение:** существующий frontend EFHC работает через те же HTTP-маршруты, схемы ответов и бизнес-сервисы, что и реальный FastAPI backend. Отдельный раздел `demo_backend/` добавляет только тестовую сессию, диагностические операции и переключение на Neon TEST. Он не является копией экономического движка.

## 1. Структура

- `backend/` — **исходный неизменённый** FastAPI EFHC из переданного FULL-архива. Все пользовательские, административные, банковские, платёжные, TON Proof, рекламные и остальные маршруты регистрируются его штатным `app.main`.
- `demo_backend/asgi.py` — отдельный entrypoint `uvicorn demo_backend.asgi:app`; подключает исходное приложение и накладывает только DEMO-специфичные правила.
- `demo_backend/config.py` — жёсткая проверка подключения к Neon TEST, запрет production DSN и отдельные конфигурационные параметры.
- `demo_backend/auth_adapter.py` — операторская тестовая сессия; настоящие Telegram/TON login sessions проверяются исходной БД и действующим механизмом auth, без подмены TON Proof.
- `demo_backend/tonconnect.py` — изолированный тестовый идентификатор привязки proof для DEMO-оператора. Нужен, потому что в существующей тестовой Neon-ветке пока нет подтверждённых Telegram identities. Он **не выдаёт поддельную Telegram identity**: только связывает одноразовый HMAC payload с локальным тестовым владельцем для штатной криптографической проверки TonConnect. Native session идёт через исходную проверку Telegram identity без этого адаптера.
- `demo_backend/routes.py` — `/api/staging/*`: login, session, logout, select-global-id, schema, routes, bank-snapshot, topup, energy/tick и health.
- `demo_backend/schema.py` — только read-only анализ 54 существующих EFHC таблиц и 10 представлений.
- `demo_backend/audit.py`, `route_inventory.json` — инвентаризация маршрутов и DB-объектов, без обращения к базе.
- `site/frontend/src/pages/dev/neon.tsx` — консоль тестового сервера в локальном frontend.
- `site/frontend/src/demo/` и `site/frontend/src/data/` — единый транспорт API для DEMO backend и production. Браузерный DEMO экономический движок удалён из исполняемого frontend.

**Принцип:** не создаются и не удаляются ни таблицы, ни колонки. Экономические действия идут через те же сервисы и финансовый журнал `efhc_core.efhc_transfers_log`, панели — через исходный сервис, энергия — через `app.scheduler.generate_energy`.

## 2. Подготовка

1. Скопировать `demo_backend/.env.example` в `demo_backend/.env` на собственном сервере. Заполнить **только тестовый Neon DSN** и его точный `*.neon.tech` host, `DEMO_OPERATOR_PASSWORD`, `SECRET_KEY`, при необходимости `TON_API_KEY`.
2. Убедиться, что в выбранной Neon TEST уже существует активный `DEMO_INITIAL_GLOBAL_ID`, по умолчанию `0000000002`. Данный ID — существующая запись тестовой ветки, **не** новый утверждённый SuperAdmin ID `0000000088`. Перенос SuperAdmin в БД — отдельная операция, этим модулем не производится.
3. Настроить HTTPS reverse-proxy над API. HTTPS origin frontend (например `https://gly-efhc.github.io`) должен присутствовать в `DEMO_CORS_ORIGINS`; он же применяется для домена TonConnect proof.
4. `SECRET_KEY` должен быть отдельным TEST ключом. Не копировать рабочие prod-секреты или реальные server payout keys. Сеанс и CSRF выдаёт сервер.
5. В директории корня проекта выполнить `docker compose -f demo_backend/docker-compose.demo.yml up --build -d`; файл ENV читается из `demo_backend/.env`. По умолчанию API слушает только `127.0.0.1:8000`, наружу отдаёт только HTTPS reverse-proxy.

Локальный запуск без Docker (из корня, с Python зависимостями из `backend/requirements.txt`):

```bash
python -m pip install -r backend/requirements.txt
# Экспортировать значения DEMO_* из приватного .env в процесс сервера.
python -m uvicorn demo_backend.asgi:app --host 127.0.0.1 --port 8000 --workers 1
```

Не запускать `app.main:app` как DEMO — обход тестовой границы.

## 3. Подключение frontend

В **отдельной** локальной или тестовой Pages-сборке указать:

```dotenv
NEXT_PUBLIC_EFHC_DATA_SOURCE=demo_backend
NEXT_PUBLIC_EFHC_DEMO_API_ORIGIN=https://YOUR_TEST_API_HOST
```

Новый серверный DEMO не использует три прежних preview/test-флага, локальное IndexedDB-хранилище или браузерный финансовый симулятор. Для GitHub Pages прежний флаг `NEXT_PUBLIC_EFHC_PAGES_PREVIEW=1` может оставаться исключительно как технический режим статической сборки и пути ресурсов, не как переключатель источника данных. В URL API не должно быть пути или секретов — только HTTPS origin.

Открыть `/dev/neon` в тестовой Pages-сборке: войти по паролю, проверить `schema`, `Home`, `bank-snapshot`, выбрать существующий Global ID и проверить перевод через тестовый Банк. Выбранный пользователь проверяется в Neon по существующей таблице `efhc_core.users`. Обычные маршруты `/sync/me`, `/panels/*`, `/exchange/*`, `/admin/reports/*`, `/wallets/*`, `/auth/*` и т. п. обслуживаются **исходным FastAPI**.

Важные ограничения: DEMO operator password — не пользовательская production-аутентификация. Нативный TON proof даёт собственную полноценную TEST auth-сессию. Произвольный Global ID из браузера **никогда не превращается в авторизацию без действующей операторской сессии**.

## 4. TonConnect и внешние интеграции

Согласно уточнению OWNER, внешние интеграции **не выключаются**. В частности:

- `/api/wallets/tonconnect/proof-payload`, `/check-proof`, `/wallets/connect` — настоящий серверный TON Proof, проверка криптографической подписи и запись wallet binding в Neon TEST.
- `/api/auth/ton/challenge` и `/api/auth/ton/proof` — нативная проверка TON login и server-side session, если feature flag и публичный домен настроены.
- API внешних провайдеров рекламы, TONAPI и другие маршруты исходного backend остаются зарегистрированными; для фактического обращения нужны валидные TEST credentials и соответствующая исходная конфигурация.
- Для чистой тестовой операторской сессии, где ещё нет Telegram identity, используется строго тестовый proof-subject (отдельный от Telegram ID). Это позволяет **проверить подпись кошелька, а не симулировать её успешность**.

Тестовый процесс фиксирует `ALLOW_REAL_FUNDS=false` и `RUN_EMBEDDED_TON_AGENT=false`: автоматическая отправка реальных средств не запускается. Это не запрет на TonConnect; если пользователь самостоятельно подписывает реальную платёжную транзакцию кошельком, она может произойти в блокчейне. Поэтому реальные финансовые тесты требуют отдельного осознанного выбора кошелька/сети; DEMO-начисление через `/api/staging/topup` само по себе никакой транзакции не отправляет.

**Не путать:** интеграция реальной TON-сети доступна; отсутствие конфигурации конкретного провайдера не является успешной имитацией его работы.

## 5. Проводки, схема и целостность

`POST /api/staging/topup` с `Idempotency-Key` и `X-EFHC-Test-CSRF` вызывает `credit_user_from_bank_nocommit(...)`, использует `efhc_core.bank_balance` и финансовый журнал и делает общий DB commit с audit. Он не выполняет прямой SQL UPDATE по пользовательскому балансу.

`POST /api/staging/energy/tick` запускает **реальный** расчёт существующего планировщика; `DEMO_ENERGY_SCHEDULER=1` включает периодический тик без запуска TON payout agent. Проверять `bank_metrics_snapshot` можно через GET `/api/staging/bank-snapshot` и обычный `/api/admin/reports/overview`.

На запуске проверяются необходимые физические таблицы/VIEW и существование активного стартового пользователя. При несовпадении сервер **не создаёт новую схему** и не запускается.

## 6. Результаты локальных проверок и границы верификации

- `python -m pytest demo_backend/tests -q` — PASS, в том числе валидация TEST DSN, сессии, 54 таблиц, 10 VIEW и TonConnect bridge.
- `python -m compileall -q demo_backend` — PASS.
- `python -m demo_backend.audit` — 192 маршрута в статическом inventory; живой импорт FastAPI через entrypoint регистрирует **202 `/api` routes**. Разница обусловлена отдельными/совмещёнными обработчиками; источник истины при запуске — live `app.routes`.
- ASGI smoke с фиктивной DSN: `/openapi.json` — 200; `/api/wallets/tonconnect/proof-payload` по тестовому bearer — 200; криптографическая проверка реальной подписи кошельком **не проводилась**.
- Runtime CRUD на живой Neon/верификация реального TON Proof/Pages через HTTPS — **NOT_VERIFIED**, потому что серверный TEST DSN и секреты не переданы в локальное окружение. Наличие Neon connector позволяет проверить схемы, но не даёт локальному FastAPI DSN и авторизованное сетевое соединение.
- Код исходного `backend/` не изменялся. Production Neon, remote GitHub, Pages и блокчейн-операции не изменялись.

## Цикл 0032 (05.11.2026) — локальная интеграция

- Создана удалённая ветка `gly-efhc/efhc:cycle0032/demo-backend-migration` от `fe0ad6ae47ffd09ab40477f14f396b216f8ec545`; изменения кода подготовлены **локально**, не опубликованы и не развернуты.
- React использует `NEXT_PUBLIC_EFHC_DATA_SOURCE=demo_backend` или `production` для выбора одного зарегистрированного транспорта; тестовый HTTP origin — только `NEXT_PUBLIC_EFHC_DEMO_API_ORIGIN`.
- Browser IndexedDB/DEMO fixtures и DEMO-сервисы убраны из исполняемого frontend; серверный `demo_backend/` изолирован от неизменённого `backend/`.
- `site/frontend/src/pages/dev/neon.tsx` показывает operator console. Таблицы Neon остаются прежними: 54 EFHC BASE TABLE, 10 VIEW.
- Protected historical visual/parity tests не удалялись; их контракт на устаревший browser DEMO требует отдельного OWNER-разрешения на замену. Не следует объявлять полный старый CI `PASS`.
- Не запускались живые банковские операции на Neon и реальные TON Proof подписи; серверный URL/DSN и HTTPS соединение требуют runtime-настройки.

## 7. Публикация Pages после миграции браузерного DEMO

Для TEST Pages задан `NEXT_PUBLIC_EFHC_DATA_SOURCE=demo_backend`. GitHub Actions
должен иметь **публичную** переменную репозитория `EFHC_DEMO_API_ORIGIN`
(например `https://demo-api.example.org`). При её отсутствии или неверном
HTTPS origin публикация намеренно останавливается, не создавая видимость
работающего тестового сайта на локальных JSON. Neon DSN и пароли НЕ передаются
в `NEXT_PUBLIC_*` и не хранятся в GitHub Pages.

В цикле 0032 старые браузерные DEMO-тесты удалены по разрешению OWNER.
Рабочий контроль теперь: `pytest demo_backend/tests`,
`node --test tests/regression/current-demo-backend-transport.test.mjs`,
защищённые `tests/parity/contracts.test.mjs`, затем HTML/React build и
реальный HTTPS smoke против TEST Neon. Замена старого браузерного DEMO
не является доказательством выполненного HTTP → Neon интеграционного теста.
