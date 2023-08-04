const {Telegraf, Scenes, session} = require('telegraf')
const {enter, leave} = Scenes.Stage
const {cronAssistant} = require('./cron/cron-assistant')
const cron = require('node-cron')
const {FilescannerAssistant} = require('./controllers/filescanner-assistant')
const {TokenAssistant} = require('./controllers/token-assistant')

require('dotenv').config()
const md5 = require('md5')

const log4js = require("log4js")
log4js.configure({
  appenders: {
    filescanner: {
      type: "file",
      filename: "filescanner.log"
    } 
  },
  categories: {
    default: {
      appenders: ["filescanner"],
      level: "error"
    }
  },
})

const logger = log4js.getLogger("filescanner")

// addDirectoryToMonitoringList scene
const addDirectoryToMonitoringList = new Scenes.BaseScene('add_directory_monitor')
addDirectoryToMonitoringList.enter((ctx) => {
  let insert = ctx.scene.state.insert

  if (insert) {
    ctx.reply(`<i>⚠️ Введите абсолютный путь директории. \nОтменить /cancel</i>`, {"parse_mode": "HTML"})  
  } else {
    return ctx.scene.leave()
  }
})
addDirectoryToMonitoringList.leave((ctx) => {
  if (ctx.update.message && ctx.update.message.text && ctx.update.message.text === '/cancel') {
    ctx.reply(`<i>🟠 Отмена процедуры - добавления директории в мониторинг!</i>`, {
      "reply_to_message_id": ctx.update.message.message_id,
      "parse_mode": "HTML"
    })
  }
})
addDirectoryToMonitoringList.command('cancel', leave())
addDirectoryToMonitoringList.on('text', async (ctx) => {
  if (ctx.message.text) {
    let data = ctx.scene.state.chat
    let path = ctx.message.text.trim()
    let filescanner = new FilescannerAssistant(bot, md5)
    await filescanner.accessDri(path, data)
      .then(() => {
        ctx.reply(`🟠 <i>Запускаем мониторинг директории!</i>`, {
          "reply_to_message_id": ctx.update.message.message_id,
          "parse_mode": "HTML"
        })
      })
    return ctx.scene.leave()
  }
})

// removeDirectoryToMonitoringList scene
const removeDirectoryToMonitoringList = new Scenes.BaseScene('remove_directory_monitor')
removeDirectoryToMonitoringList.enter((ctx) => {
  let userId = ctx.scene.state.user_id

  if (userId) {
    ctx.reply(`<i>⚠️ Введите абсолютный путь директории. \nОтменить /cancel</i>`, {"parse_mode": "HTML"})  
  } else {
    return ctx.scene.leave()
  }
})
removeDirectoryToMonitoringList.leave((ctx) => {
  if (ctx.update.message && ctx.update.message.text && ctx.update.message.text === '/cancel') {
    ctx.reply(`<i>🟠 Отмена процедуры - удаления директории из мониторинга!</i>`, {
      "reply_to_message_id": ctx.update.message.message_id,
      "parse_mode": "HTML"
    })
  }
})
removeDirectoryToMonitoringList.command('cancel', leave())
removeDirectoryToMonitoringList.on('text', async (ctx) => {
  if (ctx.message.text) {
    let userId = ctx.scene.state.user_id
    let path = ctx.message.text.trim()
    if (path) {
      let filescanner = new FilescannerAssistant(bot, md5)
      let resRemove = await filescanner.removeDirFrom(path, userId)
      if (resRemove.deletedCount) {
        await filescanner.stopMonitoring(path)
          .then(() => {
            ctx.reply(`<i>🔴 Отменен мониторинг директории!</i>`, {
              "reply_to_message_id": ctx.update.message.message_id,
              "parse_mode": "HTML"
            })
          })
      }
    }
    return ctx.scene.leave()
  }
})

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([
  addDirectoryToMonitoringList,
  removeDirectoryToMonitoringList,
])

bot.use(session())
bot.use(stage.middleware())

bot.command('menu', async (ctx) => {
  let chatId = (ctx.update) ? ctx.update.message.chat.id : null
  let type = (ctx.update) ? ctx.update.message.chat.type : null
  let userFromId = (ctx.update) ? ctx.update.message.from.id : null
  let isBot = (ctx.update) ? ctx.update.message.from.is_bot : null
  if (type === 'private' && !isBot && chatId === userFromId) {
    let filescanner = new FilescannerAssistant(bot, md5)
    await filescanner.getKeyboardForSettingsMenu(ctx)
  } else {
    bot.telegram.sendMessage(
      chatId, 
      `<i>🟠 Вызов меню возможен, только из приватного чата с ботом! \nЗапустите бота ${process.env.BOT_LINK}</i>`, 
      {"parse_mode": "HTML"}
    )
  }
})

bot.command('remove', async (ctx) => {
  let userFromId = (ctx.update) ? ctx.update.message.from.id : null
  ctx.scene.enter('remove_directory_monitor', {
    user_id: userFromId
  })
})

bot.start((ctx) => {
  let filescanner = new FilescannerAssistant(bot, md5)
  filescanner.commandStart(ctx)
})

bot.help((ctx) => {
  let filescanner = new FilescannerAssistant(bot, md5)
  filescanner.commandHelp(ctx)
})

bot.on('text', async (ctx) => {
  if (ctx.message.text) {
    let token = new TokenAssistant(bot, md5)
    let text = ctx.message.text.trim()
    if (text.startsWith("new_group_", 0)) {
      token.connectManagerToChat(ctx)
    }
  }
})

bot.startPolling()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

try {
  logger.level = "info"
  logger.info("Restart BOT")
} finally {
    let filescanner = new FilescannerAssistant(bot, md5)
    filescanner.commandRun()
    bot.telegram.sendMessage(
      process.env.BOT_ADMINISTRATOR_ID,
      `🟠 Запущен бот ${process.env.BOT_LINK_USERNAME}`, {"parse_mode": "HTML"}
    ).catch((err) => {
      logger.level = "error"
      logger.info(err)
    })
}

//let cronFn = new cronAssistant(bot, md5)
//cron.schedule('0 0 */1 * * *', async () => {
//  await cronFn.findOrders_pulscen()
//    .then(async () => {
//      await bot.telegram.sendMessage(
//        process.env.BOT_ADMINISTRATOR_ID,
//        `🟠 <b>CRON</b> <pre>'0 0 */1 * * *' - findOrders_pulscen</pre>`, {"parse_mode": "HTML"}
//      )
//    })
//})