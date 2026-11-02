# Test-3 — старт работы с кодом и документами EFHC

**ID:** `EFHC_TEST3_START`  
**Статус:** `ACTIVE`  
**Основание:** OWNER 02.11.2026, минимальная публичная навигация к private SSOT  
**Раздел:** `START_HERE.md`  
**Дата:** 2026-11-02

1. После [AGENTS.md](AGENTS.md) прочитать [KERNEL.md](KERNEL.md) **один раз** и [INDEX.md](INDEX.md).
2. Зафиксировать реальный `gly-efhc/Test-3/main` SHA, task scope и `AUDIT_READ_ONLY` / `CODE_WRITE_APPROVED` / `RELEASE_DEPLOY_APPROVED`.
3. Выбрать ветку: **документы → private archive**, **React/tests/CI → код + approved private canon**, **релиз → отдельный физический FULL/REPO по private release norm**.
4. Для кодового изменения получить реальный аутентифицированный доступ к [private `gly-efhc/efhc_archive`](https://github.com/gly-efhc/efhc_archive). Следовать его `AGENTS → START_HERE → KERNEL` (one read) `→ INDEX → TERMS → DOCUMENT_MANAGEMENT_RULES → applicable CANON`; фиксировать archive SHA.
5. OWNER утвердил **B**: `site/EFHC_APPLICATION_RULES.md` — публичный действующий документ ([private decision](https://github.com/gly-efhc/efhc_archive/blob/main/01_CANON/APP_RULES_OWNER_DECISION_B.md)). Отсутствие private доступа блокирует зависимые изменения кода; новые конфликты требуют OWNER, но вопрос A/B уже закрыт.
6. Для React сверить [RECOVERY](site/RECOVERY.md), исходники `site/frontend/`, тесты `site/frontend/tests/`, `site/ci/` и workflows; не менять UI без точного задания.
7. Выполнить только согласованный scope и фактические проверки; отдельно фиксировать browser, parity, CI, Pages и OWNER acceptance.
8. Сохранить доказательства и краткий handoff с **двумя** Git SHA, состоянием reports/cycles и следующим разрешённым шагом. Запись в private archive — только по отдельному scope, без публичных копий.
