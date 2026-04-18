const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

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

// ===== СЧЁТЧИК =====
let orderCounter = 1;

try {
  const data = fs.readFileSync("counter.json");
  orderCounter = JSON.parse(data).counter || 1;
} catch (e) {}

function saveCounter() {
  fs.writeFileSync("counter.json", JSON.stringify({ counter: orderCounter }));
}

// ===== SERVER =====
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ===== ЗАЯВКА =====
app.post("/order", async (req, res) => {
  const { order, user } = req.body;
  if (!order) return res.sendStatus(400);

  const orderId = orderCounter++;
  saveCounter();

  const userId = user?.id;

  const userLabel = user?.username
    ? `@${user.username}`
    : `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || `ID:${userId}`;

  const clean = (t, r) => (t ? t.replace(r, "").trim() : "-");

  const receive = clean(order.resultText, "К получению:");
  const fee = clean(order.feeText, "Комиссия:");

  const text = `
📨 Заявка №${orderId}

👤 Клиент: ${userLabel}

💱 ${order.from} → ${order.to}

💸 Отдаёт: ${order.amount} ${order.from}
💰 Получает: ${receive}

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
            {
              text: "💬 Написать клиенту",
              url: `tg://user?id=${userId}`
            }
          ],
          [
            {
              text: "✉️ Ответить (шаблон)",
              callback_data: `reply:${userId}:${orderId}`
            }
          ],
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
bot.on("callback_query", async (q) => {
  const data = q.data;

  if (data.startsWith("reply")) {
    const [, userId, orderId] = data.split(":");

    try {
      await bot.sendMessage(userId, `Здравствуйте! Ваша заявка №${orderId} принята в работу. Сейчас уточняем детали и скоро свяжемся с вами.`);
      await bot.answerCallbackQuery(q.id, { text: "Ответ отправлен" });
    } catch (e) {
      await bot.answerCallbackQuery(q.id, { text: "Клиент не писал боту", show_alert: true });
    }
  }

  if (data.startsWith("take")) {
    await bot.editMessageText(
      q.message.text + "\n\n🟢 Статус: В работе",
      {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Завершена", callback_data: `done` }]
          ]
        }
      }
    );
  }

  if (data.startsWith("done")) {
    await bot.editMessageText(
      q.message.text + "\n\n✅ Статус: Завершена",
      {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: { inline_keyboard: [] }
      }
    );
  }

  if (data.startsWith("close")) {
    await bot.deleteMessage(q.message.chat.id, q.message.message_id);
  }

  await bot.answerCallbackQuery(q.id);
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
        [{ text: "🚀 Открыть форму", web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log("Server running");

  try {
    await bot.setWebHook(WEBHOOK_URL);
  } catch (e) {
    console.log(e);
  }
});
