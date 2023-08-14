
var Scraper = require('images-scraper');
const rp = require('request-promise-native');
const { ObjectId } = require('mongodb');

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
    video_id: generateRandomID(8)
  }));

  return scrapedData
}

async function scrapeMode3(query, mode, nsfw, url, page) {
  try {
    if(!query){
      return []
    }
    if(!nsfw){
      console.log('Operating a safe search');
      return await searchGoogleImage(query, mode, nsfw, url, page);
    }
    console.log('Operating a NSFW search');
    const data1 = await searchPorn(query, mode, nsfw, url, page);
    const data2 = await searchGoogleImage(query, mode, !nsfw, url, page);
    const data = data1.concat(data2)
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
