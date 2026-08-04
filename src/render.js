'use strict';
// render.js — HTML rendering functions for BTEU CMS.

function fmtDate(iso) {
  if (!iso) return '';
  let str = iso instanceof Date ? iso.toISOString() : String(iso);
  str = str.replace(' ', 'T');
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Короткая дата для боковых списков новостей и событий
function fmtDateShort(iso) {
  if (!iso) return '';
  let str = iso instanceof Date ? iso.toISOString() : String(iso);
  str = str.replace(' ', 'T');
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `<b>${d.getDate()}</b><span>${months[d.getMonth()]}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function layout({ title = 'БТЭУ ПК', body = '', extraHead = '', session = null } = {}) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/public/style.css">
  ${extraHead}
</head>
<body>
  <a class="skip-link" href="#main">Перейти к содержанию</a>

  <div class="topbar">
    <div class="wrap topbar__inner">
      <div class="topbar__contacts">
        <a href="tel:+375232500344">+375 (232) 50-03-44</a>
        <a href="mailto:info@bteu.by">info@bteu.by</a>
        <span class="topbar__addr">г. Гомель, пр-т Октября, 50</span>
      </div>
      <div class="topbar__tools">
        <a href="#" class="topbar__link">Версия для слабовидящих</a>
        ${session ? '<a href="/admin" class="topbar__link topbar__link--accent">Админ-панель</a>' : '<a href="/admin/login" class="topbar__link topbar__link--accent">Вход для сотрудников</a>'}
      </div>
    </div>
  </div>

  <header class="site-header">
    <div class="wrap site-header__inner">
      <a href="/" class="brand">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="40" height="40"><path d="M24 3 L44 13 V24 C44 35 35.5 42.5 24 45 C12.5 42.5 4 35 4 24 V13 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24 12 L24 32 M16 18 L24 12 L32 18 M16 26 L24 32 L32 26" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        <span class="brand__text">
          <strong>БТЭУ ПК</strong>
          <em>Белорусский торгово-экономический университет потребительской кооперации</em>
        </span>
      </a>

      <nav class="mainnav" aria-label="Основная навигация">
        <ul>
          <li><a href="/">Главная</a></li>
          <li><a href="/#faculties">Факультеты</a></li>
          <li><a href="/#admission">Абитуриенту</a></li>
          <li><a href="/news">Новости</a></li>
          <li><a href="/#contacts">Контакты</a></li>
        </ul>
      </nav>

      <button class="burger" aria-label="Открыть меню" aria-expanded="false" id="burgerBtn">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <main id="main">
    ${body}
  </main>

  <footer class="site-footer" id="contacts">
    <div class="wrap footer__grid">
      <div>
        <p class="footer__brand">БТЭУ ПК</p>
        <p class="footer__legal">УО «Белорусский торгово-экономический университет потребительской кооперации»</p>
        <p class="footer__legal">г. Гомель, пр-т Октября, 50, 246029</p>
      </div>
      <div>
        <p class="footer__head">Университет</p>
        <ul>
          <li><a href="/#faculties">Факультеты</a></li>
          <li><a href="/news">Новости</a></li>
          <li><a href="#">Доступная среда</a></li>
        </ul>
      </div>
      <div>
        <p class="footer__head">Абитуриенту</p>
        <ul>
          <li><a href="/#admission">Правила приёма</a></li>
          <li><a href="#">Специальности</a></li>
        </ul>
      </div>
      <div>
        <p class="footer__head">Контакты</p>
        <ul>
          <li><a href="tel:+375232500344">+375 (232) 50-03-44</a></li>
          <li><a href="mailto:info@bteu.by">info@bteu.by</a></li>
          <li><a href="#">Политика обработки персональных данных</a></li>
        </ul>
      </div>
    </div>
    <div class="wrap footer__bottom">
      <p>&copy; ${new Date().getFullYear()} БТЭУ ПК. Все права защищены.</p>
    </div>
  </footer>

  <script src="/public/main.js"></script>
</body>
</html>`;
}

function homePage({ news = [], events = [], programs = [], faculties = [] } = {}) {
  const featuredNews = news[0];
  const listNews = news.slice(1, 5);

  let newsSection = '<p>Новостей пока нет.</p>';
  if (featuredNews) {
    newsSection = `
      <div class="news-layout">
        <div class="news-feature">
          ${featuredNews.cover_image ? `<img src="${escapeHtml(featuredNews.cover_image)}" alt="">` : '<img src="https://placehold.co/800x450/ece3cf/8b98a8?text=BTEU" alt="">'}
          <span class="tag-chip">${escapeHtml(featuredNews.category_title || 'Новости')}</span>
          <h3><a href="/news/${escapeHtml(featuredNews.slug)}">${escapeHtml(featuredNews.title)}</a></h3>
          <p>${escapeHtml(featuredNews.excerpt || '')}</p>
          <div class="news-meta">${fmtDate(featuredNews.published_at)}</div>
        </div>
        <div>
          <span class="eyebrow">Последние обновления</span>
          <ul class="news-list">
            ${listNews.map(item => `
              <li>
                <div class="news-date">${fmtDateShort(item.published_at)}</div>
                <div>
                  <h4><a href="/news/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a></h4>
                </div>
              </li>
            `).join('')}
          </ul>
          <a href="/news" class="btn btn-outline" style="margin-top:24px; width:100%; justify-content:center;">Все новости</a>
        </div>
      </div>
    `;
  }

  const eventsHtml = events.map(ev => `
    <li>
      <div class="event-date">${fmtDateShort(ev.event_date)}</div>
      <div>
        <h4>${escapeHtml(ev.title)}</h4>
        <p>${escapeHtml(ev.description || '')}</p>
      </div>
    </li>
  `).join('');

  const programsHtml = programs.map(p => `
    <li>
      <div class="event-date"><b>${p.sort_order}</b><span>Код</span></div>
      <div>
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.level)} &middot; ${escapeHtml(p.form)}</p>
      </div>
    </li>
  `).join('');

  const facultiesRows = faculties.map((f, i) => `
    <tr>
      <td class="reestr__no">${String(i + 1).padStart(2, '0')}</td>
      <td class="reestr__name">${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.profile || '')}</td>
      <td><a href="/faculties/${escapeHtml(f.slug)}" class="reestr__go" aria-label="Подробнее о факультете">&rarr;</a></td>
    </tr>
  `).join('');

  const body = `
    <section class="hero">
      <div class="wrap hero__inner">
        <div class="hero__copy">
          <p class="eyebrow">Учреждение образования &middot; система потребительской кооперации Республики Беларусь</p>
          <h1>Экономика, право и торговое дело &mdash;<br>подготовка кадров для кооперации</h1>
          <p class="hero__lead">Готовим экономистов, юристов, товароведов и IT-специалистов, которых ждут в реальном секторе &mdash; от Белкоопсоюза до частных торговых сетей.</p>
          <div class="hero__actions">
            <a href="/#admission" class="btn btn-gold">Поступление 2026</a>
            <a href="/#faculties" class="btn btn-outline">Факультеты и специальности</a>
          </div>
        </div>

        <aside class="hero__ledger" aria-label="Университет в цифрах">
          <div class="ledger__row"><span class="ledger__num">60+</span><span class="ledger__label">лет истории университета</span></div>
          <div class="ledger__row"><span class="ledger__num">${programs.length || '20+'}</span><span class="ledger__label">специальностей высшего образования</span></div>
          <div class="ledger__row"><span class="ledger__num">${faculties.length || 5}</span><span class="ledger__label">факультетов и институтов</span></div>
          <div class="ledger__row"><span class="ledger__num">98%</span><span class="ledger__label">трудоустройство выпускников</span></div>
        </aside>
      </div>
    </section>

    <section class="section section--muted" id="faculties">
      <div class="wrap">
        <div class="section__head section__head--center">
          <p class="eyebrow">Структура</p>
          <h2>Факультеты и институты</h2>
        </div>
        <table class="reestr" aria-label="Реестр факультетов">
          <thead>
            <tr><th>&#8470;</th><th>Факультет</th><th>Профиль подготовки</th><th></th></tr>
          </thead>
          <tbody>
            ${facultiesRows || '<tr><td colspan="4">Факультеты скоро появятся.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="wrap" id="news">
      <div class="section-head">
        <h2>События и жизнь университета</h2>
      </div>
      ${newsSection}
    </section>

    <section class="wrap" id="admission">
      <div class="split">
        <div>
          <span class="eyebrow">Календарь</span>
          <h3 style="margin: 12px 0 24px;">Предстоящие мероприятия</h3>
          <ul class="event-list">
            ${eventsHtml || '<li><p>Событий не запланировано.</p></li>'}
          </ul>
        </div>
        <div>
          <span class="eyebrow">Образование</span>
          <h3 style="margin: 12px 0 24px;">Наши программы</h3>
          <ul class="event-list">
            ${programsHtml || '<li><p>Программы загружаются...</p></li>'}
          </ul>
        </div>
      </div>
    </section>
  `;

  return layout({ title: 'Главная — БТЭУ ПК', body });
}

function newsListPage({ news = [], category = null } = {}) {
  const newsHtml = news.map(item => `
    <div style="margin-bottom: 40px; padding-bottom: 40px; border-bottom: 1px solid var(--line);">
      <span class="tag-chip" style="margin-bottom:12px;">${escapeHtml(item.category_title || 'Новости')}</span>
      <h3><a href="/news/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a></h3>
      <div class="news-meta" style="margin: 8px 0 16px;">${fmtDate(item.published_at)}</div>
      <p style="color:var(--ink-soft); line-height:1.6; max-width:65ch;">${escapeHtml(item.excerpt || '')}</p>
    </div>
  `).join('');

  const body = `
    <section class="wrap">
      <div class="hero-copy" style="margin-bottom: 40px;">
        <span class="eyebrow">Пресс-центр</span>
        <h1>Новости ${category ? `— ${escapeHtml(category)}` : ''}</h1>
      </div>
      <div style="max-width: 800px;">
        ${newsHtml || '<p>В данной категории нет новостей.</p>'}
      </div>
    </section>
  `;

  return layout({ title: 'Новости — БТЭУ ПК', body });
}

function newsDetailPage(item) {
  const body = `
    <section class="wrap" style="max-width: 800px; margin: 0 auto; padding-top: 50px;">
      <span class="tag-chip">${escapeHtml(item.category_title || 'Новости')}</span>
      <h1 style="margin: 16px 0; font-size: clamp(28px, 4vw, 42px);">${escapeHtml(item.title)}</h1>
      <div class="news-meta" style="margin-bottom: 30px;">Опубликовано: ${fmtDate(item.published_at)}</div>
      
      ${item.cover_image ? `<img src="${escapeHtml(item.cover_image)}" alt="" style="width:100%; border-radius:var(--radius); margin-bottom:40px;">` : ''}
      
      <div class="article-body" style="font-size: 17px; line-height: 1.7; color: var(--ink);">
        ${item.body}
      </div>
      
      <div style="margin-top: 60px; padding-top: 30px; border-top: 1px solid var(--line);">
        <a href="/news" class="btn btn-outline">&larr; Назад к новостям</a>
      </div>
    </section>
  `;

  return layout({ title: `${item.title} — БТЭУ ПК`, body });
}

function loginPage({ error = '' } = {}) {
  const body = `
    <section class="wrap" style="display:flex; justify-content:center; align-items:center; min-height:60vh;">
      <div style="background:var(--white); padding:40px; border:1px solid var(--line); border-radius:var(--radius); width:100%; max-width:400px;">
        <h2 style="margin-bottom: 24px; text-align:center;">Вход в систему</h2>
        ${error ? `<div style="background:#ffebee; color:#c62828; padding:12px; margin-bottom:20px; font-size:14px; border-radius:var(--radius);">${escapeHtml(error)}</div>` : ''}
        <form method="POST" action="/admin/login">
          <div style="margin-bottom:16px;">
            <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:bold; font-family:var(--sans);">Логин</label>
            <input type="text" name="username" required style="width:100%; padding:10px; border:1px solid var(--line); font-family:var(--sans);">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:bold; font-family:var(--sans);">Пароль</label>
            <input type="password" name="password" required style="width:100%; padding:10px; border:1px solid var(--line); font-family:var(--sans);">
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%; justify-content:center;">Войти</button>
        </form>
      </div>
    </section>
  `;

  return layout({ title: 'Вход — БТЭУ ПК', body });
}

function adminDashboard({ news = [], session = null, csrfToken = '' } = {}) {
  const rows = news.map(item => `
    <tr style="border-bottom: 1px solid var(--line);">
      <td style="padding:12px;">${item.id}</td>
      <td style="padding:12px;"><strong>${escapeHtml(item.title)}</strong></td>
      <td style="padding:12px;">${item.status === 'published' ? '<span style="color:var(--moss);">Опубликовано</span>' : '<span style="color:var(--gold-deep);">Черновик</span>'}</td>
      <td style="padding:12px;">${fmtDate(item.updated_at)}</td>
      <td style="padding:12px; text-align:right;">
        <a href="/admin/news/${item.id}/edit" class="btn btn-outline" style="padding:6px 12px; font-size:12px;">Ред.</a>
        <form method="POST" action="/admin/news/${item.id}/delete" style="display:inline;" onsubmit="return confirm('Удалить новость?');">
          <input type="hidden" name="_csrf" value="${csrfToken}">
          <button type="submit" class="btn" style="padding:6px 12px; font-size:12px; border:1px solid #c62828; color:#c62828; background:transparent;">Удалить</button>
        </form>
      </td>
    </tr>
  `).join('');

  const body = `
    <section class="wrap" style="padding-top: 40px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
        <div>
          <span class="eyebrow">Панель управления</span>
          <h1 style="margin-top:10px;">Администрирование</h1>
        </div>
        <div style="display:flex; gap:16px; align-items:center;">
          <span style="font-size:14px; color:var(--ink-soft);">Admin: <strong>${escapeHtml(session ? session.username : '')}</strong></span>
          <form method="POST" action="/admin/logout" style="margin:0;">
            <button type="submit" class="btn btn-outline" style="padding:8px 16px;">Выйти</button>
          </form>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <a href="/admin/news/new" class="btn btn-gold">+ Создать новость</a>
      </div>

      <div style="background:var(--white); border:1px solid var(--line); border-radius:var(--radius); overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:var(--paper); border-bottom:1px solid var(--line);">
            <tr>
              <th style="padding:12px; font-weight:600;">ID</th>
              <th style="padding:12px; font-weight:600;">Заголовок</th>
              <th style="padding:12px; font-weight:600;">Статус</th>
              <th style="padding:12px; font-weight:600;">Обновлено</th>
              <th style="padding:12px; font-weight:600; text-align:right;">Действия</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="padding:20px; text-align:center;">Новостей нет.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;

  return layout({ title: 'Админка — БТЭУ ПК', body, session });
}

function adminNewsForm({ item = {}, categories = [], session = null, error = '', csrfToken = '' } = {}) {
  const isEdit = Boolean(item.id);
  const action = isEdit ? `/admin/news/${item.id}` : '/admin/news';

  const catOptions = categories.map(c => `
    <option value="${c.id}" ${item.category_id == c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>
  `).join('');

  const body = `
    <section class="wrap" style="padding-top:40px; max-width:800px; margin:0 auto;">
      <h1 style="margin-bottom: 24px;">${isEdit ? 'Редактирование новости' : 'Новая новость'}</h1>
      ${error ? `<div style="background:#ffebee; color:#c62828; padding:12px; margin-bottom:20px; border-radius:var(--radius);">${escapeHtml(error)}</div>` : ''}

      <form method="POST" action="${action}" style="background:var(--white); padding:30px; border:1px solid var(--line); border-radius:var(--radius);">
        <input type="hidden" name="_csrf" value="${csrfToken}">

        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Заголовок</label>
          <input type="text" name="title" value="${escapeHtml(item.title || '')}" required style="width:100%; padding:10px; border:1px solid var(--line);">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">URL-слаг (оставьте пустым для автогенерации)</label>
          <input type="text" name="slug" value="${escapeHtml(item.slug || '')}" style="width:100%; padding:10px; border:1px solid var(--line);">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
          <div>
            <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Категория</label>
            <select name="category_id" style="width:100%; padding:10px; border:1px solid var(--line); background:var(--white);">
              <option value="">Без категории</option>
              ${catOptions}
            </select>
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Статус</label>
            <select name="status" style="width:100%; padding:10px; border:1px solid var(--line); background:var(--white);">
              <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Черновик</option>
              <option value="published" ${item.status === 'published' ? 'selected' : ''}>Опубликовано</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Ссылка на обложку</label>
          <input type="text" name="cover_image" value="${escapeHtml(item.cover_image || '')}" style="width:100%; padding:10px; border:1px solid var(--line);" placeholder="/uploads/image.jpg">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Краткое описание</label>
          <textarea name="excerpt" rows="3" style="width:100%; padding:10px; border:1px solid var(--line); resize:vertical;">${escapeHtml(item.excerpt || '')}</textarea>
        </div>

        <div style="margin-bottom:30px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">Полный текст (HTML)</label>
          <textarea name="body" rows="12" required style="width:100%; padding:10px; border:1px solid var(--line); resize:vertical; font-family:var(--mono);">${escapeHtml(item.body || '')}</textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-gold">Сохранить</button>
          <a href="/admin" class="btn btn-outline">Отмена</a>
        </div>
      </form>
    </section>
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
