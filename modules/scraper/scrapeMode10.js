const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');



function generateTopPageUrl(page){
  return `https://sexxxgif.com/page/${page}/`
}

function generateUrl(query,page){
  return `https://sexxxgif.com/page/${page}/?s=${query}`
}

function getExtractor(){
  return `sexxxgif`
}

const LAST_PAGE_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

    const dataSrcPromises = $('.thumb').map(async (index, element) => {
      const link = $(element).find('a.thumb-title').attr('href');
      const alt = $(element).find('a.thumb-title').text();

      if (link) {
        const { data: linkData } = await axios.get(link);
        const $linkPage = cheerio.load(linkData);
        const imageUrl = $linkPage('.single-image a').attr('href');

        return {
          link,
          imageUrl,
          highestQualityURL: imageUrl,
          alt
        };
      }
    }).get();

    const dataSrcArray = await Promise.all(dataSrcPromises);

    console.log('Successfully conjured data');
    return dataSrcArray.filter(item => item); // Remove undefined results
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

    const imagedata = query && query != 'undefined' ? await fetchDataSrcArray(generateUrl(query,page)).catch(error => {
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
