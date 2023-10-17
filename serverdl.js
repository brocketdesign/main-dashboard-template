require('dotenv').config(); // To read .env file
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const ip = require('ip');
const app = express();
const bodyParser = require('body-parser');


const url = process.env.MONGODB_URL; // Use MONGODB_URL from .env file
const dbName = process.env.MONGODB_DATABASE; // Use MONGODB_DATABASE from .env file

// Initialize MongoDB connection using promises
MongoClient.connect(url, { useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB');
    global.db = client.db(dbName);

    // Initialize Express Router
    const router = express.Router();
    const fs = require('fs');
    const { ObjectId } = require('mongodb');
    const starterTools = require('./services/starterTools')
    const getHighestQualityVideoURL = require("./modules/getHighestQualityVideoURL")
    const { 
        saveData, 
        getFileExtension,
        downloadVideo, 
        updateSameElements, 
        generateFilePathFromUrl,
        downloadFileFromURL,
        downloadYoutubeVideo } = require('./services/tools')

    // Your /api/dl route (content left empty for you to fill in)
    router.post('/dl', async (req, res) => {
        const video_id = req.body.video_id;
        const title = req.body.title || 'media';
        console.log('File download requested for video_id:', video_id);
      
        try {
          const url = await getHighestQualityVideoURL(video_id,req.user,false);
          
          if (!url) {
            console.log('Video URL not found for video_id:', video_id);
            res.status(404).json({ error: 'Video URL not found.' });
            return;
          }
      
          res.status(200).json({ url, message: 'Start Download' }); 
      
          if(!url.includes('http')){
            saveData(req.user, video_id, {isdl:true})
            res.status(200).json({ message: 'ダウンロードされました' });
            return;
          }
      
          //console.log('Downloading from URL:', url);
      
          let download_directory = 'public/downloads'
          if (url.includes('youtube.com')) {
            download_directory = download_directory+'/youtube';
          }
      
          const {fileName,filePath} = generateFilePathFromUrl(download_directory,url,title)
      
          // Create download folder if it doesn't exist
          await fs.promises.mkdir(download_directory, { recursive: true });
      
          const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(video_id)})
          updateSameElements(foundElement,{isdl:false,isdl_start:new Date()})
          let done = false
          if (url.includes('youtube.com')) {
            done = true
            await downloadYoutubeVideo(download_directory,filePath,foundElement.video_id)
          } 
          if(url.includes('redgifs.com')){
            done = true
            await downloadVideo(url, filePath, video_id);
          }
          if(!done){
            await downloadFileFromURL(filePath,url)
          }
      
          
          // After the file is downloaded, do the same things for both YouTube videos and other types of files
      
          console.log('File downloaded:', fileName);
      
          updateSameElements(foundElement,{filePath:filePath.replace('public',''), isdl:true,isdl_end:new Date()})
          // Send a success status response after the file is downloaded
          //res.status(200).json({ message: 'アイテムが成功的に保存されました。' });
      
        } catch (err) {
          console.log(err)
          console.log('Error occurred while downloading file:', err.message);
          //res.status(500).json({ error: err.message });
        }
      });

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));
    // parse application/json
    app.use(bodyParser.json());
    // Allow CORS 
    app.use(cors());
    // Use the router with /api prefix
    app.use('/api', router);

    // Start the server
    const port = process.env.PORT_DL || 4000;
    app.listen(port, () => {
    console.log(`Express running → PORT http://${ip.address()}:${port}`);
    });

  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
  });

