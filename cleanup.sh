#!/bin/bash
mkdir .tmp
mv rssnotifier/db.sqlite .tmp/db.sqlite
mv rssnotifier/config.js .tmp/config.js
rm -rf rssnotifier
git clone https://github.com/avivace/rssnotifier
mv .tmp/db.sqlite rssnotifier/db.sqlite
mv .tmp/config.js rssnotifier/config.js
rm -rf .tmp
cd rssnotifier
git update-index --assume-unchanged config.js
git update-index --assume-unchanged db.sqlite
npm install