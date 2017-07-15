// This file holds instance-depended settings and configurations
var config = module.exports = {}

// Talk to @BotFather to set up a bot and get the token
config.token = '';

// If whitelist_enabled is set to 1, bot will talk only to the chat IDs
//  specified in the whitelist array.
config.whitelist_enabled = 0;
config.whitelist = [];

// Define feed fetching interval in seconds (default: 5 seconds)
config.refreshInterval = 5;