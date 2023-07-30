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
      { $set: { scrapedData: userScrapedData } }
    );
    console.log(`Scraped data saved for user ${userId}.`);
  }

  return user;
}

// Helper function to get user's scraped data based on criteria
function getUserScrapedData(user, url, mode, nsfw) {
  let userScrapedData = user.scrapedData || [];
  let userScrapedDataWithCurrentPage;

  if(url){
    console.log({url,mode,nsfw})
    userScrapedDataWithCurrentPage = userScrapedData.filter(item => 
       item.query == url && item.mode == mode && item.nsfw == nsfw);
  }else{
    console.log(nsfw);
    userScrapedDataWithCurrentPage = userScrapedData.reverse().filter(item => 
      item.mode == mode && item.nsfw == nsfw).slice(0,50);
  }

  return userScrapedDataWithCurrentPage;
}

async function ManageScraper(url, nsfw, mode, user) {
  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = new ObjectId(user._id);
  const currentTime = new Date().getTime();

  const userInfo = await findAndUpdateUser(userId);
  const existingData = userInfo.scrapInfo?.url; 
  const existingDataTime = Number(existingData);
  const moreThan24h = !!(currentTime - existingDataTime > 24*60*60*1000);
  
  if(!url || !moreThan24h) {
    const userScrapedDataWithCurrentPage = getUserScrapedData(userInfo, url, mode, nsfw);

    if (userScrapedDataWithCurrentPage.length > 0) {
      console.log('Data has already been scraped today.');
      console.log(userScrapedDataWithCurrentPage[0]);
      return userScrapedDataWithCurrentPage;
    } else {
      console.log('No data scraped for the current page.');
    }
  }

  var scrapedData = await scrapeMode(url, mode, nsfw, url);

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
  }));

  await findAndUpdateUser(userId, scrapedData);
  console.log('Scraped data saved.');

  await global.db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { 'scrapInfo.url': currentTime } },
    { upsert: true }
  );
  // Retrieve updated user info from the database
  const updatedUserInfo = await findAndUpdateUser(userId);
  // Pass updated user info to the function
  const userScrapedDataWithCurrentPage = getUserScrapedData(updatedUserInfo, url, mode, nsfw);
  
  console.log('x userScrapedDataWithCurrentPage: ', userScrapedDataWithCurrentPage[0]);

  return userScrapedDataWithCurrentPage;
}

module.exports = ManageScraper;
