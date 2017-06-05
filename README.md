# RSSnotifier

An RSS reader on steroids.

### `index.js`
A Node **backend** handles the feed parsing and reading. The `match` function flags specific elements, based on user-defined keywords (*queries*).

### `bot.js`
A telegram bot - working as a frontend - allowing multiple users to define their subscriptions, preferences and *queries*.

Every subscription can be set on two modes:

- **query-mode** - every query-matching element triggers a notification;
- **reading-mode** - every new element will be notified.

## Using
Given you have Node (and npm) installed, deploy your instance:

- Clone this repo, `git clone https://github.com/avivace/rssnotifier`
- Edit `config.js` with your botToken and configure the whitelisting
- `npm install`
- `npm start`
- Talk with the bot and add a sample query