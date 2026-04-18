const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();
app.use(express.json());

// 🚀 API ДЛЯ ПРИЁМА ЗАЯВОК
app.post("/order", async (req, res) => {
  const { order, user } = req.body;

  if (!order) return res.sendStatus(400);

  const username = user?.username
    ? `@${user.username}`
    : "без username";

  const userLink = user?.username
    ? `https://t.me/${user.username}`
    : "нет ссылки";

  const text = `
💸 Заявка

${order.from} → ${order.to}

Сумма: ${order.amount}
Режим: ${order.mode}

${order.resultText || ""}
${order.subResultText || ""}
${order.feeText || ""}

👤 Клиент: ${username}
🔗 Профиль: ${userLink}
`;

  try {
    await bot.sendMessage(WORK_CHAT_ID, text);
    console.log("✅ Заявка отправлена");
    res.sendStatus(200);
  } catch (err) {
    console.log("❌ Ошибка:", err);
    res.sendStatus(500);
  }
});

// запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running", PORT));

// кнопка открытия формы
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть форму:", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "🚀 Открыть",
          web_app: { url: process.env.WEBAPP_URL }
        }
      ]]
    }
  });
});

console.log("Bot is running...");
