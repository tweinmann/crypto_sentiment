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
function toD3JSON(articles) {
    var coins = {};
    articles.forEach((item) => {
        if(!coins[item.coin]) coins[item.coin] = [];
        coins[item.coin].push(item);
    });
    var output = {"id":"coins", "children": []};
    Object.keys(coins).forEach((coin) => {
        var temp = [];
        coins[coin].forEach((item) => {
            temp.push({"id": coin + "." + item._id, "url": item.url, "value": Math.abs(item.score), "sentiment":(item.score>0?"pos":"neg"), "current": item.current, "past": item.past});
        });
        var rate = collector.getRates()[coin];
        var diff = 0;
        if(rate) {
            var current = rate.current;
            var past = rate.past;
            if(current > past) {
                diff = (100 / current) * (current - past);
            } else if (current < past) {
                diff = (100 / past) * (current - past);
            }
        }
        output.children.push( {"id":coin, "diff": parseInt(diff), "children": temp});
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

