const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // You'll need to install axios: npm install axios


// Initialize OpenAI with your API key
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

function formatDateToDDMMYYHHMMSS() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).substr(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ddmmyyhhmmss = `${day}${month}${year}${hours}${minutes}${seconds}`;
  return ddmmyyhhmmss;
}

async function findElementIndex(user,video_id){
  const userId = user._id;
  const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  const AllData = userInfo.scrapedData || [] ;
  const foundElement = AllData.find(item => item.video_id === video_id);
  const elementIndex = AllData.findIndex(item => item.video_id === video_id);
  return {elementIndex,foundElement};
}


async function saveData(user, documentId, update){
  try {
    console.log(documentId)
    const { elementIndex, foundElement } = await findElementIndex(user, documentId);

    if (elementIndex === -1) {
      console.log('Element with video_id not found.');
      return;
    }

    const userId = user._id;
    const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
    const AllData = userInfo.scrapedData || [];
    AllData[elementIndex] = Object.assign({}, AllData[elementIndex], update);

    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { scrapedData: AllData } }
    );

    return true
  } catch (error) {
    console.log('Error while updating element:', error);
    return false
  }
}

async function translateText(text,lang) {
  let summary = '';
  
  const gptResponse = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Translate the following text in ${lang} :${text} `,
    max_tokens: 1000,
    temperature: 0,
  });
  
  return gptResponse.data.choices[0].text.trim();
}

async function fetchMediaUrls(url) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();

  const images = [];
  const videos = [];

  // Listen to all requests
  page.on('request', request => {
      const resourceType = request.resourceType();
      const requestUrl = request.url();

      if (resourceType === 'image') {
          images.push(requestUrl);
      } else if (resourceType === 'media') {
          videos.push(requestUrl);
      }
  });

  await page.goto(url, { waitUntil: 'networkidle2' });

  // Scroll to the bottom of the page
  let previousHeight;
  let maxScrollAttempts = 10; // Adjust this value based on your needs
  let attempts = 0;
  
  while (attempts < maxScrollAttempts) {
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      
      try {
          await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: 3000 }); // 3 seconds timeout
      } catch (error) {
          // If waitForFunction times out, break out of the loop
          break;
      }
  
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) {
          break;
      }
  
      attempts++;
  }
  

  await browser.close();

  // Check if 'downloaded_images' directory exists, if not, create it
  const dirPath = path.join(__dirname, '..', 'public', 'downloads', 'downloaded_images');

  if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
  }

  // Download images and save them locally
  const imagePaths = await Promise.all(images.map(async (imageUrl) => {
      const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageName = path.basename(new URL(imageUrl).pathname) || 'defaultImageName.jpg'; // Provide a default name if imageName is empty

      const localImagePath = path.join(dirPath, imageName);
      
      // Check if localImagePath is a directory
      if (fs.existsSync(localImagePath) && fs.statSync(localImagePath).isDirectory()) {
          console.error(`Cannot write to ${localImagePath} because it's a directory.`);
          return;
      }
      
      fs.writeFileSync(localImagePath, imageBuffer.data);
            return {link:localImagePath.replace(/.*public/, ''),source:imageUrl};
  }));

console.log(imagePaths[0])
  return imagePaths;
}

module.exports = { formatDateToDDMMYYHHMMSS, findElementIndex, saveData ,translateText , fetchMediaUrls}