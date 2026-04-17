const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть заявку:", {
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

bot.on("message", (msg) => {
  if (msg.web_app_data) {
    console.log("Заявка:", msg.web_app_data.data);
  }
});

console.log("Bot is running...");
