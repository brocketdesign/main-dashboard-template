const puppeteer = require('puppeteer');
const { ObjectId, GoogleApis } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');

const getVideoFromPD = (query, mode, nsfw, url, pageNum, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if(url){
        url = url.includes('http') ? url : `https://www.porndig.com/videos/s=${query}/page/${pageNum}`;
      }else{
        url ='https://www.porndig.com/';
      }
      const user = await global.db.collection('users').findOne({_id:new ObjectId(userId)})
      
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const results = [];
      $('.video_block_wrapper').each((i, element) => {
        let item = {}
        item.link = 'https://www.porndig.com/'+$(element).find('a').attr('href')
        item.video_id = $(element).attr("data-post_id");
        item.imageUrl = $(element).find('.video_block_wrapper img').attr('data-src');
        item.alt = $(element).find('.video_item_title .video_item_section_txt').text();
        item.currentPage = url;
        item.extractor = 'PornDig'
        results.push(item);
      });
      resolve(results)
    } catch (error) {
      reject(error);
    }
  });
}

const getVideoFromSB = (query, mode, nsfw, url, pageNum, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if(url){
        url = url.includes('http') ? url : `https://spankbang.com/s/${url}/${pageNum}/?o=all`;
      }else{
        url ='https://spankbang.com';
      }
      const user = await global.db.collection('users').findOne({_id:new ObjectId(userId)})
      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });

      const page = await browser.newPage();

      // get the cookie value from the page's cookies object
      const cookies = await page.cookies();
      const coeCookie = cookies.find((cookie) => cookie.name === 'coe');
      
      // set the cookie with the updated value
      
      await page.setCookie({
        name: 'coe',
        value: user.favoriteCountry || process.env.COUNTRY,
        domain: '.spankbang.com' // specify the domain where the cookie should be set
      });
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      

      const scrapedData = await page.evaluate((url, query, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('#container .video-list .video-item'));
        const data = items.map(item => {
          try {
            const thumb = item.querySelector('.thumb');
            const coverImg = thumb.querySelector('picture img.cover');
            const link = 'https://spankbang.com'+thumb.getAttribute('href');
            const video_id = item.getAttribute("data-id");
            const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
            const alt = coverImg ? coverImg.getAttribute('alt') : '';
            const currentPage = url;
  
            return { video_id, imageUrl, alt, link ,currentPage, query, mode, nsfw, extractor:'spankbang' };
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
const scrapeWebsiteTopPage = (mode, nsfw, userId) => {
        return new Promise(async (resolve, reject) => {
          try {
            const url ='https://spankbang.com';
            const user = await global.db.collection('users').findOne({_id:new ObjectId(userId)})
            const browser = await puppeteer.launch({
              headless: false,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            });
      
            const page = await browser.newPage();
      
            // get the cookie value from the page's cookies object
            const cookies = await page.cookies();
            const coeCookie = cookies.find((cookie) => cookie.name === 'coe');
            
            // set the cookie with the updated value
            
            await page.setCookie({
              name: 'coe',
              value: user.favoriteCountry || process.env.COUNTRY,
              domain: '.spankbang.com' // specify the domain where the cookie should be set
            });
            
            await page.goto(url, { waitUntil: 'networkidle2' });
            
      
            const scrapedData = await page.evaluate((mode, nsfw) => {
              const items = Array.from(document.querySelectorAll('#container .video-list .video-item'));
              const data = items.map(item => {
                try {
                  const thumb = item.querySelector('.thumb');
                  const coverImg = thumb.querySelector('picture img.cover');
                  const link = 'https://spankbang.com'+thumb.getAttribute('href');
                  const video_id = item.getAttribute("data-id");
                  const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
                  const alt = coverImg ? coverImg.getAttribute('alt') : '';
        
                  return { video_id, imageUrl, alt, link, mode, nsfw, extractor:'spankbang' };
                } catch (error) {
                  console.log(error)
                }
              });
              return data;
            }, mode, nsfw);
      
            await browser.close();
      
            resolve(scrapedData);
          } catch (error) {
            reject(error);
          }
        });
}
module.exports = {getVideoFromSB,scrapeWebsiteTopPage,getVideoFromPD}