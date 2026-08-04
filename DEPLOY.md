# Деплой на Render.com

Проект уже готов к деплою: `render.yaml` описывает веб-сервис и базу
данных одним файлом («Blueprint»). Ничего запускать самостоятельно не
нужно — Render соберёт и запустит всё по этому файлу.

## 1. Залить код в GitHub

Render разворачивает только из git-репозитория.

```bash
cd vsTUPa-main
git init
git add .
git commit -m "БТЭУ ПК: обновлённый дизайн + подготовка к деплою"
git branch -M main
git remote add origin https://github.com/<ваш-аккаунт>/bteu-cms.git
git push -u origin main
```

`.env` и `node_modules/` в репозиторий не попадут — они в `.gitignore`.

## 2. Создать Blueprint в Render

1. render.com → **New** → **Blueprint**.
2. Выбрать репозиторий `bteu-cms`.
3. Render прочитает `render.yaml` и предложит создать:
   - веб-сервис `bteu-cms` (Node, план **Starter**, регион **Frankfurt** — ближайший к Беларуси из доступных),
   - базу `bteu-db` (PostgreSQL, план **Free**).
4. Нажать **Apply**.

`SESSION_SECRET` Render сгенерирует сам (`generateValue: true`),
`DATABASE_URL` подставится автоматически из связанной базы
(`fromDatabase`) — руками их вводить не нужно.

Если план `free` для базы недоступен в вашем регионе/аккаунте, замените
`plan: free` на `starter` в `render.yaml` перед пушем — это платный тир,
но он есть везде.

## 3. Задать переменные для первого администратора

В render.yaml поля `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_PASSWORD`
помечены `sync: false` — значит Render попросит ввести их вручную в
момент применения Blueprint (значения не должны лежать в git).

Введите:
- `ADMIN_BOOTSTRAP_USER` — логин первого редактора, например `admin`
- `ADMIN_BOOTSTRAP_PASSWORD` — надёжный пароль (замените после первого входа)

## 4. Первый запуск

При первом старте `src/db.js` сам:
- накатит `db/schema.sql`,
- засеет демо-контент из `db/seed.sql` (новости, факультеты, программы, события) — переменная `SEED_ON_INIT=true`,
- создаст первого администратора из `ADMIN_BOOTSTRAP_*`.

Откройте `https://bteu-cms.onrender.com/admin/login` (URL Render покажет
в дашборде) и войдите под этой учёткой.

## 5. Сразу после первого входа

1. В Render Dashboard → сервис `bteu-cms` → **Environment** —
   удалите переменные `ADMIN_BOOTSTRAP_USER` и `ADMIN_BOOTSTRAP_PASSWORD`.
   Иначе пароль так и останется висеть в переменных окружения открытым
   текстом (см. предупреждение в README).
2. По желанию — поставьте `SEED_ON_INIT=false`, чтобы демо-контент не
   пересоздавался, если база вдруг окажется пустой после миграции.

## 6. Подключить свой домен bteu.by

Render Dashboard → сервис → **Settings** → **Custom Domains** →
добавить `bteu.by` и `www.bteu.by`, затем у регистратора домена
прописать CNAME/ALIAS так, как укажет Render. TLS-сертификат Render
выпускает и обновляет сам (Let's Encrypt) — свой `nginx`/`certbot` из
README для этого варианта не нужен.

## 7. Проверка после деплоя

- `/healthz` должен отвечать `ok` — это health-check эндпоинт, который
  уже прописан в `render.yaml` (`healthCheckPath`).
- Открыть `/` — должны отрендериться факультеты (реестр) и новости из БД.
- Проверить `/admin` — логин, создание/редактирование новости.

## Важно про SQLite из README

`README.md` в разделе «Стек» ещё упоминает `node:sqlite` — это было
верно для самой первой версии прототипа. Сейчас `src/db.js` уже
работает через `pg` (PostgreSQL) и `DATABASE_URL`, так что раздел
«База данных» из README можно считать выполненным — Render использует
управляемый PostgreSQL из коробки, отдельно поднимать ничего не нужно.
