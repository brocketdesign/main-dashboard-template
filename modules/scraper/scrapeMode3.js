
var Scraper = require('images-scraper');
const rp = require('request-promise-native');
const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const streamPipeline = promisify(require('stream').pipeline);
const { exec } = require('child_process');
const { includes } = require('lodash');
const urlLib = require('url');
async function searchGoogleImage(query, mode, nsfw, url) {

  try {

    const google = new Scraper({
      puppeteer: {
        headless: nsfw,
      },
      safe: nsfw   // enable/disable safe search
    });

    let scrapedData = await google.scrape(query, 100);

    // Map each element to add the fields
    scrapedData = scrapedData.map((data) => ({
      ...data,
      video_id: generateRandomID(8)
    }));
    
    return scrapedData

  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return []; // Return an empty array in case of an error
  }

}
async function searchPorn(query, mode, nsfw, url, page) {

  const Pornsearch = require('pornsearch')
  const Searcher = new Pornsearch(query, driver = 'pornhub');
  
  let scrapedData = await Searcher.gifs(page)
  scrapedData = scrapedData.map((data) => ({
    ...data,
    extractor:"pornhub",
    video_id: generateRandomID(8)
  }));
  return scrapedData
}

async function convertWebpTo(filePath,mediaType) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(path.dirname(filePath), path.basename(filePath, '.webp') + `.${mediaType}`);
        
        exec(`convert "${filePath}" "${outputPath}"`, async (error, stdout, stderr) => {
            if (error) {
                reject(`Error converting image: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`Error message: ${stderr}`);
                return;
            }

            // Delete the original .webp file
            try {
                await fs.promises.unlink(filePath);
            } catch (err) {
                console.error(`Failed to delete file ${filePath}:`, err);
                // Continue to resolve the promise even if deletion fails. 
                // If you want the promise to be rejected in this case, 
                // you can uncomment the following line:
                // reject(`Failed to delete file ${filePath}: ${err.message}`);
            }

            resolve(outputPath);
        });
    });
}

async function downloadResource(response, dirPath, mediaType) {
    try {
        const url = response.url();
        let parsedUrl = urlLib.parse(url);
        let baseName = path.basename(parsedUrl.pathname);

        // Let's play 'Guess the Extension'!
        let extension = baseName.endsWith('.jpg') ? 'jpg' : 'webp';

        // Time to build the file path, now with more precision!
        const filePath = path.join(dirPath, `${path.basename(baseName, `.${extension}`)}.${extension}`);
        const content = await response.buffer();

        // Write the file like it's the next bestseller
        await fs.promises.writeFile(filePath, content);
        console.log(`Downloaded and saved: ${filePath} (with a little twist!)`);
        return filePath;
    } catch (error) {
        console.error(`Oops! Sherlock Holmes couldn't download or save the resource from URL: ${response.url()} - Error: ${error}`);
        throw error;
    }
}



async function allImagesLazyLoaded(page) {
  return await page.evaluate(() => {
      const images = document.querySelectorAll('.image');
      return Array.from(images).every(img => img.classList.contains('lazy-loaded'));
  });
}
async function isElementPresent(page, selector) {
  try {
    const isPresent = await page.evaluate(selector => {
      return document.querySelector(selector) !== null;
    }, selector);
    return isPresent;
  } catch (error) {
    console.error(`Something funky happened while checking the element: ${error}`);
    return false;
  }
}



async function scrollToBottom(page, viewportN = 1) {
  let previousScrollPosition = 0;
  let currentScrollPosition;
  let count = 0;
  // Check for page error
  const hasErrorPage = await isElementPresent(page, '#error_page');
  if (hasErrorPage) {
    return false
  }
  try {
      previousScrollPosition = await page.evaluate(() => window.scrollY);
  } catch (error) {
      console.error("Error getting initial scroll position:", error);
      return false; // Exit if we can't get the initial scroll position
  }

  while (true) {
      try {
          // Scroll down by the height of the viewport times viewportN
          await page.evaluate(`window.scrollBy(0, window.innerHeight * ${viewportN})`);

          // Wait for any lazy-loaded content to load or animations
          //await page.waitForTimeout(1000); // adjust timeout as needed
      } catch (error) {
          console.error("Error during scrolling or waiting:", error);
          break; // Break the loop on error
      }

      try {
          currentScrollPosition = await page.evaluate(() => window.scrollY);
      } catch (error) {
          console.error("Error getting current scroll position:");
          break; // Break the loop on error
      }

      // If the scroll position hasn't changed
      if (currentScrollPosition === previousScrollPosition) {
          let loaded = false;

          try {
              loaded = await allImagesLazyLoaded(page);
          } catch (error) {
              console.error("Error checking if all images have lazy-loaded:", error);
              // Decide whether to break or continue based on your use case
          }

          if (loaded || count > 1) {
              break;
          }

          console.log('Waiting for all images to be lazy-loaded...');
          await page.waitForTimeout(1000); // wait an additional second, adjust as needed
          count++;
      }

      previousScrollPosition = currentScrollPosition;
  }
  return true
}

function generateTopPageUrl(){
  return 'https://www.sex.com/gifs/'
}

function generateUrl(query,page){
  return `https://www.sex.com/search/gifs?query=${query}&page=${page}`
}
function generateUrlPics(query,page){
  return `https://www.sex.com/search/pics?query=${query}&page=${page}`
}

function getExtractor(){
  return `sex`
}

const LAST_PAGE_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function searchImage(query, isReset = false ){
  const lastPageIndex = await getLastPageIndex(`pics_${query}`);
  const startTime = Date.now();

  if (isReset || (startTime - lastPageIndex.time) > LAST_PAGE_RESET_INTERVAL) {
    await resetLastPageIndex(query);
    page = 1;
  } else {
    page = lastPageIndex.page;
  }
  const maxGifCount = 20;
  const browser = await puppeteer.launch({ headless: 'new' });
  const [tab] = await browser.pages();
  await tab.setViewport({ width: 1920, height: 5000 });
  let gifResponseCount = 0;

  const filePaths = [];
  const processGifResponse= async (response) => {
    if (response.url().includes('.jpg') && !response.url().includes('abc.gif')) {
      const imageData = await handleImage(response);
      if (imageData) {
        filePaths.push(imageData);
        gifResponseCount++;
      }
    }
  };

  tab.on('response', processGifResponse);

  while (gifResponseCount < maxGifCount) {
    await tab.goto(generateUrlPics(query, page), { waitUntil: 'networkidle2' });
    let pageStatus = false
    try {
      pageStatus = await scrollToBottom(tab);
    } catch (error) {
      console.log('End scrolling:', error);
    }
    
    //await processGifResponseQueue();
    console.log(`${gifResponseCount} new images on this page`);

    if (gifResponseCount === 0 && pageStatus) {
      page++;
    } else {
      await saveLastPageIndex(page, startTime, query);
      break;
    }
  }

  await browser.close();
  return filePaths;
}

async function searchGifImage(query, isReset = false, topPage = false) {

  if(query == undefined){
    console.log(`Query is not defined`)
    return
  }
  const lastPageIndex = await getLastPageIndex(query);
  const startTime = Date.now();
  console.log({lastPageIndex})
  if (isReset || (startTime - lastPageIndex.time) > LAST_PAGE_RESET_INTERVAL) {
    await resetLastPageIndex(query);
    page = 1;
  } else {
    page = lastPageIndex.page;
  }
  
  const maxGifCount = 40;
  const browser = await puppeteer.launch({ headless: 'new' }); 
  const [tab] = await browser.pages();
  await tab.setViewport({ width: 1920, height: 5000 });
  let gifResponseCount = 0;
  const filePaths = [];
  const gifResponseQueue = [];

  const gifResponseListener = async (response) => {
    if (response.url().includes('.gif')) {
      gifResponseQueue.push(response);
    }
  };
  
  const processGifResponseQueue = async () => {
    while (gifResponseQueue.length > 0 && gifResponseCount < maxGifCount) {
      const response = gifResponseQueue.shift();
      const imageData = await handleGif(response,topPage);
      if (imageData) {
        filePaths.push(imageData);
        gifResponseCount++;
        console.log({ url:response.url(),gifResponseCount });
      }
    }
  };

  const processGifResponse= async (response) => {
    if (response.url().includes('.gif') && !response.url().includes('abc.gif')) {
      const imageData = await handleGif(response,topPage);
      if (imageData) {
        filePaths.push(imageData);
        gifResponseCount++;
      }
    }
  };

  tab.on('response', processGifResponse);

  let pageStatus = 0
  while (gifResponseCount < maxGifCount) {
    const pageUrl = topPage == true ? generateTopPageUrl() : generateUrl(query, page)
    await tab.goto(pageUrl, { waitUntil: 'networkidle2' });
    try {
      await scrollToBottom(tab);
    } catch (error) {
      console.log('End scrolling:', error);
    }
    
    //await processGifResponseQueue();
    console.log(`${gifResponseCount} new images on page ${page}`);

    if (gifResponseCount === 0 && pageStatus <= 2) {
      pageStatus ++
      page++;
    } else {
      await saveLastPageIndex(page, startTime, query);
      break;
    }
  }

  await browser.close();
  return filePaths;
}

async function getLastPageIndex(query) {
  try {
    const lastPageInfo = await global.db.collection('scrapInfo').findOne({ extractor: getExtractor() +'_'+ query});
    return lastPageInfo || { page: 1, time: 0 };  // Default to page 1 and time 0 if nothing is found
  } catch (error) {
    console.error('Error fetching last page index:', error);
    return { page: 1, time: 0 };  // In case of error, also default to page 1 and time 0
  }
}
async function saveLastPageIndex(page, time, query) {
  console.log(`saveLastPageIndex ${time}`)
  try {
    await global.db.collection('scrapInfo').updateOne(
      { extractor: getExtractor() +'_'+ query },
      { $set: { page, time } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error saving last page index:', error);
  }
}
async function resetLastPageIndex(query) {
  try {
    await global.db.collection('scrapInfo').updateOne(
      { extractor: getExtractor() +'_'+ query },
      { $set: { page: 1, time: Date.now() } }
    );
  } catch (error) {
    console.error('Error resetting last page index:', error);
  }
}

async function handleGif(response,topPage){
  try {
    const isAlreadyDownloaded = await global.db.collection('medias_3').findOne({link:response.url()})

    if(topPage){
     //return isAlreadyDownloaded
    }
    
    if(!isAlreadyDownloaded){
      const filePath = await downloadResource(response, path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images'), 'gif');
      //const convertedGifPath = await convertWebpTo(filePath, 'gif');
      return {
          link: response.url(),
          filePath: filePath.split('public')[1], // convertedGifPath.split('public')[1],
          type: 'gif',
          mode:3,
          extractor: getExtractor() +'(GIF)'
      };
    }
  } catch (error) {
      console.error(`Failed processing URL`);
      return false
  }
  return false
}
async function handleImage(response){
  try {
    const isAlreadyDownloaded = await global.db.collection('medias').findOne({link:response.url()})
    if(!isAlreadyDownloaded){
      const filePath = await downloadResource(response, path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images'), 'gif');
      //const convertedGifPath = await convertWebpTo(filePath, 'gif');
      return {
          link: response.url(),
          filePath: filePath.split('public')[1], // convertedGifPath.split('public')[1],
          type: 'image',
          extractor: getExtractor()
      };
    }
  } catch (error) {
      console.error(`Failed processing URL`);
      return false
  }
  return false
}
async function scrapeTopPage(){
  console.log(`scrapeTopPage`)
  try {
    const lastTopPageData = await global.db.collection('medias_3').find({query:'top',extractor:'SEX(GIF)'}).toArray()
    const startTime = Date.now();
    const lastTime = lastTopPageData[0] && lastTopPageData[0].time ? lastTopPageData[0].time : 0

    if ((startTime - lastTime) < LAST_PAGE_RESET_INTERVAL && lastTopPageData.length > 5) {
      console.log(`Up to date scrapeTopPage`)
      return lastTopPageData
    }
    let SexGifPromise =  await searchGifImage('top',false,true).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    });
    SexGifPromise = SexGifPromise.map((data) => ({
      ...data,
      query:'top',
      extractor:'SEX(GIF)',
      time :new Date()
    })); 
    const {insertInDB} = require('../ManageScraper')
    await insertInDB('medias_3',SexGifPromise)
    return SexGifPromise
  } catch (error) {
    console.log(error)
    console.log(`Error scraping top page for S3`)
  }
}
async function scrapeMode(url, mode, nsfw, page, user, isAsync) {
  const query = url
  try {
    let data = []
    if(!query){
      return []
    }
    if(!nsfw){
      return await searchGoogleImage(query, mode, nsfw, url, page);
    }
    //const data1 = await searchPorn(query, mode, nsfw, url, page);
    
    const SexGifPromise = query && query != 'undefined' ? searchGifImage(query,false,false).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    }) : scrapeTopPage()
    const sexImagePromise = [] || searchImage(query).catch(error => {
      console.error("Failed to scrape data from Sex Image", error);
      return []; // Return empty array on failure
    });

   
    try {
      console.log("Starting scraping from Sex.com for Image and GIFs...");

      // Use Promise.all to wait for all promises to resolve
      const results = await Promise.all([SexGifPromise, sexImagePromise]);

      // Combine the results
      data = results.flat(); // Flattens the array of arrays into a single array
      console.log("Successfully scraped data from  Sex.com for Image and GIFs...");
    } catch (error) {
      // Handle any unexpected error that wasn't caught earlier
      console.error("An unexpected error occurred during scraping", error);
    }

    console.log("Combined data from Image and Gif");
    return data;
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
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

module.exports = {scrapeMode,scrapeTopPage};
