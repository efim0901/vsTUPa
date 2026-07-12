const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN is not set. The bot will not be able to handle Telegram updates.');
}
const bot = new Telegraf(BOT_TOKEN || 'dummy-token');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  timeout: 25000,
});

const UNIVERSITIES = {
  gsu: {
    id: 'gsu',
    name: 'ГГУ им. Скорины',
    emoji: '🏛',
    url: 'https://old.gsu.by/dinamika/konkurs/dn-plat.html',
    type: 'html',
  },
  gstu: {
    id: 'gstu',
    name: 'ГГТУ им. Сухого',
    emoji: '⚙️',
    urls: {
      bud: 'https://abiturient.gstu.by/sites/default/files/atoms/files/47/25/ball_dnevn_site_bud_new_int1212.pdf',
      paid: 'https://abiturient.gstu.by/sites/default/files/atoms/files/10/66/ball_dnevn_site_plat_new_int1212.pdf',
    },
    localPaths: {
      bud: path.join(__dirname, 'ball_dnevn_site_bud_new_int1212.pdf'),
      paid: path.join(__dirname, 'ball_dnevn_site_plat_new_int1212.pdf'),
    },
    type: 'pdf',
  },
};

// ==================== SCORE BANDS ====================
function generateScoreBands(topMin, bottomMax, step) {
  const bands = [`${topMin}+`];
  let upper = topMin - 1;
  while (upper - step + 1 > bottomMax) {
    const lower = upper - step + 1;
    bands.push(`${lower}-${upper}`);
    upper -= step;
  }
  bands.push(`1-${bottomMax}`);
  return bands;
}

const NON_SCORE_LABELS = ['План приема', 'Подано заявлений', 'без экзаменов', 'вне конкурса', 'по конкурсу'];
const SCORE_BANDS = generateScoreBands(396, 50, 5);
const DATA_COLUMN_LABELS = [...NON_SCORE_LABELS, ...SCORE_BANDS];
const SCORE_BANDS_START = NON_SCORE_LABELS.length;

// ==================== GSU PARSING ====================
async function fetchGSUStructured() {
  const { data } = await axiosInstance.get(UNIVERSITIES.gsu.url);
  const $ = cheerio.load(data);
  const faculties = [];
  let currentFaculty = null;

  $('#main_table_body tr').each((index, element) => {
    const cols = $(element).find('td');
    const cellTexts = cols.map((i, el) => $(el).text().trim().replace(/\s+/g, ' ')).get();

    if (cellTexts.length === 0) return;
    if (cellTexts.length === 1) {
      currentFaculty = { name: cellTexts[0], specialties: [] };
      faculties.push(currentFaculty);
      return;
    }

    const nameIndex = cellTexts.findIndex((t) => /[А-Яа-яЁё]{3,}/.test(t));
    if (nameIndex === -1) return;

    const name = cellTexts[nameIndex];
    const after = cellTexts.slice(nameIndex + 1);
    if (after.length < DATA_COLUMN_LABELS.length) return;

    const specialty = {
      name,
      plan: after[0] || '0',
      submittedTotal: after[1] || '0',
      withoutExams: after[2] || '0',
      outOfCompetition: after[3] || '0',
      byCompetition: after[4] || '0',
      scores: SCORE_BANDS.map((label, i) => ({ label, count: parseInt(after[SCORE_BANDS_START + i], 10) || 0 })).filter((s) => s.count > 0),
    };

    if (!currentFaculty) {
      currentFaculty = { name: 'Без указания факультета', specialties: [] };
      faculties.push(currentFaculty);
    }
    currentFaculty.specialties.push(specialty);
  });

  return faculties;
}

// ==================== GSTU PDF PARSING ====================
function cleanLine(line) {
  return line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseGSTUFromText(text, formType = 'bud') {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);

  console.log(`[GSTU ${formType}] Извлечено строк из PDF: ${lines.length}`);

  const specialties = [];
  const ignored = [
    /^форма получения образования/i,
    /^прием осуществляется/i,
    /^всего/i,
    /^информация/i,
    /^время/i,
    /^дата/i,
    /^учреждение образования/i,
    /^гомельский государственный технический университет/i,
    /^п\.о\.сухого/i,
    /^страница/i,
    /^содержание/i,
    /^по факультетам/i,
    /^группа специальностей/i,
  ];

  for (const line of lines) {
    if (!line || line.length < 5) continue;
    
    const lower = line.toLowerCase();
    if (ignored.some((pattern) => pattern.test(lower))) continue;
    
    // Пропускаем строки только с цифрами, символами и пробелами
    if (/^[\s\d.<>\-()]+$/.test(line)) continue;
    
    // Должны быть кириллические символы
    if (!/[А-Яа-яЁё]/.test(line)) continue;

    // Ищем строки с названием специальности и числами
    // Более гибкий паттерн: название + 1-2 числа в конце
    const match = line.match(/^(.+?)\s+(\d{1,3})(?:\s+(\d{1,3}))?(?:\s+(\d{1,3}))?(?:\s+(\d{1,3}))?$/);
    if (!match) continue;

    const rawName = cleanLine(match[1]).trim();
    const firstNum = parseInt(match[2], 10) || 0;
    const secondNum = parseInt(match[3], 10) || 0;

    // Фильтруем короткие названия
    if (!rawName || rawName.length < 8) continue;
    
    // Пропускаем строки, которые явно служебные или заголовки
    if (/^(План|Подано|Без|Вне|По|Форма|Прием|Всего)/i.test(rawName)) continue;
    if (/^\d+$/.test(rawName)) continue;

    // Специальность должна быть хотя бы 2+ слова
    const words = rawName.split(/\s+/).filter(Boolean);
    if (words.length < 2 || rawName.length < 10) continue;

    specialties.push({
      name: rawName,
      plan: firstNum || 0,
      submittedTotal: secondNum || firstNum || 0,
      withoutExams: 0,
      outOfCompetition: 0,
      byCompetition: secondNum || firstNum || 0,
      scores: [],
    });
  }

  console.log(`[GSTU ${formType}] Найдено специальностей: ${specialties.length}`);

  // Удаляем дубликаты
  const unique = [];
  const seen = new Set();
  for (const spec of specialties) {
    const key = spec.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(spec);
    }
  }

  return unique.slice(0, 100);
}

// ==================== PDF DOWNLOAD & PARSING ====================
async function fetchPdfBuffer(url, fallbackPath) {
  try {
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (e) {
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      return fs.readFileSync(fallbackPath);
    }
    throw e;
  }
}

async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    const text = data.text || '';
    console.log(`[PDF] Извлечено символов: ${text.length}`);
    return text;
  } catch (e) {
    console.error('PDF extraction error:', e.message);
    return '';
  }
}

// ==================== CACHING ====================
const CACHE_TTL_MS = 5 * 60 * 1000;
let universityCache = {
  gsu: { data: null, timestamp: 0, error: null },
  gstu: { bud: { data: null, timestamp: 0, error: null }, paid: { data: null, timestamp: 0, error: null } },
};

async function getGSUData(forceRefresh = false) {
  const bucket = universityCache.gsu;
  const isStale = Date.now() - bucket.timestamp > CACHE_TTL_MS;
  
  if (forceRefresh || isStale || !bucket.data) {
    try {
      const faculties = await fetchGSUStructured();
      bucket.data = faculties;
      bucket.timestamp = Date.now();
      bucket.error = null;
    } catch (e) {
      console.error('GSU fetch error:', e);
      bucket.error = e;
      if (!bucket.data) bucket.data = [];
    }
  }
  return bucket;
}

async function getGSTUData(form = 'bud', forceRefresh = false) {
  const bucket = universityCache.gstu[form];
  const isStale = Date.now() - bucket.timestamp > CACHE_TTL_MS;
  
  if (forceRefresh || isStale || !bucket.data) {
    try {
      console.log(`[GSTU ${form}] Начинаю загрузку...`);
      const url = UNIVERSITIES.gstu.urls[form];
      const fallbackPath = UNIVERSITIES.gstu.localPaths[form];
      const buffer = await fetchPdfBuffer(url, fallbackPath);
      console.log(`[GSTU ${form}] PDF загружен, размер: ${buffer.length} байт`);
      const text = await extractTextFromPDF(buffer);
      const specialties = parseGSTUFromText(text, form);
      
      bucket.data = specialties;
      bucket.timestamp = Date.now();
      bucket.error = null;
      console.log(`[GSTU ${form}] Успешно загружено ${specialties.length} специальностей`);
    } catch (e) {
      console.error(`GSTU ${form} parse error:`, e);
      bucket.error = e;
      if (!bucket.data) bucket.data = [];
    }
  }
  return bucket;
}

// ==================== FORMATTING ====================
function formatScoreTable(scores) {
  if (!scores || scores.length === 0) return '_данных по баллам нет_';
  const width = Math.max(...scores.map((s) => s.label.length));
  const lines = scores.map((s) => `${s.label.padEnd(width)}  ${String(s.count).padStart(3)} чел.`);
  return '```\n' + lines.join('\n') + '\n```';
}

function formatSpecialtyCard(spec) {
  let text = `🔹 *${spec.name}*\n\n`;
  text += `📋 План приема: *${spec.plan}*\n`;
  text += `🧾 Подано заявлений: *${spec.submittedTotal}*\n`;
  if (parseInt(spec.withoutExams, 10) > 0) text += `🎯 Без экзаменов: ${spec.withoutExams}\n`;
  if (parseInt(spec.outOfCompetition, 10) > 0) text += `🏆 Вне конкурса: ${spec.outOfCompetition}\n`;
  text += `🎓 По конкурсу: ${spec.byCompetition}\n`;
  
  if (spec.scores && spec.scores.length > 0) {
    text += `\n📊 Баллы поступивших:\n`;
    text += formatScoreTable(spec.scores);
  }
  
  return text;
}

function truncateLabel(label, max = 60) {
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
}

// ==================== KEYBOARDS ====================
function startKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${UNIVERSITIES.gsu.emoji} ${UNIVERSITIES.gsu.name}`, 'get_gsu')],
    [Markup.button.callback(`${UNIVERSITIES.gstu.emoji} ${UNIVERSITIES.gstu.name}`, 'get_gstu')],
  ]);
}

function universityHomeKeyboard(univId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📚 Список факультетов', `${univId}_open_faculties`)],
    [Markup.button.callback('🔄 Обновить данные', `${univId}_refresh`)],
    [Markup.button.callback('◀️ В начало', 'go_start')],
  ]);
}

function facultyListKeyboard(faculties, univId) {
  const rows = faculties.map((f, i) => [Markup.button.callback(`🏫 ${truncateLabel(f.name)} (${f.specialties.length})`, `${univId}_f_${i}`)]);
  rows.push([Markup.button.callback('🔄 Обновить данные', `${univId}_refresh`)]);
  rows.push([Markup.button.callback('◀️ В начало', 'go_start')]);
  return Markup.inlineKeyboard(rows);
}

function specialtyListKeyboard(faculty, facIndex, univId) {
  const rows = faculty.specialties.map((s, i) => [Markup.button.callback(`${truncateLabel(s.name)} — план ${s.plan}`, `${univId}_s_${facIndex}_${i}`)]);
  rows.push([Markup.button.callback('◀️ К факультетам', `${univId}_back_faculties`)]);
  return Markup.inlineKeyboard(rows);
}

function specialtyCardKeyboard(facIndex, univId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('◀️ К специальностям', `${univId}_f_${facIndex}`)],
    [Markup.button.callback('◀️ К факультетам', `${univId}_back_faculties`)],
  ]);
}

// ==================== HELPERS ====================
async function safeEditMessage(ctx, text, extra) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (e) {
    if (!String(e.description || e.message).includes('not modified')) {
      console.error('editMessageText error:', e.description || e.message);
    }
  }
}

async function getGSTUFaculties(forceRefresh = false) {
  const [bud, paid] = await Promise.all([
    getGSTUData('bud', forceRefresh),
    getGSTUData('paid', forceRefresh),
  ]);

  const faculties = [];
  if (bud.data && bud.data.length > 0) {
    faculties.push({ name: '🎓 Бюджет', specialties: bud.data });
  }
  if (paid.data && paid.data.length > 0) {
    faculties.push({ name: '💰 Платное', specialties: paid.data });
  }

  if (faculties.length === 0) {
    faculties.push({ name: '🎓 Бюджет', specialties: [] });
    faculties.push({ name: '💰 Платное', specialties: [] });
  }

  return faculties;
}

// ==================== SHOW FUNCTIONS ====================
async function showUniversityHome(ctx, univId) {
  const univ = UNIVERSITIES[univId];
  await safeEditMessage(ctx, `${univ.emoji} *${univ.name}*\n\nВыбери действие:`, {
    parse_mode: 'Markdown',
    ...universityHomeKeyboard(univId),
  });
}

async function showFacultyList(ctx, univId, forceRefresh = false) {
  const univ = UNIVERSITIES[univId];
  let faculties, error;

  if (univId === 'gsu') {
    const result = await getGSUData(forceRefresh);
    faculties = result.data;
    error = result.error;
  } else if (univId === 'gstu') {
    faculties = await getGSTUFaculties(forceRefresh);
    error = null;
  }

  if (error && faculties.length === 0) {
    await safeEditMessage(ctx, `❌ Ошибка при получении данных ${univ.name}. Попробуй ещё раз чуть позже.`, startKeyboard());
    return;
  }

  if (faculties.length === 0) {
    await safeEditMessage(ctx, '⚠️ Данные не найдены или изменилась структура источника.', startKeyboard());
    return;
  }

  await safeEditMessage(ctx, `${univ.emoji} *${univ.name}*\n\nВыбери факультет:`, {
    parse_mode: 'Markdown',
    ...facultyListKeyboard(faculties, univId),
  });
}

async function showSpecialtyList(ctx, univId, facultyIndex = 0, forceRefresh = false) {
  let faculties;
  
  if (univId === 'gsu') {
    const result = await getGSUData(forceRefresh);
    faculties = result.data.map(f => ({ name: f.name, specialties: f.specialties }));
  } else if (univId === 'gstu') {
    faculties = await getGSTUFaculties(forceRefresh);
  }

  const faculty = faculties[facultyIndex];
  if (!faculty) {
    await showFacultyList(ctx, univId, forceRefresh);
    return;
  }

  await safeEditMessage(ctx, `🏫 *${faculty.name}*\n\nВыбери специальность:`, {
    parse_mode: 'Markdown',
    ...specialtyListKeyboard(faculty, facultyIndex, univId),
  });
}

async function showSpecialtyCard(ctx, univId, facultyIndex = 0, specIndex = 0, forceRefresh = false) {
  let faculties;

  if (univId === 'gsu') {
    const result = await getGSUData(forceRefresh);
    faculties = result.data.map(f => ({ name: f.name, specialties: f.specialties }));
  } else if (univId === 'gstu') {
    faculties = await getGSTUFaculties(forceRefresh);
  }

  const faculty = faculties[facultyIndex];
  const specialty = faculty && faculty.specialties[specIndex];

  if (!specialty) {
    await showFacultyList(ctx, univId, forceRefresh);
    return;
  }

  await safeEditMessage(ctx, formatSpecialtyCard(specialty), {
    parse_mode: 'Markdown',
    ...specialtyCardKeyboard(facultyIndex, univId),
  });
}

// ==================== BOT ACTIONS ====================
bot.start((ctx) => {
  ctx.reply('Привет! Выбери университет:', startKeyboard());
});

bot.action('go_start', async (ctx) => {
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, 'Привет! Выбери университет:', startKeyboard());
});

// Generic handlers for both universities
bot.action(/^(gsu|gstu)_open_faculties$/, async (ctx) => {
  await ctx.answerCbQuery();
  const univId = ctx.match[1];
  await safeEditMessage(ctx, '⏳ Загрузка...');
  await showFacultyList(ctx, univId);
});

bot.action(/^(gsu|gstu)_refresh$/, async (ctx) => {
  await ctx.answerCbQuery('Обновляю данные...');
  const univId = ctx.match[1];
  await safeEditMessage(ctx, '⏳ Загрузка...');
  await showFacultyList(ctx, univId, true);
});

bot.action(/^(gsu|gstu)_back_faculties$/, async (ctx) => {
  await ctx.answerCbQuery();
  const univId = ctx.match[1];
  await showFacultyList(ctx, univId);
});

bot.action(/^(gsu|gstu)_f_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const univId = ctx.match[1];
  const facIndex = parseInt(ctx.match[2], 10);
  await showSpecialtyList(ctx, univId, facIndex);
});

bot.action(/^(gsu|gstu)_s_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const univId = ctx.match[1];
  const facIndex = parseInt(ctx.match[2], 10);
  const specIndex = parseInt(ctx.match[3], 10);
  await showSpecialtyCard(ctx, univId, facIndex, specIndex);
});

// University home actions
bot.action('get_gsu', async (ctx) => {
  await ctx.answerCbQuery(`Открываю ${UNIVERSITIES.gsu.name}...`);
  await safeEditMessage(ctx, '⏳ Загрузка...');
  await showUniversityHome(ctx, 'gsu');
});

bot.action('get_gstu', async (ctx) => {
  await ctx.answerCbQuery(`Открываю ${UNIVERSITIES.gstu.name}...`);
  await safeEditMessage(ctx, '⏳ Загрузка данных из PDF...');
  await showUniversityHome(ctx, 'gstu');
});

// ==================== SERVER ====================
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegraf/${bot.secretPathComponent()}`;
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}` : '';

if (process.env.NODE_ENV === 'production' && WEBHOOK_URL) {
  bot.telegram.setWebhook(WEBHOOK_URL)
    .then(() => console.log('Webhook установлен на:', WEBHOOK_URL))
    .catch((error) => console.error('Webhook error:', error));

  http.createServer((req, res) => {
    if (req.url === WEBHOOK_PATH) {
      return bot.webhookCallback(WEBHOOK_PATH)(req, res);
    }
    res.writeHead(200);
    res.end('Bot is running');
  }).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} else {
  bot.launch().then(() => {
    console.log('Bot launched in polling mode');
  }).catch((error) => {
    console.error('Bot launch error:', error);
    process.exit(1);
  });
}
