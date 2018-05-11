// pull in libraries (test)
const util = require('util');
const express = require('express');
const request = require('request');
const boiler = require('boilerpipe-scraper');
const Sentiment = require('sentiment');
const moment = require('moment');
const requestPromise = require('request-promise');
const Joi = require('joi');
const NewsAPI = require('newsapi');
const MongoClient = require('mongodb').MongoClient;
const collector = require('./collector');

// load environment vars
require('dotenv').config();

// instances
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

// static coin list (for now)
//var coins = ["nano", "bitcoin", "icon"];
var coins = ["nano", "bitcoin", "ethereum", "ripple", "stellar", "omisego", "0x", "icon", "iota"];

exports.collect = function collect() {

    getArticles().then((input) => {
        return skimArticles(input);
    }).then((input) => {
        return calculateSentiment(input);
    }).then((input) => {
        return storeArticles(input);
    }).then((input) => {
        // wait 60 seconds and restart
        setTimeout(() => {collect()}, 1000 * 60);
        console.log("collecting again in 60 seconds ...")
    }).catch((err) => {
        console.log(err);
    });
 
}

function getArticles(coin) {
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
                boiler(item.url, (err, text) => {
                    console.log("scanning -> " + item.url);
                    var score = "n/a";
                    var comparative = "n/a";
                    if(!err) {
                        var result = sentiment.analyze(text);
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

function storeArticles(articles) {
    console.log("storeArticles");
    // store articles
    var url = process.env.MONGODB_URL;
    var result = [];
    articles.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                MongoClient.connect(url, (err, db) => {
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
                    MongoClient.connect(url, (err, db) => {
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