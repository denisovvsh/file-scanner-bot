const {mongoDbAssistant} = require('./mongo-db-assistant')
const {attributesAssistant} = require('./attributes-assistant')
const {TokenAssistant} = require('./token-assistant')
const Shell = require('shelljs')
require('dotenv').config()
const fs = require('fs')
const chokidar = require('chokidar')
const log4jsFilescannerAssistant = require("log4js")
const watcher = []
const scannedDirectories = new Set()

class FilescannerAssistant extends attributesAssistant {
  constructor(bot, md5, ...args) {
    super(...args)

    this._bot = bot
    this._md5 = md5
    
    log4jsFilescannerAssistant.configure({
      appenders: {
        filescannerAssistant: {
          type: "file",
          filename: "filescannerAssistant.log"
        } 
      },
      categories: {
        default: {
          appenders: ["filescannerAssistant"],
          level: "error"
        }
      },
    })

    this._loglog4jsFilescannerAssistant = log4jsFilescannerAssistant.getLogger("filescannerAssistant")
    this._dir = './img/'
    this._db = new mongoDbAssistant()
    this._token = new TokenAssistant(this._bot, this._md5)
  }

  async upDir(directoryPath) {
    try {
      let arrPath = directoryPath.split('/')
      arrPath.pop()
      return arrPath.join('/')
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async accessDri(directoryPath = '/home', data = null) {
    try {
      fs.access(directoryPath, fs.constants.F_OK, async (err) => {
        if (err) {
          let text = `🔴 <i>Нет доступа к директории:</i> <pre>${err}</pre>`
          await this._bot.telegram.sendMessage(data.user_id, text, {"parse_mode": "HTML"})

          directoryPath = await this.upDir(directoryPath)
          if (directoryPath) {
            text = `🟠 <i>Проверяем директорию:</i> <pre>${directoryPath}</pre>`
            await this._bot.telegram.sendMessage(data.user_id, text, {"parse_mode": "HTML"})
            this.accessDri(directoryPath, data)
          }
          return false
        } else {
          this.insertPathDirAndStartMonitoring(directoryPath, data)
        }
      })
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async insertPathDirAndStartMonitoring(directoryPath, data) {
    try {
      let query = {
        user_id: data.user_id,
        chat_id: data.chat_id,
        path: directoryPath,
      }
      let update = {
        $set: {
          user_id: data.user_id || null,
          chat_id: data.chat_id || null,
          chat_title: data.chat_title || null,
          path: directoryPath,
        }
      }
      let options = {
        upsert: true
      }

      let res = await this._db.queryUpdate(this._db._collectionsList.directory_list, query, update, options)

      if (res.acknowledged) {
        if (res.upsertedId) await this.startMonitoringDir(directoryPath, data)
      } else {
        this._bot.telegram.sendMessage(
          data.user_id, 
          `<i>🔴 Ошибка запуска мониторинга директории: <pre>${directoryPath}</pre></i>`, 
          {"parse_mode": "HTML"}
        )
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async removeDirFrom(directoryPath, userId) {
    try {
      let query = {
        user_id: userId,
        path: directoryPath,
      }

      return this._db.queryDeleteMany(this._db._collectionsList.directory_list, query)
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async readDri(directoryPath = '/home', userId = null) {
    try {
      fs.readdir(`${directoryPath}`, async (err, files) => {
        if (err) {
          let text = `🔴 <i>Ошибка при чтении директории:</i> \n<pre>${err}</pre>`
          await this._bot.telegram.sendMessage(userId, text, {"parse_mode": "HTML"})

          /* directoryPath = await this.upDir(directoryPath)
          if (directoryPath) {
            text = `🟠 Проверяем директорию: <pre>${directoryPath}</pre>`
            await this._bot.telegram.sendMessage(userId, text, {"parse_mode": "HTML"})
            
            this.readDri(directoryPath, userId)
          } */
          return false
        }

        this.commandRun(directoryPath)

        // Фильтруем только директории
        /* let directories = files.filter((file) => {
          return fs.statSync(`${directoryPath}/${file}`).isDirectory();
        }) */
      
        // Выводим список директорий
        /* let text = `🟢 Список директорий внутри <pre>${directoryPath}</pre>:`
        await this._bot.telegram.sendMessage(userId, text + directories.join('\n'), {"parse_mode": "HTML"})
        
        console.log(directories) */
      })
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async commandRun(directoryPath) {
    try {
      let query = {}
      let select = {}
      let result = await this._db.queryFind(this._db._collectionsList.directory_list, query, select, {}, 999)
      if (!result) return
      for (let data of result.response) {
        if (directoryPath && directoryPath !== data.path) continue
        await this.delay(1000)
        await this.startMonitoringDir(data.path, data)
      }
      let text = `🟢 Стартовое сканирование завершено!`
      await this._bot.telegram.sendMessage(process.env.OWNER_CHAT_ID, text, {"parse_mode": "HTML"})
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async startMonitoringDir(directoryPath, data = null) {
    try {
      let key = this._md5(directoryPath)
      watcher[key] = chokidar.watch(directoryPath, {
        ignored: /(^|[\/\\])\../, // Игнорировать скрытые файлы
        persistent: true, // Оставаться в слежении даже после завершения сценария
        awaitWriteFinish: {
          stabilityThreshold: 2000, // Задержка после записи файла в миллисекундах
          pollInterval: 100 // Интервал опроса для проверки записи в миллисекундах
        }
      })
      .on('ready', (path) => {
        console.log(`Мониторинг директории ${path} начат.`)
        const initialDirectories = Array.from(scannedDirectories)
        console.log('Список директорий при старте программы:', initialDirectories)
      })
      .on('add', async (path) => {
        if (!scannedDirectories.has(path)) {
          scannedDirectories.add(path);
          console.log(`Добавлена новая директория: ${path}`);
        }
        /* try {
          let text = `➕ 📥 <b>Новый файл:</b> \n\n<pre>${path}</pre>`
          await this._bot.telegram.sendMessage(data.chat_id, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        } */
      })
      .on('change', async (path) => {
        if (!scannedDirectories.has(path)) {
          scannedDirectories.add(path);
          console.log(`Добавлена новая директория: ${path}`);
        }
        /* try {
          let text = `📝 <b>Файл изменен:</b> \n\n<pre>${path}</pre>`
          await this._bot.telegram.sendMessage(data.chat_id, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        } */
      })
      .on('unlink', async (path) => {
        if (!scannedDirectories.has(path)) {
          scannedDirectories.add(path);
          console.log(`Добавлена новая директория: ${path}`);
        }
        /* try {
          let text = `➖ 📤 <b>Файл удален:</b> \n\n<pre>${path}</pre>`
          await this._bot.telegram.sendMessage(data.chat_id, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        } */
      })
      .on('addDir', async (path) => {
        if (!scannedDirectories.has(path)) {
          scannedDirectories.add(path);
          console.log(`Добавлена новая директория: ${path}`);
        }
        /* try {
          let text = `➕ 📂 <b>Новая директория:</b> \n\n<pre>${path}</pre>`
          await this._bot.telegram.sendMessage(data.chat_id, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        } */
      })
      .on('unlinkDir', async (path) => {
        if (!scannedDirectories.has(path)) {
          scannedDirectories.add(path);
          console.log(`Добавлена новая директория: ${path}`);
        }
        /* try {
          let text = `➖ 📁 <b>Директория удалена:</b> \n\n<pre>${path}</pre>`
          await this._bot.telegram.sendMessage(data.chat_id, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        } */
      })
      .on('error', async (error) => {
        try {
          let text = `🔴 Произошла ошибка при мониторинге: \n\n<pre>${error}</pre>`
          await this._bot.telegram.sendMessage(process.env.OWNER_CHAT_ID, text, {"parse_mode": "HTML"})
        } catch (err) {
          this._loglog4jsFilescannerAssistant.level = "error"
          this._loglog4jsFilescannerAssistant.error(err)
        }
      })
    } catch (err) {
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async stopMonitoring(path) {
    try {
      let key = this._md5(path)
      if (watcher[key]) {
        await watcher[key].close()
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async actionGetMenuChatsList(ctx) {
    try {
      let userFromId = (ctx.from) ? ctx.from.id : null
      
      let query = {
        user_id: userFromId
      }
      let select = {}
      let result = await this._db.queryFind(this._db._collectionsList.chats_list, query, select, {}, 999)
      
      if (result) {
        let listGroup = `<i>🛎 Выбирете группу для которой настроить уведомления</i>`;
        this._bot.telegram.sendMessage(userFromId, listGroup, await this.getKeyboardForChatsList(result.response, 'add'))
      } else {
        this._bot.telegram.sendMessage(userFromId, `<i>🟠 Сначала добавьте группу /menu</i>`, {"parse_mode": "HTML"})
      }
          
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async getKeyboardForChatsList(chatListsCollection, mode = 'add') {
    try {
      let keyboard = {
        "inline_keyboard": []
      }

      let idsChat = []

      for (let element of chatListsCollection) {
        if (!idsChat[element.chat_id] && element.chat_id) {
          let actionId = await this.getRandomArbitrary()

          keyboard.inline_keyboard.unshift([
            {
              text: '📌 '+(element.chat_title || `no title chet ${element.chat_id}`), 
              callback_data: mode + '_dir_' + actionId,
            }
          ])

          if (mode === 'add') {
            this._bot.action('add_dir_'+actionId, async (ctx) => {
              ctx.answerCbQuery()
              ctx.scene.enter('add_directory_monitor', {
                chat: element, 
                insert: true
              })
            })
          }

          if (mode === 'list') {
            this._bot.action('list_dir_'+actionId, async (ctx) => {
              ctx.answerCbQuery()
              let query = {
                user_id: element.user_id,
                chat_id: element.chat_id
              }
              let select = {}
              let result = await this._db.queryFind(this._db._collectionsList.directory_list, query, select, {}, 999)
              
              if (result) {
                let arrDir = []
                for (let dir of result.response) {
                  arrDir.push('<pre>' + dir.path + '</pre>')
                }
                let text = '🗒 <b>Список директорий привязанных к группе ' + result.response[0]['chat_title'] + '</b>\n\n' + arrDir.join('\n')
                await this._bot.telegram.sendMessage(element.user_id, text + '\n\n<b>Для удаления директории нажмите</b> /remove', {"parse_mode": "HTML"})
              } else {
                await this._bot.telegram.sendMessage(element.user_id, `🟠 <b>Нет директорий</b>`, {"parse_mode": "HTML"})
              }
            })
          }
        }

        idsChat[element.chat_id] = element.chat_id
      }

      return {
        "reply_markup": JSON.stringify(keyboard),
        "parse_mode": "HTML"
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async getKeyboardForChatsListFromMonitoring(ctx) {
    try {
      let userFromId = (ctx.from) ? ctx.from.id : null
      
      let query = {
        user_id: userFromId
      }
      let select = {}
      let result = await this._db.queryFind(this._db._collectionsList.directory_list, query, select, {}, 999)
      
      if (result) {
        let listGroup = `<b>🗂 Выбирете группу, для которой получить список директорий:</b>`;
        this._bot.telegram.sendMessage(userFromId, listGroup, await this.getKeyboardForChatsList(result.response, 'list'))
      } else {
        this._bot.telegram.sendMessage(userFromId, `<i>🟠 Сначала добавьте группу /menu</i>`, {"parse_mode": "HTML"})
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async getKeyboardForSettingsMenu(ctx) {
    try {
      let userFromId = (ctx.update) ? ctx.update.message.from.id : null
      let actionId = await this.getRandomArbitrary()
      
      let keyboard = {
        "inline_keyboard": [
          [{'text': 'Дообавить новую группу', 'callback_data': 'add_group_'+actionId}],
          [{'text': 'Дообавить мониторинг директории', 'callback_data': 'add_dir_monitor_'+actionId}],
          [{'text': 'Список директорий', 'callback_data': 'get_list_dir_'+actionId}],
          //[{'text': 'Остановить мониторинг', 'callback_data': 'stop_monitor_'+actionId}],
        ]
      }

      this._bot.action('get_list_dir_'+actionId, async (ctx) => {
        ctx.answerCbQuery(this._loader)
        await this.getKeyboardForChatsListFromMonitoring(ctx)
      })

      this._bot.action('add_group_'+actionId, async (ctx) => {
        ctx.answerCbQuery(this._loader)
        await this._token.commandAddToken(ctx)
      })

      this._bot.action('add_dir_monitor_'+actionId, async (ctx) => {
        ctx.answerCbQuery(this._loader)
        await this.actionGetMenuChatsList(ctx)
      })

      /* this._bot.action('stop_monitor_'+actionId, async (ctx) => {
        ctx.answerCbQuery(this._loader)
        await this.stopMonitoring()
      }) */

      this._bot.telegram.sendMessage(userFromId, `<b>🟠 Меню:</b>`, {
        "reply_markup": JSON.stringify(keyboard),
        "parse_mode": "HTML"
      })
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async getRandomArbitrary() {
    let min = 1000000000000
    let max = 9999999999999
    let result = Math.floor(Math.random() * (max - min) + min)
    return result
  }

  async commandHelp(ctx) {
    try {
      let messageId = (ctx.update) ? ctx.update.message.message_id : ctx.message.message_id
      let chatId = (ctx.update) ? ctx.update.message.chat.id : ctx.message.chat.id

      let keyboard = {
        inline_keyboard: [
            [
              //{text: "Сайт", url: process.env.BOT_LINK_SITE},
              {text: "Поддержка", url: process.env.BOT_LINK_SUPPORT},
            ]
        ]
      }
      
      let optionsMessage = {
        reply_to_message_id: messageId,
        reply_markup: JSON.stringify(keyboard),
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    
      this._bot.telegram.sendMessage(chatId, `<i>🟠 ${process.env.BOT_LINK_USERNAME} - сканирует директории. \nИ уведомляет об изменениях, в различные группы.</i>`, optionsMessage)
    } catch (err) {
      this.sendErrorMessage(this._bot, err)
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async commandStart(ctx) {
    try {
      let chatId = (ctx.update) ? ctx.update.message.chat.id : ctx.message.chat.id
      this._bot.telegram.sendMessage(chatId, 
        `<i>🟠 ${process.env.BOT_LINK_USERNAME} - сканирует директории.</i>`, 
        {
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
    } catch (err) {
      this.sendErrorMessage(this._bot, err)
      this._loglog4jsFilescannerAssistant.level = "error"
      this._loglog4jsFilescannerAssistant.error(err)
    }
  }

  async delay(time) {
    await new Promise(r => setTimeout(r, time))
  }
}

module.exports = {FilescannerAssistant}