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

exports.collect = function collect() {

    getCoins().then((input) => {
        // get articles from newsapi
        return getArticles(input);
    }).then((input) => {
        // process all articles
        return calculateSentiment(input);
    }).then((input) => {
        // wait 60 seconds and restart
        setTimeout(() => {collect()}, 1000 * 3600 * 4);
        console.log("Collecting again in 4 hours ...")
    }).catch((err) => {
        console.log(err);
    });
 
}

function getArticles(coins) {
    return new Promise((resolve, reject) => {
        var result = [];
        coins.forEach((coin) => {
            result.push(       
     
                new Promise((resolve, reject) => {
     
                    newsapi.v2.everything({
                        q: '"' + coin + '"',
                        language: 'en',
                        sources: 'crypto-coins-news',
                        pageSize: 100,
                        from: moment().add(-4, 'week').format('YYYY-MM-DD'),
                    }).then((response) => {
                        var articles = response.articles;
                        articles.forEach((article) => {
                            article.coin = coin;
                        });
                        resolve(articles);
                    }).catch((err) => {
                        reject(err);
                    });
     
                })
     
     
            );
        }); 
        resolve(Promise.all(result));
    }).then((input) => {
        // merge arrays of articles
        var articles = [];
        input.forEach((item) => {
            articles = articles.concat(item);
        });
        console.log("Found " + articles.length + " articles ...");
        return articles;
    });

    
}

function calculateSentiment(articles) {
    if(articles.length > 0) {
        var article = articles.pop();        
        return new Promise((resolve, reject) => {
            // lookup article
            var url = process.env.MONGODB_URL;
            MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
                if (err) reject(err);
                var dbo = db.db("crypto_sentiment");
                dbo.collection("articles").findOne({url: article.url,query: article.coin}, (err, res) => {
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
                        var sentiment = new Sentiment();
                        var score = "n/a";
                        var comparative = "n/a";
                        if(!err) {
                            var content = extractor(body);
                            var result = sentiment.analyze(content.text);
                            score = result.score;
                            comparative = result.comparative;
                        } else {
                            // no sentiment calculated, but proceed
                            console.log(err);
                        }
                        resolve({'timestamp':article.publishedAt,'query':article.coin,'score':score,'comparative':comparative,'title':article.title,'url':article.url,'snippet':article.description,'source':article.source.id});          
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
                        var dbo = db.db("crypto_sentiment");
                        dbo.collection("articles").updateOne({url: newItem.url,query: newItem.query}, {$set:newItem}, {upsert: true}, (err, res) =>{
                            if (err) {
                                console.log(err);
                                reject(err);
                            }
                            console.log((res.result.upserted?"Added - ":"Skipped - ") + newItem.url + " article -> (query: " + newItem.query + ", score: " + newItem.score + ")");
                            db.close();
                            resolve(newItem);
                        });
                    });
                });
            } else {
                return;
            }
        }).then((item) => {
            if(articles.length%50==0) console.log("Processing articles -> " + articles.length + " to go ...");
            if(articles.length > 0) {
                return calculateSentiment(articles);
            } else {
                console.log("Processing articles finished!");
                return;
            }
        });  
    } else {
        return result;
    }
    
}

function getCoins() {
    return coinmarketcap.ticker("", "", 25).then((input) => {
        var result = [];
        input.forEach((item) => {
            result.push(item.name.toLowerCase());
        });
        console.log("Fetched top 20 coins -> " + result);
        return result;
    });
}