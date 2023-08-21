const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const { findDataInMedias, filterHiddenElement, sanitizeData } = require('../services/tools')
// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.');

  if(!newScrapedData){
    console.log('No data provided')
    return user
  }

  await global.db.collection('medias').insertMany(newScrapedData)
  console.log('Saved data in medias collection')
 
  let userScrapedData = user.scrapedData || [];
  userScrapedData.push(...newScrapedData);
  await global.db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { scrapedData: userScrapedData } },
    { upsert: true }
  );
  console.log(`Scraped data saved for user ${userId}.`);


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
      let userScrapedDataWithCurrentPage = getUserScrapedData(userInfo, url, mode, nsfw, page);
  
      if (userScrapedDataWithCurrentPage.length > 1) {
        console.log('Data has already been scraped today.');
        userScrapedDataWithCurrentPage = await filterHiddenElement(userScrapedDataWithCurrentPage)
        return userScrapedDataWithCurrentPage;
      } else {
        console.log('No data scraped for the current page.');
      }
    }
}

  scrapedData = await findDataInMedias({
    query:url,
    page:page,
    hide:{$exists:false},
    isdl:{$exists:false},
    link:{$exists:true}
  })

  if(scrapedData){
    scrapedData = await filterHiddenElement(scrapedData)
    return scrapedData
  }

  scrapedData = await scrapeMode(url, mode, nsfw, page);
  console.log(`Scrape data and found ${scrapedData.length} elements.`)

  if(scrapedData.length == 0) {
    let userScrapedDataWithCurrentPage = getUserScrapedData(userInfo, url, mode, nsfw).slice(0, 50);
    userScrapedDataWithCurrentPage =await  filterHiddenElement(userScrapedDataWithCurrentPage)
    return userScrapedDataWithCurrentPage;
  }

  scrapedData = scrapedData.map((data) => ({
    ...data,
    currentPage: url,
    query: url,
    mode: mode,
    nsfw: nsfw,
    page: page,
    userId: userId,
  })); 


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
  let userScrapedDataWithCurrentPage = getUserScrapedData(updatedUserInfo, url, mode, nsfw, page);

  scrapedData = await findDataInMedias({
    query:url,
    page:page,
    hide:{$exists:false},
    isdl:{$exists:false},
    link:{$exists:true}
  })
  if(scrapedData){
    scrapedData = await filterHiddenElement(scrapedData)
    return scrapedData
  }
  userScrapedDataWithCurrentPage = await filterHiddenElement(userScrapedDataWithCurrentPage)

  return userScrapedDataWithCurrentPage;
}

module.exports = ManageScraper;
