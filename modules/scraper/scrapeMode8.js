const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');



function generateTopPageUrl(){
  return 'https://jp.xgroovy.com/gifs/'
}

function generateUrl(query,page){
  return new URL(`https://jp.xgroovy.com/gifs/search/${query}/${page}/`).href
}

function getExtractor(){
  return `xgroovy`
}

const LAST_PAGE_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds



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
    const lastTopPageData = await global.db.collection('medias').find({query:'top',extractor:getExtractor()}).toArray()
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
      extractor:getExtractor(),
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

async function searchImage(galleryUrl){
  return fetchDataSrcArray(galleryUrl)
}
async function fetchDataSrcArray(url) {
  console.log({url})
  try {
    // Fetch the HTML of the page
    const { data } = await axios.get(url);
    // Load the HTML into cheerio
    const $ = cheerio.load(data);
    // An empty cauldron to fill with our data-src spells
    const dataSrcArray = [];

    // Conjure the data-src attributes from each li.thumbwook img element
    $('.list-gifs .item').each((index, element) => {
      // The magic essence of the data-src attribute
      const highestQualityURL = $(element).find('.gif-wrap').attr('data-full');
      if (highestQualityURL) {
        const imageUrl = $(element).find('.gif-wrap').attr('data-poster');
        const alt = $(element).find('.gif-thumb-image').attr('alt');
        const link = $(element).find('a.title-link').attr('href');
        // Add the essence to our cauldron
        dataSrcArray.push({
          link,
          imageUrl,
          highestQualityURL,
          alt
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

async function scrapeMode(query, mode, nsfw, page, user, isAsync) {
  try {
    let data = []
    if(!query){
      return []
    }

    const PornPics = await searchImage(generateUrl(trimAndReplace(query),page)).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    }) 

    return PornPics;
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}

function trimAndReplace(string) {
  // Trim the string to remove leading and trailing spaces
  var trimmedString = string.trim();
  
  // Replace all spaces with dashes
  var replacedString = trimmedString.replace(/\s+/g, '-');
  
  return replacedString;
}


module.exports = {scrapeMode,scrapeTopPage};
