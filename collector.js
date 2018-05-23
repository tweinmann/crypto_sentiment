// pull in libraries
const util = require('util');
const express = require('express');
const request = require('request');
const Sentiment = require('sentiment');
const moment = require('moment');
const requestPromise = require('request-promise');
const Joi = require('joi');
const NewsAPI = require('newsapi');
const MongoClient = require('mongodb').MongoClient;
const Coinmarketcap = require('node-coinmarketcap-api');
const collector = require('./collector');
const extractor = require('node-article-extractor');

// load environment vars
require('dotenv').config();

// instances
const coinmarketcap = new Coinmarketcap();
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

// coins in global scope
var coins = [];

// schedule data collector 
exports.collectData = function collectData() {

    // get coin listing from coinmarketcap
    loadCoins().then((input) => {
        // store coins in global scope
        coins = input;
        // get articles from newsapi
        return loadArticles();
    }).then((input) => {
        // process all articles
        return calculateSentiment(input, coins);
    }).then((input) => {
        // wait 4 hours and restart
        setTimeout(() => {collectData()}, 1000 * 3600 * 4);
        console.log("Collecting new articles in 4 hours ...")
    }).catch((err) => {
        console.log(err);
    });
 
}

// schedule rate updates
exports.updateRates = function updateRates() {

    // load rates
    loadRates().then((input) => {
        // store rates in global scope
        rates = input;
        // wait 10 minutes seconds and restart
        setTimeout(() => {updateRates()}, 1000 * 60 * 10);
        console.log("Updating rates in 10 minutes ...")
    }).catch((err) => {
        console.log(err);
    });

}

// get articles from db
exports.getArticles = function getArticles() {
    return new Promise((resolve, reject) => {
        var url = process.env.MONGODB_URL;
        MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
            if (err) reject(err);
            var dbo = db.db(process.env.MONGODB_NAME);
            dbo.collection("articles").find({"timestamp" : {"$gte": moment().add(-1, 'week').toDate().getTime()}}).sort([['_id', -1]]).toArray((err, result) => {
                if (err) reject(err);
                db.close();
                resolve(result);
            });
        });
    });    
}

// cache objects
var rates = {};

// get rates from cache
exports.getRates = function getRates() {
    return rates;
}

// load articles from newsapi
function loadArticles(articles = [], page = 1) {
    return new Promise((resolve, reject) => {
        newsapi.v2.everything({
 //           q: 'cryptocurrency OR blockchain',
            sources: 'crypto-coins-news',
            language: 'en',
            pageSize: 100,
            from: moment().add(-4, 'weeks').format('YYYY-MM-DD'),
            page: page
        }).then((response) => {
            console.log("Loading article metadata - " + (response.totalResults - ((page-1) * 100)) + " to go");
            resolve(response.articles);
        }).catch((err) => {
            reject(err);
        });
    }).then((input) => {
        // merge arrays of articles
        articles = articles.concat(input);
        if(input.length == 100) return loadArticles(articles, page + 1);
        console.log("Loading article metadata - finished!");
        return articles;
    });
}

// calculate sentiment for each article and store in db
function calculateSentiment(articles) {
    if(articles.length > 0) {
        var article = articles.pop();        
        return new Promise((resolve, reject) => {
            // lookup article
            var url = process.env.MONGODB_URL;
            MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
                if (err) reject(err);
                var dbo = db.db(process.env.MONGODB_NAME);
                dbo.collection("articles").findOne({url: article.url}, (err, res) => {
                    if (err) reject(err);
                    db.close();
                    if (!res) resolve(false);
                    else resolve(true);
                });
            });
        }).then((found) => {        
            if(!found) {
                // calculate sentiment
                return new Promise((resolve, reject) => {
                    request(article.url, (err, res, body) => {
                        if(!err) {
                            var content = extractor(body);
                            var sentiment = new Sentiment();
                            var result = sentiment.analyze(content.text);
                            var coinWeighting = calculateCoinWeighting(content.text, coins);
                            resolve({'timestamp':Date.parse(article.publishedAt),'weighting':coinWeighting,'score':result.score,'comparative':result.comparative,'title':article.title,'url':article.url,'source':article.source.id});
                        } else {
                            // no sentiment calculated, but proceed
                            console.log("Failed to fetch article -> " + article.url);
                        }
                        resolve(null);
                    });
                });
            } else {
                return null;
            }
        }).then((newItem) => {
            if(newItem) {
                // store new item
                return new Promise((resolve, reject) => {
                    var url = process.env.MONGODB_URL;
                    MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
                        if (err) reject(err);
                        var dbo = db.db(process.env.MONGODB_NAME);
                        dbo.collection("articles").updateOne({url: newItem.url}, {$set:newItem}, {upsert: true}, (err, res) =>{
                            if (err) {
                                console.log(err);
                                reject(err);
                            }
                            console.log((res.result.upserted?"Added - ":"Skipped - ") + newItem.url + " article -> " + JSON.stringify(newItem));
                            db.close();
                            resolve(newItem);
                        });
                    });
                });
            } else {
                return;
            }
        }).then((item) => {
            if(articles.length%50==0) console.log("Calculating article sentiment - " + articles.length + " to go");
            if(articles.length > 0) {
                return calculateSentiment(articles);
            } else {
                console.log("Calculating article sentiment - finished!");
                return;
            }
        });  
    } else {
        return null;
    }
    
}

// delete coin entries from db
function deleteCoin(coin) {
    return new Promise((resolve, reject) => {
        var url = process.env.MONGODB_URL;
        MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
            if (err) throw err;
            var dbo = db.db(process.env.MONGODB_NAME);
            var query = { coin: coin };
            dbo.collection("articles").deleteMany(query, (err, obj) => {
                if (err) throw err;
                console.log(obj.result.n + " document(s) deleted");
                db.close();
            });
        });   
    });
}

// load coin data from coinmarketcap
function loadCoins() {
    return coinmarketcap.ticker("", "", 100).then((input) => {
        var result = [];
        input.forEach((item) => {
            result.push({"name": item.name.toLowerCase().replace(/[^\w\s]/gi, '_'), "symbol":item.symbol.replace(/[^\w\s]/gi, '_')});
        });
        return result;
    });
}

// load rate data from coinmarketcap
function loadRates() {
    return coinmarketcap.ticker("", "").then((input) => {
        var result = {};
        input.forEach((item) => {
            result[item.symbol.replace(/[^\w\s]/gi, '_')] = item.percent_change_7d;
        });
        return result;
    });    
}

// count occurences of coins in text
function calculateCoinWeighting(text, coins = []) {
    var result = {};
    // order by number of spaces (this is to catch e.g. "Bitcoin Cash" before "Bitcoin")
    coins.sort((a,b) => {
        if(a.name.split(" ").length > b.name.split(" ").length) return -1;
        else return 1;
    });
    coins.forEach((coin) => {
        var count = 0;
        var nameRegex = new RegExp(" " + coin.name + " ", "gi");
        var nameCount = (text.match(nameRegex) || []).length;
        if(nameCount) {
            text =  text.replace(nameRegex, "___");
        }
        var symbolRegex = new RegExp(" " + coin.symbol + " ", "gi");                
        var symbolCount = (text.match(symbolRegex) || []).length;
        if(nameCount > symbolCount) {
            count = nameCount;
        } else {
            count = symbolCount;
        }
        if(count) result[coin.symbol] = count;
    });
    return result;
}