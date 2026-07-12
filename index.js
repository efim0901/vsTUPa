const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const iconv = require('iconv-lite');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Настройка для обхода блокировок SSL
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
});

const URLS = {
    gsu_plat: 'https://old.gsu.by/dinamika/konkurs/dn-plat.html',
    gstu: 'https://abiturient.gstu.by/course-of-documents-acceptance'
};

// ==========================================
// Генерация диапазонов баллов
// ==========================================
// На сайте ГГУ таблица содержит колонки-диапазоны баллов:
// "396 и более", "391-395", "386-390", ... "51-55", "1-50"
// (последняя подпись "1-50" — как реально написано в шапке таблицы на сайте)
// Генерируем этот список программно, чтобы не хардкодить 70+ строк.
function generateScoreBands(topMin, bottomMax, step) {
    const bands = [`${topMin} и более`];
    let upper = topMin - 1;
    while (upper - step + 1 > bottomMax) {
        const lower = upper - step + 1;
        bands.push(`${lower}-${upper}`);
        upper -= step;
    }
    bands.push(`1-${bottomMax}`);
    return bands;
}

// Полный список подписей колонок в строке данных, ИДУЩИЙ ПОСЛЕ названия специальности.
// Проверено на реальном HTML сайта (main_table): после названия у каждой строки данных
// идёт ровно 76 ячеек: План приема, Подано заявлений (ВСЕГО), без экзаменов, вне конкурса,
// по конкурсу, и затем 71 диапазон баллов ("396 и более" ... "1-50").
const DATA_COLUMN_LABELS = [
    'План приема',
    'Подано заявлений',
    'без экзаменов',
    'вне конкурса',
    'по конкурсу',
    ...generateScoreBands(396, 50, 5)
];
const SCORE_BANDS_START = 5; // индекс, с которого в DATA_COLUMN_LABELS начинаются баллы

// Функция парсинга ГГУ
async function parseGSU() {
    try {
        const { data } = await axiosInstance.get(URLS.gsu_plat);
        const $ = cheerio.load(data);

        const results = [];

        // ВАЖНО: работаем только с телом основной таблицы результатов (#main_table_body).
        // На странице есть и другие таблицы (например, #table_info с шапкой/датой) —
        // если парсить все <table> на странице скопом, туда попадает мусор.
        $('#main_table_body tr').each((index, element) => {
            const cols = $(element).find('td');
            const cellTexts = cols
                .map((i, el) => $(el).text().trim().replace(/\s+/g, ' '))
                .get();

            if (cellTexts.length === 0) return;

            // Строка-разделитель факультета — всего одна широкая ячейка (colspan на всю таблицу)
            if (cellTexts.length === 1) {
                results.push({ type: 'faculty', name: cellTexts[0] });
                return;
            }

            // Ищем ячейку с названием специальности — первая с 3+ кириллическими буквами
            // (перед ней могут быть 0, 1 или 2 числовых кода группы специальностей —
            // они присутствуют не в каждой строке из-за rowspan)
            const nameIndex = cellTexts.findIndex(t => /[А-Яа-яЁё]{3,}/.test(t));
            if (nameIndex === -1) return;

            const name = cellTexts[nameIndex];
            const after = cellTexts.slice(nameIndex + 1);

            if (after.length < DATA_COLUMN_LABELS.length) return; // строка не той структуры — пропускаем

            const plan = after[0] || '0';
            const submittedTotal = after[1] || '0';

            const scoreBreakdown = DATA_COLUMN_LABELS
                .slice(SCORE_BANDS_START)
                .map((label, i) => ({ label, count: parseInt(after[SCORE_BANDS_START + i], 10) || 0 }))
                .filter(b => b.count > 0)
                .map(b => `${b.label}: ${b.count}`)
                .join(', ');

            results.push({
                type: 'specialty',
                name,
                plan,
                submittedTotal,
                scoreBreakdown
            });
        });

        if (results.length === 0) {
            return '⚠️ Данные не найдены или изменилась структура сайта.';
        }

        let text = '📊 *ГГУ (Платное - Дневное):*\n\n';
        for (const r of results) {
            if (r.type === 'faculty') {
                text += `\n🏫 *${r.name}*\n`;
                continue;
            }
            text += `🔹 *${r.name}*\n`;
            text += `План: ${r.plan} | Подано: ${r.submittedTotal}\n`;
            text += r.scoreBreakdown
                ? `Баллы подавших: ${r.scoreBreakdown}\n`
                : `Баллы подавших: нет данных\n`;
            text += `\n`;
        }

        return text;
    } catch (e) {
        console.error(e);
        return '❌ Ошибка при получении данных ГГУ.';
    }
}

// Функция парсинга ГГТУ
async function parseGSTU() {
    try {
        const { data } = await axiosInstance.get(URLS.gstu);
        const $ = cheerio.load(data);
        let results = '📊 *Сводка по ГГТУ им. Сухого:*\n\n';

        $('table tbody tr').each((index, element) => {
            if (index === 0) return;
            const cols = $(element).find('td');
            if (cols.length >= 3) {
                const title = $(cols[0]).text().trim().replace(/\n/g, ' ');
                const plan = $(cols[1]).text().trim();
                const apps = $(cols[2]).text().trim();
                if (title && plan) {
                    results += `🔸 *${title}*\nПлан: ${plan} | Подано: ${apps}\n\n`;
                }
            }
        });
        return results === '📊 *Сводка по ГГТУ им. Сухого:*\n\n' ? '⚠️ Данные не найдены.' : results;
    } catch (e) {
        return '❌ Ошибка при получении данных ГГТУ.';
    }
}

// Интерфейс бота
bot.start((ctx) => {
    ctx.reply(
        'Привет! Выбери университет:',
        Markup.inlineKeyboard([
            [Markup.button.callback('🏛 ГГУ им. Скорины', 'get_gsu')],
            [Markup.button.callback('⚙️ ГГТУ им. Сухого', 'get_gstu')]
        ])
    );
});

bot.action('get_gsu', async (ctx) => {
    await ctx.answerCbQuery('Собираю данные...');
    const message = await ctx.reply('⏳ Загрузка...');
    const data = await parseGSU();
    const chunks = data.match(/[\s\S]{1,4000}/g) || [];
    await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, chunks[0], { parse_mode: 'Markdown' });
    for (let i = 1; i < chunks.length; i++) await ctx.reply(chunks[i], { parse_mode: 'Markdown' });
});

bot.action('get_gstu', async (ctx) => {
    await ctx.answerCbQuery('Собираю данные...');
    const message = await ctx.reply('⏳ Загрузка...');
    const data = await parseGSTU();
    const chunks = data.match(/[\s\S]{1,4000}/g) || [];
    await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, chunks[0], { parse_mode: 'Markdown' });
    for (let i = 1; i < chunks.length; i++) await ctx.reply(chunks[i], { parse_mode: 'Markdown' });
});

// ==========================================
// НАСТРОЙКА WEBHOOK ДЛЯ RENDER
// ==========================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegraf/${bot.secretPathComponent()}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

// Устанавливаем Webhook в Telegram
bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log('Webhook успешно установлен на:', WEBHOOK_URL);
});

// Запускаем сервер
http.createServer((req, res) => {
    if (req.url === WEBHOOK_PATH) {
        return bot.webhookCallback(WEBHOOK_PATH)(req, res);
    }
    res.writeHead(200);
    res.end('Bot is running');
}).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
