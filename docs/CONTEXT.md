# Resend Panel: общий контекст приложения

Файл описывает, что представляет собой приложение, что в нём реализовано и как работают
ключевые механизмы. Актуально на 2026-08-09 (коммит `40a7679`).

---

## 1. Что это

Self-hosted почтовая панель поверх [Resend](https://resend.com). Один пользователь (владелец),
одно рабочее пространство (workspace), одна почта. Приложение умеет:

- принимать входящие письма через вебхук Resend и складывать их в треды;
- отправлять письма и отвечать в тредах через Resend API;
- хранить черновики;
- показывать статистику доставки (delivered / opened / clicked / failed);
- хранить зашифрованный API-токен Resend и настройки отправителя;
- импортировать историю писем из Resend (sync).

Модель доступа простая: **первый зарегистрировавшийся становится владельцем, после этого
регистрация закрывается навсегда** (`getBootstrapState().hasUsers` → форма регистрации
редиректит на `/login`). Мультиарендности нет: везде берётся «первый» workspace
(`getCurrentWorkspace()` = `select * from workspaces limit 1`).

---

## 2. Стек

| Слой | Технология |
|------|-----------|
| Фреймворк | Next.js 16.2.9 (App Router, RSC, Server Actions), React 19.2 |
| Язык | TypeScript 5, strict |
| Стили | Tailwind CSS 4 + `@tailwindcss/typography`, CSS-переменные в `app/globals.css` |
| UI-кит | shadcn/ui (стиль `radix-nova`), Radix UI + Base UI, иконки lucide-react |
| БД | Supabase (hosted Postgres) через `@supabase/supabase-js`, service/secret key |
| Файлы | Supabase Storage, приватный бакет `attachments` |
| i18n | next-intl 4, локали `en` / `ru` / `zh`, без префикса в URL |
| Почта | Resend REST API (`api.resend.com`) + вебхуки (Svix-подпись) |
| Деплой | Docker (multi-stage, `output: "standalone"`), миграции на старте контейнера |
| Пакетник | Bun (`bun.lock`), сборка внутри Docker через Node |

Важное замечание из `AGENTS.md`: это **не тот Next.js, что в обучающих данных** - перед
написанием кода читать `node_modules/next/dist/docs/`.

---

## 3. Структура каталогов

```
app/
├── layout.tsx              корневой layout: шрифты, NextIntlClientProvider, TooltipProvider
├── page.tsx                роутер входа: нет юзеров → /register, нет сессии → /login, иначе /dashboard
├── actions.ts              ВСЕ server actions (auth, settings, compose, вебхуки)
├── locale-actions.ts       смена локали (кука NEXT_LOCALE)
├── globals.css             дизайн-токены (oklch), light + .dark
├── (auth)/                 login, register - центрированный layout без сайдбара
├── (app)/                  защищённая зона: requireCurrentUser() в layout
│   ├── dashboard/          сводные метрики + последние события
│   ├── inbox/              two-pane: layout = список тредов, [threadId] = тред
│   ├── sent/               two-pane: layout = список отправленных, [messageId] = письмо
│   ├── compose/            новое письмо или ответ (?threadId=)
│   ├── drafts/             таблица черновиков + [draftId]/edit
│   ├── statistics/         расширенные метрики и таблица событий
│   └── settings/           токен Resend, отправитель, тест связи, sync истории
└── api/
    ├── inbound/            POST-вебхук email.received
    ├── events/             POST-вебхук delivered/opened/clicked/bounced/failed
    ├── upload/             POST загрузка вложений в Storage
    └── attachments/        GET список вложений сообщения + подписанные URL

lib/
├── store.ts                весь слой данных Supabase + мапперы snake_case → camelCase
├── supabase.ts             один серверный клиент (persistSession: false)
├── auth.ts                 сессии в куке, requireCurrentUser, регистрация владельца
├── crypto.ts               PBKDF2 для паролей, AES-256-GCM для секретов, createToken
├── email.ts                нормализация адресов/темы, text→html, разбор inbound payload
├── webhooks.ts             проверка Svix/legacy HMAC, маппинг типов событий Resend
├── resend-sync.ts          импорт истории писем из Resend API
├── attachments.ts          Storage + таблица attachments, лимиты размеров
├── mail-search.ts          клиентский поиск по теме/участникам/адресам
├── format.ts               даты, относительное время, сортировка по «настоящему» времени
├── nav.ts                  активный пункт меню
└── types.ts                доменные типы

components/                 прикладные компоненты (см. §8) + components/ui/ (shadcn)
i18n/                       routing.ts, request.ts (кука), navigation.ts (Link/usePathname)
messages/                   en.json, ru.json, zh.json
supabase/migrations/        001_initial_schema, 002_attachments, 003_attachments_nullable_message_id
scripts/                    run-migrations.mjs, migrate-json-to-supabase.ts, repair-workspace.ts
docs/compose/plans/         исторические планы задач
```

---

## 4. Данные

### 4.1 Таблицы (Postgres, все id - текстовые токены вида `msg_<uuid>`)

| Таблица | Назначение | Ключевые поля |
|---------|-----------|---------------|
| `users` | владелец панели | `email` unique, `password_hash` |
| `workspaces` | единственное рабочее пространство | `owner_user_id` |
| `sessions` | сессии | `expires_at`, каскад по `user_id` |
| `resend_settings` | настройки Resend | `token_encrypted`, `from_name`, `from_email`, `inbound_email` |
| `threads` | переписки | `subject`, `participants text[]`, `last_message_at` |
| `messages` | письма | `direction`, `status`, `to/cc/bcc text[]`, `text`, `html`, `provider_id`, `in_reply_to`, `references_list`, `sent_at`, `received_at` |
| `message_events` | события доставки | `type`, `payload jsonb` |
| `drafts` | черновики | адреса хранятся строками, не массивами |
| `inbound_receipts` | идемпотентность входящих | `external_id` PK |
| `attachments` | вложения | `message_id` (nullable), `storage_path`, `size` |

Индексы: по `workspace_id`, `thread_id`, `direction`, `provider_id`, `message_id`.
RLS включён на всех таблицах как defense-in-depth, но политик нет - сервер ходит с
secret key и обходит RLS. Прямого клиентского доступа к Supabase нет.

Типы в БД проверяются `check`-констрейнтами:
`direction ∈ (inbound, outbound)`,
`status ∈ (draft, queued, sent, delivered, failed, received)`,
`event.type ∈ (sent, delivered, opened, clicked, bounced, failed, received)`.

### 4.2 Миграции

`scripts/run-migrations.mjs` - самописный раннер на `pg`: создаёт `schema_migrations`,
применяет `supabase/migrations/*.sql` по алфавиту, каждый файл в транзакции, повторно
не применяет. Запуск: `bun run migrate` (нужен `DATABASE_URL`) или автоматически в
`docker-entrypoint.sh` перед стартом сервера.

`scripts/migrate-json-to-supabase.ts` - разовый перенос из старого файлового хранилища
`.data/resend-panel.json` (наследие; `readStore()` в `lib/store.ts` оставлен только для него).

`scripts/repair-workspace.ts` - чинит ситуацию «юзер есть, workspace нет».

---

## 5. Аутентификация и сессии

- Пароль: PBKDF2-SHA512, 120 000 итераций, соль 16 байт, формат `pbkdf2$120000$<salt>$<hash>`,
  сравнение через `timingSafeEqual`.
- Секреты (токен Resend): AES-256-GCM, ключ = SHA-256 от `APP_SECRET`, формат
  `enc:v1:<iv>:<tag>:<ciphertext>` в base64. Значение без префикса `enc:v1:` возвращается
  как есть (обратная совместимость).
- Сессия: строка в таблице `sessions`, id кладётся в httpOnly-куку `resend-panel-session`,
  срок 14 дней, `secure` только в production. `createSession` **удаляет все прежние сессии
  пользователя** - активна ровно одна.
- `requireCurrentUser()` в layout `(app)` и в чувствительных actions; при отсутствии сессии
  `redirect("/login")`.
- Регистрация: `registerAction` проверяет `hasUsers`, создаёт пользователя, затем
  `createWorkspaceForOwner` (он же создаёт строку `resend_settings` с дефолтами:
  `from_email = onboarding@resend.dev`, `inbound_email = inbox@<8 символов id>.local`).

`APP_SECRET` имеет небезопасный дефолт (`resend-panel-dev-secret-change-me`) - в проде
обязателен свой (`openssl rand -hex 32`).

---

## 6. Почтовые сценарии

### 6.1 Отправка и ответ (`composeAction` → `sendMessage`)

1. Форма `/compose` (или `/drafts/[id]/edit`) шлёт FormData с `intent = send | save`.
2. При `intent=save` вызывается `upsertDraft` и всё заканчивается.
3. Если передан `threadId`, это ответ: тема становится `Re: <тема без префиксов>`,
   получатели подставляются из последнего письма (`getReplyRecipients`), заполняются
   `In-Reply-To` и `References`. Иначе создаётся/находится тред через `ensureThread`.
4. Создаётся `message` со статусом `queued`, тело конвертируется text → html
   (`buildHtmlFromText`: экранирование, автолинки, абзацы `<p>` и `<br />`).
5. Загруженные заранее вложения привязываются к сообщению (`attachments.message_id = ...`),
   скачиваются из Storage и добавляются в запрос как base64.
6. `POST https://api.resend.com/emails` с `Authorization: Bearer <расшифрованный токен>`.
   Успех → статус `sent`, `provider_id`, `sent_at`, событие `sent`.
   Ошибка (или нет токена) → статус `failed` + событие `failed` с причиной.
7. `revalidatePath` для dashboard/sent/inbox/statistics и редирект в тред либо в `/sent`.

### 6.2 Входящие (`POST /api/inbound` → `inboundWebhookAction`)

1. Проверка подписи (см. §6.4). Тело логируется в консоль (диагностика).
2. `extractInboundPayload` вытаскивает поля из разных возможных обёрток
   (`data` / `email` / корень) и разных вариантов имён (`html`, `content`, `body_html`, …).
3. Идемпотентность: если `message_id` уже есть в `inbound_receipts` - выходим с
   `{ duplicate: true }`.
4. `ensureThread` по теме и участникам.
5. **Если в вебхуке нет тела письма** (Resend его не присылает), делается запрос
   `GET https://api.resend.com/emails/receiving/<email_id>` за `html`/`text`
   (`fetchResendEmail`).
6. Создаётся `message` с `direction=inbound`, `status=received`, пишется `inbound_receipts`
   и событие `received`, ревалидируются страницы.

### 6.3 События доставки (`POST /api/events` → `resendEventWebhookAction`)

Тип из Resend маппится `mapResendEventType`:
`email.delivered → delivered`, `email.opened → opened`, `email.clicked → clicked`,
`email.bounced → bounced`, `email.failed | email.delivery_delayed → failed`,
остальное игнорируется. Сообщение ищется по `provider_id`; если не найдено -
`{ ignored: true }`. Для `delivered` статус сообщения меняется на `delivered`.

### 6.4 Проверка подписи вебхуков (`lib/webhooks.ts`)

- Основной путь - Svix: заголовки `svix-id`, `svix-timestamp`, `svix-signature`,
  HMAC-SHA256 от `id.timestamp.body` секретом из base64 после `whsec_`, сравнение
  `timingSafeEqual` по каждой версии `v1,...`.
- Fallback: legacy `resend-signature` = hex-HMAC от тела.
- Секреты: `RESEND_INBOUND_WEBHOOK_SECRET` / `RESEND_EVENTS_WEBHOOK_SECRET`,
  общий `RESEND_WEBHOOK_SECRET` как запасной.
- **Если секрет не задан, проверка пропускается вне production** (в production запрос
  отклоняется 401).

### 6.5 Импорт истории (`syncResendHistoryAction` → `lib/resend-sync.ts`)

Кнопка в настройках. Постранично тянет `GET /emails` и `GET /emails/receiving`
(курсор `after`), по каждому письму делает запрос за деталями, затем:
- если письмо уже есть по `provider_id` - только проставляет реальные `sent_at`/
  `received_at`/`created_at` (backfill);
- иначе создаёт тред, сообщение и события.
В конце `refreshAllThreadLastMessageAt` пересчитывает `last_message_at` у всех тредов.
Возвращает счётчики imported / backfilled / sent / received.

### 6.6 Вложения

- Загрузка: `POST /api/upload` (требует сессию). Лимиты: 10 МБ на файл, 25 МБ суммарно.
  Файл кладётся в бакет `attachments` по пути `<workspaceId>/<fileId>.<ext>`, создаётся
  строка в `attachments` с `message_id = null`.
- При отправке письма `message_id` проставляется, файл читается из Storage и уходит
  в Resend в base64. Именно поэтому миграция 003 сняла `not null` с `message_id`.
- Просмотр: `GET /api/attachments?messageId=...` возвращает подписанные URL на 1 час.
  Компонент `MessageAttachments` в `thread-view.tsx` подгружает их на клиенте.
- Входящие вложения не сохраняются: обработчик inbound их не разбирает.

---

## 7. Треды и время

- `ensureThread` ищет существующий тред по `workspace_id` + `ilike` **точному тексту темы**.
  Совпало - объединяет участников и двигает `last_message_at`; не совпало - создаёт новый.
  Это значит: ответы с темой `Re: X` попадают в отдельный тред от `X`.
- «Время сообщения» = `sent_at` для outbound и `received_at` для inbound, с откатом на
  `created_at` (`getMessageTimestamp`). По нему идёт сортировка и в БД-слое, и в UI.
- `getThreadPreviews` строит превью тредов одним запросом: берёт все сообщения
  workspace по убыванию `created_at` и оставляет первое встреченное на тред.

---

## 8. UI

### Оболочка

`ResendAppShell` (client) - сайдбар shadcn (`collapsible="icon"`) с пунктами
Dashboard / Inbox / Sent / Compose / Drafts / Statistics / Settings, футером `NavUser`
(email, выход) и переключателем языка. Для маршрутов `/inbox*` и `/sent*` включается
режим two-pane: высота фиксируется в `h-svh`, шапка с хлебными крошками скрывается,
на мобильных остаётся компактный заголовок.

### Экраны

| Маршрут | Что показывает |
|---------|----------------|
| `/dashboard` | 8 карточек метрик + последние события + карточка-призыв написать письмо |
| `/inbox` | слева список тредов с аватар-инициалами и поиском, справа заглушка |
| `/inbox/[threadId]` | шапка треда, кнопка «Ответить», лента сообщений (`dangerouslySetInnerHTML` в `prose`), вложения, нижняя панель ответа |
| `/sent` + `/sent/[messageId]` | то же самое для исходящих, со статус-бейджем и ссылкой на тред |
| `/compose` | форма (subject, to, cc, bcc, текст, вложения drag-and-drop) + живой HTML-превью справа |
| `/drafts` | таблица черновиков со ссылкой на редактирование |
| `/statistics` | метрики + рассчитанные delivery/open/click rate + таблица событий |
| `/settings` | токен Resend (password-поле, показывается только факт наличия), отправитель, inbound-адрес, кнопки «Тест соединения» и «Синхронизировать историю» |

Формы работают на `useActionState` + server actions, состояние возвращается как
`{ error?, success? }` (`AuthState`). Поиск и сортировка списков - на клиенте
(`lib/mail-search.ts`, `SortToggle`), без запросов к серверу.

Кнопки Forward / Archive / Delete / More в шапке треда присутствуют, но `disabled` -
функциональность не реализована.

### Тема

Токены в `app/globals.css` в `oklch`, нейтральная палитра, есть блок `.dark`, но
переключателя темы в интерфейсе нет - класс `.dark` нигде не ставится.

---

## 9. Локализация

- Локали: `en` (по умолчанию), `ru`, `zh`. `localePrefix: "never"` - URL одинаковые для всех.
- Локаль берётся из куки `NEXT_LOCALE` в `i18n/request.ts`; переключение через
  `setLocaleAction` (кука на год + `revalidatePath("/", "layout")`).
- Словари: `messages/*.json`, 16 неймспейсов (`nav`, `mail`, `inbox`, `compose`,
  `settings`, `statistics`, `errors`, …). Серверные тексты ошибок тоже переводятся -
  actions используют `getTranslations("errors")`.
- Форматирование дат - `Intl.DateTimeFormat` с текущей локалью; относительное время
  (`5m ago` / `5 мин. назад` / `5 分钟前`) захардкожено шаблонами в `lib/format.ts`.

---

## 10. Конфигурация и деплой

### Переменные окружения

| Переменная | Обязательна | Назначение |
|-----------|-------------|-----------|
| `SUPABASE_URL` | да | URL проекта Supabase |
| `SUPABASE_SECRET_KEY` (или `SUPABASE_SERVICE_KEY`) | да | серверный ключ, обходит RLS |
| `DATABASE_URL` | для Docker/миграций | прямое подключение Postgres |
| `APP_SECRET` | да | ключ шифрования токена Resend |
| `RESEND_INBOUND_WEBHOOK_SECRET` | прод | подпись `/api/inbound` |
| `RESEND_EVENTS_WEBHOOK_SECRET` | прод | подпись `/api/events` |
| `RESEND_WEBHOOK_SECRET` | нет | общий fallback |

Токен Resend в env не хранится - он вводится в UI и лежит зашифрованным в БД.

### Docker

Три стадии: `deps` (bun install) → `builder` (сборка **через Node**, потому что
Next 16 + Turbopack требует worker_threads/NAPI) → `runner` (standalone-сервер,
непривилегированный пользователь `nextjs`, порт 3000). Entrypoint сначала применяет
миграции, затем запускает `node server.js`.

### Настройка Resend

1. Вставить API-токен в `/settings`.
2. Вебхук `email.received` → `https://<домен>/api/inbound`, его signing secret в
   `RESEND_INBOUND_WEBHOOK_SECRET`.
3. Вебхук событий доставки → `https://<домен>/api/events`, secret в
   `RESEND_EVENTS_WEBHOOK_SECRET`.

---

## 11. Ограничения и известные особенности

Это не список багов к немедленному исправлению, а то, что стоит держать в голове.

1. **Статистика по событиям считается по последним 8 записям.** `getStats` тянет
   `message_events` с `limit(8)` и по этому же срезу считает `delivered`, `opened`,
   `clicked`. Цифры на дашборде и в `/statistics` (включая delivery/open/click rate)
   поэтому не отражают всю историю.
2. **Треды склеиваются по точному совпадению темы**, префикс `Re:` создаёт новый тред.
   Заголовки `In-Reply-To` / `References` сохраняются, но при группировке не используются.
3. **Нет пагинации.** `listMessages`, `listThreads`, `getThreadPreviews`, `getStats`
   выбирают все строки workspace и фильтруют/сортируют в памяти.
4. **HTML писем вставляется без санитайзинга** (`dangerouslySetInnerHTML` в `thread-view`
   и `message-view`). Для входящих писем это доверие к контенту отправителя.
5. `/api/attachments` не проверяет сессию и не ограничивает выдачу по workspace -
   зная `messageId`, можно получить подписанные ссылки.
6. Вложения входящих писем не сохраняются; удаления вложений через UI нет
   (`deleteAttachment` есть в lib, но не вызывается из интерфейса).
7. Кнопки Forward / Archive / Delete в треде отключены, флагов «прочитано» нет.
8. Без заданного webhook-секрета вне production подпись не проверяется вовсе.
9. Дефолтный `APP_SECRET` в коде: при незаданной переменной токен шифруется предсказуемым ключом.
10. В `/api/inbound` остались диагностические `console.log` с ключами payload.
11. `.dark`-палитра описана, но переключателя темы нет.
12. Тестов в проекте нет.

---

## 12. Команды

```bash
bun install
bun run dev            # локальная разработка
bun run build          # прод-сборка (standalone)
bun run lint
bun run migrate        # применить SQL-миграции (нужен DATABASE_URL)
bun run migrate:json   # разовый перенос из .data/resend-panel.json
bun run repair-workspace
```
