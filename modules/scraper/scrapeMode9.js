const { ObjectId } = require('mongodb');
const axios = require('axios');
const puppeteer = require('puppeteer');

async function scrapeMode(url, mode, nsfw, page, filter = 'videos',isAsync) {
  let data = [];

  // Prepare promises for each scraping task
  const redditPromise = scrapeReddit(url, mode, nsfw, page, filter).catch(error => {
    console.error("Failed to scrape data from Reddit", error);
    return []; // Return empty array on failure
  });


  try {
    console.log("Starting scraping from Reddit and Scrolller...");

    // Use Promise.all to wait for all promises to resolve
    const results = await Promise.all([redditPromise ]);

    // Combine the results
    data = results.flat(); // Flattens the array of arrays into a single array
    console.log("Successfully scraped data from Reddit and Scrolller");
  } catch (error) {
    // Handle any unexpected error that wasn't caught earlier
    console.error("An unexpected error occurred during scraping", error);
  }

  //console.log("Combined data from Reddit and Scrolller");
  return data;
}


async function scrapeReddit(url, mode, nsfw, page, filter) {
  if (!url) return [];
  if(url.includes('discover')){return []}
  const subreddit = url;
  const myCollection = `medias_${mode}`
  const collection = global.db.collection(myCollection);
  const today = new Date().setHours(0, 0, 0, 0);

  // Check if the data has already been scraped today
  const existingData = await collection.findOne({ date: today, subreddit, page });

  if (existingData) {
    console.log('Data has already been scraped today.');
    return collection.find({ subreddit, page }).toArray();
  }

  let lastID = await collection.findOne({
    subreddit,
    page: parseInt(page) - 1,
    afterId: { $exists: true }
  });
  lastID = lastID?.afterId || '';
  //console.log('Latest afterID is:', lastID);

  const getUrl = subreddit.includes('http')
    ? subreddit
    : `https://www.reddit.com${subreddit}new/.json?count=25&after=${lastID}`;

  //console.log('Searching data on reddit. ', getUrl);

  try {
    const response = await axios.get(getUrl);
    const data = response.data.data.children.map((child) => child.data);
    const result = filterData(data, filter, nsfw);
    const afterId = response.data.data.after; // Get the 'after' field directly from the Reddit response
    
    //console.log(`New after ID is: ${afterId}`);
    const AllData = processResults(result, subreddit, afterId, page);

    //console.log(`Founded ${AllData.length} elements.`);
    return AllData;
  } catch (error) {
    console.log('Failed to fetch data from Reddit', error);
    return [];
  }
}

function _filterData(data, filter, nsfw) {
  return data.reduce((filteredData, post) => {
    if (filter === 'images' && !post.is_video && (nsfw || !post.over_18)) filteredData.push(post);
    else if (filter === 'videos' && post.is_video && (!post.over_18 || nsfw)) filteredData.push(post);
    else if (filter === 'default' && (!post.over_18 || nsfw)) filteredData.push(post);

    return filteredData;
  }, []);
}

function filterData(data, filter, nsfw) {
  
  return data.reduce((filteredData, post) => {

      let obj = {
          title: post.title,
          thumbnail: post.thumbnail,
          imageUrl: extractImageUrl(post),
          link: post.url,
          extractor:'reddit'
      };

      try{
          obj.url = post.preview.reddit_video_preview.fallback_url
      }catch{
          obj.url = post.url_overridden_by_dest || post.url
      }

      // Try to extract video URL from standard video posts
      if (post.is_video && (post.over_18 === nsfw || !post.over_18)) {
          obj.url = post.media.reddit_video.fallback_url;
          obj.type = 'video';
          filteredData.push(obj);
      }

      // Handle specific video/gif formats even if not marked as video
      if (post.url && (post.url.includes('.mp4') || post.url.includes('redgifs.com') || post.url.includes('.gifv'))) {
          if (post.over_18 === nsfw || !post.over_18) {
              if (post.url.includes('.mp4')) {
                  obj.type = 'REDDIT';
              }

              if (post.url.includes('redgifs.com')) {
                  obj.name = post.url.split('/').pop();
                  obj.extractor = 'redgifs';
              }

              if (post.url.includes('.gifv')) {
                  let objUrl = post.url;
                  obj.name = post.url.split('/').pop();
                  obj.url = objUrl.replace('.gifv', '.jpg');
                  obj.link = objUrl.replace('.gifv', '.mp4');
                  obj.extractor = 'redgifs (gifv)';
              }

              // Correct the video URL if not done already
              if (!obj.url) {
                  obj.url = post.url_overridden_by_dest || post.url;
              }

              filteredData.push(obj);
          }
      }
      const uniqueData = removeDuplicates(filteredData);
      return uniqueData;
  }, []);
}

function removeDuplicates(filteredData) {
  const seenLinks = new Map();

  filteredData.forEach(item => {
      if (!seenLinks.has(item.link)) {
          seenLinks.set(item.link, item);
      }
  });

  // Convert the Map values back to an array
  return Array.from(seenLinks.values());
}


function processResults(result, subreddit, afterId, page) {
  return result
    .map((post) => ({
      ...post,
      thumb: post.thumbnail,
      source: `https://www.reddit.com${post.permalink}`,
      url:post.url,
      link:post.link || post.url,
      title: post.title,
      name:post.name,
      subreddit,
      video_id: generateRandomID(8),
      afterId,
      page,
    }));
}

function extractImageUrl(post) {
  const image = post.preview?.images?.[0]?.source?.url;
  const video = post.preview?.reddit_video_preview?.fallback_url;
  return image || video || '';
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

module.exports = {scrapeMode};
