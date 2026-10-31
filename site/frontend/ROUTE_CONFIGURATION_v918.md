# EFHC — маршруты и адреса без расхождения по файлам

## 1. Внешний Browser Shop

**GitHub → Test-3 → Settings → Secrets and variables → Actions → Variables**:
`EFHC_SHOP_URL` = действующий полный URL публичного Browser Shop, например `https://shop.example.org`.

В веточном и Pages workflows это значение передаётся в `NEXT_PUBLIC_EFHC_SHOP_URL`. Приложение читает его из `src/lib/portal/shopDestination.ts` / `public-runtime.ts`; приложение может также получить его через `window.__EFHC_PUBLIC_CONFIG__`, если соответствующий серверный механизм подключён.

- Прямые защищённые абсолютные URL, выданные backend для оплаты/авторизации, **не переписываются**.
- При изменении переменной GitHub требуется новая сборка статического React; это **не** мгновенная замена уже опубликованного JS.
- URL, установленные администратором для дополнительных ссылок HUB, являются данными backend; их не следует подменять переменной Shop.

## 2. Базовый путь GitHub Pages

Одна GitHub Actions Variable: `EFHC_PAGES_BASE_PATH` = `/Test-3` (текущий дефолт), либо новый путь `/New-Project`, либо `/` для корня.

Из этого значения workflow задаёт `NEXT_PUBLIC_EFHC_PAGES_BASE_PATH`, подготавливает статический экспорт Next и проверяет файлы. Helper `src/lib/publicAssetPath.ts` не хранит другое ручное значение. Менять имя репозитория или hosting path отдельно от GitHub Pages конфигурации нельзя: hosting должен фактически публиковать результат по указанному пути.

## 3. Внутренние маршруты React

`src/lib/appRoutes.ts` — единый SSOT для логических адресов `/hub`, `/browser-shop`, `/browser-shop/orders`, `/browser-shop/profile` и `/web-profile`. Использовать `APP_ROUTES`, `browserShopRouteFor()`, `isBrowserShopRoute()`.

**Изменение значения в этом реестре само по себе не создаёт физическую страницу Next.js.** При переносе slug надо синхронно перенести / создать соответствующий `src/pages/...` файл либо проверенный redirect/alias и выполнить сборку, тестирование и обновление внешних ссылок.

Нельзя смешивать логический `router.push(APP_ROUTES.*)` с префиксом Pages: Next сам добавляет собственный `basePath`. При восстановлении старых ссылок приложения используют `stripPagesBasePath()`.

## 4. Эталон и финансовые контракты

`public/SHOP_v866.html` — неизменяемый визуальный эталон, не замена production Browser Shop. Смена адресов не даёт разрешения менять оплату, подписи, токены доступа, VIP/TONConnect, бухгалтерские записи или права Admin.

## 5. Контроль

Веточный CI обязан выполнить TypeScript/Next build, экспорт Pages, проверить контрольный исходный HTML и автоматические маршруты. Старые регрессионные тесты не отменяются; при их падении релиз остаётся непринятым.
