const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');

// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.');

  // If there is new scraped data, add it to the user's existing scraped data and update the database
  if (newScrapedData) {
    let userScrapedData = user.scrapedData || [];
    userScrapedData.push(...newScrapedData);
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { scrapedData: userScrapedData } },
      { upsert: true }
    );
    console.log(`Scraped data saved for user ${userId}.`);
  }

  return user;
}

// Helper function to get user's scraped data based on criteria
function getUserScrapedData(user, url, mode, nsfw, page) {
  let userScrapedData = user.scrapedData || [];
  let userScrapedDataWithCurrentPage;

  if(url){
    userScrapedDataWithCurrentPage = userScrapedData.filter(item => 
       item.query == url && 
       item.mode == mode && 
       item.nsfw == nsfw && 
       !item.hide && 
       item.page == page &&
       !item.filePath &&
       !item.isdl
      );
  }else{
    userScrapedDataWithCurrentPage = userScrapedData.filter(item => 
        item.mode == mode && 
        item.nsfw == nsfw && 
        !item.hide && 
        item.page == page &&
        !item.filePath &&
        !item.isdl
    ); 
  }
  return userScrapedDataWithCurrentPage.slice(0,50);
}

async function ManageScraper(url, nsfw, mode, user, page) {
  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = new ObjectId(user._id);
  const currentTime = new Date().getTime();

  const userInfo = await findAndUpdateUser(userId);


  const existingData = userInfo.scrapInfo?.[url];
  const moreThan24h = existingData
      ? currentTime - Number(existingData.time) > 24 * 60 * 60 * 1000
      : true;

  let currentPage = 1
  if(user.scrapInfo){
    try{
      currentPage = user.scrapInfo[url].page
    }catch(err){
      console.log('No page data founded')
    }
  }

if (page <= currentPage) {
    if(!url || !moreThan24h) {
      const userScrapedDataWithCurrentPage = getUserScrapedData(userInfo, url, mode, nsfw, page);
  
      if (userScrapedDataWithCurrentPage.length > 1) {
        console.log('Data has already been scraped today.');
        console.log(userScrapedDataWithCurrentPage[0]);
        return userScrapedDataWithCurrentPage;
      } else {
        console.log('No data scraped for the current page.');
      }
    }
}

  scrapedData = await findDataInMedias()
  if(scrapedData){
    return scrapedData
  }

  scrapedData = await scrapeMode(url, mode, nsfw, page);

  if(scrapedData.length == 0) {
    const userScrapedDataWithCurrentPage = getUserScrapedData(userInfo, url, mode, nsfw).slice(0, 50);
    console.log('userScrapedDataWithCurrentPage: ', userScrapedDataWithCurrentPage[0]);
    return userScrapedDataWithCurrentPage;
  }

  scrapedData = scrapedData.map((data) => ({
    ...data,
    currentPage: url,
    query: url,
    mode: mode,
    nsfw: nsfw,
    page: page
  })); 

  //check for object with the same source and keep only one
  let uniqueData = [];
  let seenSources = new Set();
  
  for (let item of scrapedData) {
      if (!seenSources.has(item.source)) {
          seenSources.add(item.source);
          uniqueData.push(item);
      }
  }
  
  scrapedData = uniqueData; // Now, scrapedData contains unique items based on the source property.
  scrapedData = await filterElement(scrapedData)

  await findAndUpdateUser(userId, scrapedData);
  console.log('Scraped data saved.');

  url = url ? url : process.env.DEFAULT_URL
  await global.db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { ['scrapInfo.' + url]: {time:currentTime, page:page >= currentPage?page:currentPage} } }, // Concatenate 'scrapInfo.' with your variable
    { upsert: true }
  );
  // Retrieve updated user info from the database
  const updatedUserInfo = await findAndUpdateUser(userId);
  // Pass updated user info to the function
  const userScrapedDataWithCurrentPage = getUserScrapedData(updatedUserInfo, url, mode, nsfw, page);

  scrapedData = await findDataInMedias()
  if(scrapedData){
    console.log('Found data in the medias collection: ',scrapedData)
    return scrapedData
  }

  console.log('x userScrapedDataWithCurrentPage: ', userScrapedDataWithCurrentPage[0]);

  return userScrapedDataWithCurrentPage;
}
async function filterElement(scrapedData) {
  // Extract all sources from scrapedData
  const sources = scrapedData.map(item => item.source);

  // Find sources that exist in the "medias" collection with hide: true
  const hiddenSources = await global.db.collection('medias').find({ 
    source: { $in: sources },
  }).toArray();
  const hiddenSourceSet = new Set(hiddenSources.map(item => item.source));

  // Filter out items from scrapedData that have hide: true in the "medias" collection
  return scrapedData.filter(item => !hiddenSourceSet.has(item.source));
}
async function filterHiddenElement(scrapedData) {
  // Extract all sources from scrapedData
  const sources = scrapedData.map(item => item.source);

  // Find sources that exist in the "medias" collection with hide: true
  const hiddenSources = await global.db.collection('medias').find({ 
    source: { $in: sources },
    hide: true
  }).toArray();
  const hiddenSourceSet = new Set(hiddenSources.map(item => item.source));

  // Filter out items from scrapedData that have hide: true in the "medias" collection
  return scrapedData.filter(item => !hiddenSourceSet.has(item.source));
}
async function findDataInMedias(){
  var scrapedData = await global.db.collection('medias').find({
    query:url,page,
    hide:{$exists:false},
    isdl:{$exists:false},
    link:{$exists:true}
  }).toArray()

  if(scrapedData.length >0 ){
    scrapedData = await filterHiddenElement(scrapedData)
    return scrapedData
  }
  return false
}
module.exports = ManageScraper;
