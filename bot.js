const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN || "8665717135:AAENomQRMAHEu3Yihm6DGiv24oks-U5XMYM";
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID || "-5286290643";
const WEBAPP_URL = process.env.WEBAPP_URL || "https:/timely-yeot-97c989.netlify.app";
const MANAGER_CHAT_URL = process.env.MANAGER_CHAT_URL || "https://t.me/UAGA_B";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const orderOwners = new Map();

function formatOrder(order) {
  const lines = [
    "💸 Заявка Trud Exchange",
    `${order.from} → ${order.to}`,
    `Сумма: ${order.amount}`,
    `Режим: ${order.mode === "give" ? "Отдаёт" : "Получает"}`,
    order.resultText || "",
    order.subResultText || "",
    order.feeText || ""
  ];

  if (order.sendRubMethod) lines.push(`Отправка RUB: ${order.sendRubMethod}`);
  if (order.sendRubTransferType) lines.push(`Тип RUB: ${order.sendRubTransferType}`);
  if (order.sendCity) lines.push(`Город отправки: ${order.sendCity}`);
  if (order.receiveMethod) lines.push(`Получение: ${order.receiveMethod}`);
  if (order.receiveCity) lines.push(`Город получения: ${order.receiveCity}`);
  if (order.receiveDetails) lines.push(`Детали: ${order.receiveDetails}`);
  if (order.network) lines.push(`Сеть: ${order.network}`);

  return lines.filter(Boolean).join("\n");
}

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id, "Откройте мини-апп для составления заявки:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть заявку",
            web_app: { url: WEBAPP_URL }
          }
        ]
      ]
    }
  });
});

bot.on("message", async (msg) => {
  if (!msg.web_app_data || !msg.web_app_data.data) return;

  let payload;
  try {
    payload = JSON.parse(msg.web_app_data.data);
  } catch {
    return;
  }

  if (!payload || payload.type !== "exchange_order" || !payload.order) return;

  const order = payload.order;
  orderOwners.set(String(order.id), msg.chat.id);

  const text = formatOrder(order);

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
});

bot.on("callback_query", async (query) => {
  const data = query.data || "";
  const [action, orderId] = data.split(":");
  const ownerChatId = orderOwners.get(String(orderId));

  let suffix = "";
  if (action === "take") suffix = "🟢 Взята в работу";
  if (action === "close") suffix = "🔴 Закрыта";

  try {
    await bot.editMessageText(`${query.message.text}\n\n${suffix}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
  } catch {}

  if (ownerChatId) {
    try {
      await bot.sendMessage(
        ownerChatId,
        action === "take"
          ? "🟢 Ваша заявка взята в работу."
          : "🔴 Ваша заявка закрыта."
      );
    } catch {}
  }

  await bot.answerCallbackQuery(query.id);
});

console.log("Bot is running...");
