module.exports = {
  start: function (db) {
        var HashMap = require('hashmap');
        var config = require('./config.js');
        const TelegramBot = require('node-telegram-bot-api');

        // Strings
        const errorText_0 = "Mh, something went wrong. Retry the last phase or /cancel to start over"
        const errorText_1 = "Command unrecognised. See /help"
        const errorText_2 = "Something unexpected happened. Please restart from the beginning."
        const startText = "Yay, welcome and w/e"
        const helpText = "Yay, commands and w/e"
        const cancelText = "Yay, aborting all efforts"
        const addqueryText_0 = "Great! Send me a list of keywords separated by a single space. Like this: `Doctor` `Who`"
        const addqueryText_1 = "Gotcha. Now send me the Feed URL"
        const addqueryText_2 = "Yay. I've added the query to your account. You will receive notifications on matching elements"

        // Create a bot. Polling to fetch new messages
        const bot = new TelegramBot(config.token, {polling: true});
        // Holds the current conversation state per user
        var convStatusMap = new HashMap();
        // Holds the Keyword array for the last phase of /addquery conversation
        var tempArrayMap = new HashMap();
        var status = 0;
        
        // Listen for any kind of message
        bot.on('message', (msg) => {

          const chatId = msg.chat.id;
          const message = msg.text;
          console.log (chatId + " : " + message)
          if (!convStatusMap.get(chatId)){
            status = 0;
          }
          else {
            status = convStatusMap.get(chatId);
          }
          // Fallback cancel
          if (message.match(/\/cancel\s*/)){
            bot.sendMessage(chatId, cancelText);
            convStatusMap.set(chatId, 0)
          }

          console.log(status)
          // Conversation Handling
          switch (status){
            case 0:
                if (message.match(/\/start\s*/))
                    bot.sendMessage(chatId, startText);
                else if (message.match(/\/help\s*/)) 
                    bot.sendMessage(chatId, helpText);
                else if (message.match(/\/addquery\s*/)){
                    bot.sendMessage(chatId, addqueryText_0, {parse_mode:"Markdown"})
                    convStatusMap.set(chatId, 1)  
                }
                else if (message.match(/\/status\s*/)){
                    // COMPOSE SQL TO MATCH EVERY EXISTENT QUERY
                    bot.sendMessage(chatId, "status")
                }
                else {
                    bot.sendMessage(chatId, errorText_1)
                }
                break;

            case 1:
                if (message.match(/[A-Za-z\s0-9]*/)) {
                    var array = JSON.stringify(message.split(' '));
                    convStatusMap.set(chatId, 2)
                    tempArrayMap.set(chatId, array)
                    bot.sendMessage(chatId, addqueryText_1)
                }
                else {
                    bot.sendMessage(chatId, errorText_0)
                }
                break;

            case 2:
                // maybe URL regex?
                convStatusMap.set(chatId, 0)
                bot.sendMessage(chatId, addqueryText_2)
                db.run("INSERT INTO `QUERIES`(`ID`,`Keywords`,`Owner`,`FeedURL`,`Active`) VALUES (NULL,?,?,?, 1)", tempArrayMap.get(chatId) , chatId, message);
                break;

            default:
                bot.sendMessage(chatId, errorText_2);
                convStatusMap.set(chatId, 0)
          }
        });
  }
};