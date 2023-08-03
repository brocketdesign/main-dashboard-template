// Importing required modules
const ObjectId = require('mongodb').ObjectId;
const cheerio = require('cheerio');
const got = require('got');

// Function to search subreddits
async function searchSubreddits(query) {
  try {
    // Forming base URL
    let url = `https://www.reddit.com/api/subreddit_autocomplete_v2.json?query=${query}&include_over_18=true&after=`;

    // Accessing the scraping info in the database to get 'after' value
    const scrapingInfo = await global.db.collection('subreddits').findOne({ 'scraping_info': true });

    // Initializing 'after' value
    let after = '';

    // If no scrapingInfo found, create one. Otherwise, use the existing 'after' value.
    if (!scrapingInfo) {
      scrapingInfo = await db.collection('subreddits').insertOne({ 'scraping_info': true, 'after': null });
    } else {
      after = scrapingInfo.after;
    }

    // Finalizing the URL
    url += after;

    // Fetching the URL using got
    const response = await got(url);

    // Parsing the HTML body with cheerio
    const $ = cheerio.load(response.body);

    // Parsing the JSON
    const parsedData = JSON.parse($('body').html().replace(/&quot;/g, '"'));

      // Updating 'after' in the database with the new value
      await db.collection('subreddits').updateOne(
        { _id: new ObjectId(scrapingInfo._id) },
        { $set: { after: parsedData.data.after } }
      );


    // Collecting results
    const result = parsedData.data.children.map(async item => {
      const obj = {
        title: item.data.title,
        url: item.data.url,
        r18: item.data.over18,
      };

      // If the subreddit does not exist in the database, insert it
      const existingSubreddit = await global.db.collection('subreddits').findOne({ 'title': obj.title });
      if (!existingSubreddit) {
        await global.db.collection('subreddits').insertOne(obj);
      }

      return obj;
    });

    // Resolving the promise with the result
    return await Promise.all(result);

  } catch (err) {
    // Logging the error and rejecting the promise
    console.log(err);
    throw err;
  }
}

module.exports = searchSubreddits;
