
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

async function downloadResource(response, dirPath,mediaType) {
  try {
      const url = response.url();
      const stringUntilWebp = url.split(`.${mediaType}`)[0]+".webp";

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
  let previousScrollPosition = 0;
  let currentScrollPosition;
  let count = 0;

  try {
      previousScrollPosition = await page.evaluate(() => window.scrollY);
  } catch (error) {
      console.error("Error getting initial scroll position:", error);
      return; // Exit if we can't get the initial scroll position
  }

  while (true) {
      try {
          // Scroll down by the height of the viewport times viewportN
          await page.evaluate(`window.scrollBy(0, window.innerHeight * ${viewportN})`);

          // Wait for any lazy-loaded content to load or animations
          await page.waitForTimeout(1000); // adjust timeout as needed
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

          if (loaded || count >= 3) {
              break;
          }

          console.log('Waiting for all images to be lazy-loaded...');
          await page.waitForTimeout(1000); // wait an additional second, adjust as needed
          count++;
      }

      previousScrollPosition = currentScrollPosition;
  }
}


async function searchImage(query, page = 1) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const [tab] = await browser.pages();

  const filePaths = [];
  tab.on('response', async (response) => {
      if (response.url().includes('.jpg')) {
          try {
              const filePath = await downloadResource(response, path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images'),'jpg');
              const convertedGifPath = await convertWebpTo(filePath,'jpg');
              filePaths.push({
                  link: response.url(),
                  filePath: convertedGifPath.split('public')[1],
                  type:'image',
                  extractor: "sex"
              });
          } catch (error) {
              //console.error(`Failed processing URL: ${response.url()}`, error);
          }
      }
  });


  // Open a page with the given query (you might need to adjust the URL)
  await tab.goto(`https://www.sex.com/search/pics?query=${query}&page=${page}`, { waitUntil: 'networkidle2' });

  await scrollToBottom(tab);
  
  await browser.close();

  return filePaths;
}

async function searchGifImage(query, page = 1, isAsync) {
  const maxGifCount = isAsync ? false : 10
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    const [tab] = await browser.pages();

    let gifResponseCount = 0;
    let listenerActive = true;
    const filePaths = [];
    const gifResponseListener = async (response) => {

       if (!listenerActive || (maxGifCount? gifResponseCount >= maxGifCount : false)) return;
        if (response.url().includes('.gif')) {
            try {
                const isAlreadyDownloaded = await global.db.collection('medias').findOne({link:response.url()})
                if(!isAlreadyDownloaded){
                  const filePath = await downloadResource(response, path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images'), 'gif');
                  const convertedGifPath = await convertWebpTo(filePath, 'gif');
                  filePaths.push({
                      link: response.url(),
                      filePath: convertedGifPath.split('public')[1],
                      type: 'image_gif',
                      extractor: "sex"
                  });
                  gifResponseCount++;
                }
            } catch (error) {
                console.error(`Failed processing URL: ${response.url()}`, error);
            }

            if (maxGifCount? gifResponseCount >= maxGifCount : false) {
                console.log('Got the required number of items.');
                listenerActive = false;
                tab.off('response', gifResponseListener);
                await browser.close();
                return
            }
        }
    };

    tab.on('response', gifResponseListener);

    await tab.goto(`https://www.sex.com/search/gifs?query=${query}&page=${page}`, { waitUntil: 'networkidle2' });
    try {
      await scrollToBottom(tab);
    } catch (error) {
      console.log('End scrolling : ',error)
    }

    await browser.close();
    return filePaths;
}

async function scrapeMode3(url, mode, nsfw, page, user, isAsync) {
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
    const SexGifPromise =  searchGifImage(query, page, isAsync).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    });
    const sexImagePromise = [] || searchImage(query, page).catch(error => {
      console.error("Failed to scrape data from Sex Image", error);
      return []; // Return empty array on failure
    });

   
    try {
      console.log("Starting scraping from Sex.com for Image and GIFs...");

      // Use Promise.all to wait for all promises to resolve
      const results = await Promise.all([SexGifPromise, sexImagePromise]);

      // Combine the results
      data = results.flat(); // Flattens the array of arrays into a single array
      console.log("Successfully scraped data from Reddit and Scrolller");
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
module.exports = scrapeMode3;
