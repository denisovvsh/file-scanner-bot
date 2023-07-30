const {mongoDbAssistant} = require('../controllers/mongo-db-assistant')
const {attributesAssistant} = require('../controllers/attributes-assistant')
const {FilescannerAssistant} = require('../controllers/filescanner-assistant')
require('dotenv').config()
const log4jsCronAssistant = require("log4js")

class cronAssistant extends attributesAssistant{
  constructor(bot, md5, ...args) {
    super(...args)

    this._bot = bot
    this._md5 = md5
    
    log4jsCronAssistant.configure({
      appenders: {
        cronAssistant: {
          type: "file",
          filename: "cronAssistant.log"
        } 
      },
      categories: {
        default: {
          appenders: ["cronAssistant"],
          level: "error"
        }
      },
    })

    this._logCronAssistant = log4jsCronAssistant.getLogger("cronAssistant")

    this._db = new mongoDbAssistant()
  }

  async findOrders_pulscen() {
    let crm = new FilescannerAssistant(this._bot, this._md5)
    crm.getLinksList()
  }
}

module.exports = {cronAssistant}