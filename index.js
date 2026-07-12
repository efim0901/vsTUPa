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

// Функция парсинга ГГУ
async function parseGSU() {
    try {
        // Убрали arraybuffer и iconv, используем стандартный запрос
        const { data } = await axiosInstance.get(URLS.gsu_plat);
        const $ = cheerio.load(data);
        let results = '📊 *ГГУ (Платное - Дневное):*\n\n';

        $('table tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length >= 3) {
                const title = $(cols[0]).text().trim().replace(/\n/g, ' ');
                const plan = $(cols[1]).text().trim();
                const apps = $(cols[2]).text().trim();
                
                // Фильтруем: пропускаем заголовки, пустые строки и мусор
                const isHeader = title.toLowerCase().includes('специальность') || 
                                 title.toLowerCase().includes('форма') || 
                                 title.toLowerCase().includes('всего');
                
                if (title && !isHeader && plan !== 'План приема') {
                    results += `🔹 *${title}*\nПлан: ${plan} | Подано: ${apps}\n\n`;
                }
            }
        });
        
        return results === '📊 *ГГУ (Платное - Дневное):*\n\n' ? '⚠️ Данные не найдены или изменилась структура сайта.' : results;
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
