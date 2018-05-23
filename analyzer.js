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

// var coins = ["bitcoin", "bitcoin cash", "bitcoin cash fork", "ethereum", "etherum classic"]
var coins;

collector.loadCoins().then((input) => {
    
    coins = input;
    coins.sort((a,b) => {
        if(a.name.split(" ").length > b.name.split(" ").length) return -1;
        else return 1;
    });
    return(collector.getArticles());

}).then((input) => {

    return crawl(input);
 //   console.log(countCoinOccurences("jkjkj bitcoin cash bitcoin", coins));

});

function crawl(articles = []) {

    if(articles.length > 0) {
        var article = articles.pop();        
        return new Promise((resolve, reject) => {
            request(article.url, (err, res, body) => {
                var sentiment = new Sentiment();
                var score = "n/a";
                var comparative = "n/a";
                if(!err) {
                    var content = extractor(body);
                    var result = sentiment.analyze(content.text);

                    console.log(content.text);
                    console.log("score: " + result.score + " -> " + JSON.stringify(countCoinOccurences(content.text, coins)));
                    console.log("*******************");

                    score = result.score;
                    comparative = result.comparative;
                } else {
                    // no sentiment calculated, but proceed
                    console.log(err);
                }
                resolve({'timestamp':article.publishedAt,'coin':article.coin,'symbol':article.symbol,'score':score,'comparative':comparative,'title':article.title,'url':article.url,'snippet':article.description,'source':article.source.id});          
            });
        }).then((item) => {
            if(articles.length%50==0) console.log("Processing articles -> " + articles.length + " to go ...");
            if(articles.length > 0) {
                return crawl(articles);
            } else {
                console.log("Processing articles finished!");
                return;
            }
        });  
    } else {
        return;
    }

}


function countCoinOccurences(text, coins = []) {
    var result = {};
    coins.forEach((coin) => {
        var count = 0;
        var nameRegex = new RegExp(coin.name, "gi");
        var nameCount = (text.match(nameRegex) || []).length;
        if(nameCount) {
            text =  text.replace(nameRegex, "___");
        }
        var symbolRegex = new RegExp(coin.symbol, "g");                
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