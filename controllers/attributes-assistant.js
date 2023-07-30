require('dotenv').config()

class attributesAssistant {
  constructor() {}

  async sendErrorMessage(bot, err) {
    let text = `⚠️ BOT ${process.env.BOT_LINK}\n🆘 <pre>${err}</pre>`
    await bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
  }
}

module.exports = {attributesAssistant}