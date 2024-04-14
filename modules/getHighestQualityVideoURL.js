const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core');
const { saveData, updateSameElements, lessThan24Hours, isMedia } = require('../services/tools')
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const axios = require('axios');
const cheerio = require('cheerio');

async function getHighestQualityVideoURL(myCollection,video_id, user, stream = true) {
  try {
    const foundElement = await global.db.collection(myCollection).findOne({_id:new ObjectId(video_id)})

    if(!foundElement){
      console.log(`Error could not found element ( ${video_id} ) in  ${myCollection}`)
      return
    }
    if(foundElement.filePath){
      await updateSameElements(foundElement, myCollection, {isdl:true,isdl_data:new Date(),filePath:foundElement.filePath})
      return foundElement.filePath.replace('public','')
    }
    
    if(!foundElement.link.includes('youtube') && lessThan24Hours(foundElement.last_scraped)){
      if(!foundElement.isdl_process){
        console.log(`Start download for ${video_id}`)
        global.db.collection(myCollection).updateOne({_id:new ObjectId(video_id)},{$set:{isdl_process:true}})
        .then(()=>{
          downloadMedia(myCollection, foundElement)
        })
        .catch((err)=>{
          console.log(err)
        })
      }

      return foundElement.highestQualityURL
    }

    if (foundElement.mode == "3") {
      const medialink = foundElement.webm || foundElement.url
      return medialink; 
    }
    if (foundElement.mode == "4" || foundElement.mode == "7" ) {
      return isMedia(foundElement.link) ? foundElement.link : foundElement.thumb; 
    }
    
    if (foundElement.mode == "6") {
      return foundElement.link ; 
    }
    
    if(!foundElement.video && foundElement.mode == "2"){
      if( foundElement.link.includes('scrolller')){
        return foundElement.thumb
      }
      return foundElement.link
    }
    const result = await searchVideo(foundElement, myCollection, user, stream);

    if(!foundElement.isdl_process){
      global.db.collection(myCollection).updateOne({_id:new ObjectId(video_id)},{$set:{isdl_process:true}})
      .then(()=>{
        downloadMedia(myCollection, foundElement)
      })
      .catch((err)=>{
        console.log(err)
      })
    }
    return result
  } catch (error) {
    console.log('Error occurred while getting the video URL:', error);
    return null;
  }
}
async function downloadMedia(myCollection,foundElement){
        axios.post('http://192.168.10.115:3100/api/dl', {
          video_id: foundElement._id,
          title: foundElement.title || foundElement._id,
          myCollection
        })
        .then(response => {
          global.db.collection(myCollection).updateOne({_id:new ObjectId(foundElement._id)},{$set:{isdl_process:false}})
        })
        .catch(error => {
          console.error('There was an error!', error);
        });        
}

async function searchVideo(videoDocument, myCollection, user, stream) {
  const videoLink = videoDocument.link; // Assuming 'link' field contains the video link

  if( videoLink.includes('monsnode')){
    return await searchVideoDirectLink(videoDocument, myCollection, user)
  }
  if( videoLink.includes('porndig')){
    return await searchVideoPD(videoDocument, myCollection, user)
  }
  if( videoLink.includes('youtube') ){
    return await searchVideoYoutube(videoDocument, myCollection, user, stream)
  }
  if( videoLink.includes('spankbang') ){
    return await searchVideoUrl(videoDocument, myCollection, user);
  }
  if( videoLink.includes('missav') ){
    return await searchVideoUrl(videoDocument, myCollection, user);
  }
  if( videoLink.includes('xvideos') ){
    return await searchVideoUrlAPI(videoDocument, myCollection, user);
  }
  if( videoLink.includes('scrolller') ){
    return await searchVideoScroller(videoDocument, myCollection, user);
  }
}

async function searchVideoScroller(videoDocument, myCollection, user) {
  const videoURL = videoDocument.link;
  const browser = await puppeteer.launch({ headless: 'new' });
  const defaultPage = await browser.newPage();
  console.log('searchVideoScroller',{videoURL})
  try {
    await defaultPage.goto(videoURL, { waitUntil: 'networkidle2' });
    await defaultPage.evaluate(() => localStorage.setItem('SCROLLLER_BETA_1:CONFIRMED_NSFW', true));
    const page = await browser.newPage();
    await page.goto(videoURL, { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('video', { timeout: 1000 });

    const highestQualityURL = await page.$eval('video', video => {
      if (video.src) return video.src;
      const source = video.querySelector('source');
      return source ? source.src : null;
    });

    await browser.close();
    await updateSameElements(videoDocument, myCollection, { highestQualityURL,isdl:true, last_scraped: new Date() });

    return highestQualityURL;

  } catch (error) {
    await browser.close();
    console.error('Error:', error);
    return videoDocument.thumb;
  }
}

async function searchVideoUrlAPI(videoDocument, myCollection,user){
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
async function searchVideoUrl( videoDocument, myCollection, user) {

  videoURL = videoDocument.link

  if(!videoDocument.link.includes('http')){
    videoURL = `${process.env.DEFAULT_URL}${videoDocument.link}`;
  }
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

  await updateSameElements(videoDocument, myCollection, {highestQualityURL:highestQualityURL,last_scraped:new Date()})
  //console.log('Highest Quality URL:', highestQualityURL);
  return highestQualityURL;
}

async function searchVideoYoutube( videoDocument, myCollection, user, stream){
  if(!stream){
    return videoDocument.link
  }

  const info = await ytdl.getInfo(videoDocument.video_id);
  
  const format = ytdl.chooseFormat(info.formats, { 
    filter: 'audioandvideo', 
    quality: 'highestaudio'
  });
  await updateSameElements(videoDocument, myCollection, {streamingUrl:format.url,last_scraped:new Date()})

  //console.log('Format found!', format.url);
  return format.url;
}

async function searchVideoDirectLink(videoDocument, myCollection, user){
  const url = videoDocument.link

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  const videoDirectLink = $('a').attr('href')

  return videoDirectLink
}
async function searchVideoPD(videoDocument, myCollection, user){
  const url = videoDocument.link;
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const videoPage = $('.video_iframe_container iframe').attr('src');
  
  const videoPageResponse = await axios.get(videoPage);
  const $$ = cheerio.load(videoPageResponse.data);
  
  let vcJsonString;
  $$('script').each((i, elem) => {
    const scriptContent = $$(elem).html();
    // Adjust the regex to match multi-line JSON assignment
    const vcVariableMatch = scriptContent.match(/var vc = ({[\s\S]*?});/);
    if (vcVariableMatch && vcVariableMatch.length > 1) {
      vcJsonString = vcVariableMatch[1];
      // Break the loop once we find the match
      return false;
    }
  });
  
  // Assuming vcJsonString is found and is a valid JSON string
  let vcData;
  if (vcJsonString) {
    try {
      vcData = JSON.parse(vcJsonString);
     // console.log('VC Data:', vcData);
    } catch (error) {
      console.error('Failed to parse vc JSON string:', error);
    }
  }
  
  return vcData.sources[0].src; // This will contain the parsed JSON, or undefined if not found/parsed

}
module.exports = getHighestQualityVideoURL;
