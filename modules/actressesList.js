const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// This is an async function that performs the web scraping.
const actressesList = async (page_number = 1) => {
  const actressCollection = global.db.collection('actresses');
  const actressData = await actressCollection.find({page_number}).toArray()
  if(actressData.length>0){
    return actressData
  }
  
  console.log("Launching Puppeteer...");
  
  // Initialize a new Puppeteer browser instance
  const browser = await puppeteer.launch({
    headless:false
  });
  
  // Create a new page in the browser
  const page = await browser.newPage();
  
  // Navigate to the blog page you want to scrape
  console.log("Navigating to blog page...");
  await page.goto(`https://missav.com/dm38/ja/actresses?page=${page_number}`);
  
  let scrapedData = await page.evaluate((page_number) => {
    const items = Array.from(document.querySelectorAll('ul.grid li'));
    const data = items.map((item, index) => {
      try {
        const picture = item.querySelector('img').getAttribute('src');
        const name = item.querySelector('h4').textContent;
        const record_number = item.querySelector('.space-y-2 p').textContent.replace(' 本映画','');
        
        const paragraphs = Array.from(item.querySelectorAll('.space-y-2 p'));
        const debutElement = paragraphs[1];  // equivalent to .eq(1) since indexing is 0-based
        const debut = debutElement ? debutElement.textContent.replace('デビュー: ','') : 'Element not found';

        const link = item.querySelector('a').getAttribute('href');
  
        return { picture, name, record_number, debut, link, page_number };
      } catch (error) {
        console.log(`Error at index ${index}:`, error);
        return null;
      }
    });
    return data;
  },page_number);
  
  scrapedData = await downloadPicture(scrapedData);
  
  console.log("Closing Puppeteer...");
  // Close the browser
  await browser.close();

    // Insert or update the scraped data in MongoDB
    console.log("Saving to MongoDB...");

    for (const data of scrapedData) {
      const { name, record_number } = data;

      // Update or insert data to avoid duplicates
      // Assuming 'name' or 'record_number' is unique for each actress
      await actressCollection.updateOne(
        { name },
        { $set: data },
        { upsert: true }
      );
    }

    // Send the response
    console.log("Scraping and database update complete.");
    const reusult = await actressCollection.find({page_number}).toArray()
    if(reusult.length>0){
      return reusult
    }
    
  return scrapedData;
};

async function downloadPicture (scrapedData)  {

  // Download pictures
  const updatedScrapedData = await Promise.all(scrapedData.map(async (data) => {

    try {
      
      const dirPath = path.join(__dirname,  '..', 'public','downloads', 'actresses', data.name);

      // Create the directory if it does not exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      }

      const pictureUrl = data.picture;

      // Download the image
      console.log(`Downloading picture from URL: ${pictureUrl}`);
      const pictureBuffer = await axios.get(pictureUrl, { responseType: 'arraybuffer' });

      // Generate a name for the picture and its save path
      const pictureName = path.basename(new URL(pictureUrl).pathname) || 'defaultPictureName.jpg';
      const localPicturePath = path.join(dirPath, pictureName);

      // Check if path already exists and is a directory
      if (fs.existsSync(localPicturePath) && fs.statSync(localPicturePath).isDirectory()) {
        console.error(`Cannot write to ${localPicturePath} because it's a directory.`);
        return null;
      }

      // Save the picture
      fs.writeFileSync(localPicturePath, pictureBuffer.data);
      console.log(`Saved picture to: ${localPicturePath}`);
      const trimmedPath = localPicturePath.replace(/.*\/public/, '');
      // Update the data object to include the local file path
      return { ...data, filePath: trimmedPath };

    } catch (error) {
      console.log('Error with picture download', error);
      return null;
    }
  }));

  // Remove any null values (failed downloads)
  return updatedScrapedData.filter(Boolean);
};
// Export the function for use in other modules
module.exports = { actressesList };
