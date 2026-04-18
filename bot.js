const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
if (!PUBLIC_URL) throw new Error("PUBLIC_URL is missing");
if (!WEBAPP_URL) throw new Error("WEBAPP_URL is missing");
if (!Number.isFinite(WORK_CHAT_ID)) throw new Error("WORK_CHAT_ID is missing or invalid");

const bot = new TelegramBot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegram/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

let orderCounter = 1;
try {
  const data = fs.readFileSync("counter.json", "utf8");
  orderCounter = JSON.parse(data).counter || 1;
} catch {}

function saveCounter() {
  fs.writeFileSync("counter.json", JSON.stringify({ counter: orderCounter }));
}

function parseInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    try {
      return JSON.parse(userRaw);
    } catch {
      return JSON.parse(decodeURIComponent(userRaw));
    }
  } catch {
    return null;
  }
}

function clean(text, prefix) {
  if (!text) return "-";
  return text.replace(prefix, "").trim();
}

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

app.post("/order", async (req, res) => {
  try {
    const { order, initData, user } = req.body || {};
    const tgUser = parseInitData(initData) || user || null;

    if (!order) {
      return res.status(400).json({ ok: false, error: "order missing" });
    }

    const orderId = orderCounter++;
    saveCounter();

    const userId = tgUser?.id || null;
    const userLabel = tgUser?.username
      ? `@${tgUser.username}`
      : `${tgUser?.first_name || ""} ${tgUser?.last_name || ""}`.trim() || (userId ? `ID:${userId}` : "Клиент");

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

    const keyboard = [
      ...(userId ? [[{ text: "💬 Открыть чат", callback_data: `contact:${userId}` }]] : []),
      [
        { text: "🟢 В работу", callback_data: `take:${orderId}` },
        { text: "❌ Закрыта", callback_data: `close:${orderId}` }
      ]
    ];

    await bot.sendMessage(WORK_CHAT_ID, text, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.log("ORDER SEND ERROR:", err.response?.body || err);
    return res.status(500).json({
      ok: false,
      error: err.response?.body?.description || err.message || "unknown error"
    });
  }
});

bot.on("callback_query", async (q) => {
  const data = String(q.data || "");

  if (data.startsWith("contact:")) {
    const userId = data.split(":")[1];
    if (!userId || userId === "null") {
      await bot.answerCallbackQuery(q.id, { text: "Нет данных пользователя", show_alert: true });
      return;
    }
    const link = `tg://openmessage?user_id=${userId}`;
    await bot.sendMessage(q.from.id, `Открыть чат:\n${link}`);
  }

  if (data.startsWith("take:")) {
    await bot.editMessageText(q.message.text + "\n\n🟢 Статус: В работе", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: {
        inline_keyboard: [[{ text: "✅ Завершена", callback_data: `done:${data.split(":")[1]}` }]]
      }
    });
  }

  if (data.startsWith("done:")) {
    await bot.editMessageText(q.message.text + "\n\n✅ Статус: Завершена", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
  }

  if (data.startsWith("close:")) {
    await bot.deleteMessage(q.message.chat.id, q.message.message_id);
  }

  await bot.answerCallbackQuery(q.id);
});

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть форму:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Открыть форму", web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

app.listen(PORT, async () => {
  console.log("Server running on port", PORT);
  try {
    await bot.setWebHook(WEBHOOK_URL);
    console.log("Webhook set:", WEBHOOK_URL);
  } catch (e) {
    console.log("WEBHOOK ERROR:", e.response?.body || e);
  }
});
