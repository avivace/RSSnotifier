# rssnotifier
A Node application - a resident **backend** and a Telegram **bot** - that scans RSS feeds and sends notifications on matching elements.
Provides a user UI with the bot, allowing every user to manage its preferences and subscriptions. Every user can add its query on a custom RSS feed URL.

## Using
Given you have Node installed, deploy your instance in this way:

- Clone this repo, `git clone https://github.com/avivace/rssnotifier`
- Edit `config.js` with your botToken and configure the whitelisting
- `npm install`
- `npm start`
- Talk with the bot and add a sample query