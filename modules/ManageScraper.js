const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');

async function ManageScraper(url,mode,user) {

  const scrapeMode = require(`./scraper/scrapeMode${mode}`)
  const collection = global.db.collection('scrapedData'); // Replace 'scrapedData' with your desired collection name
  const query = url
  
  // Check if the data has already been scraped today
  const today = new Date().setHours(0, 0, 0, 0);

  const userId = new ObjectId(user._id);
  // Assuming you have the MongoDB client instance available as global.db
  const userInfo = await global.db.collection('users').findOne({ _id: userId });

  const existingData = userInfo.scrapInfo?.url; // Using optional chaining to handle cases where scrapInfo is not present or does not have a url field

  if(!url || existingData){
    console.log('Data has been scraped in the last 24 hours')
    try {
  
      if (userInfo) {
        // Access the scrapedData array from the user document
        let userScrapedData = userInfo.scrapedData || []; // Initialize as an empty array if it doesn't exist yet

        // Filter the userScrapedData to get elements that have the currentPage field
        let userScrapedDataWithCurrentPage
        if(url){
           userScrapedDataWithCurrentPage = userScrapedData.filter(item => (item.currentPage === url || item.query === url) && item.mode == mode);
        }else{
           userScrapedDataWithCurrentPage = userScrapedData.reverse().filter(item => item.mode == mode).slice(0,50);
        }

        if (userScrapedDataWithCurrentPage.length > 0) {
          // If there are elements with the currentPage field, return them
          console.log('Data has already been scraped today.');
          console.log(userScrapedDataWithCurrentPage[0])
          return userScrapedDataWithCurrentPage;
        } else {
          console.log('No data scraped for the current page.');
        }
      } else {
        console.log('User not found in the database.');
      }
    } catch (error) {
      console.error('Error while fetching user data:', error);
    }
  }


    //console.log('scrapedData: ',scrapedData)

    try {
        if(!url.includes('http')){
      url = `${process.env.DEFAULT_URL}/s/${url}/`
    }
    
    var scrapedData = await scrapeMode(query,url)
    if(scrapedData.length == 0){

      const userInfoEnd = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
      const userScrapedData = userInfoEnd.scrapedData 
      const userScrapedDataWithCurrentPage = userScrapedData.filter(item => item.mode == mode).slice(0, 50);
      console.log('userScrapedDataWithCurrentPage: ',userScrapedDataWithCurrentPage)
      console.log(mode)
      return userScrapedDataWithCurrentPage; // Return the scraped data array

    }
    // Map each element to add the fields
    scrapedData = scrapedData.map((data) => ({
      ...data,
      currentPage: url,
      query:query,
      mode: mode,
    }));
          
      if (userInfo) {
        // Access the scrapedData object from the user document
        let userScrapedData = userInfo.scrapedData || []; // Initialize as an empty array if it doesn't exist yet
    
        // Loop through the scrapedData and add it to the userScrapedData
        for (const newData of scrapedData) {
          userScrapedData.push(newData);
        }
    
        // Update the user document with the new scrapedData
        await global.db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { scrapedData: userScrapedData } }
        );
    
        console.log(`Scraped data saved for user ${user._id}.`);
      } else {
        console.log('User not found in the database.');
      }
    } catch (error) {
      console.error('Error while fetching user data:', error);
    }

    console.log(`Scraped data saved.`);

    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) }, // The filter to find the specific user by their _id
      { $set: { 'scrapInfo.url': today } }, // The correct update object to set the scrapInfo.url field
      { upsert: true } // The option to perform an upsert if the document doesn't exist
    );

    const userInfoEnd = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
    const userScrapedData = userInfoEnd.scrapedData 
    const userScrapedDataWithCurrentPage = userScrapedData.filter(item => item.currentPage === url && item.mode == mode);

    console.log('userScrapedDataWithCurrentPage: ',userScrapedDataWithCurrentPage[0])

    return userScrapedDataWithCurrentPage; // Return the scraped data array
}

module.exports = ManageScraper;
