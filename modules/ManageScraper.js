const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const _ = require('lodash');  // Import lodash at the top of your file
const { 
  findDataInMedias,
  updateSameElements,
  initCategories,
  sanitizeData,
  cleanupDatabase,
  removeDuplicates
} = require('../services/tools')
const scrapeMode1 = require(`./scraper/scrapeMode1`);

async function ManageScraper(searchterm, nsfw, mode, user, page) {
  const myCollection = `medias_${mode}`;
  const { scrapeMode } = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id;

  const userInfo = await findAndUpdateUser(userId);
  searchterm = searchterm.trim()
  const query = { searchterm, mode, nsfw, hidden_item: { $exists: false } };
  if (true || await checkUserScrapTimeAndMode(user, searchterm, mode)) {
    const scrapedData = await findDataInMedias(userId, parseInt(page), query);
    if (scrapedData?.length) return scrapedData;
  }

  let scrapedData = await scrapeMode(searchterm, mode, nsfw, page, user);
  if (!scrapedData?.length) return [];

  await cleanupDatabase(myCollection);
  const categories = await initCategories(userId);

  scrapedData = scrapedData.map(data => ({
    ...data,
    searchterm,
    mode,
    nsfw,
    page: parseInt(page),
    userId,
    categories,
    favoriteCountry: userInfo.favoriteCountry,
    time: new Date(),
  }));

  await updateUserScrapInfo(user, searchterm, page, mode);
  const result = await insertInDB(myCollection, scrapedData);
  return result?.reverse() || [];
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
            if(!exists.hidden_item){
              newEntries.push(exists);
            }
            addedIds.add(exists._id.toString()); // Track this ID as added
          }
        }
      }
    }

    console.log('Inserted documents:', newEntries.length);
    return newEntries;
  } catch (error) {
    console.error('Error processing documents:', error);
    throw error; // It's often a good practice to rethrow the error after logging
  }
}


async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.',userId);
  return user;
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
async function checkUserScrapTimeAndMode(user, searchterm, mode) {
  const userInfo = await findAndUpdateUser(user._id);
  const scrapInfo = userInfo.scrapInfo.find(info => info.searchterm === searchterm);

  if (scrapInfo) {
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - scrapInfo.time;
    return timeDifference < (24 * 60 * 60 * 1000) && scrapInfo.mode === mode;
  }

  return false; 
}



module.exports = {ManageScraper,AsyncManageScraper,insertInDB};
