const { ObjectId } = require('mongodb');
const axios = require('axios');

async function scrapeAndSaveDataMode2(query, mode, nsfw, url, page, filter='images') {
  const collection = global.db.collection('scrapedData');
  const subreddit = query
  if(subreddit== false){
    return false
  }

  // Check if the data has already been scraped today
  const today = new Date().setHours(0, 0, 0, 0);
  const existingData = await collection.findOne({ date: today ,subreddit:subreddit, page});

  try{
    if (existingData) {
      const AllData = await collection.find({subreddit:subreddit,page}).toArray();
      console.log('Data has already been scraped today.');
      return AllData;
    }
  }catch(e){
    console.log(e)
  }

  let result = []
  let AllData = []
  try {
    lastID = await collection.findOne({ date: today ,subreddit:subreddit, page:parseInt(page -1 )});
    if(lastID){
      lastID = lastID.afterId || ''
    }

    let getUrl = subreddit
    if(!subreddit.includes('http')){
      getUrl = `https://www.reddit.com${subreddit}new/.json?count=25&after=${lastID}`
    }
    console.log('Searching data on reddit. ',getUrl)
    const response = await axios.get(getUrl);

    const data = response.data.data.children.map((child) => child.data);

    // Filter the data based on the 'filter' query parameter
    result = data.reduce((filteredData, post) => {
      if (filter === 'images' && !post.is_video && (!post.over_18 || nsfw)) {
        filteredData.push(post);
      } else if (filter === 'videos' && post.is_video && (!post.over_18 || nsfw)) {
        filteredData.push(post);
      } else if (filter === 'default' && (!post.over_18 || nsfw)) {
        filteredData.push(post);
      }
      return filteredData;
    }, []);
    const afterId = result[result.length-1].id
    console.log({afterId})
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

    AllData.push({
      thumb: post.thumbnail,
      imageUrl : preview,
      source: `https://www.reddit.com${post.permalink}`,
      link: post.url_overridden_by_dest.replace('gifv','gif'),
      title: post.title,
      subreddit: subreddit, 
      video_id: generateRandomID(8),
      afterId,
      page
    });
  }
  } catch (error) {
    console.log(error)
    console.log('Failed to fetch data from Reddit' )
  }

  console.log(AllData[0])
  return AllData; // Return the scraped data array
}
function generateRandomID(length) {
  const digits = '0123456789';
  let randomID = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    randomID += digits.charAt(randomIndex);
  }

  return randomID;
}
module.exports = scrapeAndSaveDataMode2;
