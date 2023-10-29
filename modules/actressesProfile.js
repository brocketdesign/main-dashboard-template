const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');

// This is an async function that performs the web scraping.
const actressesProfile = async (actressID,page_number = 1) => {
  const actressCollection = global.db.collection('actresses');
  const actressProfileCollection = global.db.collection('actresses_profile');
  const actressInfo = await actressCollection.findOne({_id:new ObjectId(actressID)})
  const actressData = await actressProfileCollection.find({actressID,page_number}).toArray()
  if(actressData.length>0){
    return actressData
  }
  
  console.log("Launching Puppeteer...");
  
  // Initialize a new Puppeteer browser instance
  const browser = await puppeteer.launch({
    headless:false
  });
  
  // Create a new page in the browser
  const page = await browser.newPage();
  
  // Navigate to the blog page you want to scrape
  console.log("Navigating to blog page...");
  await page.goto(`https://missav.com/dm237/ja/actresses/${actressInfo.name}?page=${page_number}`);

  let actressInfoData = await page.evaluate(() => {
    try {
        let data = {}
          const paragraphs = Array.from(document.querySelectorAll('.mt-2.text-sm p'));
  
          data.height = paragraphs[0] ? paragraphs[0].textContent.split('/')[0].replace('cm','').trim() : false;;
          data.bust = paragraphs[0] ? paragraphs[0].textContent.split('/')[1].split('-')[0].trim() : false;;
          data.birth = paragraphs[1] ? paragraphs[1].textContent.split('(')[0].trim() : false;;
          data.age = paragraphs[1] ? paragraphs[1].textContent.split('(')[1].replace(')','').trim() : false;;
  
      return data;
    } catch (error) {
      console.log(error)
    }
  });
  if(actressInfoData){
    await actressCollection.updateOne({_id:new ObjectId(actressID)},{ $set:actressInfoData })
  }
  let scrapedData = await page.evaluate((actressID,page_number) => {
    const items = Array.from(document.querySelectorAll('.thumbnail.group'));
    const data = items.map((item, index) => {
      try {
        const thumbnail = item.querySelector('img').getAttribute('data-src');
        const title = item.querySelector('.truncate').textContent;
        const duration = item.querySelector('.absolute.bottom-1.right-1.rounded-lg.px-2.py-1.text-xs.text-nord5.bg-gray-800.bg-opacity-75').textContent;
        const preview = item.querySelector('video').getAttribute('data-src')
        const link = item.querySelector('a').getAttribute('href');
  
        return { thumbnail, title, duration, preview, link, actressID, page_number };
      } catch (error) {
        console.log(`Error at index ${index}:`, error);
        return null;
      }
    });
    return data;
  },actressID,page_number);

  const uniqueID = generateRandomID();
  scrapedData = await downloadPicture(actressInfo,scrapedData,uniqueID);
  scrapedData = await downloadVideo(actressInfo,scrapedData,uniqueID);
 
  console.log("Closing Puppeteer...");
  // Close the browser
  await browser.close();

    // Insert or update the scraped data in MongoDB
    console.log("Saving to MongoDB...");

    for (const data of scrapedData) {
      const { title } = data;

      // Update or insert data to avoid duplicates
      // Assuming 'name' or 'record_number' is unique for each actress
      await actressProfileCollection.updateOne(
        { title },
        { $set: data },
        { upsert: true }
      );
    }

    // Send the response
    console.log("Scraping and database update complete.");
    const result = await actressProfileCollection.find({actressID,page_number}).toArray()
    if(result.length>0){
      return result
    }
    return scrapedData
};

async function downloadPicture (actressInfo,scrapedData,uniqueID)  {
  const dirPath = path.join(__dirname,  '..', 'public','downloads', 'actresses', actressInfo.name);

  // Create the directory if it does not exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Download pictures
  const updatedScrapedData = await Promise.all(scrapedData.map(async (data,index) => {
    try {
      const pictureUrl = data.thumbnail;

      // Download the image
      const pictureBuffer = await axios.get(pictureUrl, { responseType: 'arraybuffer' });

      // Generate a name for the picture and its save path
      const pictureName = actressInfo.name +'_'+index+'_'+uniqueID+'_'+ path.basename(new URL(pictureUrl).pathname) || 'defaultPictureName.jpg';
      const localPicturePath = path.join(dirPath, pictureName);

      // Check if path already exists and is a directory
      if (fs.existsSync(localPicturePath) && fs.statSync(localPicturePath).isDirectory()) {
        return null;
      }

      // Save the picture
      fs.writeFileSync(localPicturePath, pictureBuffer.data);
      const trimmedPath = localPicturePath.replace(/.*\/public/, '');
      // Update the data object to include the local file path
      return { ...data, thumbnail_filePath: trimmedPath };

    } catch (error) {
      console.log('Error with picture download', error);
      return null;
    }
  }));

  // Remove any null values (failed downloads)
  return updatedScrapedData.filter(Boolean);
};

async function downloadVideo(actressInfo, scrapedData, uniqueID) {
  const dirPath = path.join(__dirname, '..', 'public', 'downloads', 'actresses', actressInfo.name);

  // Create the directory if it does not exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Download videos
  const updatedScrapedData = await Promise.all(scrapedData.map(async (data,index) => {
    try {
      const videoUrl = data.preview;  // assumed property name

      // Download the video
      const videoBuffer = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 300000  // Optional: increased timeout for potentially larger files
      });

      // Generate a name for the video and its save path
      const videoName = actressInfo.name + '_' +index+'_'+uniqueID+'_'+ path.basename(new URL(videoUrl).pathname) || 'defaultVideoName.mp4';
      const localVideoPath = path.join(dirPath, videoName);

      // Check if path already exists and is a directory
      if (fs.existsSync(localVideoPath) && fs.statSync(localVideoPath).isDirectory()) {
        return null;
      }

      // Save the video
      fs.writeFileSync(localVideoPath, videoBuffer.data);

      const trimmedPath = localVideoPath.replace(/.*\/public/, '');

      // Update the data object to include the local file path
      return { ...data, preview_filePath: trimmedPath };

    } catch (error) {
      console.log('Error with video download', error);
      return null;
    }
  }));

  // Remove any null values (failed downloads)
  return updatedScrapedData.filter(Boolean);
};

function generateRandomID() {
    return Math.random().toString(36).substr(2, 8);
}

// Export the function for use in other modules
module.exports = { actressesProfile };
