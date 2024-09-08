const puppeteer = require('puppeteer');
const { ObjectId, GoogleApis } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const urlLib = require('url');

const getVideoFromPD = (query, mode, nsfw, url, pageNum, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (url) {
        if( url.includes('http') && !url.includes('porndig')){
          resolve([])
          return
        }
        url = url.includes('http') ? new URL(url).href : `https://www.porndig.com/videos/s=${query}/page/${pageNum}`;
      } else {
        url = 'https://www.porndig.com/';
      }
      const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) })

      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const results = [];
      $('.video_block_wrapper').each((i, element) => {
        let item = {}
        item.link = 'https://www.porndig.com/' + $(element).find('a').attr('href')
        item.video_id = $(element).attr("data-post_id");
        item.imageUrl = $(element).find('.video_block_wrapper img').attr('data-src');
        item.alt = $(element).find('.video_item_title .video_item_section_txt').text();
        item.currentPage = url;
        item.extractor = 'PornDig'
        results.push(item);
      });
      resolve(results)
    } catch (error) {
      console.log(`Error with PD`)
      reject(error);
    }
  });
}
const ext3 = 'hqporner'
const ext3_title = 'HQPorner'
const ext3_url = 'https://hqporner.com/'
const ext3_url2 = 'https://hqporner.com'

const getVideoFromHQP = (query, mode, nsfw, url, pageNum, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (url) {
        if (url.includes('http') && !url.includes(ext3)) {
          resolve([]);
          return;
        }
        url = url.includes('http') ? new URL(url).href : `${ext3_url}?q=${query}&p=${pageNum}`;
      } else {
        url = ext3_url;
      }
      const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });

      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const promises = []; // Array to hold all the promises
      $('.image.featured.non-overlay.atfib.n8hu6s').each(async (i, element) => {
        const item = {};
        item.link = ext3_url2 + $(element).attr('href');
      
        try {
          const response = await fetch(item.link);
      
          if (response.ok) {
            item.video_id = item.link.split('/')[2].split('-')[0];
            const imageUrl = matchImageUrl($, element);
      
            // Push the downloadImage promise if the link is valid
            const imagePromise = downloadImage(imageUrl).then(filePath => {
              item.imageUrl = filePath;
            });
      
            promises.push(imagePromise.then(() => {
              item.alt = $(element).find('.meta-data-title').text();
              item.currentPage = url;
              item.extractor = ext3_title;
              return item;
            }));
          } else {
            console.log(`Link returned status ${response.status}: ${item.link}`);
          }
        } catch (error) {
          console.error(`Error fetching link: ${item.link}`, error);
        }
      });      

      // Resolve all promises and then resolve the outer promise with the results
      Promise.all(promises).then(results => {
        resolve(results);
      }).catch(error => {
        reject(error);
      });

    } catch (error) {
      console.log(`Error with ${ext3_title}`);
      reject(error);
    }
  });
};

function matchImageUrl($, item) {
  // Select the div with the specific class
  var div = $(item).find('.w403px');

  // Get the 'onmouseleave' attribute value
  var onmouseleaveAttr = div.attr('onmouseleave');
  
  // Update the regex to extract only the URL, stopping before the comma
  var urlMatch = onmouseleaveAttr.match(/defaultImage\("([^"]+)",/);
  
  if (urlMatch && urlMatch[1]) {
      // URL extracted from the attribute
      var imageUrl = 'https:'+decodeURIComponent(urlMatch[1]);
      return imageUrl;
  } else {
      console.log("No URL found.");
      return null; // It's a good practice to return null if nothing is found
  }
}

async function downloadImage(imageUrl) {
  let parsedUrl = urlLib.parse(imageUrl);
  let baseName = path.basename(parsedUrl.pathname);
  const imagePath = path.join(__dirname, '..', 'public', 'downloads', 'video_thumbnail', `${baseName}.jpg`); // Modify 'image.jpg' if you need a dynamic name
  // Fetching the image data
  const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
  });

  // Saving the image to the filesystem
  response.data.pipe(fs.createWriteStream(imagePath));

  return new Promise((resolve, reject) => {
      response.data.on('end', () => {
          // Returning the path part after 'public'
          let filePath = imagePath.split('public')[1];
          resolve(filePath);
      });

      response.data.on('error', (err) => {
          reject(err);
      });
  });
}

const getVideoFromSB = (query, mode, nsfw, url, pageNum, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (url) {
        if( url.includes('http') && !url.includes('spankbang')){
          resolve([])
          return
        }
        if(url.includes('http')){
          url = new URL(url).href
          if(url.includes('playlist')){
            const result = await scrapeSearchPage(query, mode, nsfw, url, pageNum, userId)
            resolve(result)
          }else{
            const result = await scrapeResultPage(query, mode, nsfw, url, pageNum, userId)
            resolve(result)
          }
        }else{
          url = `https://spankbang.com/s/${url}/${pageNum}/?o=all`
          const result = await scrapeSearchPage(query, mode, nsfw, url, pageNum, userId)
          resolve(result)
        }
        return
      } else {
        url = 'https://spankbang.com';
      }
    } catch (error) {
      console.log(`Error with SB`)
      reject(error);
    }
  });
}
async function scrapeResultPage(query, mode, nsfw, url, pageNum, userId){
  return new Promise(async (resolve, reject) => {
    try{
      const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) })
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

      const playerVideo = await page.evaluate((url, query, mode, nsfw) => {
            const item = document.querySelector('#video');
              try {
                const link = url;
                const video_id = item.getAttribute("data-videoid");
                const coverImg = item.querySelector('.player_thumb')
                const imageUrl = coverImg.getAttribute('data-src');
                const alt = coverImg ? coverImg.getAttribute('alt') : '';
                const currentPage = url;

                return { video_id, imageUrl, alt, link, currentPage, query, mode, nsfw, extractor: 'spankbang' };

              } catch (error) {
                console.log(error)
              }
          }, url, query, mode, nsfw);
          
          
        const similarVideo = await page.evaluate((url, query, mode, nsfw) => {
            const items = Array.from(document.querySelectorAll('.similar .video-list.video-rotate  .video-item'));
            const data = items.map(item => {
              try {
                const thumb = item.querySelector('.thumb');
                const ahref = thumb.getAttribute('href')
                const coverImg = thumb.querySelector('picture img.cover');
                const link = 'https://spankbang.com' + ahref;
                const video_id = item.getAttribute("data-id");
                const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
                const alt = coverImg ? coverImg.getAttribute('alt') : '';
                const currentPage = url;
    
                if(!ahref.includes('campaignId')){
                  return { video_id, imageUrl, alt, link, currentPage, query, mode, nsfw, extractor: 'spankbang' };
                }
              } catch (error) {
                console.log(error)
              }
            });
            return data;
          }, url, query, mode, nsfw);


      const user_uploads = await page.evaluate((url, query, mode, nsfw) => {
            const items = Array.from(document.querySelectorAll('.user_uploads .video-list.video-rotate  .video-item'));
            const data = items.map(item => {
              try {
                const thumb = item.querySelector('.thumb');
                const ahref = thumb.getAttribute('href')
                const coverImg = thumb.querySelector('picture img.cover');
                const link = 'https://spankbang.com' + ahref;
                const video_id = item.getAttribute("data-id");
                const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
                const alt = coverImg ? coverImg.getAttribute('alt') : '';
                const currentPage = url;
    
                if(!ahref.includes('campaignId')){
                  return { video_id, imageUrl, alt, link, currentPage, query, mode, nsfw, extractor: 'spankbang' };
                }
              } catch (error) {
                console.log(error)
              }
            });
            return data;
          }, url, query, mode, nsfw);

      const combinedResult = await Promise.all([playerVideo,similarVideo,user_uploads])
      await browser.close();
      const flattened = combinedResult.flat();
      const result = flattened.filter(element => element !== null);
      const uniqueEnchantedObjects =  filterUniqueObjects(result)
      resolve(uniqueEnchantedObjects);

    }catch(error){
      reject(error)
    }
  })
};
function filterUniqueObjects(enchantedObjects){
  const uniqueEnchantedObjects = enchantedObjects.reduce((acc, current) => {
    const x = acc.find(item => item.link === current.link);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);
  
  return uniqueEnchantedObjects
  
}
async function scrapeSearchPage(query, mode, nsfw, url, pageNum, userId){
  return new Promise(async (resolve, reject) => {
    try{
      const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) })
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
      try {
        // The magic spell to detect if our element is basking in the spotlight
        const isVisible = await page.evaluate(() => {
          const el = document.querySelector('#search_empty');
          const style = window.getComputedStyle(el);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
          
        if(isVisible){
          resolve();
          return
        }
      } catch (error) {
        
      }

      const scrapedData = await page.evaluate((url, query, mode, nsfw) => {
        const items = Array.from(document.querySelectorAll('#container .video-list.video-rotate  .video-item'));
        const data = items.map(item => {
          try {
            const thumb = item.querySelector('.thumb');
            const ahref = thumb.getAttribute('href')
            const coverImg = thumb.querySelector('picture img.cover');
            const link = 'https://spankbang.com' + ahref;
            const video_id = item.getAttribute("data-id");
            const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
            const alt = coverImg ? coverImg.getAttribute('alt') : '';
            const currentPage = url;

            if(!ahref.includes('campaignId')){
              return { video_id, imageUrl, alt, link, currentPage, query, mode, nsfw, extractor: 'spankbang' };
            }
          } catch (error) {
            console.log(error)
          }
        });
        return data;
      }, url, query, mode, nsfw);

      await browser.close();

      resolve(scrapedData);

    }catch(error){
      console.log(error)
    }
  })
};

const scrapeWebsiteTopPage = (mode, nsfw, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = 'https://spankbang.com';
      const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) })
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
            const link = 'https://spankbang.com' + thumb.getAttribute('href');
            const video_id = item.getAttribute("data-id");
            const imageUrl = coverImg ? coverImg.getAttribute('data-src') : '';
            const alt = coverImg ? coverImg.getAttribute('alt') : '';

            return { video_id, imageUrl, alt, link, mode, nsfw, extractor: 'spankbang' };
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
module.exports = { getVideoFromSB, scrapeWebsiteTopPage, getVideoFromPD, getVideoFromHQP }