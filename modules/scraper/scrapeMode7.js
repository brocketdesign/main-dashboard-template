const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');


async function downloadResource(response, dirPath, mediaType) {
    try {
        const url = response.url();
        let parsedUrl = urlLib.parse(url);
        let baseName = path.basename(parsedUrl.pathname);

        // Let's play 'Guess the Extension'!
        let extension = baseName.endsWith('.jpg') ? 'jpg' : 'webp';

        // Time to build the file path, now with more precision!
        const filePath = path.join(dirPath, `${path.basename(baseName, `.${extension}`)}.${extension}`);
        const content = await response.buffer();

        // Write the file like it's the next bestseller
        await fs.promises.writeFile(filePath, content);
        console.log(`Downloaded and saved: ${filePath} (with a little twist!)`);
        return filePath;
    } catch (error) {
        console.error(`Oops! Sherlock Holmes couldn't download or save the resource from URL: ${response.url()} - Error: ${error}`);
        throw error;
    }
}

function generateTopPageUrl(){
  return 'https://www.pornpics.com/popular/'
}

function generateUrl(query,page){
  return new URL(`https://www.pornpics.com/search/srch.php?q=${query}&lang=en&limit=20&offset=${page*20}`).href
}

function getExtractor(){
  return `pornpics`
}

const LAST_PAGE_RESET_INTERVAL = 0 //24 * 60 * 60 * 1000; // 24 hours in milliseconds



async function getLastPageIndex(query) {
  try {
    const lastPageInfo = await global.db.collection('scrapInfo').findOne({ extractor: getExtractor() +'_'+ query});
    return lastPageInfo || { page: 1, time: 0 };  // Default to page 1 and time 0 if nothing is found
  } catch (error) {
    console.error('Error fetching last page index:', error);
    return { page: 1, time: 0 };  // In case of error, also default to page 1 and time 0
  }
}
async function saveLastPageIndex(page, time, query) {
  try {
    await global.db.collection('scrapInfo').updateOne(
      { extractor: getExtractor() +'_'+ query },
      { $set: { page, time } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error saving last page index:', error);
  }
}
async function resetLastPageIndex(query) {
  try {
    await global.db.collection('scrapInfo').updateOne(
      { extractor: getExtractor() +'_'+ query },
      { $set: { page: 1, time: Date.now() } }
    );
  } catch (error) {
    console.error('Error resetting last page index:', error);
  }
}


async function scrapeTopPage(){
  try {
    const lastTopPageData = await global.db.collection('medias').find({query:'top',extractor:'pornpics'}).toArray()
    const startTime = Date.now();
    const lastTime = lastTopPageData[0] && lastTopPageData[0].time ? lastTopPageData[0].time : 0

    if ((startTime - lastTime) < LAST_PAGE_RESET_INTERVAL) {
      return lastTopPageData
    }
    let pornpics =  await searchImage(generateTopPageUrl()).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    });
    pornpics = pornpics.map((data) => ({
      ...data,
      query:'top',
      extractor:'pornpics',
      time :new Date()
    })); 
    const {insertInDB} = require('../ManageScraper')
    await insertInDB(pornpics)
    return pornpics
  } catch (error) {
    console.log(error)
    console.log(`Error scraping top page for S7`)
  }
}

async function searchGallery(query,isReset,topPage){
  if(query == undefined){
    console.log(`Query is not defined`)
    return
  }
  const lastPageIndex = await getLastPageIndex(query);
  const startTime = Date.now();

  if (isReset || (startTime - lastPageIndex.time) > LAST_PAGE_RESET_INTERVAL) {
    await resetLastPageIndex(query);
    page = 1;
  } else {
    page = lastPageIndex.page;
  }
  const pageUrl = topPage == true ? generateTopPageUrl() : generateUrl(query, page)

  let galleries = await fetchArrayFromUrl(pageUrl)
  galleries = galleries.map((gallery)=>({
    ...gallery,
    link:gallery.g_url,
    imageUrl:gallery.t_url,
    isGallery:true
  }));

  return galleries
}

async function searchImage(galleryUrl){
  return fetchDataSrcArray(galleryUrl)
}


async function fetchArrayFromUrl(url) {
  try {
    const response = await axios.get(url);
    // Assuming the data we're interested in is directly in the response body
    const array = response.data;
    if (Array.isArray(array)) {
      console.log('Data fetched successfully');
      return array;
    } else {
      console.log('Oops! We were expecting an array, but got something else.');
      return null;
    }
  } catch (error) {
    console.error('Ahoy! There was an issue fetching the data:', error.message);
    return null;
  }
}


async function fetchDataSrcArray(url) {
  try {
    // Fetch the HTML of the page
    const { data } = await axios.get(url);
    // Load the HTML into cheerio
    const $ = cheerio.load(data);
    // An empty cauldron to fill with our data-src spells
    const dataSrcArray = [];

    // Conjure the data-src attributes from each li.thumbwook img element
    $('li.thumbwook').each((index, element) => {
      // The magic essence of the data-src attribute
      const dataSrc = $(element).find('img').attr('data-src');
      if (dataSrc) {
        const alt = $(element).find('img').attr('alt');
        const link = $(element).find('a').attr('href');
        // Add the essence to our cauldron
        dataSrcArray.push({
          link,
          imageUrl:dataSrc,
          alt,
          isGallery:false
        });
      }
    });

    console.log('Successfully conjured data');
    return dataSrcArray;
  } catch (error) {
    console.error('Alas! The spell failed:', error.message);
    return [];
  }
}
function isGalleryUrl(query){
  try {
    new URL(query)
  } catch (error) {
    return false
  }
  return true
}

async function scrapeMode(query, mode, nsfw, page, user, isAsync) {
  try {
    let data = []
    if(!query){
      return []
    }

    const PornPics = !isGalleryUrl(query) ? 
    await searchGallery(query,false,false).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    }) 
    : await searchImage(query).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    }) 

    return PornPics;
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}


module.exports = {scrapeMode,scrapeTopPage};
