const { ObjectId } = require('mongodb');
const axios = require('axios');
const puppeteer = require('puppeteer');

async function scrapeMode(url, mode, nsfw, page, filter = 'videos',isAsync) {
  let data = [];

  const scrolllerVideoPromise = scrapeScrolller(url, mode, nsfw, page, 'videos', isAsync).catch(error => {
    console.error("Failed to scrape data from Scrolller (VIDEO)", error);
    return []; // Return empty array on failure
  });

  const scrolllerPicturePromise = scrapeScrolller(url, mode, nsfw, page, 'picture', isAsync).catch(error => {
    console.error("Failed to scrape data from Scrolller (PICTURE)", error);
    return []; // Return empty array on failure
  });

  try {
    console.log("Starting scraping from Scrolller...");

    // Use Promise.all to wait for all promises to resolve
    const results = await Promise.all([scrolllerVideoPromise]);

    // Combine the results
    data = results.flat(); // Flattens the array of arrays into a single array
    console.log("Successfully scraped data from Reddit and Scrolller");
  } catch (error) {
    // Handle any unexpected error that wasn't caught earlier
    console.error("An unexpected error occurred during scraping", error);
  }

  console.log("Combined data from Reddit and Scrolller");
  return data;
}


const scrapeScrolller = (subreddit, mode, nsfw, page, mediaType, isAsync) => {
  return new Promise(async (resolve, reject) => {
    const url = subreddit.indexOf('http') >= 0 ? subreddit : `https://scrolller.com${subreddit}?filter=${mediaType}`;

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: 'new',
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
      const itemCount = isAsync ? 100:20; // Number of items you want to collect
      console.log(!!isAsync,`I want ${itemCount} items.`)
      const scrapedData = await scrollAndScrape(page, itemSelector, itemCount, mediaType);
    
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

async function scrollAndScrape(page, itemSelector, itemCount, mediaType) {
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
    const items = await page.$$eval(itemSelector, (elements, mediaType) => {
    
        return elements.map(element => {
          try {
            const link = 'https://scrolller.com' + element.querySelector('a').getAttribute('href');
            const thumb = element.querySelector('img').getAttribute('src');
            const title = element.querySelector('img').getAttribute('alt');
            const video = !!(mediaType.toUpperCase() === 'VIDEOS') || !!element.querySelector('.media-icon__play');
            const subreddit = element.querySelector('.item-panel__text-title:nth-child(2)').getAttribute('href');
            return { link, thumb, title, video, subreddit, extractor: `scrolller (${mediaType})` };
          } catch (error) {
            return null;
          }
        });
    
    }, mediaType);  // Pass mediaType as an argument here
    

    // Filter and add unique items to the scrapedData array
    items.forEach(item => {
      const key = JSON.stringify(item); // Create a unique key for the object
      if (!uniqueItems.has(key) && item != null) {
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
      if(ct>=5){
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

module.exports = {scrapeMode};
