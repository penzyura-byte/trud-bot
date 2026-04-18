const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);

const bot = new TelegramBot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegram/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

// счетчик
let orderCounter = 1;
try {
  const data = fs.readFileSync("counter.json");
  orderCounter = JSON.parse(data).counter || 1;
} catch {}

function saveCounter() {
  fs.writeFileSync("counter.json", JSON.stringify({ counter: orderCounter }));
}

app.get("/", (req, res) => res.send("Bot is running"));

// заявка
app.post("/order", async (req, res) => {
  const { order, user } = req.body;

  if (!order || !user || !user.id) {
    console.log("❌ USER NULL:", user);
    return res.sendStatus(400);
  }

  const orderId = orderCounter++;
  saveCounter();

  const userId = user.id;

  const userLabel = user.username
    ? `@${user.username}`
    : `${user.first_name || ""} ${user.last_name || ""}`.trim() || `ID:${userId}`;

  const clean = (t, r) => (t ? t.replace(r, "").trim() : "-");

  const text = `
📨 Заявка №${orderId}

👤 Клиент: ${userLabel}

💱 ${order.from} → ${order.to}

💸 Отдаёт: ${order.amount} ${order.from}
💰 Получает: ${clean(order.resultText, "К получению:")}

💼 Комиссия: ${clean(order.feeText, "Комиссия:")}
`;

  await bot.sendMessage(WORK_CHAT_ID, text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "💬 Открыть чат",
            callback_data: `contact:${userId}`
          }
        ],
        [
          { text: "🟢 В работу", callback_data: "take" },
          { text: "❌ Закрыта", callback_data: "close" }
        ]
      ]
    }
  });

  res.sendStatus(200);
});

// кнопки
bot.on("callback_query", async (q) => {
  const data = q.data;

  if (data.startsWith("contact")) {
    const [, userId] = data.split(":");

    if (!userId || userId === "null") {
      await bot.answerCallbackQuery(q.id, {
        text: "Нет данных пользователя",
        show_alert: true
      });
      return;
    }

    const link = `tg://openmessage?user_id=${userId}`;

    await bot.sendMessage(q.from.id, `👉 Открыть чат:\n${link}`);
  }

  if (data === "take") {
    await bot.editMessageText(q.message.text + "\n\n🟢 В работе", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id
    });
  }

  if (data === "close") {
    await bot.deleteMessage(q.message.chat.id, q.message.message_id);
  }

  await bot.answerCallbackQuery(q.id);
});

// webhook
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// старт
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть форму:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Открыть", web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

app.listen(PORT, async () => {
  console.log("Server running");
  await bot.setWebHook(WEBHOOK_URL);
});
