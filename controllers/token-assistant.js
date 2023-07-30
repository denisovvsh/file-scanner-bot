const {mongoDbAssistant} = require('./mongo-db-assistant')
const {attributesAssistant} = require('./attributes-assistant')
require('dotenv').config()
const log4jsAssistant = require("log4js")

class TokenAssistant extends attributesAssistant {
  constructor(bot, md5, ...args) {
    super(...args)

    this._bot = bot
    this._md5 = md5
    
    log4jsAssistant.configure({
      appenders: {
        tokenAssistant: {
          type: "file",
          filename: "tokenAssistant.log"
        } 
      },
      categories: {
        default: {
          appenders: ["tokenAssistant"],
          level: "error"
        }
      },
    })

    this._log4jsTokenAssistant = log4jsAssistant.getLogger("tokenAssistant")

    this._db = new mongoDbAssistant()
  }

  async commandAddToken(ctx) {
    try {
      let messageId = (ctx.update) ? ctx.update.callback_query.message.message_id : null
      let chatId = (ctx.update) ? ctx.update.callback_query.message.chat.id : null
      let type = (ctx.update) ? ctx.update.callback_query.message.chat.type : null

      let userFromId = (ctx.from) ? ctx.from.id : null
      let isBot = (ctx.from) ? ctx.from.is_bot : null
      let firstNameFrom = (ctx.from) ? ctx.from.first_name : null
      let lastNameFrom = (ctx.from) ? ctx.from.last_name : null
      let usernameFrom = (ctx.from) ? ctx.from.username : null
      let languageCodeFrom = (ctx.from) ? ctx.from.language_code : null

      if (usernameFrom) {
        let optionsMessage = {
          "reply_to_message_id": messageId,
          "parse_mode": "HTML"
        }

        if (type === 'private' && !isBot && chatId === userFromId) {
          let key = this._md5(messageId+'_'+userFromId)
          let token = 'new_group_'+key
          
          await this._bot.telegram.sendMessage(chatId, `<i>🟠 Ожидайте - регистрируется токен для добавления новой группы!</i>`, optionsMessage)
          
          let queryIns = {
            key: token,
            user_id: userFromId,
            user_first_name: firstNameFrom || null,
            user_last_name: lastNameFrom || null,
            user_username: usernameFrom,
            user_is_bot: isBot,
            user_language_code: languageCodeFrom,
            token_active: false,
          }

          let resTokens = await this._db.queryInsertOne(this._db._collectionsList.tokens, queryIns)

          if (!resTokens.error) {
            let messageCode = await this._bot.telegram.sendMessage(chatId, `<pre>${token}</pre>`, {"parse_mode": "HTML"})
            
            optionsMessage = {
              "reply_to_message_id": messageCode.message_id,
              "parse_mode": "HTML"
            }
            await this._bot.telegram.sendMessage(chatId, `<i>\n<b>1)</b> Добавьте бота ${process.env.BOT_LINK_USERNAME} в нужную группу. \n<b>2)</b> Отправьте сгенерированный токен в группу.</i>`, optionsMessage)
          } else {
            ctx.reply(`<i>🔴 Ошибка <b>${resTokens.error}</b>!</i>`, {"parse_mode": "HTML"})  
          }
        } else {
          this._bot.telegram.sendMessage(chatId, `<i>🟠 Добавление новой группы, возможно, только из приватного чата с ботом! \nЗапустите бота ${process.env.BOT_LINK}</i>`, optionsMessage)
        }
      } else {
        ctx.reply(`<i>🔴 Заполните <b>username</b> в настройках вашей учетной записи, в Telegram!</i>`, {"parse_mode": "HTML"})  
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  async connectManagerToChat(ctx) {
    try {
      let messageId = (ctx.update) ? ctx.update.message.message_id : ctx.message.message_id
      let chatId = ((ctx.update) ? ctx.update.message.chat.id : ctx.message.chat.id).toString()
      let fromId = ((ctx.update) ? ctx.update.message.from.id : ctx.message.from.id).toString()
      let chatTitle = (ctx.update) ? ctx.update.message.chat.title : ctx.message.chat.title
      let textMessage = ((ctx.update) ? ctx.update.message.text : ctx.message.text).trim()

      let optionsMessage = {
        "reply_to_message_id": messageId,
        "parse_mode": "HTML"
      }

      if (chatId === fromId) {
        this._bot.telegram.sendMessage(chatId, `<i>🟠 Ключ, нужно отправлять в ту группу, которую хотите добавить!</i>`, optionsMessage)
      } else {
        this._bot.telegram.sendMessage(chatId, `<i>🟠 Ожидайте - произвожу поиск токена и привязку группы!</i>`, optionsMessage)

        let tokensQuery = {
          key: textMessage
        }
        let select = {}
        let resultTokens = await this._db.queryFind(this._db._collectionsList.tokens, tokensQuery, select, {}, 1)

        if (resultTokens) {
          resultTokens = resultTokens.response
          
          if (!resultTokens[0].token_active) {
            let managerQuery = {
              chat_id: chatId,
            }

            let resultFindChat = await this._db.queryFind(this._db._collectionsList.chats_list, managerQuery, select, {}, 1)

            if (!resultFindChat) {
              await this.addChatToUser(resultTokens[0], chatId, chatTitle, tokensQuery, optionsMessage)
            } else {
              let user = await this._db.queryFind(this._db._collectionsList.users, {id: resultFindChat.response[0].user_id}, select, {}, 1)
              ctx.reply(`<i>🟠 Группа уже находится под управлением! <b>@${user.response[0].username}</b></i>`, optionsMessage)    
            }
          } else {
            ctx.reply(`<i>🟠 Токен уже использован, сгенерируйте новый</i>`, optionsMessage)
          }
        } else {
          ctx.reply(`<i>🟠 Токен не обнаружен, сгенерируйте новый</i>`, optionsMessage)
        }
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  async addChatToUser(resultTokens, chatId, chatTitle, tokensQuery, optionsMessage) {
    try {
      let update = {
        $set: {
          token_active: true
        }
      }
      let options = {}

      let resUpdate = await this._db.queryUpdate(this._db._collectionsList.tokens, tokensQuery, update, options)
      
      if (resUpdate.modifiedCount && resUpdate.modifiedCount > 0) {
        let user = {
          id: resultTokens.user_id,
          first_name: resultTokens.user_first_name,
          last_name: resultTokens.user_last_name,
          username: resultTokens.user_username,
          is_bot: resultTokens.user_is_bot,
          language_code: resultTokens.user_language_code,
        }

        let resUser = await this.insertOrUpdateUsers(user)

        if (resUser) {
          resUpdate = await this.insertOrUpdateChatsList(resultTokens.user_id, chatId, chatTitle)
          
          if (resUpdate.acknowledged) {
            this._bot.telegram.sendMessage(resultTokens.user_id, `<i>🟠 Теперь группа <b>${chatTitle}</b> находится под вашим управлением.</i>`, {"parse_mode": "HTML"})
            this._bot.telegram.sendMessage(chatId, `<i>🟠 Группа <b>${chatTitle}</b> привязана к пользователю: <b>@${resultTokens.user_username}</b></i>`, optionsMessage)
          } else {
            ctx.reply(`<i>🔴 Ошибка обновления списка чатов!</i>`, {"parse_mode": "HTML"})  
          }
        } else {
          ctx.reply(`<i>🔴 Ошибка добавления пользователя!</i>`, {"parse_mode": "HTML"})
        }
      } else {
        ctx.reply(`<i>🔴 Ошибка обновления токена!</i>`, {"parse_mode": "HTML"})
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  async insertOrUpdateUsers(user) {
    try {
      let createAt = this.getCurrentDate().date_seconds

      let userQuery = {
        id: user.id,
      }

      let updateUser = {
        $set: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          is_bot: user.is_bot,
          language_code: user.language_code,
          create_at: createAt
        }
      }

      let options = {
        upsert: true
      }

      let res = await this._db.queryUpdate(this._db._collectionsList.users, userQuery, updateUser, options)

      if (res.upsertedId) {
        let countUsers = await this._db.queryCount(this._db._collectionsList.users, {})
        let text = `➕ <b>Добавлен новый пользователь!</b> \n<b>Идентификатор:</b> ${user.id} \n<b>Имя:</b> ${(user.first_name || '-')} \n<b>Фамилия:</b> ${(user.last_name || '-')} \n<b>Имя пользователя:</b> ${('@'+user.username || '-')} \n\n<b>Количество пользователей:</b> ${countUsers} \n\n#users`
        await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      }

      return res.acknowledged || false
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  async insertOrUpdateChatsList(userId, chatId, chatTitle) {
    try {
      let createAt = this.getCurrentDate().date_seconds

      let chListQuery = {
        user_id: userId,
        chat_id: chatId,
      }

      let update = {
        $set: {
          user_id: userId,
          chat_id: chatId,
          chat_title: chatTitle,
          create_at: createAt
        }
      }

      let options = {
        upsert: true
      }

      let res = await this._db.queryUpdate(this._db._collectionsList.chats_list, chListQuery, update, options)
      return res
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      await this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  getCurrentDate() {
    try {
      let date = new Date()
      date.setMonth(date.getMonth() + 1) 
      let mm = !+date.getMonth().toString().length || +date.getMonth().toString().length == 1 ? `0${date.getMonth().toString()}` : date.getMonth()
      let dd = !+date.getDate().toString().length || +date.getDate().toString().length == 1 ? `0${date.getDate().toString()}` : date.getDate()
      let yyyy = date.getFullYear().toString()
      
      return {
        date_seconds: Date.now(),
        date_iso_8601: date,
        date: `${dd}.${mm}.${yyyy}`
      }
    } catch (err) {
      let text = `🆘 <pre>${err}</pre>`
      this._bot.telegram.sendMessage(process.env.BOT_ADMINISTRATOR_ID, text, {"parse_mode": "HTML"})
      this._log4jsTokenAssistant.level = "error"
      this._log4jsTokenAssistant.error(err)
    }
  }

  getUserInfo(firstName, lastName, username) {
    let resultFirstName = (firstName) ? firstName+' ' : ''
    let resultLastName = (lastName) ? lastName+' ' : ''
    let resultUsername = (username) ? (firstName) ? '(@'+username+')' : '@'+username : '@не назначен'
    return resultFirstName+resultLastName+resultUsername
  }
}

module.exports = {TokenAssistant}