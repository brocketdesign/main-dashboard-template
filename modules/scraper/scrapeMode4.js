const {fetchMediaUrls} = require('../../services/tools');

async function scrapeMode4(){
    let mediaUrls = await fetchMediaUrls('https://avwebm.com/h_491dori00063/');
    
    // Insert the media URLs into the 'medias' collection
    const insertResult = await global.db.collection('medias').insertMany(mediaUrls);
    
    // Combine the original mediaUrls with the inserted IDs to get an array of { link, video_id }
    const combinedResults = mediaUrls.map((media, index) => ({
        link: media.link,
        source:media.source,
        video_id: insertResult.insertedIds[index].toString()
    }));

    return combinedResults;
    
}

module.exports = scrapeMode4;