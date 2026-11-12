require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');

// --- Render Uyku Modunu Engelleme ---
const app = express();
app.get('/', (req, res) => res.send('Telegram Bot Aktif!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Web sunucusu ${PORT} portunda çalışıyor.`));

// --- Telegram Botu ---
const token = process.env.TELEGRAM_TOKEN;
const groupId = process.env.GROUP_ID;
const bot = new TelegramBot(token, { polling: true });

// --- Soruları Yükle ---
let questions = [];
try {
    questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
} catch (err) {
    console.log("Hata: questions.json bulunamadı veya okunamadı!");
}

// --- Rastgele Soru Sorma Fonksiyonu ---
async function askQuestion() {
    if (questions.length === 0) return console.log("Soru bulunamadı!");

    // Rastgele bir soru seç
    const randomIndex = Math.floor(Math.random() * questions.length);
    const q = questions[randomIndex];

    // Şıkları butonlara çevir (A, B, C, D)
    const options = q.options.map((opt, index) => {
        return [{ text: opt, callback_data: `answer_${randomIndex}_${index}` }];
    });

    try {
        await bot.sendMessage(groupId, `📝 **SORU:**\n\n${q.question}`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: options
            }
        });
        console.log(`Soru gönderildi: ${q.question}`);
    } catch (error) {
        console.error("Soru sorma hatası:", error);
    }
}

// --- Butonlara Tıklanınca (Cevap Verilince) Ne Olacak? ---
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const userName = callbackQuery.from.first_name;

    // callback_data içinden soru ve şık indeksini al
    const parts = data.split('_');
    const qIndex = parseInt(parts[1]);
    const selectedIndex = parseInt(parts[2]);

    const q = questions[qIndex];

    if (selectedIndex === q.correct) {
        // DOĞRU CEVAP (YEŞİL UYARI)
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: `✅ Tebrikler ${userName}, doğru cevap!`,
            show_alert: true
        });
    } else {
        // YANLIŞ CEVAP (KIRMIZI UYARI)
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: `❌ Yanlış cevap. Doğru cevap: ${q.options[q.correct]}`,
            show_alert: true
        });
    }
});

// --- Otomatik Soru Sorma (Her gün Saat 20:00'de) ---
// Türkiye saati UTC+3 olduğu için 17:00 UTC'ye denk gelir.
cron.schedule('0 17 * * *', () => {
    askQuestion();
}, {
    timezone: "Europe/Istanbul"
});

console.log("🤖 Telegram Botu çalışıyor ve soruları bekliyor...");

// --- Test Komutu: Gruba /sor yazınca hemen soru sorar ---
bot.onText(/\/sor/, (msg) => {
    if (msg.chat.id.toString() === groupId.toString()) {
        askQuestion();
    }
});