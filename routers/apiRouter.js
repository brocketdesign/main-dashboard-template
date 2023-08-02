const express = require('express');
const router = express.Router();

const getHighestQualityVideoURL = require("../modules/getHighestQualityVideoURL")
const ensureAuthenticated = require('../middleware/authMiddleware');
const {formatDateToDDMMYYHHMMSS,findElementIndex,saveData} = require('../services/tools')
const pdfToChunks = require('../modules/pdf-parse')
const multer = require('multer');

const axios = require('axios');
const path = require('path');

const fs = require('fs');
const { ObjectId } = require('mongodb');

// API router for openAI
router.post('/openai/send-prompt', async (req, res) => {
  const { Configuration, OpenAIApi } = require('openai');

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const openai = new OpenAIApi(configuration);

  const { prompt, time } = req.body;
  if(!prompt){
    res.status(500).send('Error with the prompt');
    return
  }
  console.log(`Generate response for:  ${prompt} at ${time}`)

  const messages = [
    { role: 'system', content: 'You are a powerful assistant' },
    { role: 'user', content: prompt },
  ];

  try {
    var completion = await openai.createChatCompletion({
      model: process.env.COMPLETIONS_MODEL,
      messages,
      max_tokens: 1000 // Specify the maximum token limit
    });
    completion = completion.data.choices[0].message.content

    console.log(completion)

    const dataUpdate = { message: prompt, completion: completion, response_time: new Date(),message_time:time };
    const result = await global.db.collection('users').updateOne(
      { _id: req.user._id },
      { $push: { openai_conversation: dataUpdate } }
    );

    res.json({ success: true, dataUpdate});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_STORAGE_FOLDER);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${req.user._id}-${formatDateToDDMMYYHHMMSS()}.pdf`);
  }
});


const upload = multer( {storage: storage });

router.post('/openai/compare', upload.fields([{ name: 'pdf1' }, { name: 'pdf2' }]), async (req, res) => {
  const { Configuration, OpenAIApi } = require('openai');

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const openai = new OpenAIApi(configuration);

  let { input1, input2, time } = req.body;
  let isPDF = false
  try{

    if(req.files.pdf1 && req.files.pdf2){
      isPDF = true
      input1 = await pdfToChunks(req.files.pdf1[0].path)
      input2 = await pdfToChunks(req.files.pdf2[0].path)
    }

  }catch(e){
      console.log('No PDF provided')
    }

  if(!input1 || !input2){
    res.status(500).send('Error with the input');
    return
  }
  if(isPDF){
    input1 = input1[0]
    input2 = input2[0]
  }
  console.log(`Generate response for:  ${input1} and ${input2}`)

  const messages = [
    { role: 'system', content: 'You are a powerful assistant' },
    { role: 'user', content: `Compare this "${input1}" to "${input2}". 
    Generate a summary of each PDF and compare the summaries. you should answer in the document language.
    [{"input2":"","input2":"","difference":""}].
    return only the JSON array.` },
  ];

  try {
    const generatedJson = await generateJson(messages,openai);
    console.log(generatedJson)

    const dataUpdate = { input1, input2, completion:generatedJson, response_time: new Date(),message_time:time };
    const result = await global.db.collection('users').updateOne(
      { _id: req.user._id },
      { $push: { openai_compare: dataUpdate } }
    );

    res.json({ success: true, completion:generatedJson});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});


const generateJson = async (messages,openai) => {
  const completion = await openai.createChatCompletion({
    model: process.env.COMPLETIONS_MODEL,
    messages,
    max_tokens: 2000 // Specify the maximum token limit
  });

  try {
    return JSON.parse(completion.data.choices[0].message.content);
  } catch (e) {
    console.log(completion.data.choices[0].message.content)
    throw new Error('The JSON structure generated from GPT is not valid. Please try again.');
  }
};
// Wordpress 
router.post('/post-article', async (req, res) => {
  const wordpress = require( "wordpress" );

  const client = wordpress.createClient({
    url: req.user.wpURL,
    username: req.user.wpUsername,
    password: req.user.wpPassword
  });
  
  const { title, content } = req.body;

  if (!content) {
      res.status(400).json({status: 'error', message: 'Article content is required'});
      return;
  }

  try {

      const response = await client.newPost({
          title: title,
          content: content,
          status: eq.user.wpPostStatus || 'draft'
      }, function( error, id ){
        if(!error){
          res.status(200).json({status: 'success', message: `Article posted successfully with ID: ${id}`,link:`${req.user.wpURL}/`});
        }else{
          console.error(error);
          res.status(500).json({status: 'error', message: 'Internal server error'});
        }
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({status: 'error', message: 'Internal server error'});
  }
});



router.post('/submit/:sectionName', ensureAuthenticated, (req, res) => {
  const sectionName = req.params.sectionName;
  const formData = req.body;

  // Save the form data to the MongoDB collection
  global.db
    .collection(sectionName)
    .updateOne({ userId: req.user._id }, { $set: formData }, { upsert: true })
    .then(result => {
      res.json({ message: 'Data saved successfully.' });
    })
    .catch(err => {
      console.log('Submit error:', err);
      res.status(500).json({ error: err });
    });
});

// Define a route to handle video requests
router.get('/video', async (req, res) => {
  try {
    const { id } = req.query;
    
    // Call the function to get the highest quality video URL for the provided id
    const highestQualityURL = await getHighestQualityVideoURL(id,req.user);

    if (!highestQualityURL) {
      return res.status(404).json({ error: 'Video not found or no valid URL available.' });
    }

    // Respond with the highest quality video URL
    return res.json({ url: highestQualityURL });
  } catch (error) {
    console.error('Error occurred while processing the request:', error);
    return res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

// Handle file download
router.post('/dl', async (req, res) => {
  const video_id = req.body.video_id;
  console.log('File download requested for video_id:', video_id);

  try {
    // Get the highest quality video URL for the given video_id
    const url = video_id.includes('http') ? video_id :  await getHighestQualityVideoURL(video_id,req.user);

    if (!url) {
      console.log('Video URL not found for video_id:', video_id);
      res.status(404).json({ error: 'Video URL not found.' });
      return;
    }

    if(!url.includes('http')){
      res.status(200).json({ message: 'File already downloaded.' });
      return
    }
    
    console.log('Downloading from URL:', url);

    const response = await axios.get(url, { responseType: 'stream', maxContentLength: 10 * 1024 * 1024 });
    console.log('Received response for URL:', url);

    // Parse the URL and remove the query parameters before extracting fileName
    let parsedUrl = new URL(url);
    parsedUrl.search = "";

    // Check if the folder exists
    await fs.access(process.env.DOWNLOAD_DIRECTORY, fs.constants.F_OK, (err) => {
      if (err) {
        // Folder does not exist, create it
        createDownloadFolder(process.env.DOWNLOAD_DIRECTORY);
      } else {
        console.log('Download folder already exists.');
      }
    });

    const fileName = path.basename(parsedUrl.toString());
    const filePath = path.join(process.env.DOWNLOAD_DIRECTORY, fileName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on('finish', async() => {
      console.log('File downloaded:', fileName);

      // Save the download details to the database (update the video document)
      const currentTime = new Date().getTime();

      const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });
      const AllData = userInfo.scrapedData;
      
      const foundElement = AllData.find(item => item.video_id === video_id);
      // Find the index of the element with the desired video_id in the scrapedData array
      const elementIndex = AllData.findIndex(item => item.video_id === video_id);

      if(elementIndex !== -1){
        AllData[elementIndex].filePath = filePath.replace('public','');
  
        // Update the user document in the 'users' collection with the modified scrapedData array
        await global.db.collection('users').updateOne(
          { _id: new ObjectId(req.user._id) },
          { $set: { scrapedData: AllData } },
          (err) => {
            if (err) {
              console.log('Error occurred while saving download details:', err.message);
            }
          }
        );
      }else{
        console.log('Element not founded')
      }

      // Send a success status response after the file is downloaded
      res.status(200).json({ message: 'File downloaded successfully.' });
    });

    writer.on('error', (err) => {
      console.log('Error occurred while downloading file:', err.message);
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    console.log('Error occurred while downloading file:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for fetching data from Reddit based on the subreddit and filter parameters
router.get('/reddit/:subreddit', async (req, res) => {
  const { subreddit } = req.params;
  const { filter, allowR18 } = req.query;

  try {
    const response = await axios.get(`https://www.reddit.com/r/${subreddit}.json`);
    const data = response.data.data.children.map((child) => child.data);

    // Filter the data based on the 'filter' query parameter
    if (filter === 'images') {
      const imagesData = data.filter((post) => post.post_hint === 'image' && (!post.over_18 || allowR18 === 'true'));
      res.json(imagesData);
    } else if (filter === 'videos') {
      const videosData = data.filter((post) => post.is_video && (!post.over_18 || allowR18 === 'true'));
      res.json(videosData);
    } else {
      // By default, exclude R18 content if allowR18 is not explicitly set to true
      const filteredData = data.filter((post) => (!post.over_18 || allowR18 === 'true'));
      res.json(filteredData);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data from Reddit' });
  }
});

// API routers for generative image AI
router.get('/current-model', async (req, res) => {
  try {
    const currentModel = await global.sdapi.getCurrentModel();
    res.json({ model: currentModel });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching current model');
  }
});


router.post('/model', async (req, res) => {
  try {
    // Retrieve the desired model hash from the request body
    const { hash } = req.body;
    
    // If the hash is not provided, return an error response
    if (!hash) {
      res.status(400).send('Model hash not provided');
      return;
    }
    
    // Get all models
    const models = await global.sdapi.getSdModels();

    // Find the model with the provided hash
    const model = models.find(model => model.hash === hash);

    // If the model was not found, return an error response
    if (!model) {
      res.status(404).send('Model not found');
      return;
    }

    // Attempt to change the model
    const options = {
      sd_model_checkpoint: model.title,
    };
    await global.sdapi.setOptions(options);
    // Retrieve the current model to confirm the change
    const currentModel = await global.sdapi.getCurrentModel();
    
    // Save the selected model in the user database
    const userCollection = global.db.collection('users');
    await userCollection.updateOne(
      { _id: new ObjectId(req.user._id) },
      { $set: { selected_model: currentModel } }
    );
    
    // Send a success response with the current model
    res.json({ model: currentModel });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error changing model');
  }
});


router.post('/image', async (req, res) => {
  const prompt = req.body.prompt;
  const negative_prompt = req.body.negative_prompt;

  const payload = {
    prompt: prompt,
    negative_prompt: negative_prompt.length == 0 ? "illustration, 3d, 2d, painting, cartoons, sketch, (worst quality:1.9), (low quality:1.9), (normal quality:1.9), lowres, bad anatomy, bad hands, vaginas in breasts, ((monochrome)), ((grayscale)), collapsed eyeshadow, multiple eyeblows, (cropped), oversaturated, extra limb, missing limbs, deformed hands, long neck, long body, imperfect, (bad hands), signature, watermark, username, artist name, conjoined fingers, deformed fingers, ugly eyes, imperfect eyes, skewed eyes, unnatural face, unnatural body, error, bad image, bad photo, worst quality, low quality:1.5), clothes, lingerie, monochrome, blurry, condom, text, logo, ((child)), ((underage)), ((teenage)), crossed eyes, plain background, futa girl, futa, Sfw censored Blurry pixelated out of frame low resolution poor quality grainy monochrome gloves, horns, lowres, disfigured, ostentatious, ugly, oversaturated, grain, low resolution, disfigured, blurry, bad anatomy, disfigured, poorly drawn face, mutant, mutated, extra limb, ugly, poorly drawn hands, missing limbs, blurred, floating limbs, disjointed limbs, deformed hands, blurred out of focus, long neck, long body, ugly, disgusting, bad drawing, childish, cut off cropped, distorted, imperfect, surreal, bad hands, text, error, extra digit, fewer digits, cropped , worst quality, missing limbs, imperfect anatomy, Oriental, Asian, shiny skin, oily skin, unrealistic lighting, fake, airbrushed skin, deformed, blur, blurry, bokeh, warp hard bokeh, gaussian, out of focus, out of frame, obese, (odd proportions, asymmetrical), super thin, fat,dialog, words, fonts, teeth, ((((ugly)))), (((duplicate))), ((morbid)), monochrome, b&w, [out of frame], extra fingers, mutated hands, ((poorly drawn hands)), ((poorly drawn face)), (((mutation))), (((deformed))), ((ugly)), blurry, ((bad anatomy)), (((bad proportions))), ((extra limbs)), cloned face, (((disfigured))), out of frame, ugly, extra limbs, (bad anatomy), ((gross proportions)), (malformed limbs), ((missing arms)), ((missing legs)), (((extra arms))), (((extra legs))), mutated hands, (fused fingers), (too many fingers), (((long neck))), (worst quality:1.5), (low quality:1.5), (normal quality:1.5), lowres, bad anatomy, bad hands, vaginas in breasts, ((monochrome)), ((grayscale)), collapsed eyeshadow, multiple eyeblows, (cropped), oversaturated, extra limb, missing limbs, deformed hands, long neck, long body, imperfect, (bad hands), signature, watermark, username, artist name, conjoined fingers, deformed fingers, ugly eyes, imperfect eyes, skewed eyes, unnatural face, unnatural body, error, painting by bad-artist, 1girl with penis, 1girl with masculine features, backlight, (worst quality, low quality:1.2), watermark, logo, bad anatomy, topless, fat, bad anatomy" : negative_prompt,
    height:768
  };

  try {
    const result = await global.sdapi.txt2img(payload);
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, result.image);
    // Ensure that the output folder exists
    await ensureFolderExists('./public/output');

    const imagePath = `./public/output/${imageID}.png`;
    await result.image.toFile(imagePath);

    const base64Image = await convertImageToBase64(imagePath);
    res.json({ image_id: imageID, image: base64Image });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});

router.post('/hide', async (req, res) => {
  const element_id = req.body.id;
  try {
    const statusUpdate = await saveData(req.user, element_id, {hide:true})
    if(!statusUpdate){
      res.status(500).json({ message:'An error occured' });
      return
    }
    res.status(200).json({ message:'This element wont be displayed anymore' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message:'An error occured' });
  }
});

async function saveImageToDB(db, userID, prompt, image) {
  const imageID = new ObjectId();
  const collection = db.collection('images');
  await collection.insertOne({
    _id: imageID,
    user_id: userID,
    prompt: prompt,
  });
    // Save the image in the user's document
    const userCollection = db.collection('users');
    await userCollection.updateOne(
      { _id: new ObjectId(userID) },
      { $push: { images: { image_id: imageID } } }
    );
  
  return imageID;
}

async function convertImageToBase64(imagePath) {
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  return base64Image;
}


async function ensureFolderExists(folderPath) {
  try {
    // Check if the folder exists
    await fs.promises.access(folderPath, fs.constants.F_OK);
  } catch (error) {
    // Folder does not exist, create it
    await fs.promises.mkdir(folderPath, { recursive: true });
  }
}
async function checkFilePermissions(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
    console.log('File has read and write permissions.');
  } catch (error) {
    console.log('File does not have read and write permissions.');
  }
}
// Function to create the folder if it doesn't exist
function createDownloadFolder(downloadDirectory) {
  fs.mkdir(downloadDirectory, { recursive: true }, (err) => {
    if (err) {
      console.error('Error creating the folder:', err);
    } else {
      console.log('Download folder created successfully.');
    }
  });
}

module.exports = router;
