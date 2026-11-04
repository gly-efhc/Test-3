# EFHC Test-3 — публичный репозиторий приложения

**Проект:** EFHC — Energy for Humanity Coin · **Репозиторий кода:** [gly-efhc/Test-3](https://github.com/gly-efhc/Test-3) · **Тип:** публичный исходный frontend, тесты и CI · **Документальная власть:** приватный [efhc_archive](https://github.com/gly-efhc/efhc_archive)

> Здесь находится рабочий код и публично безопасные технические инструкции. Это **не** приватный документальный Архив, не производственный backend и не гарантия подключения серверных/финансовых операций. Для приватных норм требуется авторизованный доступ к отдельному репозиторию EFHC.

## Назначение и границы

Test-3 содержит исходный frontend на React/Next.js, необходимые статические ресурсы, regression/parity tests, инструменты Pages и GitHub Actions. Сохранённый физический ZIP фронтенда может служить резервным источником восстановления только после сверки с актуальным Git HEAD, manifest и контрольными суммами. Оригиналы private CANON, SSOT, REPORTS, CYCLES, HISTORY, персональные данные и secrets здесь не публикуются.

Нормативные решения принимает OWNER. Актуальные приватные документы хранятся в `gly-efhc/efhc_archive`; утверждённый владельцем локальный архив и удалённый документальный HEAD сверяются как разные физические состояния. Публичный код Test-3 — фактический источник реализации, но не замена private правовых, экономических и инженерных контрактов.

## Начало работы

Маршрут агента: [AGENTS.md](AGENTS.md) → [START_HERE.md](START_HERE.md) → [KERNEL.md](KERNEL.md) (**один раз**) → [INDEX.md](INDEX.md). Далее установить реальный Test-3 HEAD, task scope, требуемый private canon и применимые проверки. Только авторизованный GitHub-коннектор допускается для удалённого доступа к private Архиву; публичная ссылка не раскрывает его содержимое.

**Основные файлы и каталоги:**

| Путь | Назначение |
| --- | --- |
| [site/frontend/](site/frontend/) | React/Next.js исходники, lockfile и frontend scripts |
| [site/frontend/src/](site/frontend/src/) | Код интерфейса и компонентов |
| [site/frontend/tests/](site/frontend/tests/) | Регрессионные и parity-проверки |
| [site/ci/parity/](site/ci/parity/) | Инструменты сопоставления с эталоном |
| [site/ci/pages-tools/](site/ci/pages-tools/) | Экспорт Pages и browser smoke |
| [.github/workflows/](.github/workflows/) | GitHub Actions, проверки и публикация |
| [site/RECOVERY.md](site/RECOVERY.md) | Восстановление source и проверка границ |
| [site/RELEASE.json](site/RELEASE.json) | Маркер физической редакции приложения |
| [site/EFHC_APPLICATION_RULES.md](site/EFHC_APPLICATION_RULES.md) | OWNER-подтверждённый публичный маршрут B |
| [site/APPLICATION_RULES.md](site/APPLICATION_RULES.md) | Вторичная редакция, не равноправный SSOT |
| [import/README.md](import/README.md) | Локальный public code-import; **не** private документальный импорт |

## Локальная разработка и проверки

Рабочий каталог — `site/frontend/`. Команды, реально объявленные в `package.json`:

```bash
cd site/frontend
npm ci
npm run typecheck
npm run test:frontend-regression
npm run build
```

`npm run dev` запускает локальный интерфейс; `npm run start` — собранный Next.js (если окружение поддерживает соответствующий режим). Точный список скриптов и их зависимости читать в [package.json](site/frontend/package.json); часть отдельных проверок может требовать CI/browser или дополнительные файлы, не включённые в конкретный резервный ZIP. Выполнять только релевантные тесты; отсутствие запуска отмечать `NOT_RUN`.

Public Pages может публиковать пользовательский frontend. Демонстрационные fixtures не означают действующий внешний Python backend, production DB, реальные EFHC-кредиты, выплату, TON transfer или авторизованный Admin transport. Для них необходимы независимые серверные и end-to-end доказательства.

## Документальная синхронизация с приватным Архивом

Только через авторизованный GitHub-коннектор получить реальный private HEAD, прочитать `AGENTS → START_HERE → KERNEL (once) → INDEX → TERMS → 17_CONTROL/DOCUMENT_MANAGEMENT_RULES`, затем применимый тематический CANON/SSOT и OWNER decisions. Записать отдельно `CODE_HEAD`, `ARCHIVE_HEAD`, доказательства и ограничения. Отсутствует private доступ — не начинать зависимый code change и не заменять его данными из памяти.

Содержательные документы Архива нельзя дублировать в открытый Test-3. Из private Архива допустимы только публично безопасные пути/названия, без private bytes. Протокол загрузки полного документального ZIP — отдельный `efhc_archive/_import/`; это **не** public `Test-3/import/`.

## Инженерная дисциплина и приёмка

Работать по прямому OWNER scope. До изменения проверить source HEAD, совместимость с принятым UI, защищёнными Header/Bottom Nav/FAQ/themes/локализацией/Wallet/TON/Admin и применимыми контрактами. Не «чинить» регрессию выключением тестов, не скрывать FAIL под SKIP, не выдавать локальный DEMO за backend. После записи — commit, remote readback, CI/Pages proof, отдельная OWNER visual acceptance. Для разрушительных/спорных изменений требуется предметное согласование.

Нумерованные REPORTS/CYCLES, исторический provenance и принятие решения о закрытии блока живут в **private Архиве** по `17_CONTROL/REPORTS_CYCLES_FORMAT_CONTROL.md`. Публичные `reports/` и этот README не создают новый канон или закрытый номер. При передаче следующему агенту указать проверенные SHA, scope, changed paths, test results и открытые зависимости без публикации приватных сведений.

**Маршрут следующего шага:** [START_HERE.md](START_HERE.md) · [INDEX.md](INDEX.md) · [AGENTS.md](AGENTS.md).
