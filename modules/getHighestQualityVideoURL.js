const { ObjectId } = require('mongodb');
const puppeteer = require('puppeteer');

async function getHighestQualityVideoURL(video_id,user) {
  try {
    const userId = user._id
    const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
    const AllData = userInfo.scrapedData;
    
    
    const foundElement = AllData.find(item => item.video_id === video_id);
    // Find the index of the element with the desired video_id in the scrapedData array
    const elementIndex = AllData.findIndex(item => item.video_id === video_id);
    
    if (foundElement) {
      console.log('Found element:', foundElement);
    } else {
      console.log('Element with video_id not found.');
      return null;
    }
    const videoDocument = foundElement

    // Check if the video has already been scraped within the last 24 hours
    const currentTime = new Date().getTime();
    const lastScrapedTime = videoDocument.last_scraped || 0;
    const timeDifference = currentTime - lastScrapedTime;
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours
    if (timeDifference < oneDayInMilliseconds && videoDocument.highestQualityURL) {
      console.log('Video has already been scraped within the last 24 hours. Using cached URL.');
      return videoDocument.filePath ? videoDocument.filePath : videoDocument.highestQualityURL;
    }

    if(videoDocument.mode=="3"){
      console.log('Mode 3: returning the URL')
      await collection.updateOne(
        { _id: videoDocument._id },
        { $set: {last_scraped: currentTime } }
      );
  
      return videoDocument.url; 
    }

    const videoLink = videoDocument.link; // Assuming 'link' field contains the video link
    const videoURL = `${process.env.DEFAULT_URL}${videoLink}`;

    console.log('Video URL to scrape:', videoURL);

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Intercept requests
    await page.setRequestInterception(true);

    // Store the MP4 URLs
    const mp4Urls = [];

    // Listen for request events
    page.on('request', (request) => {
      if (request.url().includes('.mp4')) {
        // Intercept MP4 requests and add the URL to the mp4Urls array
        mp4Urls.push(request.url());
      }
      request.continue(); // Continue all requests
    });

    // Navigate to the video URL
    await page.goto(videoURL, { waitUntil: 'networkidle2' });

    // Wait for a short duration to capture all MP4 requests
    await page.waitForTimeout(1000);

    // Print the captured MP4 URLs
    //console.log('Captured MP4 URLs:', mp4Urls);

    await browser.close();

    // Find the highest quality available in the mp4Urls array
    const highestQualityURL = mp4Urls.length > 0 ? mp4Urls[0] : null;

    console.log('Highest Quality URL:', highestQualityURL);

    try {
      if (elementIndex !== -1) {

        AllData[elementIndex].highestQualityURL = highestQualityURL;
        AllData[elementIndex].last_scraped = currentTime;
    
        // Update the user document in the 'users' collection with the modified scrapedData array
        await global.db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { scrapedData: AllData } }
        );
    
        console.log('Element updated in the database.');
      } else {
        console.log('Element with video_id not found.');
      }
    } catch (error) {
      console.error('Error while updating element:', error);
    }
    
    return highestQualityURL;
  } catch (error) {
    console.error('Error occurred while getting the video URL:', error);
    return null; // Return null in case of an error
  }
}

module.exports = getHighestQualityVideoURL;
