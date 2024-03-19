// https://monsnode.com/

const axios = require('axios');
const cheerio = require('cheerio');

// The heart of our adventure: The Scraper Module
const scrapeData = async (query, pageNumber) => {
  try {
    
    const baseUrl = 'https://monsnode.com/'
    const url = isQueryInCorrectFormat(query) ? `${baseUrl}${query}` : `${baseUrl}search.php?search=${query}&page=${pageNumber}`;

    // Send a stealthy request to the website
    const { data } = await axios.get(url);

    // Summon Cheerio to interpret the ancient HTML scripts
    const $ = cheerio.load(data);

    // Prepare to store our treasures
    const results = [];

    if( isQueryInCorrectFormat(query) ){
        const specialElementId = query.replace('v', ''); 
        const specialElement = $(`#${specialElementId}`).closest('a'); 
    
        const moreLink = `/dashboard/app/5?&searchterm=${query}`; 
        const link = baseUrl+specialElement.attr('href');
        const imageUrl = specialElement.find('img').attr('src');
          
        console.log({ query, moreLink, link, imageUrl })
        // Collect each treasure into our results chest
        results.push({ id:specialElementId, moreLink, link, imageUrl });
    }

    // Traverse through the hidden chambers within #scroll to find our divs
    $('#scroll div').each((i, element) => {
      const id = $(element).attr('id'); // The ID, our first treasure
      if (!id) return
      const moreLink = `/dashboard/app/5?&searchterm=v${id}`; // The hyperlink, our second treasure
      const link = $(element).find('a').attr('href'); // The hyperlink, our second treasure
      const imageUrl = $(element).find('img').attr('src'); // The image source, the final piece of the puzzle
        
      // Collect each treasure into our results chest
      results.push({ id, moreLink, link, imageUrl });
    });

    // Return the collected treasures back to the calling function
    return results;
  } catch (error) {
    // In case of traps (errors), let's handle them gracefully
    console.error('Raid failed:', error.message);
    return []; // Return an empty chest, sadly
  }
};

async function scrapeMode(query, mode, nsfw, pageNumber, user){
    const data = await scrapeData(query, pageNumber)
    return data
}

function isQueryInCorrectFormat(query) {
    // The Regular Expression spell: starts with "v", followed by 16 to 18 digits
    const regex = /^v\d{17,19}$/;  
    // Cast the spell and check if the query matches the sacred pattern
    return regex.test(query);
  }
module.exports = {scrapeMode};
