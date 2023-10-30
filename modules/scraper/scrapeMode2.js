const { ObjectId } = require('mongodb');
const axios = require('axios');
const puppeteer = require('puppeteer');

async function scrapeMode2(url, mode, nsfw, page, filter = 'images') {
  let data1 = [];
  let data2 = [];
  let data = [];

  try {
    // Attempt to scrape data from Reddit
    console.log("Starting Reddit scraping...");
    data1 = await scrapeReddit(url, mode, nsfw, page, filter = 'images');
    console.log("Successfully scraped data from Reddit");
  } catch (error) {
    // Log an error if Reddit scraping fails
    console.error("Failed to scrape data from Reddit", error);
  }

  try {
    // Attempt to scrape data from Scrolller
    console.log("Starting Scrolller scraping...");
    data2 = await scrapeScrolller(url, mode, nsfw, page);
    console.log("Successfully scraped data from Scrolller");
  } catch (error) {
    // Log an error if Scrolller scraping fails
    console.error("Failed to scrape data from Scrolller", error);
  }

  // Concatenate data from both sources
  data = data1.concat(data2);
  console.log("Combined data from Reddit and Scrolller");

  return data;
}

const scrapeScrolller = (subreddit, mode, nsfw, page) => {
  return new Promise(async (resolve, reject) => {
    const url = subreddit.indexOf('http') >= 0 ? subreddit : `https://scrolller.com${subreddit}/`;

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    try {
      // Create a new page
      const defaultPage = await browser.newPage();

      // Navigate to the URL
      await defaultPage.goto(url, { waitUntil: 'networkidle2' });
      
      await defaultPage.evaluate(() => localStorage.setItem('SCROLLLER_BETA_1:CONFIRMED_NSFW', true));
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

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

      // Close the browser
      await browser.close();
      // Reject if there's an error
      reject(error);
    }
  });
}
async function scrapeReddit(url, mode, nsfw, page, filter = 'images') {
  if (!url) return [];
  if(url.includes('discover')){return []}
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
  let ct = 0
  while (scrapedData.length < itemCount) {

  // Get the current scroll position

  const currentScrollPosition = await page.evaluate(() => {
    return window.scrollY;
  });
      // Scroll the page down by one viewport height
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    // Get the updated list of items
    const items = await page.$$eval(itemSelector, elements => {
      return elements.map(element => {
        const link = 'https://scrolller.com' + element.querySelector('a').getAttribute('href');
        const thumb = element.querySelector('img').getAttribute('src');
        const video = !! element.querySelector('[data-test-id="media-component-video"]') ;
        const subreddit = element.querySelector('.item-panel__text-title:nth-child(2)').getAttribute('href');
        return { link, thumb, video, subreddit, extractor :'scrolller' };
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

    // Get the new scroll position after scrolling
    const newScrollPosition = await page.evaluate(() => {
      return window.scrollY;
    });
    // Check if the scroll position hasn't changed, indicating that you've reached the bottom
    if (newScrollPosition === currentScrollPosition) {
      // Add your logic here for what to do when you've reached the bottom
      if(scrapedData.length == 0 && ct>=10){
        console.log("Reached the bottom of the page and nothing founded. Waiting ...");
        break; // Exit the loop if you've reached the bottom
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      ct ++
      
    }

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
