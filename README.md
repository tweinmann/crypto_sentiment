# crypto sentiment

Tiny sample app that provides an "at a glance" view of news article sentiments per crypto currency. 

On a regular interval it does the following:

1. Get a list of top 25 coins from coinmarketcap
2. For each coin ...
  1. Get latest news articles from crypto-news via newsapi.org
  2. For each article ...
    1. Get full HTML from article source URL
    2. Extract plain text (strip layout, adds, etc)
    3. Calculate sentiment based on AFINN words
    4. Store result in db

The result is visualized using D3 pack. Each article is rendered as a bubble. Negative sentiment is shown in red, positive sentiment in green. The bigger the bubble, the higher the score. 

Check out the example -> https://crypto-sentiment.now.sh/ 

**Prerequisites**

1. Node
2. MongoDB

**Installation**

1. Create a file '''.env''' in the directory with the following content:

`NEWS_API_KEY=[your NewsAPI key]` (get your key at https://newsapi.org/)

`MONGODB_URL=mongodb://[your db user]:[your db password]@[your db URL]` 

`MONGODB_NAME=[your db name]` 

2. `nmp install`

**Usage**

1. `npm start`
2. Access root of web app "/"


 
