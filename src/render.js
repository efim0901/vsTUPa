'use strict';
// render.js — server-side templates. No frontend framework: plain functions
// returning strings, escaped by default. Keeps the project dependency-free
// and fast (SSR, no client-side hydration needed for content pages).

function esc(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '';

  // Если pg вернул объект Date, преобразуем его в ISO-строку
  let str = iso instanceof Date ? iso.toISOString() : String(iso);

  // Нормализуем пробел между датой и временем в 'T'
  str = str.replace(' ', 'T');

  const d = new Date(str);
  if (isNaN(d.getTime())) return str;

  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

function header(active) {
  const item = (href, label, key) =>
    `<li class="nav-item"><a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${label}</a></li>`;
  return `
<div class="utility">
  <div class="wrap">
    <div class="utility-left">
      <a href="/admin">Личный кабинет</a>
      <a href="/pages/kontakty">Контакты</a>
    </div>
    <div class="utility-right">
      <div class="soc">
        <a href="https://vk.com/bteu_official">VK</a>
        <a href="https://t.me/bteuofficial">TG</a>
      </div>
    </div>
  </div>
</div>
<header class="site">
  <div class="wrap nav-row">
    <a href="/" class="brand">
      <span class="brand-mark">БТ</span>
      <span class="brand-text">БТЭУ ПК<span>Университет потребительской кооперации · Гомель</span></span>
    </a>
    <nav class="primary" aria-label="Основная навигация">
      <ul>
        ${item('/', 'Университет', 'home')}
        ${item('/news', 'Новости', 'news')}
        ${item('/pages/istoriya', 'Абитуриенту', 'abit')}
      </ul>
    </nav>
    <div class="nav-cta">
      <button class="theme-toggle" id="themeToggle" aria-label="Тёмная тема">◐</button>
      <a href="/admin" class="btn btn-outline" style="padding:10px 16px;font-size:13px;">Админ-панель</a>
    </div>
  </div>
</header>`;
}

function footer() {
  return `
<footer>
  <div class="wrap">
    <div class="foot-bottom">
      <span>© ${new Date().getFullYear()} УО «БТЭУ ПК»</span>
      <div class="foot-legal">
        <a href="/pages/kontakty">Контакты</a>
        <a href="/admin">Админ-панель</a>
      </div>
    </div>
  </div>
</footer>`;
}

function newsCard(n) {
  return `<li>
    <a href="/news/${esc(n.slug)}" style="display:contents;">
      <span class="news-date">${fmtDate(n.published_at)}</span>
      <div><h4>${esc(n.title)}</h4></div>
    </a>
  </li>`;
}

function homePage({ news, events, programs }) {
  const [feature, ...rest] = news;
  const body = `
<section class="hero" style="padding-top:0;padding-bottom:0;">
  <div class="wrap">
    <div class="hero-copy" style="padding:64px 0 40px;">
      <div class="eyebrow">Гомель · с 1964 года</div>
      <h1>Единственный в Беларуси университет,<br>который учит <em>торговать сообща</em>.</h1>
      <p>БТЭУ ПК готовит специалистов для потребительской кооперации и экономики страны — от коммерции и логистики до финансов и права.</p>
      <div class="hero-actions">
        <a href="/news" class="btn btn-gold">Все новости</a>
        <a href="/admin" class="btn btn-outline">Админ-панель (CMS)</a>
      </div>
    </div>
  </div>
</section>

<section id="news">
  <div class="wrap">
    <div class="section-head">
      <div><div class="eyebrow">Университет сегодня</div><h2>Новости и события</h2></div>
    </div>
    <div class="news-layout">
      <div>
        ${feature ? `<div class="news-feature">
          ${feature.cover_image ? `<img src="${esc(feature.cover_image)}" alt="${esc(feature.title)}">` : ''}
          <span class="tag-chip">${esc(feature.category_title || 'Новости')}</span>
          <h3><a href="/news/${esc(feature.slug)}">${esc(feature.title)}</a></h3>
          <p>${esc(feature.excerpt || '')}</p>
          <div class="news-meta"><span>${fmtDate(feature.published_at)}</span></div>
        </div>` : '<p>Новостей пока нет — добавьте первую в админ-панели.</p>'}
      </div>
      <ul class="news-list">
        ${rest.slice(0, 6).map(newsCard).join('\n')}
      </ul>
    </div>
  </div>
</section>

<section style="padding:0;">
  <div class="split">
    <div>
      <div class="eyebrow">Ближайшие события</div>
      <ul class="event-list" style="margin-top:20px;">
        ${events.map(e => {
          const d = new Date(e.event_date);
          return `<li>
            <div class="event-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('ru-RU',{month:'short'})}</span></div>
            <div><h4>${esc(e.title)}</h4><p>${esc(e.description || '')}</p></div>
          </li>`;
        }).join('\n') || '<p>Событий не запланировано.</p>'}
      </ul>
    </div>
    <div>
      <div class="eyebrow">Образовательные программы</div>
      <ul class="event-list" style="margin-top:20px;">
        ${programs.map(p => `<li><div><h4>${esc(p.title)}</h4><p>${esc(p.level)} · ${esc(p.form)}</p></div></li>`).join('\n')}
      </ul>
    </div>
  </div>
</section>`;
  return layout({ title: 'Главная — БТЭУ ПК', body, active: 'home' });
}

function newsListPage({ news, category }) {
  const body = `
<section>
  <div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Университет</div><h2>Все новости${category ? ' — ' + esc(category) : ''}</h2></div></div>
    <ul class="news-list">
      ${news.map(newsCard).join('\n') || '<p>Новостей нет.</p>'}
    </ul>
  </div>
</section>`;
  return layout({ title: 'Новости — БТЭУ ПК', body, active: 'news' });
}

function newsDetailPage(n) {
  if (!n) return null;
  const body = `
<section>
  <div class="wrap" style="max-width:820px;">
    <div class="eyebrow">${esc(n.category_title || 'Новости')}</div>
    <h1 style="margin-top:14px;font-size:clamp(28px,4vw,44px);">${esc(n.title)}</h1>
    <div class="news-meta" style="margin:18px 0 30px;">${fmtDate(n.published_at)}</div>
    ${n.cover_image ? `<img src="${esc(n.cover_image)}" alt="${esc(n.title)}" style="width:100%;border-radius:2px;margin-bottom:30px;">` : ''}
    <div class="article-body" style="font-size:17px;line-height:1.7;color:var(--ink-soft);">${n.body}</div>
    <p style="margin-top:40px;"><a href="/news" class="btn btn-outline">← Ко всем новостям</a></p>
  </div>
</section>`;
  return layout({ title: `${n.title} — БТЭУ ПК`, description: n.excerpt || undefined, body, active: 'news' });
}

// ---------------- Admin ----------------

function adminLayout({ title, body, session }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Админ-панель БТЭУ</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/public/admin.css">
</head>
<body>
<div class="admin-shell">
  <aside class="admin-nav">
    <div class="admin-brand">БТЭУ · CMS</div>
    <nav>
      <a href="/admin">Новости</a>
      <a href="/admin/news/new">+ Добавить новость</a>
      <a href="/" target="_blank">Открыть сайт ↗</a>
    </nav>
    ${session ? `<form method="post" action="/admin/logout" class="logout-form">
      <div class="admin-user">${esc(session.username)} · ${esc(session.role)}</div>
      <button class="btn-mini">Выйти</button>
    </form>` : ''}
  </aside>
  <main class="admin-main">${body}</main>
</div>
</body>
</html>`;
}

function loginPage({ error } = {}) {
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Вход — Админ-панель БТЭУ</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/public/admin.css"></head>
<body class="login-body">
  <form method="post" action="/admin/login" class="login-card">
    <div class="admin-brand">БТЭУ · CMS</div>
    <h1>Вход в админ-панель</h1>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <label>Логин<input name="username" autocomplete="username" required autofocus></label>
    <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn btn-gold" type="submit">Войти</button>
  </form>
</body></html>`;
}

function adminDashboard({ news, session, csrfToken }) {
  const rows = news.map(n => `
    <tr>
      <td>${esc(n.title)}</td>
      <td><span class="pill pill-${n.status}">${n.status === 'published' ? 'опубликовано' : 'черновик'}</span></td>
      <td>${esc(n.category_title || '—')}</td>
      <td>${fmtDate(n.updated_at)}</td>
      <td class="row-actions">
        <a href="/admin/news/${n.id}/edit">Изменить</a>
        <form method="post" action="/admin/news/${n.id}/delete" onsubmit="return confirm('Удалить новость безвозвратно?');">
          <input type="hidden" name="_csrf" value="${esc(csrfToken)}">
          <button class="link-danger" type="submit">Удалить</button>
        </form>
      </td>
    </tr>`).join('\n');

  const body = `
    <div class="admin-head"><h1>Новости</h1><a href="/admin/news/new" class="btn btn-gold">+ Новая запись</a></div>
    <table class="admin-table">
      <thead><tr><th>Заголовок</th><th>Статус</th><th>Категория</th><th>Обновлено</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Пока нет записей.</td></tr>'}</tbody>
    </table>`;
  return adminLayout({ title: 'Новости', body, session });
}

function adminNewsForm({ item = {}, categories, session, error, csrfToken }) {
  const isEdit = Boolean(item.id);
  const opt = (c) => `<option value="${c.id}" ${item.category_id === c.id ? 'selected' : ''}>${esc(c.title)}</option>`;
  const body = `
    <div class="admin-head"><h1>${isEdit ? 'Редактировать новость' : 'Новая новость'}</h1></div>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <form method="post" action="${isEdit ? `/admin/news/${item.id}` : '/admin/news'}" class="admin-form">
      <input type="hidden" name="_csrf" value="${esc(csrfToken)}">
      <label>Заголовок<input name="title" value="${esc(item.title || '')}" required></label>
      <label>URL (slug)<input name="slug" value="${esc(item.slug || '')}" placeholder="avtomaticheski-iz-zagolovka" pattern="[a-z0-9\\-]+"></label>
      <label>Категория
        <select name="category_id">
          <option value="">—</option>
          ${categories.map(opt).join('')}
        </select>
      </label>
      <label>Обложка (URL изображения)<input name="cover_image" value="${esc(item.cover_image || '')}" placeholder="/uploads/photo.jpg"></label>
      <label>Краткое описание<textarea name="excerpt" rows="2">${esc(item.excerpt || '')}</textarea></label>
      <label>Текст новости (HTML)<textarea name="body" rows="10">${item.body || ''}</textarea></label>
      <label class="inline"><input type="checkbox" name="status" value="published" ${item.status === 'published' ? 'checked' : ''}> Опубликовать сразу</label>
      <div class="form-actions">
        <button class="btn btn-gold" type="submit">Сохранить</button>
        <a href="/admin" class="btn btn-outline">Отмена</a>
      </div>
    </form>`;
  return adminLayout({ title: isEdit ? 'Редактирование' : 'Новая новость', body, session });
}

module.exports = {
  esc,
  homePage,
  newsListPage,
  newsDetailPage,
  loginPage,
  adminDashboard,
  adminNewsForm,
};
