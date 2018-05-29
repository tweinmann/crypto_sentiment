[![Build Status](https://travis-ci.org/tweinmann/crypto_sentiment.svg?branch=master)](https://travis-ci.org/tweinmann/crypto_sentiment)

# crypto sentiment

Tiny sample app that provides an "at a glance" view of news article sentiments per crypto currency. 

On a regular interval it does the following:

1. Get top 100 coins from https://www.coinmarketcap.com
2. Get news articles from https://www.ccn.com/ for past 7 days via https://newsapi.org
3. For each article ...
    1. Get full HTML from article source URL
    2. Extract plain text (strip layout, adds, etc)
    3. Calculate weighting of coins from top 100 list (count occurence of coin name & symbol in plain text)
    4. Calculate sentiment based on AFINN words
    5. Store result in db

The result is visualized using D3 pack. Each article is rendered as a bubble. Negative sentiment is shown in red, positive sentiment in green. The bigger the bubble, the higher the score. 

Check out the example -> https://crypto-sentiment.now.sh

**Prerequisites**

1. Node
2. MongoDB

**Installation**

1. Create a file '''.env''' in the directory with the following content:

```
NEWS_API_KEY=[your NewsAPI key]
MONGODB_URL=mongodb://[your db user]:[your db password]@[your db URL]
MONGODB_NAME=[your db name]
```

2. `nmp install`

**Usage**

1. `npm start`
2. Access root of web app "/"


 
