// Importing required modules
const ObjectId = require('mongodb').ObjectId;
const cheerio = require('cheerio');
const axios = require('axios');

// Function to search subreddits
async function searchSubreddits(query) {
  try {
    // Forming base URL
    let url = `https://www.reddit.com/api/subreddit_autocomplete_v2.json?query=${query}&include_over_18=true&after=`;

    // Accessing the scraping info in the database to get 'after' value
    let scrapingInfo = await global.db.collection('subreddits').findOne({ 'scraping_info': true });

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

    // Fetching the URL using axios
    const response = await axios.get(url);

    // Parsing the JSON
    const parsedData = response.data;

      // Updating 'after' in the database with the new value
      await db.collection('subreddits').updateOne(
        { _id: new ObjectId(scrapingInfo._id) },
        { $set: { after: parsedData.data.after } }
      );


    // Collecting results
    const result = parsedData.data.children.map(item => {

      if(item.data.over18 == undefined){
        //return null;
      }
      const obj = {
        title: item.data.title,
        url: item.data.url,
        r18: item.data.over18,
      };
      return obj;
      
    }).filter(item => item !== null);

    return result;

  } catch (err) {
    // Logging the error and rejecting the promise
    console.log(err);
    throw err;
  }
}

module.exports = searchSubreddits;
