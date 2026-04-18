const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");

// ===== CONFIG =====
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

// 🔢 глобальный счётчик
let orderCounter = 1;

// ===== SERVER =====
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ===== ФОРМАТИРОВАНИЕ =====
function cleanText(text, remove) {
  if (!text) return "-";
  return text.replace(remove, "").trim();
}

// ===== ЗАЯВКА =====
app.post("/order", async (req, res) => {
  const { order, user } = req.body;
  if (!order) return res.sendStatus(400);

  // 👤 пользователь (фикс)
  const userLabel = user?.username
    ? `@${user.username}`
    : `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || `ID:${user?.id}`;

  const userLink = user?.username
    ? `https://t.me/${user.username}`
    : `tg://user?id=${user?.id}`;

  // 🔢 номер заявки
  const orderId = orderCounter++;

  // 💸 чистка текста
  const receiveAmount = cleanText(order.resultText, "К получению:");
  const giveAmount = cleanText(order.subResultText, "Вы отдаёте:");
  const fee = cleanText(order.feeText, "Комиссия:");

  const text = `
📨 Заявка №${orderId}

👤 Клиент: ${userLabel}
🔗 ${userLink}

💱 ${order.from} → ${order.to}

💸 Отдаёт: ${order.amount} ${order.from}
💰 Получает: ${receiveAmount}

💼 Комиссия: ${fee}

📦 Отправка:
${order.sendRubMethod || "-"} ${order.sendCity || ""}

📥 Получение:
${order.receiveMethod || "-"} ${order.receiveCity || ""}
${order.receiveDetails || ""}
${order.network || ""}
`;

  try {
    await bot.sendMessage(WORK_CHAT_ID, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🟢 В работу", callback_data: `take:${orderId}` },
            { text: "❌ Закрыта", callback_data: `close:${orderId}` }
          ]
        ]
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

// ===== КНОПКИ =====
bot.on("callback_query", async (query) => {
  const [action, id] = query.data.split(":");

  if (action === "take") {
    await bot.editMessageText(
      query.message.text + "\n\n🟢 Статус: В работе",
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Завершена", callback_data: `done:${id}` }
            ]
          ]
        }
      }
    );
  }

  if (action === "done") {
    await bot.editMessageText(
      query.message.text + "\n\n✅ Статус: Завершена",
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: { inline_keyboard: [] }
      }
    );
  }

  if (action === "close") {
    await bot.deleteMessage(
      query.message.chat.id,
      query.message.message_id
    );
  }

  await bot.answerCallbackQuery(query.id);
});

// ===== TELEGRAM =====
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== START =====
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

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log("Server running", PORT);

  try {
    await bot.setWebHook(WEBHOOK_URL);
    console.log("Webhook установлен");
  } catch (e) {
    console.log(e);
  }
});
