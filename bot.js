const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN || "8665717135:AAENomQRMAHEu3Yihm6DGiv24oks-U5XMYM";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://timely-yeot-97c989.netlify.app";
const WORK_CHAT_ID = Number(process.env.WORK_CHAT_ID || "-1003911423320");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const orderOwners = new Map();

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

// 🔥 /start обычный
bot.onText(/\/start$/, async (msg) => {
  await sendOpenFormButton(msg.chat.id);
});

// 🔥 deep link (1 клик сценарий)
bot.onText(/\/start (.+)/, async (msg, match) => {
  const param = match[1];

  if (param === "app") {
    await sendOpenFormButton(msg.chat.id);
    return;
  }

  await sendOpenFormButton(msg.chat.id);
});

// 🔥 ПРИЁМ ЗАЯВКИ ИЗ MINI APP
bot.on("message", async (msg) => {
  if (!msg.web_app_data || !msg.web_app_data.data) return;

  let payload;
  try {
    payload = JSON.parse(msg.web_app_data.data);
  } catch {
    console.log("Ошибка парсинга");
    return;
  }

  if (!payload || !payload.order) return;

  const order = payload.order;
  orderOwners.set(String(order.id), msg.chat.id);

  const text = `
💸 Заявка Trud Exchange

${order.from} → ${order.to}

Сумма: ${order.amount}
Режим: ${order.mode === "give" ? "Отдаёт" : "Получает"}

${order.resultText || ""}
${order.subResultText || ""}
${order.feeText || ""}

${order.receiveMethod ? "Получение: " + order.receiveMethod : ""}
${order.receiveCity ? "Город: " + order.receiveCity : ""}
${order.receiveDetails ? "Детали: " + order.receiveDetails : ""}
${order.network ? "Сеть: " + order.network : ""}
`;

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

    console.log("Заявка отправлена");
  } catch (err) {
    console.log("Ошибка отправки:", err.response?.body || err);
  }

  // ответ клиенту
  await bot.sendMessage(msg.chat.id, "✅ Заявка отправлена менеджеру");
});

// 🔥 КНОПКИ МЕНЕДЖЕРА
bot.on("callback_query", async (query) => {
  const [action, orderId] = query.data.split(":");
  const ownerChatId = orderOwners.get(orderId);

  let textUpdate = "";

  if (action === "take") textUpdate = "🟢 Взята в работу";
  if (action === "close") textUpdate = "🔴 Закрыта";

  try {
    await bot.editMessageText(
      query.message.text + "\n\n" + textUpdate,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: { inline_keyboard: [] }
      }
    );
  } catch {}

  if (ownerChatId) {
    await bot.sendMessage(
      ownerChatId,
      action === "take"
        ? "🟢 Ваша заявка в работе"
        : "🔴 Заявка закрыта"
    );
  }

  await bot.answerCallbackQuery(query.id);
});

console.log("Bot is running...");
