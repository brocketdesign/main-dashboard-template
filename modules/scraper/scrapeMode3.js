
var Scraper = require('images-scraper');
const rp = require('request-promise-native');
const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const streamPipeline = promisify(require('stream').pipeline);
const { exec } = require('child_process');

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

async function convertWebpToGif(filePath) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(path.dirname(filePath), path.basename(filePath, '.webp') + '.gif');
        
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



async function downloadResource(response, dirPath) {
  try {
      const url = response.url();
      const stringUntilWebp = url.split('.gif')[0]+".webp";

      const filePath = path.join(dirPath,  path.basename(stringUntilWebp));
      const content = await response.buffer();
      await fs.promises.writeFile(filePath, content);
      return filePath;
  } catch (error) {
      console.error(`Error downloading or saving the resource from URL: ${response.url()}`);
      throw error;
  }
}
async function allImagesLazyLoaded(page) {
  return await page.evaluate(() => {
      const images = document.querySelectorAll('.image');
      return Array.from(images).every(img => img.classList.contains('lazy-loaded'));
  });
}

async function scrollToBottom(page, viewportN = 1) {
  let previousScrollPosition = await page.evaluate(() => window.scrollY);
  let currentScrollPosition;
  let count = 0
  while (true) {
      // Scroll down by the height of the viewport times viewportN
      await page.evaluate(`window.scrollBy(0, window.innerHeight * ${viewportN})`);

      // Wait for any lazy-loaded content to load or animations
      await page.waitForTimeout(1000); // adjust timeout as needed

      currentScrollPosition = await page.evaluate(() => window.scrollY);

      // If the scroll position hasn't changed, check if all images have lazy-loaded class
      if (currentScrollPosition === previousScrollPosition) {
          const loaded = await allImagesLazyLoaded(page);
          if (loaded) {
              break;
          } else {
            if(count >= 10){
              break;
            }
              console.log('Waiting for all images to be lazy-loaded...');
              await page.waitForTimeout(1000); // wait an additional second, adjust as needed
              count ++
          }
      }

      previousScrollPosition = currentScrollPosition;
  }
}


async function searchImage(query, page = 1) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    const [tab] = await browser.pages();

    const filePaths = [];
    tab.on('response', async (response) => {
        if (response.url().includes('.gif')) {
            try {
                const filePath = await downloadResource(response, path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images'));
                const convertedGifPath = await convertWebpToGif(filePath);
                filePaths.push({
                    link: response.url(),
                    filePath: convertedGifPath.split('public')[1],
                    extractor: "sex"
                });
            } catch (error) {
                //console.error(`Failed processing URL: ${response.url()}`, error);
            }
        }
    });
  

    // Open a page with the given query (you might need to adjust the URL)
    await tab.goto(`https://www.sex.com/search/gifs?query=${query}&page=${page}`, { waitUntil: 'networkidle2' });

    await scrollToBottom(tab);
    
    await browser.close();

    return filePaths;
}

async function scrapeMode3(url, mode, nsfw, page, user) {
  const query = url
  try {
    if(!query){
      return []
    }
    if(!nsfw){
      return await searchGoogleImage(query, mode, nsfw, url, page);
    }
    const data1 = await searchPorn(query, mode, nsfw, url, page);
    const data2 = await searchImage(query, page);
    const data = data1.concat(data1,data2)

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
module.exports = scrapeMode3;
