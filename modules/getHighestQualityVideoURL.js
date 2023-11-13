const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core');
const { saveData, updateSameElements, lessThan24Hours, isMedia } = require('../services/tools')
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const axios = require('axios');
async function getHighestQualityVideoURL(video_id, user, stream = true) {
  try {
    
    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(video_id)})

    if(foundElement.filePath){
      updateSameElements(foundElement,{isdl:true,isdl_data:new Date(),filePath:foundElement.filePath})
      return foundElement.filePath.replace('public','')
    }
    
    if(!foundElement.link.includes('youtube') && lessThan24Hours(foundElement.last_scraped)){
      return foundElement.highestQualityURL
    }

    if (foundElement.mode == "3") {
      const medialink = foundElement.webm || foundElement.url
      return medialink; 
    }
    if (foundElement.mode == "4") {
      return isMedia(foundElement.link) ? foundElement.link : foundElement.thumb; 
    }
    if(!foundElement.video && foundElement.mode == "2"){
      if( foundElement.link.includes('scrolller')){
        return foundElement.thumb
      }
      return foundElement.link
    }

    return await searchVideo(foundElement, user, stream);
  } catch (error) {
    console.log('Error occurred while getting the video URL:', error);
    return null;
  }
}


async function searchVideo(videoDocument, user, stream) {
  const videoLink = videoDocument.link; // Assuming 'link' field contains the video link

  if( videoLink.includes('youtube') ){
    return await searchVideoYoutube(videoDocument, user, stream)
  }
  if( videoLink.includes('spankbang') ){
    return await searchVideoUrl(videoDocument, user);
  }
  if( videoLink.includes('missav') ){
    return await searchVideoUrl(videoDocument, user);
  }
  if( videoLink.includes('xvideos') ){
    return await searchVideoUrlAPI(videoDocument, user);
  }
  if( videoLink.includes('scrolller') ){
    return await searchVideoScroller(videoDocument, user);
  }
}

async function searchVideoScroller(videoDocument, user) {
  const videoURL = videoDocument.link;
  const browser = await puppeteer.launch({ headless: true });
  const defaultPage = await browser.newPage();

  try {
    await defaultPage.goto(videoURL, { waitUntil: 'networkidle2' });
    await defaultPage.evaluate(() => localStorage.setItem('SCROLLLER_BETA_1:CONFIRMED_NSFW', true));
    const page = await browser.newPage();
    await page.goto(videoURL, { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('video', { timeout: 10000 });

    const highestQualityURL = await page.$eval('video', video => {
      if (video.src) return video.src;
      const source = video.querySelector('source');
      return source ? source.src : null;
    });

    await browser.close();
    updateSameElements(videoDocument, { highestQualityURL,isdl:true, last_scraped: new Date() });

    return highestQualityURL;

  } catch (error) {
    await browser.close();
    console.error('Error:', error);
    return videoDocument.thumb;
  }
}

async function searchVideoUrlAPI(videoDocument,user){
  //noot working anymore
  return false
  return await getJSON(`https://appsdev.cyou/xv-ph-rt/api/?site_id=xvideos&video_id=${videoDocument.video_id}`,user)
}
const getJSON = async (url,user) => {
  try {
    const response = await axios.get(url);
    
    // Ensure the response is in JSON format.
    if (response.headers['content-type'].includes('application/json')) {
      const link = response.data.mp4.high != 	"" ? response.data.mp4.high : response.data.mp4.low
      console.log(link)
      return link;
    } else {
      throw new Error('Response is not in JSON format');
    }
  } catch (error) {
    throw error;
  }
};
async function searchVideoUrl( videoDocument, user) {

  videoURL = videoDocument.link

  if(!videoDocument.link.includes('http')){
    videoURL = `${process.env.DEFAULT_URL}${videoDocument.link}`;
  }
  console.log('Video URL to scrape:', videoURL);

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  const mp4Urls = [];

  page.on('request', (request) => {
    if (request.url().includes('.mp4')) {
      mp4Urls.push(request.url());
    }
    request.continue();
  });

  await page.goto(videoURL, { waitUntil: 'networkidle2' });

  await browser.close();

  const highestQualityURL = mp4Urls[0] || null;

  updateSameElements(videoDocument, {highestQualityURL:highestQualityURL,last_scraped:new Date()})
  
  //console.log('Highest Quality URL:', highestQualityURL);
  return highestQualityURL;
}

async function searchVideoYoutube( videoDocument, user, stream){

  if(!stream){
    return videoDocument.link
  }

  const info = await ytdl.getInfo(videoDocument.video_id);
  
  const format = ytdl.chooseFormat(info.formats, { 
    filter: 'audioandvideo', 
    quality: 'highestaudio'
  });
  updateSameElements(videoDocument, {streamingUrl:format.url,last_scraped:new Date()})

  //console.log('Format found!', format.url);
  return format.url;
}

module.exports = getHighestQualityVideoURL;
