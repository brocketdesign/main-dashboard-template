const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // You'll need to install axios: npm install axios
const { createParser } = require('eventsource-parser');
const fetch = require('node-fetch');
const https = require('https');

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


async function saveData(user, documentId, update){
  try {
    
    // Step 1: Fetch the document based on the _id
    const resultElement = await global.db.collection('medias').findOne({ _id: new ObjectId(documentId) });
    
    if (resultElement) {
       // Step 2: Update that document
       const result = await global.db.collection('medias').updateOne(
        { _id: new ObjectId(documentId) },
        { $set: update }
      );
      
      // Check if the document was updated
      if (result.matchedCount > 0) {
        updateSameElements(resultElement,update)
        return true;
      } else {
          console.log("Failed to update the document.");
          return false;
      }
    }
  } catch (error) {
    console.log('Element not founded in medias collections');
  }
   return false
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
  //console.log('Starting to fetch media URLs from:', url); // Log start
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();

  const images = [];

  // Listen to all requests
  page.on('request', request => {
    const resourceType = request.resourceType();
    const requestUrl = request.url();

    if (resourceType === 'image') {
      images.push({ source_url: requestUrl });
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
      console.log('Reached the end of scrolling, or an error occurred' ); // Log error or end of scrolling
      break;
    }

    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === previousHeight) {
      console.log('No new content loaded, breaking the loop.'); // Log if no new content is loaded
      break;
    }

    attempts++;
  }

  await browser.close();

  //console.log('Finished fetching media URLs.'); // Log finish
  return images;
}

async function findDataInMedias(userId, query, categoryId = null) {
  // Retrieve the current user's data
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  await initCategories(userId)
  // If a specific category ID is provided, use it
  // Otherwise, find the "All" category within the user's categories
  let categoryToUse;
  if (categoryId) {
    categoryToUse = user.categories && user.categories.find(cat => cat.id.toString() === categoryId.toString());
    if (!categoryToUse) {
      throw new Error('指定されたカテゴリが見つかりませんでした'); // Specified category not found
    }
  } else {
    categoryToUse = user.categories && user.categories.find(cat => cat.name === 'All');
    if (!categoryToUse) {
      throw new Error('カテゴリ「All」が見つかりませんでした'); // Category "All" not found
    }
  }

  // Add the category ID to the query
  query.categories = { $in: [categoryToUse.id.toString()] };

  // Find the medias that match the query
  const medias = await global.db.collection('medias').find(query).toArray();

  return medias;
}

function sanitizeData(scrapedData,query) {
  //check for object with the same source and keep only one
  let uniqueData = [];
  let seenSources = new Set();
  
  for (let item of scrapedData) {
      if (!seenSources.has(item[query])) {
          seenSources.add(item[query]);
          uniqueData.push(item);
      }
  }

  return uniqueData
}

async function updateItemsByField(fieldName, fieldValue, query) {
  const itemsWithSameLink = await global.db.collection('medias').find({ [fieldName]: fieldValue }).toArray();
  console.log(`Found ${itemsWithSameLink.length} item(s) with the same ${fieldName} `, fieldValue);

  for (let item of itemsWithSameLink) {
      await global.db.collection('medias').updateOne({ _id: new ObjectId(item._id) }, { $set: query });
  }
}

async function updateSameElements(foundElement, query) {

  if (foundElement.source) {
      await updateItemsByField('source', foundElement.source, query);
  }
  if (foundElement.url) {
      await updateItemsByField('url', foundElement.url, query);
  }
  if (foundElement.link) {
      await updateItemsByField('link', foundElement.link, query);
  }
  
}
async function getOpenaiTypeForUser(userId, type) {
  // 1. Fetch the user's document.
  const userDoc = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });

  // If userDoc doesn't exist or doesn't have the specified openai_type, return an empty array.
  if (!userDoc || !userDoc[`openai_${type}`]) {
    return [];
  }

  // 2. Extract the list of openai document IDs from the user's document.
  const openaiIds = userDoc[`openai_${type}`].map(id => new ObjectId(id));

  // 3. Fetch the openai documents using the extracted IDs.
  const openaiDocs = await global.db.collection('openai').find({ _id: { $in: openaiIds } }).sort({_id:-1}).toArray();

  return openaiDocs;
}
const fetchOpenAICompletion = async (messages, res) => {
  try {
      let response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
              },
              method: "POST",
              body: JSON.stringify({
                  model: process.env.COMPLETIONS_MODEL,
                  messages,
                  temperature: 0.75,
                  top_p: 0.95,
                  frequency_penalty: 0,
                  presence_penalty: 0,
                  max_tokens: 100,
                  stream: true,
                  n: 1,
              }),
          }
      );

      // Log the status and status text
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      // If the status indicates an error, log the response body
      if (!response.ok) {
          console.error("Response body:", await response.text());
      }

      let fullCompletion = ""; // Variable to collect the entire completion
      let chunkIndex = 0; // Variable to keep track of the current chunk's index
      const parser = createParser((event) => {
        try { // Add try block to catch potential errors
          if (event.type === 'event') {
            if (event.data !== "[DONE]") {
              const content = JSON.parse(event.data).choices[0].delta?.content || "";
              //console.log(`Chunk Index: ${chunkIndex}, Content: ${content}`); // Uncomment this line to log chunks
              fullCompletion += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
              res.flush(); // Flush the response to send the data immediately
              chunkIndex++; // Increment the chunk index
            }
          }
        } catch (error) { // Catch block to handle any errors
          console.log(error)
          console.error("Error in parser:", error);
          console.error("Event causing error:", event);
        }
      });


      for await (const chunk of response.body) {
        parser.feed(new TextDecoder('utf-8').decode(chunk));
      }
      
      return fullCompletion;

  } catch (error) {
      console.error("Error fetching OpenAI completion:", error);
      throw error;
  }
}


async function initCategories(userId) {
  // Find the current user's data
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });

  // Check if the category "All" already exists
  const category = user.categories && user.categories.find(cat => cat.name === 'All');

  if (category) {
    // If the category already exists, return its ID in an array
    return [category.id.toString()];
  } else {
    // If the category does not exist, create it and add to the user's categories
    const newCategory = { id: new ObjectId().toString() , name: 'All' };
 
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $push: { categories: newCategory } }
    );

    // Return the inserted ID in an array
    return [newCategory.id];
  }
} 
async function saveDataSummarize(videoId, format){
  try {
    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})

    format.last_summarized = Date.now();
    const result = await global.db.collection('medias').updateOne(
      {_id:new ObjectId(videoId)},
      {$set:format}
    )

    console.log(`${result.modifiedCount} element updated in the database.`);
  } catch (error) {
    console.log('Error while updating element:', error);
  }
}
async function downloadVideo(url, filePath, itemID) {
    let browser;
    let videoSrc;

    try {
        browser = await puppeteer.launch({
            headless: true,
            //executablePath: '/usr/bin/google-chrome'
        });

        const page = await browser.newPage();
        
        await page.goto(url);
        await page.waitForSelector('#scrollableDiv video');

        // Extract the video src
        videoSrc = await page.$eval('#scrollableDiv video', video => video.getAttribute('src'));

        // Get the video content encoded as Base64
        const videoBase64 = await page.evaluate(async (videoSrc) => {
            return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', videoSrc, true);
                xhr.responseType = 'arraybuffer';

                xhr.onload = function() {
                    if (this.status >= 200 && this.status < 300) {
                        const base64 = btoa(
                            new Uint8Array(this.response).reduce((data, byte) => data + String.fromCharCode(byte), '')
                        );
                        resolve(base64);
                    } else {
                        reject(new Error(`Failed with status: ${this.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('XHR request failed'));
                xhr.send();
            });
        }, videoSrc);

        // Convert Base64 to Buffer and save to a file
        fs.writeFileSync(filePath, Buffer.from(videoBase64, 'base64'));

        try {
          const result = await global.db.collection('medias').updateOne(
              { _id: new ObjectId(itemID) },
              { $set: { filePath: filePath } }
          );
          console.log(`Element updated: ${result.modifiedCount}`);
      } catch (error) {
          console.error("Error updating the database:", error);
      }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { 
  formatDateToDDMMYYHHMMSS, 
  saveData ,
  translateText ,
  fetchMediaUrls, 
  findDataInMedias,
  sanitizeData,
  updateSameElements,
  getOpenaiTypeForUser,
  fetchOpenAICompletion,
  initCategories,
  saveDataSummarize,
  downloadVideo
}