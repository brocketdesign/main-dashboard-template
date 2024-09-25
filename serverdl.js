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
    const path = require('path');
    const starterTools = require('./services/starterTools')
    const getHighestQualityVideoURL = require("./modules/getHighestQualityVideoURL")
    const downloadVideoSegments = require('./modules/downloadVideoSegments')
    const { 
        saveData, 
        getFileExtension,
        downloadVideo, 
        downloadVideoRedGIF,
        updateSameElements, 
        generateFilePathFromUrl,
        downloadFileFromURL,
        downloadYoutubeVideo } = require('./services/tools')
  const ManageScraper = require('./modules/ManageScraper');
  const {
    getVideoFromSB,
    scrapeWebsiteTopPage,
    getVideoFromPD,
    getVideoFromHQP
  } = require('./modules/getVideoFromSB')

    router.post('/dl', async (req, res) => {
        let {video_id,title,mode,myCollection} = req.body;
        title = title || 'media';
        myCollection = myCollection || `medias_${mode}`      
        try {
          const url = await getHighestQualityVideoURL(myCollection,video_id,req.user,false);
          
          if (!url) {
            console.log('Video URL not found for video_id:', video_id);
            res.status(404).json({ error: 'Video URL not found.' });
            return;
          }
          console.log(`Download : ${url}`)
          //res.status(200).json({ url, message: 'Start Download' }); 
      
          if(!url.includes('http')){
            saveData(req.user, video_id, myCollection, {isdl:true})
            //res.status(200).json({ message: 'ダウンロードされました' });
            return;
          }
      
          //console.log('Downloading from URL:', url);
      
          let download_directory = 'public/downloads'
          if (url.includes('youtube.com')) {
            download_directory = download_directory+'/youtube';
          }
      
          const {fileName,filePath} = generateFilePathFromUrl(download_directory,url,title)
          console.log('Start Download:', fileName);

          // Create download folder if it doesn't exist
          await fs.promises.mkdir(download_directory, { recursive: true });
      
          const foundElement = await global.db.collection(myCollection).findOne({_id:new ObjectId(video_id)})
          updateSameElements(foundElement,myCollection,{isdl:false,isdl_start:new Date()})
          let done = false
          if (url.includes('youtube.com')) {
            done = true
            await downloadYoutubeVideo(download_directory,filePath,foundElement.video_id,myCollection)
          } 
          if(url.includes('redgifs.com')){
            done = true
            await downloadVideoRedGIF(url, filePath, video_id, myCollection);
          }
          if(!done){
            await downloadFileFromURL(filePath,url)
          }
      
          
          // After the file is downloaded, do the same things for both YouTube videos and other types of files
      
          console.log('File downloaded:', fileName);
      
          updateSameElements(foundElement,myCollection,{filePath:filePath.replace('public',''), isdl:true,isdl_end:new Date()})
          // Send a success status response after the file is downloaded
          res.status(200).send({ fileName, message: 'アイテムが成功的に保存されました。' });
      
        } catch (err) {
          console.log('Error occurred while downloading file:', err.message);
          //res.status(500).json({ error: err.message });
        }
      });
      router.post('/connectUser', async (req, res) => {
        // Extract the user from the request body
        const { user } = req.body;
      
        // If user data is not present in the request body, send a bad request response
        if (!user) {
          console.log('No user data provided');
          return res.status(400).send({ message: 'User data is required' });
        }
      
        // Log the connection attempt
        console.log(`Attempting to connect the user to the download server, User ID: ${user._id}`);
      
        try {
          // Set the user to req.user
          req.user = user;
      
          // Here you would typically have some logic to handle the user connection
          // For example, you might call another function to process the user data
          // connectUserToTheDownloadServer(req.user);
      
          // If the connection logic is successful, send a success response
          console.log(`User connected to the download server, User ID: ${req.user._id}`);
          res.status(200).send({ message: 'User connected to the download server successfully' });
        } catch (error) {
          // If an error occurs, log it and send a server error status
          console.error(`Error connecting user to the download server, User ID: ${user._id}`, error);
          res.status(500).send({ message: 'Error connecting user to the download server' });
        }
      });
      

        router.post('/downloadVideoSegments', async (req, res) => {
        try{
          const actressName = req.body.actressName
          const itemID = req.body.itemID
      
          const folderPath = path.join(__dirname, 'public','downloads', 'actresses', actressName, itemID);
          const item = await global.db.collection('actresses_profile').findOne({ _id: new ObjectId(itemID) })
          const url = item.link;
      
          if(item.video_filePath){
            res.json({url:item.video_filePath.replace('public','')})
            return
          }

          // Update the isdl_start in MongoDB
          await global.db.collection('actresses_profile').updateOne(
            { _id: new ObjectId(itemID) },
            { $set: { actressName, isdl_start:new Date() } }
          );


          try {
            const finalVideoFilePath = await downloadVideoSegments(url, folderPath, itemID);
            console.log("Received final video file path:", finalVideoFilePath);
            const trimmedPath = finalVideoFilePath.replace(/.*\/public/, '');
      
            // Update the video_filePath in MongoDB
            const updateResult = await global.db.collection('actresses_profile').updateOne(
              { _id: new ObjectId(itemID) },
              { $set: { video_filePath:trimmedPath, isdl:true, isdl_end:new Date() } }
            );

            // Log the result (optional)
            if (updateResult.modifiedCount === 1) {
              console.log(`Successfully updated video_filePath for itemID: ${itemID}`);
            } else {
              console.log(`Failed to update video_filePath for itemID: ${itemID}`);
            }
      
            res.json({url:trimmedPath})
          } catch (error) {
            console.error("An error occurred while downloading video segments:", error);
          }
          
        }catch(error){
          console.log(error)
        }
      });  

      router.post('/getVideoFromSB', async (req, res) => {
        const {query, mode, nsfw, url, pageNum, userId} = req.body;
        const result1 = getVideoFromSB(query, mode, nsfw, url, pageNum, userId);
        //const result2 = getVideoFromPD(query, mode, nsfw, url, pageNum, userId);
        //const result3 = getVideoFromHQP(query, mode, nsfw, url, pageNum, userId);
        
        const combinedResult = await Promise.allSettled([result1]);
        
        const successfulResults = combinedResult
          .filter(promise => promise.status === 'fulfilled')
          .map(promise => promise.value);
        
        const result = successfulResults.flat();
        res.status(200).json({ result });
      });
      
      router.post('/scrapeWebsiteTopPage',async (req,res) => { 
        const {mode, nsfw, userId, extractor}=req.body
        try {
          const latestItems = await global.db.collection('pageTop').findOne({extractor}) //check if the date in latestItems.time is more than 24h ago. if no return latestItems.data if  yes fetch the data and sanve in latestItems.data 
          const result = await updateDataIfNeeded(extractor, mode, nsfw, userId)
          res.status(200).json({result,status:true})
        } catch (error) {
          res.status(500).json({status:false})
        }
      })

      async function updateDataIfNeeded(extractor, mode, nsfw, userId) {
        try {
          const collection = global.db.collection('pageTop');
      
          // Find the latest item for the given extractor
          const latestItems = await collection.findOne({ extractor });
      
          if (latestItems) {
            const currentTime = new Date();
            const lastUpdateTime = new Date(latestItems.time);
            const timeDifference = currentTime - lastUpdateTime;
      
            // Check if the time difference is more than 24 hours (24 * 60 * 60 * 1000 milliseconds)
            if (timeDifference > 86400000) {
              // If more than 24 hours, fetch new data
              const result = await scrapeWebsiteTopPage(mode, nsfw, userId);
      
              // Update the document in the database with the new data and time
              await collection.updateOne({ extractor }, { $set: { data: result, time: new Date() } });
              return result;
            } else {
              // If less than 24 hours, return the existing data
              console.log(`Less than 24 hours, return the existing data`)
              return latestItems.data;
            }
          } else {
            // If no document found, fetch and insert new data
            const result = await scrapeWebsiteTopPage(mode, nsfw, userId);
            await collection.insertOne({ extractor, data: result, time: new Date() });
            return result;
          }
        } catch (error) {
          console.error("Error occurred: ", error);
        } 
      }

      // Define a route to handle video requests
      router.get('/video', async (req, res) => {
        try {
          const { videoId, mode } = req.query;
          const myCollection = `medias_${mode}`
          const foundElement = await global.db.collection(myCollection).findOne({_id:new ObjectId(videoId)})
          const url = await getHighestQualityVideoURL(myCollection,videoId,req.user);

          if (!url) {
            return res.status(404).json({ error: 'Video not found or no valid URL available.' });
          }

          // Respond with the highest quality video URL
          return res.json({ url,data:foundElement });
        } catch (error) {
          console.error('Error occurred while processing the request:', error);
          return res.status(500).json({ error: 'An error occurred while processing the request.' });
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

