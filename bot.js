const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);
const MANAGER_CHAT_URL = process.env.MANAGER_CHAT_URL || "https://t.me/your_manager_username";

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
} catch (e) {
  orderCounter = 1;
}

function saveCounter() {
  fs.writeFileSync("counter.json", JSON.stringify({ counter: orderCounter }));
}

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

function clean(text, remove) {
  if (!text) return "-";
  return text.replace(remove, "").trim();
}

app.post("/order", async (req, res) => {
  const { order, user } = req.body;
  if (!order) return res.sendStatus(400);

 let userLabel = `ID:${user?.id}`;
let userLink = `tg://user?id=${user?.id}`;

try {
  if (user?.id) {
    const chat = await bot.getChat(user.id);

    if (chat.username) {
      userLabel = `@${chat.username}`;
      userLink = `https://t.me/${chat.username}`;
    } else {
      userLabel = `${chat.first_name || ""} ${chat.last_name || ""}`.trim() || userLabel;
    }
  }
} catch (e) {
  console.log("Не удалось получить username:", e.message);
}

  const orderId = orderCounter++;
  saveCounter();

  const receive = clean(order.resultText, "К получению:");
  const fee = clean(order.feeText, "Комиссия:");

  const text = [
    `📨 Заявка №${orderId}`,
    "",
    `👤 Клиент: ${userLabel}`,
    `🔗 ${userLink}`,
    "",
    `💱 ${order.from} → ${order.to}`,
    "",
    `💸 Отдаёт: ${order.amount} ${order.from}`,
    `💰 Получает: ${receive}`,
    "",
    `💼 Комиссия: ${fee}`,
    "",
    `📦 Отправка:`,
    `${order.sendRubMethod || "-"} ${order.sendCity || ""}`.trim(),
    "",
    `📥 Получение:`,
    `${order.receiveMethod || "-"} ${order.receiveCity || ""}`.trim(),
    order.receiveDetails || "",
    order.network || ""
  ].filter(Boolean).join("\n");

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
    console.log("ORDER SEND ERROR:", err.response?.body || err);
    res.sendStatus(500);
  }
});

bot.on("callback_query", async (q) => {
  const [action, id] = String(q.data || "").split(":");

  if (action === "take") {
    await bot.editMessageText(
      q.message.text + "\n\n🟢 Статус: В работе",
      {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Завершена", callback_data: `done:${id}` }]
          ]
        }
      }
    );
  }

  if (action === "done") {
    await bot.editMessageText(
      q.message.text + "\n\n✅ Статус: Завершена",
      {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: { inline_keyboard: [] }
      }
    );
  }

  if (action === "close") {
    await bot.deleteMessage(q.message.chat.id, q.message.message_id);
  }

  await bot.answerCallbackQuery(q.id);
});

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start$/, (msg) => {
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
