# EFHC Test-3 — публично безопасный INDEX

**ID:** `EFHC_TEST3_INDEX`  
**Статус:** `ACTIVE`  
**Основание:** OWNER 02.11.2026 — постоянная навигация к источникам  
**Раздел:** `INDEX.md`  
**Дата:** 2026-11-02

## Вход и полномочия

[AGENTS.md](AGENTS.md) → [START_HERE.md](START_HERE.md) → [KERNEL.md](KERNEL.md) (один раз) → этот INDEX. Определить `main` exact commit через GitHub. Никаких hardcoded «текущих» SHA.

**Private документальный SSOT** — [`gly-efhc/efhc_archive`](https://github.com/gly-efhc/efhc_archive) (не public): открыть **через реально авторизованный GitHub-доступ** его `AGENTS.md`, `START_HERE.md`, `KERNEL.md`, `INDEX.md`, `01_CANON/TERMS.md`, `08_CONTROL/DOCUMENT_MANAGEMENT_RULES.md` и только применимые approved документы. [Private AI routing](https://github.com/gly-efhc/efhc_archive/blob/main/08_CONTROL/AI_CROSS_REPO_ROUTING.md) доступен только авторизованному агенту. Нет доступа → `FAIL_CLOSED` для зависимой кодовой работы.

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

## Порядок приёмки агента

Проверить 8 сценариев из private `08_CONTROL/AI_CROSS_REPO_ROUTING.md`: private access, missing access, stale history, conflicting rules, docs-only, scoped React, public-leak rejection, handoff across chats. Наличие этих инструкций не означает, что независимый агент уже получил доступ или прошёл эти проверки.
