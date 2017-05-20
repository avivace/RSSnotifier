var request = require('request'),
    FeedParser = require('feedparser'),
    Iconv = require('iconv').Iconv,
    zlib = require('zlib'),
    schedule = require('node-schedule'),
    sqlite3 = require('sqlite3').verbose(),
    botUI = require('./bot.js'),
    config = require('./config.js'),
    HashMap = require('hashmap');


const TelegramBot = require('node-telegram-bot-api');
var db = new sqlite3.Database('db.sqlite');

var alreadyParsed = new HashMap();

// Telegram bot. Polling to fetch new messages
const bot = new TelegramBot(config.token, {
  polling: true
});

function getFeeds() {
    // Get all unique active feeds to retrieve
    gf_Query = 'SELECT DISTINCT FeedURL from QUERIES where Active =\'1\'';
    // FIXME: use ? notation for better readability
    db.all(gf_Query, function(error, rows) {
        if (rows.length == 0) console.log("No feeds")

        // For each unique feed retrieved... 
        rows.forEach(function(row) {

            // ...fetch the feed, retrieve the queries for it and test the match
            fetch(row.FeedURL);
            // TODO: if the row is invalid for some reason, skip it

        });

    });
}

function match(post, queryKeywords, chatId) {

    // Parse current query element into an Object 
    var queryKeywords = JSON.parse(queryKeywords);

    // Declare the match valid in advance
    var matchStillValid = true;

    var title = post["rss:title"]["#"];

    // For each keyword of current query test the match with Feed Title
    for (var keyword in queryKeywords) {

        // Build a new regular expression with current keyword to pass it 
        //  "i" flag for case-insensitive check
        var re = new RegExp(queryKeywords[keyword], 'i');

        // Test the match for current keyword
        var match = title.match(re) ? true : false;

        // If even a single keyword does not pass the test make the entire 
        //  query useless 
        if (match == false) {
            matchStillValid = false;
        }

    }

    // If every keyword in current query passed the test we have our match!
    // Time to start with notifications!
    if (matchStillValid) {
      // TODO: prevalid Feed-relative hardcoded values and avoid composing 
      //  the notification message with invalid ones
      console.log("matched")
      var description = post["rss:description"]["#"];
      var link = post["rss:link"]["#"]
      bot.sendMessage(chatId, "<b>New match!</b> \n"+ title + "\n" + description + "\n" + link, { parse_mode: "HTML" })
    }


}



function fetch(url) {
    // Define our streams
    var req = request(url, {
        timeout: 10000,
        pool: false
    });
    
    req.setMaxListeners(50); // Some feeds do not respond without user-agent and accept headers.
    req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36');
    req.setHeader('accept', 'text/html,application/xhtml+xml');

    var feedparser = new FeedParser();

    // Define our handlers
    req.on('error', done);
    req.on('response', function(res) {
        if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
        var encoding = res.headers['content-encoding'] || 'identity',
            charset = getParams(res.headers['content-type'] || '').charset;
        // res = maybeDecompress(res, encoding);
        res = maybeTranslate(res, charset);
        res.pipe(feedparser);
    });

    feedparser.on('error', done);
    feedparser.on('end', done);

    // Select every active query (and its owner) for current feed...
    var rq_Query = 'SELECT Owner, Keywords AS keywordGroup FROM QUERIES where FeedURL = \'' + url + '\' AND Active = \'1\'';
    // FIXME: use ? notation for better readability
    db.all(rq_Query, function(error, rows) {
        var i = 0;
        var done = 0;
        var firsttime = 0;
        var title;
        console.log("Fetching "+url)
        feedparser.on('readable', function() {
            var post;
            if (!done) {
              while (post = this.read()) {
                  
                  title = post["rss:title"]["#"];
                  //console.log("Element #"+i+" - "+title)
                  if (done) console.log("done")
                  if (i == 0 && !alreadyParsed.get(url)) {
                    console.log("First time on this Feed")
                    alreadyParsed.set(url, title)
                    console.log(alreadyParsed.get(url))
                    firsttime = 1;
                  }

                  if (i == 0) {
                    firstOfIteration = title;
                    alreadyParsed.set("FI"+url, title)
                  }
                  if (!firsttime && alreadyParsed.get(url) == title){
                      done = 1;
                      alreadyParsed.set(url, firstOfIteration)
                      console.log("Stopping at "+ i)

                      // just quit this feed
                  }
                   
                  // ...and for every results...
                  if (!done) {
                     
                     rows.forEach(function(row) {

                      // ...look for match

                        match(post, row.keywordGroup, row.Owner);

                     });
                  }

              i += 1;
              }
            }
        
        });
    /*
    if (done == 0){
      console.log("Finished a totally new feed, setting the last Parsed to FI")
      alreadyParsed.set(url, alreadyParsed.get("FI"+url, title))
    }
    FIXME:
    NOT WORKING, IT'S ACTUALLY EXECUTED BEFORE feed.readable
    Find a way to know if the last interaction finished without ever encountering
    alreadyParsed (totally new feed) AND SET alreadyParsed to the head of the
    new feed
    */
    });
}

function maybeDecompress(res, encoding) {
    var decompress;
    if (encoding.match(/\bdeflate\b/)) {
        decompress = zlib.createInflate();
    } else if (encoding.match(/\bgzip\b/)) {
        decompress = zlib.createGunzip();
    }
    return decompress ? res.pipe(decompress) : res;
}

function maybeTranslate(res, charset) {
    var iconv;
    // Use iconv if its not utf8 already.
    if (!iconv && charset && !/utf-*8/i.test(charset)) {
        try {
            iconv = new Iconv(charset, 'utf-8');
            console.log('Converting from charset %s to utf-8', charset);
            iconv.on('error', done);
            // If we're using iconv, stream will be the output of iconv
            // otherwise it will remain the output of request
            res = res.pipe(iconv);
        } catch (err) {
            res.emit('error', err);
        }
    }
    return res;
}

function getParams(str) {
    var params = str.split(';').reduce(function(params, param) {
        var parts = param.split('=').map(function(part) {
            return part.trim();
        });
        if (parts.length === 2) {
            params[parts[0]] = parts[1];
        }
        return params;
    }, {});
    return params;
}

function done(err) {
    if (err) {
        console.log(err, err.stack);
        return process.exit(1);
    }
    //server.close();
    //process.exit();
}

// Do things
// Bot up and running
botUI.start(db, bot, config, HashMap)
// Run the entire thing every 5 seconds
var job = schedule.scheduleJob('*/5 * * * * *', function(){
  getFeeds();
});

// TODO: different refresh time for specific feed urls?
// TODO: Allow user to receive notification as digests in specific time
// TODO: Some kind of exception handling?