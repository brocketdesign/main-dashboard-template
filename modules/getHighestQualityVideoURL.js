const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core');
const { saveData, updateSameElements } = require('../services/tools')
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

async function getHighestQualityVideoURL(video_id, user, stream = true) {
  try {
    const userId = user._id;
    
    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(video_id)})

    if(foundElement.filePath){
      console.log('The element has already been downloaded', foundElement)
      updateSameElements(foundElement,{isdl:true,isdl_data:new Date()})
      return foundElement.filePath
    }

    if (hasBeenScrapedRecently(foundElement)) {
      return getVideoFilePathOrHighestQualityURL(foundElement, stream);
    }

    if (foundElement.mode == "3") {
      await saveData(user, foundElement,{filePath:foundElement.url})
      return foundElement.url; 
    }
    if (foundElement.mode == "2" || foundElement.mode == "4") {
      return foundElement.link; 
    }

    return await searchVideo(foundElement, user, stream);
  } catch (error) {
    console.log('Error occurred while getting the video URL:', error);
    return null;
  }
}

function hasBeenScrapedRecently(videoDocument) {
  const currentTime = Date.now();
  const lastScrapedTime = videoDocument.last_scraped || 0;
  const timeDifference = currentTime - lastScrapedTime;
  const result = !!((timeDifference < ONE_DAY_IN_MS) && (videoDocument.highestQualityURL || videoDocument.streamingUrl))
  return result;
}

function getVideoFilePathOrHighestQualityURL(videoDocument, stream) {
  console.log('Video has already been scraped within the last 24 hours. Using cached URL.');
  if(videoDocument.link.includes('youtube.com')){
    if(stream){
      return videoDocument.filePath ? videoDocument.filePath : videoDocument.streamingUrl;
    }else{
      return videoDocument.filePath ? videoDocument.filePath : videoDocument.link;
    }
  }
  return videoDocument.filePath ? videoDocument.filePath : videoDocument.highestQualityURL;
}


async function updateLastScraped(videoDocument) {
  console.log('Mode 3: returning the URL');

}

async function searchVideo(videoDocument, user, stream) {
  const videoLink = videoDocument.link; // Assuming 'link' field contains the video link
  return videoLink.includes('youtube') ? 
    await searchVideoYoutube(videoDocument, user, stream) : await searchVideoUrl(videoDocument, user);
}

async function findElementIndex( video_id){
  const foundElement = AllData.find(item => item.video_id === video_id);
  const elementIndex = AllData.findIndex(item => item.video_id === video_id);
  return {elementIndex,foundElement};
}

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
  await page.waitForTimeout(1000);

  await browser.close();

  const highestQualityURL = mp4Urls[0] || null;

  updateSameElements(videoDocument, {highestQualityURL:highestQualityURL,last_scraped:new Date()})
  
  console.log('Highest Quality URL:', highestQualityURL);
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
