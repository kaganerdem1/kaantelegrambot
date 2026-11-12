// index.js - Telegram Quiz Botu (Spam Engeline Takılmayan Sürüm)
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

// --- Soruları Yükle ---
let soruBankasi = {};
try {
    soruBankasi = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    console.log("✅ Soru bankası başarıyla yüklendi.");
} catch (err) {
    console.log("❌ Hata: questions.json bulunamadı veya formatı bozuk!");
}

// --- Aktif Test Değişkenleri ---
let aktifTest = null;
let aktifSoruIndex = 0;

// --- /sor Komutu ile Üniteleri Göster ---
bot.onText(/\/sor/, (msg) => {
    if (msg.chat.id.toString() !== groupId.toString()) return;

    const uniteler = Object.keys(soruBankasi);
    if (uniteler.length === 0) return bot.sendMessage(groupId, "❌ Soru bankası boş veya yüklenemedi.");

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

        bot.editMessageText(`✅ **${uniteAdi} - ${testAdi}** başlıyor! Sorular arka arkaya geliyor...`, {
            chat_id: chatId,
            message_id: messageId
        });

        sorulariGonder(chatId);
    }
});

// --- Telegram Quiz (Anket) Formatında Soru Gönderme ---
async function sorulariGonder(chatId) {
    if (!aktifTest || aktifSoruIndex >= aktifTest.length) {
        bot.sendMessage(chatId, "🎉 **Test bitti!** Başka bir test için /sor yazabilirsin.");
        return;
    }

    // Testteki her soru için Telegram Anketi oluştur
    for (let i = 0; i < aktifTest.length; i++) {
        const soru = aktifTest[i];

        try {
            // Telegram anket formatına çeviriyoruz
            await bot.sendPoll(chatId, 
                `Soru ${i + 1}: ${soru.question}`, // Soru başlığı
                soru.options,                      // Şıklar (A, B, C, D)
                {
                    type: 'quiz',                  // Tip: Quiz (Sınav) - En önemlisi bu!
                    correct_option_id: soru.correct, // Doğru cevabın indeksi (0 = A, 1 = B)
                    is_anonymous: false,           // Kimin ne seçtiği görünsün (avatar için)
                    explanation: `Doğru cevap: ${soru.options[soru.correct]}` // Açıklama
                }
            );

            // 🚨 ÖNEMLİ: Telegram spam engeline takılmamak için 2.5 saniye bekle
            await new Promise(resolve => setTimeout(resolve, 2500)); 
            
        } catch (error) {
            console.error(`Soru ${i + 1} gönderilirken hata oluştu:`, error.message);
            // Eğer hata alırsak biraz daha uzun bekleyip devam edelim
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Tüm sorular gönderildikten sonra testi sıfırla
    aktifTest = null;
    aktifSoruIndex = 0;
    bot.sendMessage(chatId, "✅ **Tüm sorular gönderildi!** Telegram üzerindeki sonuçları görebilirsiniz.");
}

// --- Botu Başlat ---
console.log("🤖 Telegram Quiz Botu çalışıyor...");
