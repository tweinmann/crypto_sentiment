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

// static coin list (for now)
//var coins = ["nano", "bitcoin", "icon"];
var coins = ["nano", "bitcoin", "ethereum", "ripple", "stellar", "omisego", "0x", "icon", "iota"];

exports.collect = function collect() {

    getCoins().then((input) => {
        return getArticles(input);
    }).then((input) => {
        return skimArticles(input);
    }).then((input) => {
        return calculateSentimentR(input);
    }).then((input) => {
        return storeArticles(input);
    }).then((input) => {
        // wait 60 seconds and restart
        setTimeout(() => {collect()}, 1000 * 3600);
        console.log("collecting again in 1 hour ...")
    }).catch((err) => {
        console.log(err);
    });
 
}

function getArticles(coins) {
    console.log("getArticles");
    return new Promise((resolve, reject) => {
        var result = [];
        coins.forEach((coin) => {
            result.push(       
     
                new Promise((resolve, reject) => {
     
                    newsapi.v2.everything({
                        q: coin,
                        language: 'en',
                        sources: 'crypto-coins-news',
    //                    from: moment().add(-4, 'week').format('YYYY-MM-DD'),
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
        return articles;
    });

    
}

function calculateSentiment(articles) {
    console.log("calculateSentiment");

    // calculate sentiment
    var result = [];
    articles.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                var sentiment = new Sentiment();
                request(item.url, (err, res, body) => {
                    console.log("scanning -> " + item.url);
                    var score = "n/a";
                    var comparative = "n/a";
                    if(!err) {
                        var content = extractor(body);
                         var result = sentiment.analyze(content.text);
                        score = result.score;
                        comparative = result.comparative;
                    } else {
                        console.log(err);
                    }
                    resolve({'timestamp':item.publishedAt,'query':item.coin,'score':score,'comparative':comparative,'title':item.title,'url':item.url,'snippet':item.description,'source':item.source.id});          
                })

            }) 
        );
    });
    return Promise.all(result);     
}

function calculateSentimentR(articles, result = []) {
    console.log("calculateSentiment");
    if(articles.length > 0) {
        return new Promise((resolve, reject) => {
            var item = articles.pop();
            var sentiment = new Sentiment();
            request(item.url, (err, res, body) => {
                console.log("scanning -> " + item.url);
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
                resolve({'timestamp':item.publishedAt,'query':item.coin,'score':score,'comparative':comparative,'title':item.title,'url':item.url,'snippet':item.description,'source':item.source.id});          
            });
        }).then((input) => {
            result.push(input);
            return calculateSentimentR(articles, result);
        });  
    } else {
        return result;
    }
    
}

function storeArticles(articles) {
    console.log("storeArticles");
    // store articles
    var url = process.env.MONGODB_URL;
    var result = [];
    articles.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
                    if (err) reject(err);
                    var dbo = db.db("crypto_sentiment");
                    dbo.collection("articles").updateOne({url: item.url,query: item.query}, {$set:item}, {upsert: true}, (err, res) =>{
                        if (err) reject(err);
                        console.log((res.result.upserted?"added - ":"skipped - ") + item.url + " (query: " + item.query + ", score: " + item.score + ")");
                        db.close();
                        resolve(item);
                    });
                });
            }) 
        );
    });
    return Promise.all(result);    
}

function skimArticles(articles) {
    console.log("skimArticles");
    return new Promise((resolve, reject) => {
        // store articles
        var url = process.env.MONGODB_URL;
        var result = [];
        articles.forEach((item) => {
            result.push(
                new Promise((resolve, reject) => {
                    MongoClient.connect(url, { useNewUrlParser: true }, (err, db) => {
                        if (err) reject(err);
                        var dbo = db.db("crypto_sentiment");
                        dbo.collection("articles").findOne({url: item.url,query: item.coin}, (err, res) => {
                            if (err) reject(err);
                            db.close();
                            if (!res) resolve(item);
                            else resolve(null);
                        });
                    });
                }) 
            );
        });
        resolve(Promise.all(result));    
    }).then((input) => {
        var articles = [];
        input.forEach((item) => {
            if(item) articles.push(item);
        });
        return articles;
    });

}

function getCoins() {
    console.log("getCoins");
    return coinmarketcap.ticker("", "", 20).then((input) => {
        var result = [];
        input.forEach((item) => {
            result.push(item.name.toLowerCase());
        });
        return result;
    });
}