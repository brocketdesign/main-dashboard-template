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
      { $or: [ { hide: { $exists: false } }, { hide: "false" } ] }
    ],
    favoriteCountry: { $in: [userInfo.favoriteCountry] }
  };

  scrapedData = await findDataInMedias(userId, parseInt(page), query);

  console.log(`Found ${scrapedData.length} items in the medias collection for page ${parseInt(page)}`)

  if(scrapedData && scrapedData.length > 0 ){ //&& searchterm != 'undefined'
    return scrapedData
  }
  
  scrapedData = await scrapeMode(searchterm, mode, nsfw, page, user);
  if(!scrapedData){
    return []
  }
  console.log(`Scrape data and found ${scrapedData.length} elements.`)

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

  updateUserScrapInfo(user,searchterm,page)
  let result = await insertInDB(myCollection, scrapedData)
  if(result){result=result.reverse()}
  return result
}
async function AsyncManageScraper(searchterm, nsfw, mode, user, page) {
  console.log('// AsyncManageScraper')
  const myCollection = `medias_${mode}`
  const {scrapeMode} = require(`./scraper/scrapeMode${mode}`);
  const userId = user._id

  let userInfo = await findAndUpdateUser(userId);
  
  scrapedData = await scrapeMode(searchterm, mode, nsfw, page, user, true);
  if(!scrapedData){
    return []
  }
  console.log(`Scrape data and found ${scrapedData.length} elements.`)

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

  updateUserScrapInfo(user,searchterm,page)
  const result =  await insertInDB(myCollection, scrapedData)

  return result.slice(0,30)
}

async function updateOrInsert(myCollection,criteria, updateQuery) {
  const updateResult = await global.db.collection(myCollection).findOneAndUpdate(criteria, updateQuery, { upsert: true, returnDocument: 'after' });
  //return updateResult.matchedCount > 0 || updateResult.upsertedCount > 0;
  return updateResult.value; // This returns the updated/inserted document
}

async function insertInDB(myCollection,scrapedData) {
  let insertedDocuments = [];
  if (scrapedData && scrapedData.length > 0) {
    // Array to hold promises
    let promises = [];

    for (const itemWithId of scrapedData) {
      const item = _.omit(itemWithId, ['_id']);
      const query2 = {$addToSet: { favoriteCountry: item.favoriteCountry }}
      delete item.favoriteCountry
      const query1 = {$set:item}
      promises.push(getUpdatedDocument(myCollection,itemWithId,query1,query2));
    }

    // Wait for all db operations to complete
    insertedDocuments = await Promise.all(promises);
    
    return insertedDocuments.filter(doc => doc != null);
  }
}

async function getUpdatedDocument(myCollection,itemWithId,query1,query2) {
  const item = _.omit(itemWithId, ['_id']);
  let doc1 = doc2 = null
  if (item.source) {
    doc1 = updateOrInsert(myCollection, { 'source': item.source }, query1)
    doc2 = updateOrInsert(myCollection, { 'source': item.source }, query2)
  }

  if (item.url) {
    doc1 = updateOrInsert(myCollection, { 'url': item.url }, query1)
    doc2 = updateOrInsert(myCollection, { 'url': item.url }, query2)
  }

  if (item.link) {
    doc1 = updateOrInsert(myCollection, { 'link': item.link }, query1)
    doc2 = updateOrInsert(myCollection, { 'link': item.link }, query2)
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
async function updateUserScrapInfo(user,searchterm,page){
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
