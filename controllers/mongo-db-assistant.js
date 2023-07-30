const {MongoClient} = require("mongodb")
require('dotenv').config()
const log4jsMongoDbAssistant = require("log4js")

class mongoDbAssistant {
  _collectionsList = {
    tokens: 'tokens',
    users: 'users',
    chats_list: 'chats_list',
    directory_list: 'directory_list',
  }

  constructor() {
    this._clientMongoDb = new MongoClient(process.env.MONGO_DB_URL)

    log4jsMongoDbAssistant.configure({
      appenders: {
        mongoDbAssistant: {
          type: "file",
          filename: "mongoDbAssistant.log"
        } 
      },
      categories: {
        default: {
          appenders: ["mongoDbAssistant"],
          level: "error"
        }
      },
    })
    this._logMongoDbAssistant = log4jsMongoDbAssistant.getLogger("mongoDbAssistant")
  }

  async queryCount(collection, query) {
    try {
      await this._clientMongoDb.connect()
      let db = this._clientMongoDb.db(process.env.MONGO_DB_NAME)
      let thisCollection = db.collection(collection)

      return await thisCollection.count(query)
    } catch (err) {
      this._logMongoDbAssistant.level = "error"
      this._logMongoDbAssistant.error(err)
    } finally {
      await this._clientMongoDb.close()
    }
  }

  async queryDeleteMany(collection, query) {
    try {
      await this._clientMongoDb.connect()
      let db = this._clientMongoDb.db(process.env.MONGO_DB_NAME)
      let thisCollection = db.collection(collection)
      return await thisCollection.deleteMany(query)
    } catch (err) {
      this._logMongoDbAssistant.level = "error"
      this._logMongoDbAssistant.error(err)
    } finally {
      await this._clientMongoDb.close()
    }
  }

  async queryUpdate(collection, query, update, options) {
    try {
      await this._clientMongoDb.connect()
      let db = this._clientMongoDb.db(process.env.MONGO_DB_NAME)
      let thisCollection = db.collection(collection)

      let res = await thisCollection.updateOne(query, update, options)

      return res || false
    } catch (err) {
      this._logMongoDbAssistant.level = "error"
      this._logMongoDbAssistant.error(err)
    } finally {
      await this._clientMongoDb.close()
    }
  }

  async queryFind(collection, query, select={}, sort={}, limit=2, skip=0) {
    try {
      await this._clientMongoDb.connect()
      let db = this._clientMongoDb.db(process.env.MONGO_DB_NAME)
      let thisCollection = db.collection(collection)

      let count = await thisCollection.count(query) || 0
      if (+count) {
        if (+limit == 999) {
          limit = count
          skip = 0
        }

        let arrResult = []
        let resRequest = await thisCollection
          .find(query)
          .project(select)
          .sort(sort)
          .limit(+limit)
          .skip(+skip)

        await resRequest.forEach((element) => {
          arrResult.push(element)
        })
        
        return {
          response: arrResult,
          count: count,
          limit: limit, 
          skip: skip
        }
      }

      return false
    } catch (err) {
      this._logMongoDbAssistant.level = "error"
      this._logMongoDbAssistant.error(err)
    } finally {
      await this._clientMongoDb.close()
    }
  }

  async queryInsertOne(collection, query) {
    try {
      let validResult = {error: 'Not valid'}

      switch(collection) {
        case this._collectionsList.chats_list:
            validResult = await this.getValidChatsList(query)
          break;
        case this._collectionsList.users:
            validResult = await this.getValidUser(query)
          break;
        case this._collectionsList.tokens:
            validResult = await this.getValidTokens(query)
          break;
        case this._collectionsList.directory_list:
            validResult = await this.getValidDirectoryList(query)
          break;
      }

      if (!validResult.error) {
        await this._clientMongoDb.connect()
        let DB = this._clientMongoDb.db(process.env.MONGO_DB_NAME)
        let thisCollection = DB.collection(collection)
        await thisCollection.insertOne(query)
      }
      
      return validResult
    } catch (err) {
      this._logMongoDbAssistant.level = "error"
      this._logMongoDbAssistant.error(err)
    } finally {
      await this._clientMongoDb.close()
    }
  }

  async getValidTokens(data) {
    let result = {
      key: data.key || null,
      user_id: data.user_id || null,
      user_first_name: data.user_first_name || null,
      user_last_name: data.user_last_name || null,
      user_username: data.user_username || null,
      user_is_bot: data.user_is_bot || false,
      user_language_code: data.user_language_code || null,
      token_active: data.token_active || false,
    }

    let arrResult = []

    for (let prop in result) {
      if (!(prop in data)) {
        arrResult.push(prop)
      }
    }

    return arrResult[0] ? {error: 'Not valid object Token', fieldEmpty: arrResult} : result
  }
  
  async getValidChatsList(data) {
    let result = {
      user_id: data.user_id || null,
      chat_id: data.chat_id || null,
      chat_title: data.chat_title || null,
      create_at: data.create_at || null,
    }

    let arrResult = []

    for (let prop in result) {
      if (!(prop in data)) {
        arrResult.push(prop)
      }
    }

    return arrResult[0] ? {error: 'Not valid object Cahts list', fieldEmpty: arrResult} : result
  }

  async getValidUser(data) {
    let result = {
      id: data.user_id || null,
      first_name: data.user_first_name || null,
      last_name: data.user_last_name || null,
      username: data.user_username || null,
      is_bot: data.user_is_bot || null,
      language_code: data.user_language_code || null,
    }

    let arrResult = []

    for (let prop in result) {
      if (!(prop in data)) {
        arrResult.push(prop)
      }
    }

    return arrResult[0] ? {error: 'Not valid object User', fieldEmpty: arrResult} : result
  }

  async getValidDirectoryList(data) {
    let result = {
      user_id: data.user_id || null,
      chat_id: data.chat_id || null,
      chat_title: data.chat_title || null,
      path: data.path || null,
    }

    let arrResult = []

    for (let prop in result) {
      if (!(prop in data)) {
        arrResult.push(prop)
      }
    }

    return arrResult[0] ? {error: 'Not valid object User', fieldEmpty: arrResult} : result
  }
}

module.exports = {mongoDbAssistant}