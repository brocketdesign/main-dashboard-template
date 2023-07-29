const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');

async function scrapeMode1(query,url) {

  try {

    const browser = await puppeteer.launch({ 
      headless: false ,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    
    const page = await browser.newPage();


    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract the desired data using JavaScript executed within the page context
    const scrapedData = await page.evaluate((url,query) => {
      const data = [];
      
      // Example: Scraping image URLs, alt attributes, and hrefs
      const items = Array.from(document.querySelectorAll('#container .video-list .video-item'));
      items.forEach((item) => {
        try {
          const thumb = item.querySelector('.thumb');
          const coverImg = thumb.querySelector('picture img.cover');
          const link = thumb.getAttribute('href');
          const video_id = item.getAttribute("data-id")
          const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
          const alt = coverImg ? coverImg.getAttribute('alt') : '';
          const currentPage = url;

          // Log the scraped data
          console.log('Scraped Element:');
          console.log('Video ID: ',video_id)
          console.log('Image URL:', imageUrl);
          console.log('Alt:', alt);
          console.log('Link:', link);
          console.log('------------------');

          data.push({ video_id, imageUrl, alt, link });
        } catch (error) {
          console.log('Error occurred while scraping an element:', error);
        }
      });

      return data;
    }, url,query);
    
    await browser.close();

    return scrapedData; 

  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return []; // Return an empty array in case of an error
  }

}

module.exports = scrapeMode1;
