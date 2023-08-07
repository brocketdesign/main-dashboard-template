const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core');

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

async function getHighestQualityVideoURL(video_id, user, stream = true) {
  try {
    const userId = user._id;
    const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
    const AllData = userInfo.scrapedData;
    const { elementIndex, foundElement } = await findElementIndex(AllData, video_id);

    if (!foundElement) {
      console.log('Element with video_id not found.');
      return null;
    }
    
    if (hasBeenScrapedRecently(foundElement)) {
      return getVideoFilePathOrHighestQualityURL(foundElement, stream);
    }

    if (foundElement.mode == "3") {
      await updateLastScraped(foundElement);
      return foundElement.url; 
    }

    return await searchVideo(AllData, foundElement, user, stream);
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

async function searchVideo(AllData, videoDocument, user, stream) {
  const videoLink = videoDocument.link; // Assuming 'link' field contains the video link
  return videoLink.includes('youtube') ? 
    await searchVideoYoutube(AllData, videoDocument, user, stream) : await searchVideoUrl(AllData, videoDocument, user);
}

async function findElementIndex(AllData, video_id){
  const foundElement = AllData.find(item => item.video_id === video_id);
  const elementIndex = AllData.findIndex(item => item.video_id === video_id);
  return {elementIndex,foundElement};
}

async function saveData(AllData, videoDocument, format, user){
  try {
    const { elementIndex, foundElement } = await findElementIndex(AllData, videoDocument.video_id);
    const userId = user._id
    if (elementIndex === -1) {
      console.log('Element with video_id not found.');
      return;
    }

    AllData[elementIndex] = Object.assign({}, AllData[elementIndex], format);
    AllData[elementIndex].last_scraped = Date.now();

    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { scrapedData: AllData } }
    );

    console.log('Element updated in the database.');
  } catch (error) {
    console.log('Error while updating element:', error);
  }
}

async function searchVideoUrl(AllData, videoDocument, user) {
  const videoURL = `${process.env.DEFAULT_URL}${videoDocument.link}`;
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
  await saveData(AllData, videoDocument, {highestQualityURL}, user);

  console.log('Highest Quality URL:', highestQualityURL);
  return highestQualityURL;
}

async function searchVideoYoutube(AllData, videoDocument, user, stream){
  if(!stream){
    return videoDocument.link
  }

  const info = await ytdl.getInfo(videoDocument.video_id);
  
  const format = ytdl.chooseFormat(info.formats, { 
    filter: 'audioandvideo', 
    quality: 'highestaudio'
  });

  await saveData(AllData, videoDocument, {streamingUrl:format.url}, user);

  //console.log('Format found!', format.url);
  return format.url;
}

module.exports = getHighestQualityVideoURL;
