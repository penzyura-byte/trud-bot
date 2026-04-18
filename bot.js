const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const WEBAPP_URL = process.env.WEBAPP_URL;
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID);
const MANAGER_CHAT_URL = process.env.MANAGER_CHAT_URL || "https://t.me/your_manager_username";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
if (!PUBLIC_URL) throw new Error("PUBLIC_URL is missing");
if (!WEBAPP_URL) throw new Error("WEBAPP_URL is missing");
if (!Number.isFinite(WORK_CHAT_ID)) throw new Error("WORK_CHAT_ID is missing or invalid");

const bot = new TelegramBot(BOT_TOKEN);
const app = express();
const orderOwners = new Map();

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegram/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});
console.log("🔥 ПОЛУЧЕН ЗАПРОС:", req.body);
app.post("/order", async (req, res) => {
  try {
    const { order, user } = req.body || {};

    if (!order) {
      return res.status(400).json({ ok: false, error: "order missing" });
    }

    const userLabel = user?.label || "неизвестно";
    const userLink = user?.link || "";
    const userId = user?.id ? String(user.id) : "";

    if (userId) {
      orderOwners.set(String(order.id), Number(userId));
    }

    const text = [
      "💸 Заявка Trud Exchange",
      `${order.from} → ${order.to}`,
      `Сумма: ${order.amount}`,
      `Режим: ${order.mode === "give" ? "Отдаёт" : "Получает"}`,
      order.resultText || "",
      order.subResultText || "",
      order.feeText || "",
      order.sendRubMethod ? `Отправка RUB: ${order.sendRubMethod}` : "",
      order.sendRubTransferType ? `Тип RUB: ${order.sendRubTransferType}` : "",
      order.sendCity ? `Город отправки: ${order.sendCity}` : "",
      order.receiveMethod ? `Получение: ${order.receiveMethod}` : "",
      order.receiveCity ? `Город получения: ${order.receiveCity}` : "",
      order.receiveDetails ? `Детали: ${order.receiveDetails}` : "",
      order.network ? `Сеть: ${order.network}` : "",
      "",
      `👤 Клиент: ${userLabel}`,
      userLink ? `🔗 Профиль: ${userLink}` : ""
    ].filter(Boolean).join("\n");

    await bot.sendMessage(WORK_CHAT_ID, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Взять в работу", callback_data: `take:${order.id}` },
            { text: "🟡 Закрыть", callback_data: `close:${order.id}` }
          ]
        ]
      }
    });

    if (userId) {
      try {
        await bot.sendMessage(Number(userId), "✅ Заявка успешно отправлена.", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Новая заявка", web_app: { url: WEBAPP_URL } },
                { text: "Перейти в чат с менеджером", url: MANAGER_CHAT_URL }
              ]
            ]
          }
        });
      } catch (e) {
        console.log("Client notification failed:", e.response?.body || e);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.log("ORDER ERROR:", err.response?.body || err);
    return res.status(500).json({ ok: false });
  }
});

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, "Оставьте заявку на обмен:", {
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

bot.onText(/\/start (.+)/, async (msg, match) => {
  const param = String(match[1] || "").trim();
  if (param === "app") {
    await bot.sendMessage(msg.chat.id, "Оставьте заявку на обмен:", {
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
    return;
  }

  await bot.sendMessage(msg.chat.id, "Оставьте заявку на обмен:", {
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

bot.on("callback_query", async (query) => {
  const data = String(query.data || "");
  const [action, orderId] = data.split(":");
  const ownerChatId = orderOwners.get(String(orderId));

  let statusText = "";
  if (action === "take") statusText = "🟢 Взята в работу";
  if (action === "close") statusText = "🔴 Закрыта";

  try {
    await bot.editMessageText(`${query.message.text}\n\n${statusText}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
  } catch (err) {
    console.log("Edit message error:", err.response?.body || err);
  }

  if (ownerChatId) {
    try {
      await bot.sendMessage(
        ownerChatId,
        action === "take"
          ? "🟢 Ваша заявка в работе."
          : "🔴 Заявка закрыта."
      );
    } catch (err) {
      console.log("Notify client error:", err.response?.body || err);
    }
  }

  await bot.answerCallbackQuery(query.id);
});

(async () => {
  try {
    await bot.setWebHook(WEBHOOK_URL);
    console.log("Webhook set:", WEBHOOK_URL);
  } catch (err) {
    console.log("Webhook setup error:", err.response?.body || err);
  }
})();

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
