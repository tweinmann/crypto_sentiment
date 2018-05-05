// pull in libraries II
 const util = require('util');
 const express = require('express');
 const request = require('request');
 const boiler = require('boilerpipe-scraper');
 const Sentiment = require('sentiment');
 const moment = require('moment');
 const requestPromise = require('request-promise');
 const Joi = require('joi');
 const NewsAPI = require('newsapi');
 
 // instances
 const newsapi = new NewsAPI('69b72226c32e4419ba88d7014f4134ee');
 const app = express();

 // cache results
 const cache = new Map();

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
    var html = cache.get(query);
    if(html) {
        // result found in cache
        console.log('serving cached version for query="' + query + "'");
        res.send(html);
    } else {
        // call remote API
        getArticles(query).then((result) => {
            return calculateSentiment(result)
        }).then((result) => {
            return renderHTML(result)
        }).then((result) => {
 //           cache.set(query, result);
            res.send(result);
            return;
        }).catch((error) => {
            console.log(error);
            return;
        });
    }
    return;

 });

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

 function extractText(items) {
    console.log("extractText");
    var result = [];
    items.forEach((item) => {
        result.push(
            new Promise((resolve, reject) => {
                var sentiment = new Sentiment();
                boiler(item.url, (err, text) => {
                    var score = "n/a";
                    var comparative = "n/a";
                    if(!err) {
                        score = sentiment.analyze(text).score;
                    } else {
                        console.log(err);
                    }
                    resolve({'score':score,'title':item.title,'url':item.url,'snippet':item.snippet,'source':item.source,'comparative':comparative});
                })      
            }) 
        );
    });
    return Promise.all(result);
 }

 function calculateSentiment(items) {
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
                    resolve({'score':result.score,'comparative':result.comparative,'title':item.title,'url':item.url,'snippet':item.description,'source':item.source});
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
    items.map((item) => {
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

 app.listen(3000, () => console.log('Listening on port 3000'));
 
