const puppeteer = require('puppeteer');
const { ObjectId, GoogleApis } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');

const searchYoutube = async (query, url, mode, nsfw, page) => {
  const { google } = require('googleapis');

  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.FIREBASE_API_KEY
  });

  const response = await youtube.search.list({
    part: 'snippet',
    q: query,
    maxResults: 30,
    type: 'video'  // This filters out everything except videos
  });

  const result = response.data.items.map(item => {
    const { title, thumbnails, description } = item.snippet;
    const videoId = item.id.videoId;
    const link = `https://www.youtube.com/watch?v=${videoId}`;
    const thumb = item.snippet.thumbnails;
    const imageUrl = thumb.high ? thumb.high.url : thumb.default.url;
    const alt = title;
    const currentPage = url;

    return { video_id: videoId, imageUrl, title, alt, link, currentPage, query, mode, nsfw };
  });

  return result;
}

async function scrapeWebsiteFromOtherServer(query, mode, nsfw, url, pageNum, user) {
  try {
    const userId = user._id
    // Make a POST request to the download server
    const response = await axios.post('http://192.168.10.115:3100/api/getVideoFromSB', {
      query, mode, nsfw, url, pageNum, userId
    });
    // You might want to return something here, depending on your use case

    return response.data.result;
  } catch (error) {
    // Log the error if the request fails
    console.error('Error connecting to the download server:');
    //throw error; // Optionally throw the error to be handled by the caller
  }
}

const scrapeWebsite1 = (query, mode, nsfw, url, pageNum) => {
  return new Promise(async (resolve, reject) => {
    try {
      if(url){
        url = url.includes('http') ? url : `https://www.xvideos.com/?k=${url}&sort=relevance&quality=hd&p=${pageNum}`;
      }else{
        url = 'https://spankbang.com';
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const scrapedData = await page.evaluate((url, query, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('#content .thumb-block'));
        const data = items.map(item => {
          try {
            const thumb = item.querySelector('.thumb');
            const link = 'https://www.xvideos.com'+item.querySelector('.thumb a').getAttribute('href');
            const video_id = item.getAttribute("data-id");
            const imageUrl = item.querySelector('.thumb img').getAttribute('src');
            const alt = item.querySelector('.thumb-under .title a').getAttribute('title')
            const currentPage = url;
            if(!video_id){
              return
            }
            return { video_id, imageUrl, alt, link ,currentPage, query, mode, nsfw, extractor:'xvideos' };
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

const scrapeWebsite2 = (query, mode, nsfw, url, pageNum) => {
  return new Promise(async (resolve, reject) => {
    try {
      if(url){
        url = url.includes('http') ? url : `https://missav.com/ja/search/${url}?page=${pageNum}`;
      }

      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const scrapedData = await page.evaluate((url, query, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('.thumbnail.group'));
        const data = items.map(item => {
          try {
            const link = item.querySelector('a').getAttribute('href');
            const video_id = item.querySelector('video.preview').getAttribute("id").replace('preview-','');
            const imageUrl = item.querySelector('img').getAttribute('src');
            const alt = item.querySelector('img').getAttribute('alt')
            const currentPage = url;
            if(!video_id){
              return
            }
            return { video_id, imageUrl, alt, link ,currentPage, query, mode, nsfw, extractor:'missav' };
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

async function scrapeMode1(url, mode, nsfw, page, user) {
  query = url 
  try {
    if(nsfw!='undefined' && !nsfw){
      console.log('Operating a safe search');
      return await searchYoutube(query, url, mode, nsfw, page);
    }
    console.log('Operating a NSFW search');

    const [result1, result2] = await Promise.all([
      scrapeWebsiteFromOtherServer(query, mode, nsfw, url, page, user),
      //scrapeWebsite1(query, mode, nsfw, url, page),
      //scrapeWebsite2(query, mode, nsfw, url, page)
    ]);
    
    const data = result1.concat(result2);
  
    return data;
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}

module.exports = scrapeMode1;
