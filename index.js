require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// --- Render Uyku Modunu Engelleme ---
const app = express();
app.get('/', (req, res) => res.send('Telegram Test Botu Aktif!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Web sunucusu ${PORT} portunda çalışıyor.`));

// --- Telegram Botu ---
const token = process.env.TELEGRAM_TOKEN;
const groupId = process.env.GROUP_ID;
const bot = new TelegramBot(token, { polling: true });

// --- Soruları Yükle ---
let soruBankasi = {};
try {
    soruBankasi = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
} catch (err) {
    console.log("Hata: questions.json bulunamadı!");
}

// --- Aktif Test Değişkenleri ---
let aktifTest = null;
let aktifSoruIndex = 0;
let cevapSuresiTimer = null;

// --- 1. ADIM: /sor komutu ile Üniteleri Göster ---
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

// --- Buton Tıklamalarını Yakala ---
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    // Ünite Seçildi
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

    // Test Seçildi, Test Başlasın
    else if (data.startsWith('testsec_')) {
        const parts = data.split('_');
        const uniteIndex = parseInt(parts[1]);
        const testIndex = parseInt(parts[2]);
        
        const uniteAdi = Object.keys(soruBankasi)[uniteIndex];
        const testAdi = Object.keys(soruBankasi[uniteAdi])[testIndex];
        
        aktifTest = soruBankasi[uniteAdi][testAdi];
        aktifSoruIndex = 0;

        bot.editMessageText(`✅ **${uniteAdi} - ${testAdi}** başlıyor!`, {
            chat_id: chatId,
            message_id: messageId
        });

        soruSor(chatId);
    }

    // Şık Seçildi (Kullanıcı cevap verdi)
    else if (data.startsWith('cevap_')) {
        const parts = data.split('_');
        const secilenIndex = parseInt(parts[1]);
        const soru = aktifTest[aktifSoruIndex];

        // Süreyi durdur
        if (cevapSuresiTimer) clearTimeout(cevapSuresiTimer);

        // Cevabı değerlendir ve soruyu bitir
        soruBitir(chatId, soru, secilenIndex, callbackQuery.id);
    }
});

// --- Soru Sorma Fonksiyonu ---
async function soruSor(chatId) {
    if (!aktifTest || aktifSoruIndex >= aktifTest.length) {
        // Test bitti
        bot.sendMessage(chatId, "🎉 **Test bitti!** Başka bir test için /sor yazabilirsin.");
        aktifTest = null;
        return;
    }

    const soru = aktifTest[aktifSoruIndex];
    const butonlar = soru.options.map((opt, index) => {
        return [{ text: opt, callback_data: `cevap_${index}` }];
    });

    const mesaj = await bot.sendMessage(chatId, `❓ **Soru ${aktifSoruIndex + 1}/${aktifTest.length}**\n\n${soru.question}\n\n⏱️ *60 saniye içinde cevapla!*`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: butonlar }
    });

    // 60 Saniye Zamanlayıcı Başlat
    cevapSuresiTimer = setTimeout(() => {
        // Süre bitince cevap verilmedi, soruyu bitir (secilenIndex -1 = boş)
        soruBitir(chatId, soru, -1, null);
    }, 60000); // 60000 ms = 60 saniye
}

// --- Soru Bittiğinde (Doğru Cevabı Göster ve Sonraki Soruya Geç) ---
async function soruBitir(chatId, soru, secilenIndex, callbackId) {
    const dogruIndex = soru.correct;

    // Eğer buton tıklandıysa "Kutucuk işaretlensin" efekti için butonları düzenle
    if (callbackId) {
        if (secilenIndex === dogruIndex) {
            bot.answerCallbackQuery(callbackId, { text: "✅ Doğru!", show_alert: false });
        } else {
            bot.answerCallbackQuery(callbackId, { text: "❌ Yanlış!", show_alert: false });
        }
    }

    // Butonları güncelle (Yeşil İşaret)
    const yeniButonlar = soru.options.map((opt, index) => {
        if (index === dogruIndex) {
            return [{ text: `✅ ${opt}`, callback_data: 'bitti' }]; // Doğru cevap yeşil tikli
        } else if (index === secilenIndex) {
            return [{ text: `❌ ${opt}`, callback_data: 'bitti' }]; // Yanlış seçilen kırmızı çarpılı
        } else {
            return [{ text: opt, callback_data: 'bitti' }];
        }
    });

    await bot.sendMessage(chatId, `🔔 **Soru ${aktifSoruIndex + 1} Bitti!**\nDoğru Cevap: **${soru.options[dogruIndex]}**`, {
        reply_markup: { inline_keyboard: yeniButonlar }
    });

    // Sonraki Soruya Geç
    aktifSoruIndex++;
    
    // Kısa bir süre bekle, sonra sonraki soruyu sor
    setTimeout(() => {
        soruSor(chatId);
    }, 2000); // 2 saniye bekle
}

console.log("🤖 Telegram Test Botu çalışıyor...");
