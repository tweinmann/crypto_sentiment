[![Build Status](https://travis-ci.org/tweinmann/crypto_sentiment.svg?branch=master)](https://travis-ci.org/tweinmann/crypto_sentiment)

# crypto sentiment 

Tiny sample app that provides an "at a glance" view of news article sentiments per crypto currency. 

On a regular interval it does the following:

1. Get top 100 coins from https://www.coinmarketcap.com
2. Get news articles from https://www.cryptocompare.com
3. For each article ....
    1. Get full HTML from article source URL
    2. Extract plain text (strip layout, adds, etc)
    3. Calculate weighting of coins from top 100 list (count occurence of coin name & symbol in plain text)
    4. Calculate sentiment based on AFINN words
    5. Store result in db

The result is visualized using D3 pack. Each article is rendered as a bubble (click to get to the original article). Negative sentiment is shown in red, positive sentiment in green. The bigger the bubble, the higher the score. The older the article, the paler the color.

Check out the example -> https://crypto-sentiment.now.sh

**Prerequisites**

1. Node
2. MongoDB

**Installation**

1. Create a file '''.env''' in the directory with the following content:

```
CRYPTO_COMPARE_API_KEY=[your Cryptocompare API key]
MONGODB_URL=mongodb://[your db user]:[your db password]@[your db URL]
MONGODB_NAME=[your db name]
```

2. `nmp install`

**Usage**

1. `npm start`
2. Access root of web app "http://localhost:3000/"





 
