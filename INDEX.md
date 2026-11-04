# INDEX.md — маршрутизатор EFHC efhc (public-safe)

**ID:** `EFHC_TEST3_INDEX` · **Статус:** ACTIVE / PUBLIC NAVIGATION · **Область:** `gly-efhc/efhc` · **Редакция маршрутов:** 04.11.2026

> Это карта существующих публичных файлов и приватных **путей**, а не хранилище private правил. Не включать сюда копии CANON/SSOT, секреты, журналы и личные данные. Точные HEAD обоих репозиториев проверяются при каждом отдельном задании; статические номера не объявлять текущими.

## 1. Быстрый вход

[AGENTS.md](AGENTS.md) → [START_HERE.md](START_HERE.md) → [KERNEL.md](KERNEL.md) (**один раз**) → этот INDEX. Зафиксировать `CODE_HEAD`, затем при наличии private зависимости — `ARCHIVE_HEAD`, mode и scope. Читатель публичного efhc **не** получает private права автоматически.

**Приватный документальный контур:** [efhc_archive](https://github.com/gly-efhc/efhc_archive). Только авторизованный GitHub-коннектор, никакого браузера или public web для доступа к нему. Для зависимой кодовой задачи без такого доступа — `PRIVATE_DEPENDENCY_BLOCKED`; ничего не выдумывать.

## 2. Подтверждённые public пути кода

| Область | Физический путь | Что сверять |
| --- | --- | --- |
| Старт | [AGENTS](AGENTS.md), [START_HERE](START_HERE.md), [KERNEL](KERNEL.md), [README](README.md) | Публичный protocol, не private SSOT |
| Next.js / React | [site/frontend/](site/frontend/) | Source, local scripts, package/lock |
| Frontend исходники | [site/frontend/src/](site/frontend/src/) | Компоненты, дизайн, данные, маршруты |
| Тесты | [site/frontend/tests/](site/frontend/tests/) | Контракты, регрессия, паритет |
| Parity | [site/frontend/tests/parity/](site/frontend/tests/parity/) и [site/ci/parity/](site/ci/parity/) | Паритет, генераторы, эталоны |
| Pages и browser CI | [site/ci/pages-tools/](site/ci/pages-tools/) | Export, browser smoke и публичные доказательства |
| Recovery | [site/RECOVERY.md](site/RECOVERY.md) | Фактический способ восстановления source |
| Release marker | [site/RELEASE.json](site/RELEASE.json) | Физический marker, не private approval |
| Публичные application rules | [site/EFHC_APPLICATION_RULES.md](site/EFHC_APPLICATION_RULES.md) | Утверждённая OWNER редакция B |
| Вторичная редакция | [site/APPLICATION_RULES.md](site/APPLICATION_RULES.md) | Не имеет равного SSOT-приоритета |
| Workflows | [.github/workflows/](.github/workflows/) | CI, Pages, parity, release/import |
| Входной public import | [import/README.md](import/README.md) | Отдельный механизм кода; не путать с private архивом |
| Номерные REPORTS и CYCLES | Приватный `gly-efhc/efhc_archive` | Публичная папка `reports/` удалена по решению OWNER; история сохраняется в Git и документальном Архиве |

## 3. Приватный маршрут по предмету

В начале private чтения: [AGENTS](https://github.com/gly-efhc/efhc_archive/blob/main/AGENTS.md) → [START_HERE](https://github.com/gly-efhc/efhc_archive/blob/main/START_HERE.md) → [KERNEL](https://github.com/gly-efhc/efhc_archive/blob/main/KERNEL.md) (однократно) → [INDEX](https://github.com/gly-efhc/efhc_archive/blob/main/INDEX.md) → [TERMS](https://github.com/gly-efhc/efhc_archive/blob/main/01_CANON/TERMS.md) → [DOCUMENT_MANAGEMENT_RULES](https://github.com/gly-efhc/efhc_archive/blob/main/17_CONTROL/DOCUMENT_MANAGEMENT_RULES.md). Открывать эти ссылки **только авторизованным GitHub-коннектором**; они не открывают приватный доступ публичному посетителю.

| Вопрос | Авторитетный private путь / маршрут |
| --- | --- |
| OWNER decisions, терминология, приоритет | `01_CANON/`, `01_CANON/OWNER_DECISIONS.md`, `01_CANON/TERMS.md` |
| Правила приложения / UI | `06_SSOT/FRONTEND/APPLICATION_RULES.md`, `01_CANON/FRONTEND/`, `07_NORM/FRONTEND/` |
| Решение о публичной редакции B | `01_CANON/APP_RULES_OWNER_DECISION_B.md` |
| Архитектура приложения | `02_ARCHITECTURE/APPLICATION/EFHC_APPLICATION_ARCHITECTURE.md` и `EFHC_APPLICATION_ARCHITECTURE_DIAGRAMS.md` |
| Backend, API, DB, DEMO | `01_CANON/BACKEND/`, `06_SSOT/BACKEND/`, `11_BACKEND/`, `20_RUNBOOKS/BACKEND/` |
| Identity, Wallet, TON, financial | `06_SSOT/CONTRACTS/`, применимые `01_CANON/` и `07_NORM/` |
| Admin, roles, access | `01_CANON/ADMIN/`, `07_NORM/ADMIN/`, `10_ADMIN/` |
| Reports, cycles, формат и numbering | `04_REPORTS/`, `05_CYCLES/`, `17_CONTROL/REPORTS_CYCLES_FORMAT_CONTROL.md` |
| История и provenance | `16_HISTORY/`, `17_CONTROL/HISTORY_PATH_RESOLVER.md` |
| Cross-repo AI routing / handoff | `09_AI/AI_CROSS_REPO_ROUTING.md`, `09_AI/AI_HANDOFF.md` |
| Управление архивом и импорт | `17_CONTROL/DOCUMENT_MANAGEMENT_RULES.md`, `17_CONTROL/GITHUB_IMPORT_PROTOCOL.md`, `_import/README.md` |

### Принцип единственного владельца

`BOT` — функциональная часть системы, не новый самостоятельный действующий SSOT-силос. Документы размещаются по предметному владельцу: FRONTEND, BACKEND, CONTRACTS, ADMIN и т.д. `FRONTEND_RECONSTRUCTION` в private `04_REPORTS/` и `05_CYCLES/` — непрерывная историческая серия, а не разрешение заводить конкурирующие публичные копии. Старые пути направлять через private history resolver. Нельзя объявлять второй актуальный CANON из похожего имени.

## 4. Матрица задач efhc

**Новый UI/исправление:** private OWNER scope → exact code HEAD → исходники `site/frontend/src` → пользовательские и Admin protected contracts → targeted tests/parity → rendered checks → readback/acceptance.

**Локализация:** утверждённые языки, карусель и строки из применимого private OWNER решения → точно затронутые UI keys → tests. Не менять языковые контракты побочным «рефакторингом».

**DEMO/API:** различать fixtures, локальную UI-проекцию и настоящий сервер; backend отдельный. Pages deploy не доказывает серверную генерацию, auth, DB или финансовую операцию.

**CI/Pages:** определить существующий workflow и triggering paths → изменения в рамках scope → job/step conclusions и artifacts → public browser check, если релевантно → OWNER visual acceptance отдельно.

**Архивирование:** не переносить приватные документы в public `import/`. Private ZIP импортируется по отдельному распоряжению только через private `efhc_archive/_import/` и его workflow. ZIP фронтенда — source backup, не private document archive. При конкуренции агентов проверять оба HEAD.

## 5. Проверки, форматы и ограничения

Пакет frontend: [package.json](site/frontend/package.json), [tests](site/frontend/tests/), [.github/workflows](.github/workflows/). Команды доступны из `site/frontend/`: `npm ci`, `npm run typecheck`, `npm run test:frontend-regression`, `npm run build`; запускать только подходящие и фиксировать actual outcomes. Не объявлять PASS по найденному в документах примеру.

REPORTS/CYCLES нумеруются и заполняются только по private [контролю шаблонов](https://github.com/gly-efhc/efhc_archive/blob/main/17_CONTROL/REPORTS_CYCLES_FORMAT_CONTROL.md) с чтением реальных манифестов. Git commit, CI run, закрытие отдельной задачи и приёмка OWNER не эквивалентны. Нельзя удалять неинвентаризованные файлы, переписывать закрытую историю или копировать private reports в public.

## 6. Завершение и проверка синхронизации

1. Перечитать актуальный efhc HEAD; для private-зависимости — private Архив HEAD.
2. Сверить существование и точный смысл применимых путей, затем разрешённый diff.
3. Для remote изменения: commit, ref update без force, readback каждого файла и итогового HEAD.
4. В handoff указать `CODE_HEAD`, `ARCHIVE_HEAD` (если использовался), scope, результаты и `OWNER_PENDING` отдельно от CI.
5. Новые решения OWNER отражать в private CANON/SSOT лишь по отдельному разрешению; править этот INDEX, когда реально изменился публичный маршрут.

**Это индекс маршрутов, не самостоятельный источник нормативных решений.**
