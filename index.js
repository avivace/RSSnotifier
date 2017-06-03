var request = require('request'),
    FeedParser = require('feedparser'),
    Iconv = require('iconv').Iconv,
    zlib = require('zlib'),
    schedule = require('node-schedule'),
    sqlite3 = require('sqlite3').verbose(),
    HashMap = require('hashmap'),
    stripTags = require('striptags');

// Element is in array helper function
var contains = function(needle) {
    // Per spec, the way to identify NaN is that it is not equal to itself
    var findNaN = needle !== needle;
    var indexOf;
    if (!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1,
                index = -1;
            for (i = 0; i < this.length; i++) {
                var item = this[i];
                if ((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }
            return index;
        };
    }
    return indexOf.call(this, needle) > -1;
};

var botUI = require('./bot.js'),
    config = require('./config.js');

const TelegramBot = require('node-telegram-bot-api');
var db = new sqlite3.Database('db.sqlite');
// Element number
var i = 0;
var feeds = new HashMap();
var cachedFeeds = new HashMap;
// Telegram bot. Polling to fetch new messages
const bot = new TelegramBot(config.token, {
    polling: true
});
// Helper Functions
// Feed Parsing
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

// contains.call(config.whitelist, chatId))
// Serious shit
function getFeeds() {
    // Retrieve all the unique feed URLs, and fetch each of them
    var gf_Query = 'SELECT DISTINCT FeedURL from QUERIES where Active = ?';
    var gf_Query_Params = [1];
    db.all(gf_Query, gf_Query_Params, function(error, rows) {
        if (rows.length == 0) console.log("No feeds")
        rows.forEach(function(row) {
            // Try to fetch current URL and handle errors or bad response status codes
            fetch(row.FeedURL);
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
    // Every keyword matched
    if (matchStillValid) {
        // TODO: prevalid Feed-relative hardcoded values and avoid composing
        //  the notification message with invalid ones
        console.log("Matched!")
            // Stripping HTML code from description to avoid Telegram complaining,
            // it possibly needs addition of allowed tags
        var description = stripTags(post["rss:description"]["#"]);
        var link = post["rss:link"]["#"]
        console.log("Matched " + title + ".Sending notification to " + chatId + ".")
        bot.sendMessage(chatId, "<b>New match!</b> \n" + title + "\n" + description + "\n" + link, {
            parse_mode: "HTML"
        })
    }
}

function fetch(url) {
    // Watch out for any error raised during fetching/parsing process
    try {
        // Stream definitions
        var req = request(url, {
            timeout: 10000,
            pool: false
        });
        // Some feeds do not respond without user-agent and accept headers.
        req.setMaxListeners(50);
        req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36');
        req.setHeader('accept', 'text/html,application/xhtml+xml');
        // HANDLERS
        // Handle request error
        req.on('error', function(err) {
            console.log('ERROR:', err.code, 'on', url, '- Not a valid URL - Aborting feed...\n')
        });
        // Handle bad response status codes and, in case of status code 200, go on parsing the feed
        req.on('response', function(res) {
            switch (res.statusCode) {
                case 500:
                    console.log('ERROR: Status Code', res.statusCode, '- INTERNAL SERVER ERROR on', url, '- Aborting feed...\n');
                    break;
                case 404:
                    console.log('ERROR: Status Code', res.statusCode, '- FEED NOT FOUND on', url, '- Aborting feed...\n');
                    break;
                case 200:
                    // No request error, fetch the feed and try parsing it!
                    //fetch(url, res);
                    var feedparser = new FeedParser();
                    var encoding = res.headers['content-encoding'] || 'identity',
                        charset = getParams(res.headers['content-type'] || '').charset;
                    // res = maybeDecompress(res, encoding);
                    res = maybeTranslate(res, charset);
                    res.pipe(feedparser);
                    feedparser.on('error', feedParseDone);

                    // Select every active query (and its owner) for current feed
                    var rq_Query = 'SELECT Owner, Keywords AS keywordGroup FROM QUERIES where FeedURL = ? AND Active = ?';
                    var rq_Query_Params = [url, 1];
                    db.all(rq_Query, rq_Query_Params, function(error, rows) {
                        //console.log(rows)
                        console.log("Fetching " + url)
                        feeds.set(url, new Array());
                        feedparser.on('readable', function() {
                            var post;
                            while (post = this.read()) {
                                feeds.get(url).push(post);
                            }

                        });
                        feedparser.on('end', function(){
                            console.log("Feed " + url + "ready. Checking new elements")
                            // console.log(feeds.get(url))
                            console.log(rows)
                            // var newElements = doThings(feeds.get(url), cachedFeeds.get(url));
                            // newElements.forEach(function(element)){
                            //  rows.forEach(function(row) {
                            //      match(post, row.keywordGroup, row.Owner);
                            //  });   
                            // } 
                        });
                    });
                    break;
            }
        });
    } catch (err) {
        console.log('ERROR:', err.message, '- Aborting feed...\n');
    }
}
// Called on request error, feedparser error or end and manually when we're
//  skipping the feed processing
function feedParseDone(err, rows) {
    //console.log(rows)
    if (err) {
        console.log(err, err.stack);
        return process.exit(1);
    }
}
// DO THINGS
// Bot up and running
botUI.start(db, bot, config, HashMap)
    // Run the entire thing every 5 seconds
var job = schedule.scheduleJob('*/5 * * * * *', function() {
    getFeeds();
});
// TODO: different refresh time for specific feed urls?
// TODO: Allow user to receive notification as digests in specific time
// TODO: Some kind of exception handling?
// TODO: Make code decent, 78-80 columns