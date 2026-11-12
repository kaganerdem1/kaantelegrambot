// index.js - Sıfırdan Yazılmış Telegram Quiz Botu
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// --- Render Uyku Modunu Engelleme ---
const app = express();
app.get('/', (req, res) => res.send('Telegram Quiz Botu Aktif!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Web sunucusu ${PORT} portunda çalışıyor.`));

// --- Telegram Botu ---
const token = process.env.TELEGRAM_TOKEN;
const groupId = process.env.GROUP_ID;
const bot = new TelegramBot(token, { polling: true });

// --- Soru Bankasını Yükle ---
let soruBankasi = {};
try {
    soruBankasi = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    console.log("✅ Soru bankası başarıyla yüklendi.");
} catch (err) {
    console.log("❌ Hata: questions.json bulunamadı veya JSON formatı bozuk!");
}

// --- Test Durumunu Takip Etmek İçin ---
let aktifTest = null;
let aktifSoruIndex = 0;

// --- /sor Komutu: Üniteleri Listele ---
bot.onText(/\/sor/, (msg) => {
    if (msg.chat.id.toString() !== groupId.toString()) return;

    const uniteler = Object.keys(soruBankasi);
    if (uniteler.length === 0) return bot.sendMessage(groupId, "❌ Soru bankası boş.");

    const butonlar = uniteler.map((unite, index) => {
        return [{ text: unite, callback_data: `unite_${index}` }];
    });

    bot.sendMessage(groupId, "📚 **Hangi Üniteden Test Çözmek İstiyorsun?**", {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: butonlar }
    });
});

// --- Buton Tıklamalarını Dinle ---
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    // 1. Ünite Seçildi
    if (data.startsWith('unite_')) {
        const uniteIndex = parseInt(data.split('_')[1]);
        const uniteAdi = Object.keys(soruBankasi)[uniteIndex];
        const testler = Object.keys(soruBankasi[uniteAdi]);

        const butonlar = testler.map((test, index) => {
            return [{ text: test, callback_data: `testsec_${uniteIndex}_${index}` }];
        });

        bot.editMessageText(`📚 **${uniteAdi}**\nŞimdi bir test seç:`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: butonlar }
        });
    }

    // 2. Test Seçildi, Sınav Başlasın
    else if (data.startsWith('testsec_')) {
        const parts = data.split('_');
        const uniteIndex = parseInt(parts[1]);
        const testIndex = parseInt(parts[2]);
        
        const uniteAdi = Object.keys(soruBankasi)[uniteIndex];
        const testAdi = Object.keys(soruBankasi[uniteAdi])[testIndex];
        
        aktifTest = soruBankasi[uniteAdi][testAdi];
        aktifSoruIndex = 0;

        bot.editMessageText(`✅ **${uniteAdi} - ${testAdi}** başlıyor! Sorular tam metin olarak geliyor...`, {
            chat_id: chatId,
            message_id: messageId
        });

        sorulariGonder(chatId);
    }

    // 3. Cevap Şıkkına Tıklandığında
    else if (data.startsWith('cevap_')) {
        const secilenIndex = parseInt(data.split('_')[1]);
        const soru = aktifTest[aktifSoruIndex];

        if (secilenIndex === soru.correct) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: "✅ Doğru!",
                show_alert: true
            });
        } else {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `❌ Yanlış. Doğru cevap: ${soru.options[soru.correct]}`,
                show_alert: true
            });
        }
    }
});

// --- Soruları Gönderme Fonksiyonu ---
async function sorulariGonder(chatId) {
    if (!aktifTest || aktifSoruIndex >= aktifTest.length) {
        bot.sendMessage(chatId, "🎉 **Test bitti!** Başka bir test için /sor yazabilirsin.");
        return;
    }

    for (let i = 0; i < aktifTest.length; i++) {
        const soru = aktifTest[i];
        aktifSoruIndex = i;

        // Şıkları butonlara çevir
        const options = soru.options.map((opt, index) => {
            return [{ text: opt, callback_data: `cevap_${index}` }];
        });

        try {
            // Soruyu TAM METİN olarak gönder (Kısıtlama yok!)
            await bot.sendMessage(chatId, `❓ **Soru ${i + 1}**\n\n${soru.question}`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: options }
            });

            // Sonraki soruya geçmeden 60 saniye bekle
            await new Promise(resolve => setTimeout(resolve, 60000)); 
            
        } catch (error) {
            console.error(`Soru ${i + 1} gönderilirken hata oluştu:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Test bittiğinde sıfırla
    aktifTest = null;
    aktifSoruIndex = 0;
    bot.sendMessage(chatId, "✅ **Tüm sorular gönderildi!** Telegram üzerindeki sonuçları görebilirsiniz.");
}

// --- Botu Başlat ---
console.log("🤖 Telegram Quiz Botu çalışıyor...");
