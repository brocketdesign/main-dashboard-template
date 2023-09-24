const { ObjectId } = require('mongodb');
const axios = require('axios');
const puppeteer = require('puppeteer');

async function scrapeMode2(url, mode, nsfw, page, filter = 'images'){
  const data1 = await scrapeReddit(url, mode, nsfw, page, filter = 'images');
  const data2 = await scrapeScrolller(url, mode, nsfw, page)
  console.log(data2)
  const data = data1.concat(data2)
  return data
}
const scrapeScrolller = (subreddit, mode, nsfw, page) => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = `https://scrolller.com${subreddit}/`;

      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.evaluate(() => {
        window['SCROLLLER_BETA_1:CONFIRMED_NSFW'] = true;
      });

      const scrapedData = await page.evaluate((url, subreddit, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('.vertical-view__item-container'));
        const data = items.map(item => {
          try {
            const link = 'https://scrolller.com'+item.querySelector('a').getAttribute('href');
            const video_id = new ObjectId();
            const imageUrl = item.querySelector('img').getAttribute('src');
            const currentPage = url;
  
            return { video_id, imageUrl, link ,currentPage, query:subreddit, subreddit, mode, nsfw, extractor:'scrolller' };
          } catch (error) {
            console.log(error)
          }
        });
        return data;
      }, url, subreddit, mode, nsfw);

      await browser.close();
      
      resolve(scrapedData);
    } catch (error) {
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
