const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const FORM_URL = process.env.FORM_URL;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
if (!PUBLIC_URL) throw new Error("PUBLIC_URL is missing");
if (!FORM_URL) throw new Error("FORM_URL is missing");

const bot = new TelegramBot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegram/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Открыть форму:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Открыть форму", url: FORM_URL }]
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
