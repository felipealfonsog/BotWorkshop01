/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/
var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var dotenv = require('dotenv').config();
const parseString = require('xml2js').parseString;
const request = require('request')

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

var isProd = (process.env.Environment == 'prod');
console.log("is production? " + isProd);
var connector = isProd ? new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
}) : new botbuilder_azure.BotServiceConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});

// Documentation for text translation API here: http://docs.microsofttranslator.com/text-translate.html
bot.use({
    receive: function (event, next) {
        let idioma = ''
        let frase = event.text
        frase = frase.toString()

        idioma = {
            url: 'http://api.microsofttranslator.com/v2/http.svc/Detect?text=' + frase,
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.TRANSLATION_KEY
            }
        }

        let FROMLOCALE = '';
        let TOLOCALE = 'en';

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                let info = JSON.stringify(body)
                info = info.replace('"<', "<")
                info = info.replace('>"', ">")
                info = info.replace('"h', "h")
                info = info.replace('">', ">")
                info = info.replace(`<string xmlns=\http://schemas.microsoft.com/2003/10/Serialization/\>`, '')
                info = info.replace(`</string>`, '')
                FROMLOCALE = info
            }
        }

        request(idioma, callback)

            let options = {
                method: 'GET',
                url: 'http://api.microsofttranslator.com/v2/http.svc/translate?text=' + frase + '&from=' + FROMLOCALE + '&to=' + TOLOCALE,
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.TRANSLATION_KEY
                }
            }
            request(options, function (error, response, body) {
                if (error) {
                    return console.log('Error:', error)
                } else if (response.statusCode !== 200) {
                    return console.log('Invalid Status Code Returned:', response.statusCode)
                } else {
                    parseString(body, function (err, result) {
                        event.text = result.string._
                        next()
                    })

                }
        })
    }
})

bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;
console.log(LuisModelUrl);
// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('GreetingDialog',
    (session) => {
        session.send('You reached the Greeting intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('HelpDialog',
    (session) => {
        session.send('You reached the Help intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
})

bot.dialog('ProductDialog',
    (session) => {
        session.send('You reached the Product intent. You said \'%s\'.', session.message.text)
        // =======================================================
        let productoArray = {
            url: 'https://botworkshop01-fun.azurewebsites.net/api/HttpTriggerJS1?product=computer'
        }
 
        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                let arr = JSON.parse(body);
                console.log(arr)
                let msg = new builder.Message(session)
                msg.attachmentLayout(builder.AttachmentLayout.carousel)                
 
                let i = 0
                for (i = 0; i <= arr.length - 1; i++) {
                    let hc = new builder.HeroCard(session)
                        .title(arr[i].name)
                        .images([builder.CardImage.create(session, arr[i].image)])
                        .buttons([
                            builder.CardAction.imBack(session, "buy")
                        ])
                    msg.addAttachment(hc)
                }
                session.send(msg).endDialog()
            }
        }
        request(productoArray, callback)
        // =======================================================
    }
).triggerAction({
    matches: 'Product'
})