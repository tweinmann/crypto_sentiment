# crypto sentiment

Tiny app that provides an "at a glance" view of news articles sentiments per crypto currency

On a regular interval it does the following:

1. Get a list of top 25 coins from coinmarketcap
2. For each coin ...
  * Get latest news articles from crypto-news via newsapi.org
  * For each article ...
    * Get full HTML from article source URL
    * Extract plain text (strip layout, adds, etc)
    * Calculate sentiment based on AFINN words
    * Store result in db

Installation:

1. Create a file '''.env''' in the directory with the following content:

`NEWS_API_KEY=[your NewsAPI key]` (get your key at https://newsapi.org/)

`MONGODB_URL=mongodb://[your db user]:[your db password]@[your db URL]` 

`MONGODB_NAME=[your db name]` 

2. `nmp install`

Usage:

`npm start'

 
