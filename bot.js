const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN || "8665717135:AAEsU5zGUBRx1X61v5dp0T4G3JT1oT4uk_g";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://timely-yeot-97c989.netlify.app";
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID || "-1003911423320");
const MANAGER_CHAT_URL = process.env.MANAGER_CHAT_URL || "https://t.me/UAGA_B";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing");
}
if (!WEBAPP_URL) {
  throw new Error("WEBAPP_URL is missing");
}
if (!Number.isFinite(WORK_CHAT_ID)) {
  throw new Error("WORK_CHAT_ID is missing or invalid");
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
const orderOwners = new Map();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

function sendOpenFormButton(chatId) {
  return bot.sendMessage(chatId, "Оставьте заявку на обмен:", {
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
}

bot.onText(/\/start$/, async (msg) => {
  await sendOpenFormButton(msg.chat.id);
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  const param = String(match[1] || "").trim();
  if (param === "app") {
    await sendOpenFormButton(msg.chat.id);
    return;
  }
  await sendOpenFormButton(msg.chat.id);
});

bot.on("message", async (msg) => {
  if (!msg.web_app_data || !msg.web_app_data.data) return;

  let payload;
  try {
    payload = JSON.parse(msg.web_app_data.data);
  } catch (err) {
    console.log("JSON parse error:", err);
    return;
  }

  if (!payload || payload.type !== "exchange_order" || !payload.order) {
    console.log("Unexpected payload:", payload);
    return;
  }

  const order = payload.order;
  orderOwners.set(String(order.id), msg.chat.id);

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
    order.network ? `Сеть: ${order.network}` : ""
  ].filter(Boolean).join("\n");

  try {
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
    console.log("Заявка отправлена в рабочий чат");
  } catch (err) {
    console.log("Ошибка отправки в рабочий чат:", err.response?.body || err);
  }

  try {
    await bot.sendMessage(msg.chat.id, "✅ Заявка успешно отправлена.", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Новая заявка", web_app: { url: WEBAPP_URL } },
            { text: "Перейти в чат с менеджером", url: MANAGER_CHAT_URL }
          ]
        ]
      }
    });
  } catch (err) {
    console.log("Ошибка ответа клиенту:", err.response?.body || err);
  }
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
    console.log("Ошибка обновления сообщения:", err.response?.body || err);
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
      console.log("Ошибка уведомления клиента:", err.response?.body || err);
    }
  }

  await bot.answerCallbackQuery(query.id);
});

console.log("Bot is running...");
