const { ObjectId } = require('mongodb');
const axios = require('axios');
const puppeteer = require('puppeteer');

async function scrapeMode2(url, mode, nsfw, page, filter = 'images'){
  const data1 = await scrapeReddit(url, mode, nsfw, page, filter = 'images');
  const data2 = await scrapeScrolller(url, mode, nsfw, page)
  const data = data1.concat(data2)
  return data
}
const scrapeScrolller = (subreddit, mode, nsfw, page) => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = `https://scrolller.com${subreddit}/`;

      // Launch Puppeteer browser
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      // Create a new page
      const page = await browser.newPage();

      // Navigate to the URL
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for the element with the specified class to appear
      await page.waitForSelector('.nsfw-warning__accept-button');

      // Click on the element by class
      await page.click('.nsfw-warning__accept-button');

      const itemSelector = '.vertical-view__item-container'; // Replace with your item selector
      const itemCount = 50; // Number of items you want to collect
    
      const scrapedData = await scrollAndScrape(page, itemSelector, itemCount);
    
      // Log the total number of scraped items
      console.log('Total scraped items:', scrapedData.length);

      // Close the browser
      await browser.close();

      // Resolve with the scraped data
      resolve(scrapedData);
    } catch (error) {
      // Reject if there's an error
      reject(error);
    }
  });
}

async function scrapeReddit(url, mode, nsfw, page, filter = 'images') {
  if (!url) return false;

  const subreddit = url;
  const collection = global.db.collection('medias');
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
  console.log('Latest afterID is:', lastID);

  const getUrl = subreddit.includes('http')
    ? subreddit
    : `https://www.reddit.com${subreddit}new/.json?count=25&after=${lastID}`;

  console.log('Searching data on reddit. ', getUrl);

  try {
    const response = await axios.get(getUrl);
    const data = response.data.data.children.map((child) => child.data);
    const result = filterData(data, filter, nsfw);
    const afterId = response.data.data.after; // Get the 'after' field directly from the Reddit response
    

    console.log(`New after ID is: ${afterId}`);
    const AllData = processResults(result, subreddit, afterId, page);

    console.log(`Founded ${AllData.length} elements.`);
    return AllData;
  } catch (error) {
    console.log('Failed to fetch data from Reddit', error);
    return [];
  }
}
async function scrollAndScrape(page, itemSelector, itemCount) {
  const scrapedData = [];
  const uniqueItems = new Set(); // Using a Set to automatically avoid duplicate objects

  while (scrapedData.length < itemCount) {
    // Scroll the page down by one viewport height
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    // Get the updated list of items
    const items = await page.$$eval(itemSelector, elements => {
      return elements.map(element => {
        const link = 'https://scrolller.com' + element.querySelector('a').getAttribute('href');
        const thumb = element.querySelector('img').getAttribute('src');
        return { link, thumb, extractor :'scrolller' };
      });
    });

    // Filter and add unique items to the scrapedData array
    items.forEach(item => {
      const key = JSON.stringify(item); // Create a unique key for the object
      if (!uniqueItems.has(key)) {
        uniqueItems.add(key);
        scrapedData.push(item);
      }
    });
  }

  return scrapedData; // Return the collected data
}


function filterData(data, filter, nsfw) {
  return data.reduce((filteredData, post) => {
    if (filter === 'images' && !post.is_video && (nsfw || !post.over_18)) filteredData.push(post);
    else if (filter === 'videos' && post.is_video && (!post.over_18 || nsfw)) filteredData.push(post);
    else if (filter === 'default' && (!post.over_18 || nsfw)) filteredData.push(post);

    return filteredData;
  }, []);
}

function processResults(result, subreddit, afterId, page) {
  return result
    .filter((post) => post.url_overridden_by_dest)
    .map((post) => ({
      thumb: post.thumbnail,
      imageUrl: extractImageUrl(post),
      source: `https://www.reddit.com${post.permalink}`,
      link: post.url_overridden_by_dest.replace('gifv', 'gif'),
      title: post.title,
      subreddit,
      video_id: generateRandomID(8),
      afterId,
      page,
      extractor:'reddit' 
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

module.exports = scrapeMode2;
