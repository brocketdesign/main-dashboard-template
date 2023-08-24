const axios = require('axios');
const { fetchMediaUrls } = require('../../services/tools');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;
const { ObjectId } = require('mongodb');

async function scrapeMode4(site, mode, nsfw, page) {

        let postResponse = await axios.get(`https://${site}/wp-json/wp/v2/posts?per_page=1&page=${page}`);
        let post = postResponse.data[0];
        let postUrl = post.link;
        
        console.log(`Fetched post with ID: ${post.id}`);
    
        let postMediaResponse = await axios.get(`https://${site}/wp-json/wp/v2/media?parent=${post.id}`);
        let postMedia = postMediaResponse.data;
        console.log(`Fetched ${postMedia.length} media items for post ID: ${post.id}`);
    
        if (postMedia.length <= 2) {
            const additionalMediaUrls = await fetchMediaUrls(postUrl);
            postMedia = postMedia.concat(additionalMediaUrls);
            console.log(postMedia.length)
        }          
        const dirPath = path.join(__dirname, '..', '..', 'public', 'downloads', 'downloaded_images');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }

        let mediaObjects = await Promise.all(postMedia.map(async (media) => {
            try {
                const mediaUrl = media.source_url;
                //console.log(`Downloading media from URL: ${mediaUrl}`);
        
                const mediaBuffer = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                const mediaName = path.basename(new URL(mediaUrl).pathname) || 'defaultMediaName.jpg';
                const localMediaPath = path.join(dirPath, mediaName);
        
                if (fs.existsSync(localMediaPath) && fs.statSync(localMediaPath).isDirectory()) {
                    console.error(`Cannot write to ${localMediaPath} because it's a directory.`);
                    return;
                }
        
                fs.writeFileSync(localMediaPath, mediaBuffer.data);
                //console.log(`Saved media to: ${localMediaPath}`);
        
                return {
                    filePath: localMediaPath,
                    source: mediaUrl,
                };
            } catch (error) {
                console.log(error);
                return;
            }
        }));
        mediaObjects = mediaObjects.filter(Boolean);

        mediaObjects = mediaObjects.map((data) => ({
            ...data,
            currentPage: site,
            query: site,
            mode: mode,
            nsfw: nsfw,
            page: page
          })); 

        const combinedResults = mediaObjects.map((media, index) => ({
            link: media.filePath.replace(/.*public/, ''),
            source: media.source,
        }));
        console.log(combinedResults.slice(0,2))
        return combinedResults;
}

module.exports = scrapeMode4;
