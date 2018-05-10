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

 // load environment vars
 require('dotenv').config();
 
 // instances
 const newsapi = new NewsAPI(process.env.NEWS_API_KEY);
 const app = express();

 // request handler
 app.get('/:q', (req, res) => {
 
    // validate parameters
     const schema = {
        q: Joi.string().min(1).max(50)
     };
     const result = Joi.validate(req.params, schema);
     if(result.error) {
        res.status(400).send(result.error.details[0].message);
        return;
    }  

    var query = result.value.q;
    // call remote API
    getArticles(query,res).then((result) => {
        return calculateSentiment(result, query)
    }).then((result) => {
        return renderHTML(result)
    }).then((result) => {
        res.send(result);
        return;
    }).catch((error) => {
        console.log(error);
        res.sendStatus(500);
        return;
    });
    return;

 });

 var coins = ["nano"];
 //var coins = ["nano", "bitcoin", "ethereum", "ripple", "stellar", "omisego", "0x"];

 function collect() {
 
    console.log("1");
    var result = [];
    coins.forEach((coin) => {
        result.push(       

            new Promise((resolve, reject) => {

                newsapi.v2.everything({
                    q: coin,
                    language: 'en',
                    sources: 'crypto-coins-news',
                    from: moment().add(-2, 'week').format('YYYY-MM-DD'),
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

    Promise.all(result).then((input) => {
        console.log("2");

        var articles = [];
        input.forEach((item) => {
            articles = articles.concat(item);
        });

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
    }).then((input) => {
        console.log("3");

        // store articles
        var url = process.env.MONGODB_URL;
        var result = [];
        input.forEach((item) => {
            result.push(
                new Promise((resolve, reject) => {
                    MongoClient.connect(url, (err, db) => {
                        if (err) reject(err);
                        var dbo = db.db("crypto_sentiment");
                        dbo.collection("articles").updateOne({url: item.url}, {$set:item}, {upsert: true}, (err, res) =>{
                          if (err) reject(err);
                          console.log((res.result.upserted?"added - ":"skipped - ") + item.url);
                          db.close();
                          resolve(item);
                        });
                    });
                }) 
            );
        });
        return Promise.all(result);
    }).then((input) => {
        setTimeout(() => {collect()}, 1000 * 60);
    }).catch((err) => {
        console.log(err);
    });

 }

 function getArticles(query) {
    console.log("getArticles");
    // Return new promise 
    return new Promise((resolve, reject) => {

        // To query /v2/everything 
        // You must include at least one q, source, or domain
        newsapi.v2.everything({
            q: query,
            language: 'en',
            sources: 'crypto-coins-news',
     //       sources: 'crypto-coins-news,ars-technica,techcrunch,techradar,business-insider,financial-post,financial-times,fortune,hacker-news,recode,the-verge,the-wall-street-journal,time,wired',
            from: moment().add(-2, 'week').format('YYYY-MM-DD'),
            /*  domains: 'bbc.co.uk, techcrunch.com',
            to: '2017-12-12',
            language: 'en',
            sortBy: 'relevancy',
            page: 8*/
        }).then((response) => {
            resolve(response.articles);
        }).catch((err) => {
            reject(err);
        });
    
    });
 }

 function calculateSentiment(items, query) {
    console.log("calculateSentiment");
    var result = [];
    items.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                var sentiment = new Sentiment();
                boiler(item.url, (err, text) => {
                    var score = "n/a";
                    var comparative = "n/a";
                    if(!err) {
                        var result = sentiment.analyze(text);
                    } else {
                        console.log(err);
                    }
                    resolve({'timestamp':item.publishedAt,'query':query,'score':result.score,'comparative':result.comparative,'title':item.title,'url':item.url,'snippet':item.description,'source':item.source.id});
                })      
            }) 
        );
    });
    return Promise.all(result);
 }

 function renderHTML(items) {
    console.log("renderHTML");
    var sentiment = new Sentiment();
    var totalScore = 0;
    var html = "<html><body>";
    items.forEach((item) => {
        var score = item.score;
        var background = "rgb(200, 200, 200)"; 
        if(score == 'n/a') {
            background = "rgb(200, 200, 200)"; 
        } else if (score < 0) {
            background = "rgb(255, " + (255+score*10) + ", " + (255+score*10) + ")"; 
        } else if (score > 0 ) {
            background = "rgb(" + (255-score*10) + ", 255, " + (255-score*10) + ")"; 
        }
        totalScore += score;
        html +=  '<div style="box-shadow: 2px 2px gray; border-radius: 10px; width: 22%; height: 60px; overflow: scroll; float: left; font: 12px arial; background: ' + background + '; border: 0px solid gray; margin: 5px; padding: 5px; font: arial"><a href="' + item.url + '">' + item.title + '</a> (' + score + ')</div>'
    });
    html += '<div style="font: 36px arial">' + totalScore + '</div>';
    html += "</body></html>";
    return html;
 }

 function storeArticles(items) {
    console.log("storeArticles");
    var url = process.env.MONGODB_URL;
    var result = [];
    items.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                MongoClient.connect(url, (err, db) => {
                    if (err) reject(err);
                    var dbo = db.db("crypto_sentiment");
                    dbo.collection("articles").updateOne({url: item.url}, {$set:item}, {upsert: true}, (err, res) =>{
                      if (err) reject(err);
                      console.log((res.result.upserted?"added - ":"skipped - ") + item.url);
                      db.close();
                      resolve(item);
                    });
                });
            }) 
        );
    });
    return Promise.all(result);
 }

 app.listen(3000, () => console.log('Listening on port 3000'));
 
 collect();
