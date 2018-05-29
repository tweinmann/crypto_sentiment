// pull in libraries (test)
const express = require('express');
const path = require('path');
const collector = require('./collector');
const morgan = require('morgan');

// load environment vars
require('dotenv').config();
 
// instances
const app = express();

// logger
//app.use(morgan('combined')); 

// request handler
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

// request handler
app.get('/recentArticles', function(req, res) {
    collector.getArticles().then((input) => {  
        if(input.length>10) {
            input.splice(10, input.length - 1);
        }     
        res.send(JSON.stringify(input));
    }).catch((error) => {
        console.log(error);
        res.sendStatus(500);
    });
    return;
});

// request handler
app.get('/json', (req, res) => {
    collector.getArticles().then((input) => {       
        res.send(JSON.stringify(toD3JSON(input)));
    }).catch((error) => {
        console.log(error);
        res.sendStatus(500);
    });
    return;
});

// convert articles to D3 digestable JSON
function toD3JSON(articles, minCount = 0) {
    var coins = {};
    articles.forEach((item) => {
        Object.keys(item.weighting).forEach((coin) => {
            if(!coins[coin]) coins[coin] = [];
            coins[coin].push(item);
        });
    });
    var output = {"id":"coins", "children": []};
    Object.keys(coins).forEach((coin) => {
        var temp = [];
        coins[coin].forEach((item) => {
            var totalWeight = 0;
            Object.keys(item.weighting).forEach((key) => {
                totalWeight += item.weighting[key];
            });
            var score = parseInt((100 / totalWeight) * item.weighting[coin] / 100 * Math.abs(item.score)); 
            temp.push({"id": coin + "." + item._id, "url": item.url, "value": score, "sentiment":(item.score>0?"pos":"neg"), "current": item.current, "past": item.past, "timestamp": item.timestamp});
        });       
        var diff = collector.getRates()[coin];
        if(temp.length >= minCount) output.children.push( {"id":coin, "diff": parseInt(diff), "children": temp});
    });
    return output;
} 

// launch webserver
app.listen(3000, () => console.log('Listening on port 3000'));
 
// schedule article collection
if(!process.env.DISABLE_COLLECTOR) {
    collector.collectData();
}

// schedule rate updates
collector.updateRates();

