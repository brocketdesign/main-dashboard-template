const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const _ = require('lodash');  // Import lodash at the top of your file
const { 
  findDataInMedias,
  updateSameElements,
  initCategories 
} = require('../services/tools')
const scrapeMode1 = require(`./scraper/scrapeMode1`);
// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.');
  return user;
}
async function ManageScraper(url, nsfw, mode, user, page) {
  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = new ObjectId(user._id);

  let userInfo = await findAndUpdateUser(userId);

  scrapedData = await findDataInMedias(userId, parseInt(page), {
    query:url,
    mode: mode,
    nsfw: nsfw,
    hide_query: { $exists: false },
    hide: { $exists: false },
    favoriteCountry:userInfo.favoriteCountry
  });

  console.log(`Found ${scrapedData.length} items in the medias collection`)
  
  if(scrapedData && scrapedData.length >= 60){
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
    favoriteCountry:userInfo.favoriteCountry
  })); 

  insertInDB(scrapedData)
  updateUserScrapInfo(user,url,page)
  

  scrapedData = await findDataInMedias(userId, parseInt(page), {
    query:url,
    mode: mode,
    nsfw: nsfw,
    hide_query: { $exists: false },
    hide: { $exists: false },
    favoriteCountry:userInfo.favoriteCountry
  });

  console.log(`Found ${scrapedData.length} items in the medias collection`)
  return scrapedData;
}

async function updateOrInsert(criteria, item) {
  const updateResult = await global.db.collection('medias').updateOne(criteria, { $set: item }, { upsert: true });
  return updateResult.matchedCount > 0 || updateResult.upsertedCount > 0;
}

async function insertInDB(scrapedData) {
  if (scrapedData && scrapedData.length > 0) {
    // Array to hold promises
    let promises = [];

    for (const itemWithId of scrapedData) {
      const item = _.omit(itemWithId, ['_id']);
      
      if (item.source) {
        promises.push(updateOrInsert({ 'source': item.source }, item));
      }

      if (item.url) {
        promises.push(updateOrInsert({ 'url': item.url }, item));
      }

      if (item.link) {
        promises.push(updateOrInsert({ 'link': item.link }, item));
      }
    }

    // Wait for all db operations to complete
    const updateResults = await Promise.all(promises);

    // Filter results to count the number of inserted elements
    const insertedCount = updateResults.filter(isUpdated => isUpdated).length;

    // Logging the number of inserted elements
    console.log(`Number of inserted elements: ${insertedCount}`);
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


module.exports = ManageScraper;
