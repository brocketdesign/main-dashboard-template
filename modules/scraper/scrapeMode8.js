const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');



function generateTopPageUrl(){
  return 'https://xgroovy.com/gifs/'
}

function generateUrl(query,page){
  return new URL(`https://xgroovy.com/gifs/search/${query}/${page}/`).href
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

async function scrapeTopPage(mode){
  try {
    const myCollection = `medias_${mode}`
    const lastTopPageData = await global.db.collection(myCollection).find({query:'top',extractor:getExtractor()}).toArray()
    const startTime = Date.now();
    const lastTime = lastTopPageData[0] && lastTopPageData[0].time ? lastTopPageData[0].time : 0

    if ((startTime - lastTime) < LAST_PAGE_RESET_INTERVAL) {
      return lastTopPageData
    }
    let imagedata = await fetchDataSrcArray(generateTopPageUrl());

    if (!imagedata || imagedata.length === 0) {
      console.log('No image data retrieved');
      return lastTopPageData; // or handle accordingly
    }

    imagedata = imagedata.map((data) => ({
      ...data,
      query: 'top',
      mode,
      extractor: getExtractor(),
      time: new Date()
    }));
    
    return imagedata
  } catch (error) {
    console.log(error)
    console.log(`Error scraping top page for S8`)
  }
}

async function fetchDataSrcArray(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const dataSrcArray = [];

    $('.list-gifs .item').each((index, element) => {
      const highestQualityURL = $(element).find('.gif-wrap').attr('data-full');
      if (highestQualityURL) {
        const imageUrl = $(element).find('.gif-wrap').attr('data-poster');
        const alt = $(element).find('.gif-thumb-image').attr('alt');
        const link = $(element).find('a.title-link').attr('href');
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
    return []; // Ensure an array is returned even in the event of an error
  }
}


async function scrapeMode(query, mode, nsfw, page, user, isAsync) {
  try {
    let data = []
    if(!query){
      return []
    }

    const imagedata = query && query != 'undefined' ? await fetchDataSrcArray(generateUrl(trimAndReplace(query),page)).catch(error => {
      console.error("Failed to scrape data from Sex Gif", error);
      return []; // Return empty array on failure
    }) : await scrapeTopPage(mode)

    return imagedata;
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
