'use strict';
// render.js — HTML rendering functions for BTEU CMS.

function fmtDate(iso) {
  if (!iso) return '';
  let str = iso instanceof Date ? iso.toISOString() : String(iso);
  str = str.replace(' ', 'T');
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function layout({ title = 'БТЭУ ПК', body = '', extraHead = '', session = null } = {}) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/css/style.css">
  ${extraHead}
</head>
<body>
  <header class="header">
    <div class="container header__container">
      <a href="/" class="header__logo">БТЭУ ПК</a>
      <nav class="header__nav">
        <a href="/">Главная</a>
        <a href="/news">Новости</a>
        ${session ? '<a href="/admin">Админ-панель</a>' : '<a href="/admin/login">Вход</a>'}
      </nav>
    </div>
  </header>
  <main class="main container">
    ${body}
  </main>
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} УО «Белорусский торгово-экономический университет потребительской кооперации»</p>
    </div>
  </footer>
</body>
</html>`;
}

function homePage({ news = [], events = [], programs = [] } = {}) {
  const newsHtml = news.map(item => `
    <article class="card">
      ${item.cover_image ? `<img src="${escapeHtml(item.cover_image)}" alt="${escapeHtml(item.title)}" class="card__img">` : ''}
      <div class="card__content">
        <span class="card__date">${fmtDate(item.published_at)}</span>
        <h3 class="card__title"><a href="/news/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a></h3>
        <p class="card__excerpt">${escapeHtml(item.excerpt || '')}</p>
      </div>
    </article>
  `).join('');

  const eventsHtml = events.map(ev => `
    <li class="event-item">
      <div class="event-item__date">${fmtDate(ev.event_date)}</div>
      <div class="event-item__title">${escapeHtml(ev.title)}</div>
    </li>
  `).join('');

  const programsHtml = programs.map(p => `
    <li class="program-item">
      <strong>${escapeHtml(p.title)}</strong> — ${escapeHtml(p.level)} (${escapeHtml(p.form)})
    </li>
  `).join('');

  const body = `
    <section class="hero">
      <h1>УО «Белорусский торгово-экономический университет потребительской кооперации»</h1>
      <p>Качественное образование и студенческая жизнь в Гомеле.</p>
    </section>

    <section class="section">
      <h2>Последние новости</h2>
      <div class="grid grid--3">
        ${newsHtml || '<p>Новостей пока нет.</p>'}
      </div>
    </section>

    <div class="grid grid--2">
      <section class="section">
        <h2>Предстоящие события</h2>
        <ul class="events-list">
          ${eventsHtml || '<li>Событий не запланировано.</li>'}
        </ul>
      </section>

      <section class="section">
        <h2>Образовательные программы</h2>
        <ul class="programs-list">
          ${programsHtml || '<li>Программы загружаются...</li>'}
        </ul>
      </section>
    </div>
  `;

  return layout({ title: 'Главная — БТЭУ ПК', body });
}

function newsListPage({ news = [], category = null } = {}) {
  const newsHtml = news.map(item => `
    <article class="card">
      ${item.cover_image ? `<img src="${escapeHtml(item.cover_image)}" alt="${escapeHtml(item.title)}" class="card__img">` : ''}
      <div class="card__content">
        <span class="card__date">${fmtDate(item.published_at)}</span>
        <h3 class="card__title"><a href="/news/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a></h3>
        <p class="card__excerpt">${escapeHtml(item.excerpt || '')}</p>
      </div>
    </article>
  `).join('');

  const body = `
    <h1>Новости ${category ? `— ${escapeHtml(category)}` : ''}</h1>
    <div class="grid grid--3">
      ${newsHtml || '<p>В данной категории нет новостей.</p>'}
    </div>
  `;

  return layout({ title: 'Новости — БТЭУ ПК', body });
}

function newsDetailPage(item) {
  const body = `
    <article class="news-detail">
      <h1>${escapeHtml(item.title)}</h1>
      <div class="news-detail__meta">
        <span>${fmtDate(item.published_at)}</span>
        ${item.category_title ? `<span> | ${escapeHtml(item.category_title)}</span>` : ''}
      </div>
      ${item.cover_image ? `<img src="${escapeHtml(item.cover_image)}" alt="${escapeHtml(item.title)}" class="news-detail__img">` : ''}
      <div class="news-detail__body">
        ${item.body}
      </div>
      <p><a href="/news">&larr; Назад к новостям</a></p>
    </article>
  `;

  return layout({ title: `${item.title} — БТЭУ ПК`, body });
}

function loginPage({ error = '' } = {}) {
  const body = `
    <div class="auth-box">
      <h1>Вход в админ-панель</h1>
      ${error ? `<div class="error-msg">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/admin/login" class="form">
        <div class="form-group">
          <label for="username">Логин</label>
          <input type="text" id="username" name="username" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="password">Пароль</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn--primary">Войти</button>
      </form>
    </div>
  `;

  return layout({ title: 'Вход — Админ-панель', body });
}

function adminDashboard({ news = [], session = null, csrfToken = '' } = {}) {
  const rows = news.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${escapeHtml(item.title)}</td>
      <td><span class="badge badge--${item.status}">${item.status === 'published' ? 'Опубликовано' : 'Черновик'}</span></td>
      <td>${fmtDate(item.updated_at)}</td>
      <td class="actions">
        <a href="/admin/news/${item.id}/edit" class="btn btn--small">Редактировать</a>
        <form method="POST" action="/admin/news/${item.id}/delete" style="display:inline;" onsubmit="return confirm('Удалить новость?');">
          <input type="hidden" name="_csrf" value="${csrfToken}">
          <button type="submit" class="btn btn--danger btn--small">Удалить</button>
        </form>
      </td>
    </tr>
  `).join('');

  const body = `
    <div class="admin-header">
      <h1>Администрирование сайта</h1>
      <div>
        <span>Вы вошли как: <strong>${escapeHtml(session ? session.username : '')}</strong></span>
        <form method="POST" action="/admin/logout" style="display:inline; margin-left:1rem;">
          <button type="submit" class="btn btn--secondary btn--small">Выйти</button>
        </form>
      </div>
    </div>

    <div class="admin-actions">
      <a href="/admin/news/new" class="btn btn--primary">+ Создать новость</a>
    </div>

    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Заголовок</th>
          <th>Статус</th>
          <th>Обновлено</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">Новостей нет.</td></tr>'}
      </tbody>
    </table>
  `;

  return layout({ title: 'Админ-панель — БТЭУ ПК', body, session });
}

function adminNewsForm({ item = {}, categories = [], session = null, error = '', csrfToken = '' } = {}) {
  const isEdit = Boolean(item.id);
  const action = isEdit ? `/admin/news/${item.id}` : '/admin/news';

  const catOptions = categories.map(c => `
    <option value="${c.id}" ${item.category_id == c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>
  `).join('');

  const body = `
    <h1>${isEdit ? 'Редактирование новости' : 'Новая новость'}</h1>
    ${error ? `<div class="error-msg">${escapeHtml(error)}</div>` : ''}

    <form method="POST" action="${action}" class="form">
      <input type="hidden" name="_csrf" value="${csrfToken}">

      <div class="form-group">
        <label for="title">Заголовок</label>
        <input type="text" id="title" name="title" value="${escapeHtml(item.title || '')}" required>
      </div>

      <div class="form-group">
        <label for="slug">URL-слаг (оставьте пустым для автогенерации)</label>
        <input type="text" id="slug" name="slug" value="${escapeHtml(item.slug || '')}">
      </div>

      <div class="form-group">
        <label for="category_id">Категория</label>
        <select id="category_id" name="category_id">
          <option value="">Без категории</option>
          ${catOptions}
        </select>
      </div>

      <div class="form-group">
        <label for="cover_image">Ссылка на обложку (/uploads/image.jpg)</label>
        <input type="text" id="cover_image" name="cover_image" value="${escapeHtml(item.cover_image || '')}">
      </div>

      <div class="form-group">
        <label for="excerpt">Краткое описание</label>
        <textarea id="excerpt" name="excerpt" rows="3">${escapeHtml(item.excerpt || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="body">Полный текст (HTML)</label>
        <textarea id="body" name="body" rows="10" required>${escapeHtml(item.body || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="status">Статус</label>
        <select id="status" name="status">
          <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Черновик</option>
          <option value="published" ${item.status === 'published' ? 'selected' : ''}>Опубликовано</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Сохранить</button>
        <a href="/admin" class="btn btn--secondary">Отмена</a>
      </div>
    </form>
  `;

  return layout({ title: isEdit ? 'Редактирование — БТЭУ ПК' : 'Новая новость — БТЭУ ПК', body, session });
}

module.exports = {
  fmtDate,
  homePage,
  newsListPage,
  newsDetailPage,
  loginPage,
  adminDashboard,
  adminNewsForm,
};
