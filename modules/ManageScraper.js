const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const _ = require('lodash');  // Import lodash at the top of your file
const { 
  findDataInMedias,
  updateSameElements,
  initCategories,
  sanitizeData,
  cleanupDatabase
} = require('../services/tools')
const scrapeMode1 = require(`./scraper/scrapeMode1`);

// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.',userId);
  return user;
}

async function ManageScraper(searchterm, nsfw, mode, user, page) {
  const myCollection = `medias_${mode}`
  const {scrapeMode} = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id

  let userInfo = await findAndUpdateUser(userId);
  const query = {
    searchterm, 
    mode: mode,
    nsfw: nsfw,
    $and: [ 
      { $or: [ { hide_query: { $exists: false } }, { hide_query: "false" } ] },
      { $or: [ { hide: { $exists: false } }, { hide: "false" } ] },
    ],
    //favoriteCountry: { $in: [userInfo.favoriteCountry] }
  };
  
  scrapedData = await findDataInMedias(userId, parseInt(page), query);

  if(scrapedData && scrapedData.length >= 30 ){ //&& searchterm != 'undefined'
    return scrapedData
  }
  
  scrapedData = await scrapeMode(searchterm, mode, nsfw, page, user);
  if(!scrapedData){
    return []
  }
  console.log(`Scrape data and found ${scrapedData.length} elements.`)
  await cleanupDatabase(myCollection)

  const categories = await initCategories(userId)
  scrapedData = scrapedData.map((data) => ({
    ...data,
    searchterm,
    mode: mode,
    nsfw: nsfw,
    page:parseInt(page),
    userId: userId,
    categories:categories,
    favoriteCountry: userInfo.favoriteCountry,
    time :new Date()
  })); 

  await updateUserScrapInfo(user,searchterm,page,mode)
  let result = await insertInDB(myCollection, scrapedData)
  console.log(`Return result for page ${page} : ${result.length}`)
  if(result){result=result.reverse()}
  return result
}
async function AsyncManageScraper(searchterm, nsfw, mode, user, page) {

  const myCollection = `medias_${mode}`
  const {scrapeMode} = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id

  let userInfo = await findAndUpdateUser(userId);
  
  scrapedData = await scrapeMode(searchterm, mode, nsfw, page, user, true);
  if(!scrapedData){
    return []
  }

  
  const categories = await initCategories(userId)

  scrapedData = scrapedData.map((data) => ({
    ...data,
    searchterm,
    mode: mode,
    nsfw: nsfw,
    userId: userId,
    categories:categories,
    favoriteCountry: userInfo.favoriteCountry
  })); 

  updateUserScrapInfo(user,searchterm,page,mode)

  let result = await insertInDB(myCollection, scrapedData)

  if(result && result.length > 30){
    //return result.slice(0,30)
  }
  if(result){result=result.reverse()}
  return result
}

async function insertInDB(myCollection, scrapedData) {
  try {
    if (scrapedData.length === 0) {
      return [];
    }

    const dbCollection = global.db.collection(myCollection);
    const newEntries = [];
    const addedIds = new Set(); // Helper set to track IDs of added documents

    for (const item of scrapedData) {
      // Build a dynamic query based on existing, non-undefined fields
      const query = [];
      if (item.source !== undefined && !item.source.includes('undefined')) query.push({ source: item.source });
      if (item.url !== undefined && !item.url.includes('undefined')) query.push({ url: item.url });
      if (item.link !== undefined && !item.link.includes('undefined')) query.push({ link: item.link });

      // Only proceed if there's at least one valid field to check against
      if (query.length > 0) {
        const exists = await dbCollection.findOne({ $or: query });

        if (!exists) {
          // If it doesn't exist, insert it and add to the newEntries array
          const result = await dbCollection.insertOne(item);
          if (result.insertedId) {
            // Include the new MongoDB _id in the returned item
            item._id = result.insertedId;
            newEntries.push(item);
            addedIds.add(item._id.toString()); // Track this ID as added
          }
        } else {
          // Check if this document is already added to newEntries
          if (!addedIds.has(exists._id.toString())) {
            newEntries.push(exists);
            addedIds.add(exists._id.toString()); // Track this ID as added
          }
        }
      }
    }

    console.log('Inserted documents:', newEntries.length);
    return newEntries; // Return the array of newly inserted documents with their MongoDB _id
  } catch (error) {
    console.error('Error processing documents:', error);
    throw error; // It's often a good practice to rethrow the error after logging
  }
}



async function checkUserScrapeInfo(user){
  const scrapInfo = Array.isArray(user.scrapInfo) 
  const userId = user._id
  if(!scrapInfo){
    try {
      // If the URL doesn't exist, push the new scrapInfo
      await global.db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set:{scrapInfo: []}
          
        },
        { upsert: true }
      );
    } catch (error) {
      console,log(error)
    }
  }
}
async function updateUserScrapInfo(user,searchterm,page,mode){
  await checkUserScrapeInfo(user)
  userInfo = await findAndUpdateUser(user._id);
  const scrapInfo = userInfo.scrapInfo.find(info => info.searchterm === searchterm);
  const currentTime = new Date().getTime();
  if (scrapInfo) {
    // If the URL already exists, update the time and page
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(user._id), 'scrapInfo.searchterm': searchterm },
      {
        $set: {
          'scrapInfo.$.mode': mode,
          'scrapInfo.$.time': currentTime,
          'scrapInfo.$.page': parseInt(page)
        }
      }
    );
  } else {
    // If the searchterm doesn't exist, push the new scrapInfo
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      {
        $push: {
          scrapInfo: { searchterm: searchterm, time: currentTime, page: parseInt(page) }
        }
      },
      { upsert: true }
    );
  }
}


module.exports = {ManageScraper,AsyncManageScraper,insertInDB};
