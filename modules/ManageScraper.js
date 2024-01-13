const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const _ = require('lodash');  // Import lodash at the top of your file
const { 
  findDataInMedias,
  updateSameElements,
  initCategories,
  sanitizeData
} = require('../services/tools')
const scrapeMode1 = require(`./scraper/scrapeMode1`);

// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.',userId);
  return user;
}

async function ManageScraper(url, nsfw, mode, user, page) {
  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id

  let userInfo = await findAndUpdateUser(userId);

  scrapedData = await findDataInMedias(userId, parseInt(page), {
    query:url,
    mode: mode,
    nsfw: nsfw,
    hide_query: { $exists: false },
    hide: { $exists: false },
   //favoriteCountry: { $in: [userInfo.favoriteCountry] }
  });

  console.log(`Found ${scrapedData.length} items in the medias collection`)

  if(scrapedData && scrapedData.length > 0){
    return scrapedData
  }
  
  scrapedData = await scrapeMode(url, mode, nsfw, page, user);
  console.log(`Scrape data and found ${scrapedData.length} elements.`)

  const categories = await initCategories(userId)

  scrapedData = scrapedData.map((data) => ({
    ...data,
    query: url,
    mode: mode,
    nsfw: nsfw,
    page:parseInt(page),
    userId: userId,
    categories:categories,
    favoriteCountry: userInfo.favoriteCountry
  })); 

  updateUserScrapInfo(user,url,page)
  const result =  await insertInDB(scrapedData)
  return result
}
async function AsyncManageScraper(url, nsfw, mode, user, page) {
  console.log('// AsyncManageScraper')
  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id

  let userInfo = await findAndUpdateUser(userId);
  
  scrapedData = await scrapeMode(url, mode, nsfw, page, user, true);
  console.log(`Scrape data and found ${scrapedData.length} elements.`)

  const categories = await initCategories(userId)

  scrapedData = scrapedData.map((data) => ({
    ...data,
    query: url,
    mode: mode,
    nsfw: nsfw,
    userId: userId,
    categories:categories,
    favoriteCountry: userInfo.favoriteCountry
  })); 

  updateUserScrapInfo(user,url,page)
  const result =  await insertInDB(scrapedData)
  return result.slice(0,30)
}

async function updateOrInsert(criteria, updateQuery) {
  const updateResult = await global.db.collection('medias').findOneAndUpdate(criteria, updateQuery, { upsert: true, returnDocument: 'after' });
  //return updateResult.matchedCount > 0 || updateResult.upsertedCount > 0;
  return updateResult.value; // This returns the updated/inserted document
}

async function insertInDB(scrapedData) {
  let insertedDocuments = [];
  if (scrapedData && scrapedData.length > 0) {
    // Array to hold promises
    let promises = [];

    for (const itemWithId of scrapedData) {
      const item = _.omit(itemWithId, ['_id']);
      const query2 = {$addToSet: { favoriteCountry: item.favoriteCountry }}
      delete item.favoriteCountry
      const query1 = {$set:item}
      promises.push(getUpdatedDocument(itemWithId,query1,query2));
    }

    // Wait for all db operations to complete
    insertedDocuments = await Promise.all(promises);

    return insertedDocuments.filter(doc => doc != null);
  }
}

async function getUpdatedDocument(itemWithId,query1,query2) {
  const item = _.omit(itemWithId, ['_id']);
  let doc1 = doc2 = null
  if (item.source) {
    doc1 = updateOrInsert({ 'source': item.source }, query1)
    doc2 = updateOrInsert({ 'source': item.source }, query2)
  }

  if (item.url) {
    doc1 = updateOrInsert({ 'url': item.url }, query1)
    doc2 = updateOrInsert({ 'url': item.url }, query2)
  }

  if (item.link) {
    doc1 = updateOrInsert({ 'link': item.link }, query1)
    doc2 = updateOrInsert({ 'link': item.link }, query2)
  }
  // Return the first non-null document
  return doc1 || doc2;
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
async function updateUserScrapInfo(user,url,page){

  await checkUserScrapeInfo(user)
  userInfo = await findAndUpdateUser(user._id);
  const scrapInfo = userInfo.scrapInfo.find(info => info.url === url);
  const currentTime = new Date().getTime();
  if (scrapInfo) {
    // If the URL already exists, update the time and page
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(user._id), 'scrapInfo.url': url },
      {
        $set: {
          'scrapInfo.$.time': currentTime,
          'scrapInfo.$.page': parseInt(page)
        }
      }
    );
  } else {
    // If the URL doesn't exist, push the new scrapInfo
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      {
        $push: {
          scrapInfo: { url: url, time: currentTime, page: parseInt(page) }
        }
      },
      { upsert: true }
    );
  }
}


module.exports = {ManageScraper,AsyncManageScraper};
