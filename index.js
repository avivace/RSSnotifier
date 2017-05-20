var request = require('request'),
    FeedParser = require('feedparser'),
    Iconv = require('iconv').Iconv,
    zlib = require('zlib'),
    schedule = require('node-schedule'),
    sqlite3 = require('sqlite3').verbose(),
    bot = require('./bot.js')

var db = new sqlite3.Database('db.sqlite');


function getFeeds() {
    // Get all unique active feeds to retrieve
    gf_Query = 'SELECT DISTINCT FeedURL from QUERIES where Active =\'1\'';
    db.all(gf_Query, function(error, rows) {

        // For each unique feed retrieved... 
        rows.forEach(function(row) {

            // ...fetch the feed, retrieve the queries for it and test the match
            fetch(row.FeedURL);

        });

    });
}

function match(title, queryKeywords, chatId) {

    // Parse current query element into an Object 
    var queryKeywords = JSON.parse(queryKeywords);

    // Declare the match valid in advance
    var matchStillValid = true;

    // For each keyword of current query test the match with Feed Title
    for (var keyword in queryKeywords) {

        // Build a new regular expression with current keyword to pass it "i" flag for case-insensitive check
        var re = new RegExp(queryKeywords[keyword], 'i');

        // Test the match for current keyword
        var match = title.match(re) ? true : false;

        // If even a single keyword does not pass the test make the entire query useless 
        if (match == false) {
            matchStillValid = false;
        }

    }

    // If every keyword in current query passed the test we have our match!
    // Time to start with notifications!
    if (matchStillValid) 
    {
        //do stuff...
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
    db.all(rq_Query, function(error, rows) {

        feedparser.on('readable', function() {

            var post;
            while (post = this.read()) {

                var title = post["rss:title"]["#"];

                // ...and for every results...
                rows.forEach(function(row) {

                    // ...look for match
                    match(title, row.keywordGroup, row.Owner);

                });

            }

        });


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

/*
var job = schedule.scheduleJob('0 * * * * *', function(){
  readSettings();
  fetch(FeedURL);
});*/

// Do things
bot.start(db)
getFeeds();