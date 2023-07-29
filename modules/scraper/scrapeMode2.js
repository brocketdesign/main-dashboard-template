const { ObjectId } = require('mongodb');
const axios = require('axios');

async function scrapeAndSaveDataMode2(query , filter, allowR18) {
  const collection = global.db.collection('scrapedData');

  if(subreddit== false){
    return false
  }

  // Check if the data has already been scraped today
  const today = new Date().setHours(0, 0, 0, 0);
  const existingData = await collection.findOne({ date: today ,subreddit:subreddit});

  try{
    if (existingData) {
      const AllData = await collection.find({subreddit:subreddit}).toArray();
      console.log('Data has already been scraped today.');
      return AllData;
    }
  }catch(e){
    console.log(e)
  }

  let result = []
  try {
    const response = await axios.get(`https://www.reddit.com/r/${subreddit}.json`);

    const data = response.data.data.children.map((child) => child.data);

    // Filter the data based on the 'filter' query parameter
    result = data.reduce((filteredData, post) => {
      if (filter === 'images' && !post.is_video && (!post.over_18 || allowR18 === 'true')) {
        filteredData.push(post);
      } else if (filter === 'videos' && post.is_video && (!post.over_18 || allowR18 === 'true')) {
        filteredData.push(post);
      } else if (filter === 'default' && (!post.over_18 || allowR18 === 'true')) {
        filteredData.push(post);
      }
      return filteredData;
    }, []);
  // Save each post data to the MongoDB collection
  for (const post of result) {

    let preview = '';

    if (post.preview) {
      if (post.preview.images && post.preview.images[0] && post.preview.images[0].source && post.preview.images[0].source.url) {
        preview = post.preview.images[0].source.url;
      } else if (post.preview.reddit_video_preview && post.preview.reddit_video_preview.fallback_url) {
        preview = post.preview.reddit_video_preview.fallback_url;
      }
    }

    await collection.insertOne({
      thumb: post.thumbnail,
      preview : preview,
      source: `https://www.reddit.com${post.permalink}`,
      link: post.url_overridden_by_dest,
      title: post.title,
      subreddit: subreddit, 
      mode:"2"
    });
  }
  } catch (error) {
    console.log(error)
    console.log('Failed to fetch data from Reddit' )
  }
  await collection.updateOne({ subreddit: subreddit }, {$set : {date:today,subreddit:subreddit}}, { upsert: true });

  const AllData = await collection.find({subreddit:subreddit}).toArray();
  //console.log(AllData)
  return AllData; // Return the scraped data array
}

module.exports = scrapeAndSaveDataMode2;
