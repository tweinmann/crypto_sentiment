# crypto sentiment

Alpha version of a tiny app that does the following:

1. Get latest news articles from crypto-news via newsapi.org
2. For each article
2.1. Get HTML from source URL
2.2. Extract plain text (strip layout, adds, etc)
2.3. Calculate sentiment based on AFINN words
3. Return HTML with color coded ```<div>``` elements (red = negative, green = positive sentiment)
