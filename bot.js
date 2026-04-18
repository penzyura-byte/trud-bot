const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");

// ====== CONFIG ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);
const MANAGER_CHAT_URL = process.env.MANAGER_CHAT_URL || "https://t.me/UAGA_B";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing");
if (!PUBLIC_URL) throw new Error("PUBLIC_URL missing");
if (!WEBAPP_URL) throw new Error("WEBAPP_URL missing");
if (!WORK_CHAT_ID) throw new Error("WORK_CHAT_ID missing");

// ====== INIT ======
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegram/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

// ====== HEALTH ======
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ====== ПРИЕМ ЗАЯВОК ======
app.post("/order", async (req, res) => {
  console.log("🔥 ПОЛУЧЕН ЗАПРОС:", req.body);

  const { order, user } = req.body;
  if (!order) return res.sendStatus(400);

  // ====== USER DATA ======
  const userLabel = user?.username
    ? `@${user.username}`
    : (user?.first_name || "Клиент");

  const userLink = user?.username
    ? `https://t.me/${user.username}`
    : `tg://user?id=${user?.id}`;

  // ====== MESSAGE ======
  const text = `
💸 Заявка Trud Exchange

${order.from} → ${order.to}

Сумма: ${order.amount}
Режим: ${order.mode === "give" ? "Отдаёт" : "Получает"}

${order.resultText || ""}
${order.subResultText || ""}
${order.feeText || ""}

${order.sendRubMethod ? "Отправка: " + order.sendRubMethod : ""}
${order.sendCity ? "Город отправки: " + order.sendCity : ""}

${order.receiveMethod ? "Получение: " + order.receiveMethod : ""}
${order.receiveCity ? "Город получения: " + order.receiveCity : ""}
${order.receiveDetails ? "Детали: " + order.receiveDetails : ""}
${order.network ? "Сеть: " + order.network : ""}

👤 Клиент: ${userLabel}
🔗 Профиль: ${userLink}
`;

  try {
    await bot.sendMessage(WORK_CHAT_ID, text);
    console.log("✅ Заявка отправлена");

    // ответ клиенту
    if (user?.id) {
      await bot.sendMessage(user.id, "✅ Ваша заявка принята менеджером", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Новая заявка", web_app: { url: WEBAPP_URL } },
              { text: "Написать менеджеру", url: MANAGER_CHAT_URL }
            ]
          ]
        }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("❌ Ошибка отправки:", err.response?.body || err);
    res.sendStatus(500);
  }
});

// ====== TELEGRAM WEBHOOK ======
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ====== START ======
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть форму:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Открыть форму",
            web_app: { url: WEBAPP_URL }
          }
        ]
      ]
    }
  });
});

// ====== CALLBACK (НА БУДУЩЕЕ) ======
bot.on("callback_query", async (query) => {
  await bot.answerCallbackQuery(query.id);
});

// ====== START SERVER ======
app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);

  try {
    await bot.setWebHook(WEBHOOK_URL);
    console.log("✅ Webhook установлен:", WEBHOOK_URL);
  } catch (e) {
    console.log("❌ Ошибка webhook:", e.response?.body || e);
  }
});
