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
        updateSameElements, 
        generateFilePathFromUrl,
        downloadFileFromURL,
        downloadYoutubeVideo } = require('./services/tools')
  const ManageScraper = require('./modules/ManageScraper');
  const getVideoFromSB = require('./modules/getVideoFromSB')

    router.post('/dl', async (req, res) => {
        const video_id = req.body.video_id;
        const title = req.body.title || 'media';
        console.log('File download requested for video_id:', video_id);
      
        try {
          const url = await getHighestQualityVideoURL(video_id,req.user,false);
          console.log(url)
          
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
        const {query, mode, nsfw, url, pageNum, userId}=req.body
        const result = await getVideoFromSB(query, mode, nsfw, url, pageNum, userId)
        res.status(200).json({result})
      })

      // Define a route to handle video requests
      router.get('/video', async (req, res) => {
        try {
          const { videoId } = req.query;
          console.log(`Loading video : ${videoId}`)
          const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})
          // Call the function to get the highest quality video URL for the provided id
          const url = await getHighestQualityVideoURL(videoId,req.user);
          //const related = await scrapeMode1GetRelatedVideo(id,req.user,req.user.mode, req.user.nsfw)

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

