// index.js - Telegram Quiz Botu (Tam Metin + Quiz Formatı)
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

        bot.editMessageText(`✅ **${uniteAdi} - ${testAdi}** başlıyor! Sorular 20 saniye süreyle geliyor...`, {
            chat_id: chatId,
            message_id: messageId
        });

        sorulariGonder(chatId);
    }
});

// --- Soruları Gönderme Fonksiyonu (Tam Metin + Quiz) ---
async function sorulariGonder(chatId) {
    if (!aktifTest || aktifTest.length === 0) return;

    for (let i = 0; i < aktifTest.length; i++) {
        const soru = aktifTest[i];

        try {
            // ADIM 1: Sorunun TAMAMINI normal mesaj olarak gönder. (Karakter sınırı yok)
            await bot.sendMessage(chatId, `📝 **Soru ${i + 1}**\n\n${soru.question}`, {
                parse_mode: 'Markdown'
            });

            // Mesajların birbirine girmemesi için yarım saniye bekle
            await new Promise(resolve => setTimeout(resolve, 800));

            // ADIM 2: Hemen altına Quiz'i (Anketi) başlat. (Görseldeki gibi)
            // Soru metni kısmına kısa bir yönlendirme yazıyoruz ki 300 karakter sınırına takılmasın.
            await bot.sendPoll(chatId, 
                `Soru ${i + 1} için doğru cevap hangisidir?`, 
                soru.options, 
                {
                    type: 'quiz',
                    correct_option_id: soru.correct,
                    is_anonymous: false, // Avatarların görünmesi için
                    open_period: 20,     // 20 saniye süre
                    explanation: `Doğru cevap: ${soru.options[soru.correct]}`
                }
            );

            // Bir sonraki soruya geçmeden önce 22 saniye bekle (20 sn oylama + 2 sn sonuçları görme)
            await new Promise(resolve => setTimeout(resolve, 22000)); 
            
        } catch (error) {
            console.error(`Soru ${i + 1} gönderilirken hata oluştu:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    aktifTest = null;
    bot.sendMessage(chatId, "✅ **Tüm sorular gönderildi!** Telegram üzerindeki sonuçları görebilirsiniz.");
}

// --- Botu Başlat ---
console.log("🤖 Telegram Quiz Botu çalışıyor...");
