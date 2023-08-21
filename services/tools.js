const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // You'll need to install axios: npm install axios
const { createParser } = require('eventsource-parser');


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
  console.log({userId,video_id})
  const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  const AllData = userInfo.scrapedData || [] ;
  const foundElement = AllData.find(item => item.video_id === video_id);
  const elementIndex = AllData.findIndex(item => item.video_id === video_id);
  return {elementIndex,foundElement};
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
  
   try {
     const { elementIndex, foundElement } = await findElementIndex(user, documentId);
 
     if (elementIndex === -1) {
       console.log('Element with video_id not found.');
       return;
     }
 
     const userId = user._id;
     const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
     const AllData = userInfo.scrapedData || [];
     AllData[elementIndex] = Object.assign({}, AllData[elementIndex], update);
 
     const result = await global.db.collection('users').updateOne(
       { _id: new ObjectId(userId) },
       { $set: { scrapedData: AllData } }
     );

     if(result.matchedCount > 0){
      console.log(`Updated the database `,update)
     }else{
      console.log('Could not update the database')
     }

     return true
   } catch (error) {
      console.log(error)
      console.log('Could not save the data in the user data')
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

  return images;
}
async function findDataInMedias(query){
  console.log(`Looking in collection medias`)
  var scrapedData = await global.db.collection('medias').find(query).toArray()

  if(scrapedData.length >0 ){
    console.log(`Found ${scrapedData.length} elements. `)
    return scrapedData
  }
  console.log('Nothing founded.')
  return false
}
async function filterHiddenElement(scrapedData) {
  // Extract all sources from scrapedData
  const sources = scrapedData.reduce((acc, item) => {
    if (item && typeof item.source !== 'undefined') {
      acc.push(item.source);
    }
    return acc;
  }, []);
    if(sources.length ==0 ){
    return scrapedData
  }
  // Find sources that exist in the "medias" collection with hide: true
  const hiddenSources = await global.db.collection('medias').find({ 
    source: { $in: sources },
    hide: true
  }).toArray();

  const hiddenSourceSet = new Set(hiddenSources.map(item => item.source));

  // Filter out items from scrapedData that have hide: true in the "medias" collection
  return scrapedData.filter(item => !hiddenSourceSet.has(item.source));
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
      
      for await (const value of response.body?.pipeThrough(new TextDecoderStream())) {
          parser.feed(value);
      }
console.log(fullCompletion)
      return fullCompletion;

  } catch (error) {
      console.error("Error fetching OpenAI completion:", error);
      throw error;
  }
}

// Usage:
// const messages = [...]; // Define your messages here
// await fetchOpenAICompletion(messages, res);

module.exports = { 
  formatDateToDDMMYYHHMMSS, 
  findElementIndex, 
  saveData ,
  translateText ,
  fetchMediaUrls, 
  findDataInMedias,
  filterHiddenElement,
  sanitizeData,
  updateSameElements,
  getOpenaiTypeForUser,
  fetchOpenAICompletion
}