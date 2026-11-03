# EFHC Test-3 — публично безопасный INDEX

**ID:** `EFHC_TEST3_INDEX`  
**Статус:** `ACTIVE`  
**Основание:** OWNER 02.11.2026 — постоянная навигация к источникам  
**Раздел:** `INDEX.md`  
**Дата актуализации маршрута:** 2026-11-03

## Вход и полномочия

[AGENTS.md](AGENTS.md) → [START_HERE.md](START_HERE.md) → [KERNEL.md](KERNEL.md) (один раз) → этот INDEX. Определить `main` exact commit через GitHub. Никаких hardcoded «текущих» SHA.

**Единственный действующий private документальный архив (OWNER authority)** — [`gly-efhc/efhc_archive`](https://github.com/gly-efhc/efhc_archive) (не public): открыть **через реально авторизованный GitHub-доступ** его `AGENTS.md`, `START_HERE.md`, `KERNEL.md` (один раз за контекст), `INDEX.md`, `01_CANON/TERMS.md`, `17_CONTROL/DOCUMENT_MANAGEMENT_RULES.md` и только применимые approved документы. [Private AI routing](https://github.com/gly-efhc/efhc_archive/blob/main/09_AI/AI_CROSS_REPO_ROUTING.md) доступен только авторизованному агенту. Нет доступа → `FAIL_CLOSED` для зависимой кодовой работы.


## Один действующий архив и навигация после OWNER-консолидации 03.11.2026

- Источник решений и документов — только private `gly-efhc/efhc_archive`, а не этот публичный репозиторий и не старые папки Drive. Текущий состав определять по реальному `main` и private [INDEX](https://github.com/gly-efhc/efhc_archive/blob/main/INDEX.md), а не по фиксированным копиям или имени этапа.
- `BOT` — функциональный Telegram/backend компонент, **не отдельный действующий документальный раздел**. UI и React-документы относятся к FRONTEND; серверные и API к BACKEND; общесистемные правила к соответствующим CANON/SSOT/NORM/SHARED.
- `FRONTEND_RECONSTRUCTION` остаётся как историческая серия только для `04_REPORTS/` и `05_CYCLES/`; старые пути действующих документов разрешаются через private `17_CONTROL/HISTORY_PATH_RESOLVER.md`, исторические копии — `16_HISTORY/`. Не считать private редактируемые документы публично доступными.
- Приоритет: прямое последнее решение OWNER → применимый утверждённый `01_CANON` → действующий предметный `06_SSOT`/`07_NORM` → Test-3 как свидетельство реализации → REPORTS/CYCLES и HISTORY как датированная provenance. Код не отменяет новые утверждённые требования; исторический отчёт не переопределяет CANON.
- Изменения private Архива других агентов сверять по **фактическому архивному HEAD** перед работой и перед handoff; никогда не принимать ZIP локального чата за автоматическое обновление private GitHub. Текущую нумерацию REPORTS/CYCLES считать динамической. Неразрешённый смысловой конфликт — OWNER HOLD, не удаление по совпадению имени.
- Этот публичный INDEX хранит только маршруты и правила доступа; private нормы/внутренние тексты, исторические ZIP и чувствительные значения сюда не переносить.

## Код, тесты, CI

| Назначение | Путь |
|---|---|
| React/Next.js | [site/frontend](site/frontend/) |
| Компоненты/состояния | [site/frontend/src](site/frontend/src/) |
| UI и regression tests | [site/frontend/tests](site/frontend/tests/) |
| Parity v866 | [site/frontend/tests/parity](site/frontend/tests/parity/) |
| CI scripts | [site/ci](site/ci/) |
| Parity extraction/helpers | [site/ci/parity](site/ci/parity/) |
| Pages smoke / verification | [site/ci/pages-tools](site/ci/pages-tools/) |
| Parity workflow | [.github/workflows/efhc-parity.yml](.github/workflows/efhc-parity.yml) |
| Pages workflow | [.github/workflows/efhc-pages.yml](.github/workflows/efhc-pages.yml) |
| Import workflow | [.github/workflows/efhc-import.yml](.github/workflows/efhc-import.yml) |
| Техническая история восстановления | [site/RECOVERY.md](site/RECOVERY.md) |
| Кодовые reports (история) | [reports/numbered](reports/numbered/) |

## Ограничения документации

- **OWNER утвердил редакцию B 02.11.2026:** [действующие публичные правила](site/EFHC_APPLICATION_RULES.md), [private запись решения](https://github.com/gly-efhc/efhc_archive/blob/main/01_CANON/APP_RULES_OWNER_DECISION_B.md). [site/APPLICATION_RULES.md](site/APPLICATION_RULES.md) — вторичная редакция и не равноправный канон.
- Поведение B: 🌐 постоянно видна во время editing без таймера; ⚙ скрывается после 3 секунд только в обычном режиме. OWNER сообщил, что механизм уже реализован; новых тестов браузера это обновление не подтверждает.
- `site/RECOVERY.md`, reports и комментарии описывают техническую историю; не становятся private SSOT по расположению в source repository.
- Original HTML v866 и физические FULL/REPO должны проверяться по утверждённым private manifest/Drive/Git provenance **только при релизной задаче**; их копии не добавляются сюда.
- Задача «документы» не вызывает build/deploy. Нельзя менять `.github/workflows`, site исходники или тесты под видом одной навигационной правки.

## Reports и cycles: private регламент заполнения

- [Контроль форм и шаблонов EFHC BOT / FRONTEND / RECONSTRUCTION](https://github.com/gly-efhc/efhc_archive/blob/main/17_CONTROL/REPORTS_CYCLES_FORMAT_CONTROL.md) — действует только с авторизованным GitHub private access.
- Действительные номера и статусы отчётов/циклов читать только из private `04_REPORTS/`, `05_CYCLES/` и их текущих манифестов. Не фиксировать в публичном INDEX числа, которые устаревают при работе других агентов; этапы BOT, FRONTEND и FRONTEND_RECONSTRUCTION имеют независимые исторические серии. Исключения формата рассматриваются в private документе контроля.
- Закрытие блока не приравнивать к закрытию всего MAIN-cycle; CI/source/browser/visual/OWNER acceptance подтверждать отдельно. Не копировать private шаблоны в public GitHub.

## Порядок приёмки агента

Проверить 8 сценариев из private `09_AI/AI_CROSS_REPO_ROUTING.md`: private access, missing access, stale history, conflicting rules, docs-only, scoped React, public-leak rejection, handoff across chats. Наличие этих инструкций не означает, что независимый агент уже получил доступ или прошёл эти проверки.
