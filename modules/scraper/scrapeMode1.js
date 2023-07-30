const puppeteer = require('puppeteer');
const { ObjectId, GoogleApis } = require('mongodb');

const searchYoutube = async (query, url, mode, nsfw) => {
  const { google } = require('googleapis');

  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.FIREBASE_API_KEY
  });

  const response = await youtube.search.list({
    part: 'snippet',
    q: query,
    maxResults: 10,
  });

  const result = response.data.items.map(item => {
    const { title, thumbnails, description } = item.snippet;
    const videoId = item.id.videoId;
    const link = `https://www.youtube.com/watch?v=${videoId}`;
    const thumb = item.snippet.thumbnails;
    const imageUrl = thumb.high ? thumb.high.url : thumb.default.url;
    const alt = title;
    const currentPage = url;

    return { video_id: videoId, imageUrl, alt, link, currentPage, query, mode, nsfw };
  });

  return result;
}

const scrapeWebsite = (query, mode, nsfw, url) => {
  return new Promise(async (resolve, reject) => {
    try {
      
      if(url){
        url = url.includes('http') ? url : `${process.env.DEFAULT_URL}/s/${url}/`;
      }else{
        url = process.env.DEFAULT_URL;
      }

      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const scrapedData = await page.evaluate((url, query, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('#container .video-list .video-item'));
        const data = items.map(item => {
          try {
            const thumb = item.querySelector('.thumb');
            const coverImg = thumb.querySelector('picture img.cover');
            const link = thumb.getAttribute('href');
            const video_id = item.getAttribute("data-id");
            const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
            const alt = coverImg ? coverImg.getAttribute('alt') : '';
            const currentPage = url;
  
            return { video_id, imageUrl, alt, link ,currentPage, query, mode, nsfw };
          } catch (error) {
            console.log(error)
          }
        });

        return data;
      }, url, query, mode, nsfw);

      await browser.close();

      resolve(scrapedData);
    } catch (error) {
      reject(error);
    }
  });
}

async function scrapeMode1(query, mode, nsfw, url) {
  try {
    if(nsfw == 'false'){
      console.log('Operating a safe search');
      return await searchYoutube(query, url, mode, nsfw);
    }

    console.log('Operating a NSFW search');
    const data = await scrapeWebsite(query, mode, nsfw, url);
    return data;
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}

module.exports = scrapeMode1;
