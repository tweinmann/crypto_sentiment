[![Build Status](https://gitlab.com/tweinmann/crypto_sentiment/badges/master/pipeline.svg)](https://gitlab.com/tweinmann/crypto_sentiment/pipelines)

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

1. Docker

**Usage**

1. Copy `.env.sample` to `.env` and set API key, DB users and passwords
2. Run `docker-compose build`
3. Run `docker-compose up`
4. Access app at `http://localhost:8080/`




 
