
var Scraper = require('images-scraper');
const rp = require('request-promise-native');
const { ObjectId } = require('mongodb');

async function scrapeMode3(query,url) {

  if(!query){
    return []
  }
  
  const google = new Scraper({
    puppeteer: {
      headless: false,
    },
    safe: false   // enable/disable safe search
  });
 
  try {
    
    scrapedData = await google.scrape(query, 100);

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
