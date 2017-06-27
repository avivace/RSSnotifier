#!/bin/bash
mv rssnotifier/db.sqlite temp/db.sqlite
mv rssnotifier/config.js temp/config.js
rm -rf rssnotifier
git clone https://github.com/avivace/rssnotifier
mv temp/db.sqlite rssnotifier/db.sqlite
mv temp/config.js rssnotifier/config.js
cd rssnotifier
npm install
