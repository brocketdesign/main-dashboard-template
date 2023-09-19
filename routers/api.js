const express = require('express');
const router = express.Router();

const getHighestQualityVideoURL = require("../modules/getHighestQualityVideoURL")
const ensureAuthenticated = require('../middleware/authMiddleware');
const {
  formatDateToDDMMYYHHMMSS,
  saveData, 
  downloadVideo, 
  updateSameElements,
  fetchOpenAICompletion,
  initCategories,
  saveDataSummarize
} = require('../services/tools')
const pdfToChunks = require('../modules/pdf-parse')
const multer = require('multer');
const searchSubreddits = require('../modules/search.subreddits')
const summarizeVideo = require('../modules/youtube-summary')
const postArticleToWordpress = require('../modules/postArticleToWordpress')
const scrapeMode1GetRelatedVideo = require('../modules/scraper/scrapeMode1GetRelatedVideo')
const createBookChapters = require('../modules/createBookChapters')
const ManageScraper = require('../modules/ManageScraper');

const axios = require('axios');
const path = require('path');

const fs = require('fs');
const url = require('url');
const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_STORAGE_FOLDER);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${req.user._id}-${formatDateToDDMMYYHHMMSS()}.pdf`);
  }
});


const upload = multer( {storage: storage });

router.post('/user/:elementCreated', async (req, res) => {
  try {
      const userID = new ObjectId(req.user._id);
      const elementCreated = req.params.elementCreated;
      const content = req.body.content;

      console.log(`Request for ${elementCreated} by ${userID}. Data: ${content}`);

      // 1. Create a new document in the elementCreated collection
      const creationResult = await global.db.collection(elementCreated).insertOne({ content: content });

      // 2. Get the _id of the newly created document
      const newElementId = creationResult.insertedId;

      // 3. Push this _id into the user's elementCreated + "Ids" array
      const fieldToUpdate = elementCreated + "Ids";
      console.log(fieldToUpdate)
      const updateUserResult = await global.db.collection('users').updateOne(
          { _id: userID },
          { $push: { [fieldToUpdate]: newElementId } }
      );

      if (updateUserResult.modifiedCount === 1) {
          res.status(200).send({ message: 'Data added successfully', newElementId: newElementId });
      } else {
          res.status(400).send({ message: 'Failed to add data' });
      }
  } catch (error) {
      console.error('Error updating user data:', error);
      res.status(500).send({ message: 'Internal server error' });
  }
});

router.delete('/user/:elementRemoved/:elementId', async (req, res) => {
    try {
        const userID = new ObjectId(req.user._id);
        const elementRemoved = req.params.elementRemoved; // This should be "memo" in your use case
        const elementIdToRemove = new ObjectId(req.params.elementId); // The ID of the memo to be removed

        console.log(`Request to remove ${elementRemoved} with ID ${elementIdToRemove} for user ${userID}`);

        // Construct the field name by appending "Ids" to the elementRemoved value
        const fieldToUpdate = elementRemoved + "Ids";

        // Remove the specified ID from the user's elementRemoved + "Ids" array
        const updateUserResult = await global.db.collection('users').updateOne(
            { _id: userID },
            { $pull: { [fieldToUpdate]: elementIdToRemove } }
        );

        if (updateUserResult.modifiedCount === 1) {
            res.status(200).send({ message: 'Data removed successfully' });
        } else {
            res.status(400).send({ message: 'Failed to remove data' });
        }
    } catch (error) {
        console.error('Error updating user data:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


router.post('/openai/custom/:type', upload.fields([{ name: 'pdf1' }, { name: 'pdf2' }]), async (req, res) => {
  let { prompt, time, data } = req.body;
  const type = req.params.type;

  let isPDF = false
  let input1 = ''
  try{
    if(req.files && req.files.pdf1 ){
      isPDF = true
      input1 = await pdfToChunks(req.files.pdf1[0].path)
      if(isPDF){
        input1 = input1[0]
      }
      data = {pdf_content :input1}
      data.language= req.body.language
  
      prompt = `
      What is this content about ? 
      Summarize this content in ${data.language} in a few lines : ${input1}
      `
    }

  }catch(e){
      console.log('No PDF provided')
      console.log(e)
  }
  
  console.log(`Save ${type} data`)

  try {
    const result = await global.db.collection('openai').insertOne({ 
      userID:req.user._id, 
      data:data,
      prompt: prompt, 
      prompt_time:time,
      type 
    });

    const insertedId = result.insertedId;
    
    global.db.collection('users').updateOne(
      { _id: new ObjectId(req.user._id) },
      { $push: {[`openai_${type}`]: insertedId } }
    );

    res.json({
      redirect: `/api/openai/stream/${type}?id=${insertedId}`,
      insertedId: insertedId
    });

  } catch (error) {
  console.log(error);
  res.status(500).send('Internal server error');
  }
});

router.get('/openai/stream/:type', async (req, res) => {
  const type = req.params.type;
  const id = req.query.id;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.flushHeaders(); // Flush the headers to establish the SSE connection

  try {
      // Fetch the prompt from the database using the provided id
      const record = await global.db.collection('openai').findOne({ _id: new ObjectId(id) });

      if (!record) {
          res.write('data: {"error": "Record not found"}\n\n');
          res.end();
          return;
      }

      const prompt = record.prompt;
      const messages = [
          { role: 'system', content: 'You are a powerful assistant' },
          { role: 'user', content: prompt },
      ];

      const fullCompletion = await fetchOpenAICompletion(messages, res);

      // Update the database with the full completion
      await global.db.collection('openai').updateOne(
          { _id: new ObjectId(id) },
          { $push: { completion: fullCompletion,completion_time:new Date() } }
      );

      // 文字列内のダブルクォートと改行をエスケープ
      const completionEscaped = fullCompletion.replace(/"/g, '\\"').replace(/\n/g, '\\n');

      res.write('event: end\n');
      res.write(`data: {"id": "${id}","completion":"${completionEscaped}"}\n\n'`);
      res.flush(); // Flush the response to send the data immediately
      res.end();
  } catch (error) {
      console.log(error);
      res.write('data: {"error": "Internal server error"}\n\n');
      res.end();
  }
});

router.post('/openai/pdf/compare', upload.fields([{ name: 'pdf1' }, { name: 'pdf2' }]), async (req, res) => {

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
  res.json({ success: true, completion:JSON.parse('[{"input2":"","input2":"","difference":""}]')});
  return 
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
// Define the /openai/summarize route
router.get('/openai/summarize', async (req, res) => {

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.flushHeaders(); // Flush the headers to establish the SSE connection

  console.log('Received request to /openai/summarize');

  try {
    const videoId = req.query.videoId;
    if(!videoId){
      console.log('Provide a video ID')
      res.end();
      return
    }
    console.log(`Video ID received: ${videoId}`);

    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})
    const title = foundElement.title
    console.log(`Title fetched for video: ${title}`);

    const chunks = await summarizeVideo(req.user,videoId);
    if (Array.isArray(chunks)) {
      // chunks is an array
      const summaries = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Summarize section ${i + 1}/${chunks.length}`);
        const promptJP = `
        以下の内容を要約してください \n\n${chunks[i]}\n\n 
        そして、主要なポイントの短い段落にし、リストの中で簡潔にハイライトされた情報にまとめてください。各ハイライトには適切な絵文字を選んでください。
        あなたの出力は以下のテンプレートを使用してください:
        要約
        ハイライト
        結論
        [絵文字] バレットポイント
        Note: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.
        `;
        const prompt = `
        Please summarize the following content:\n
        ${chunks[i]}\n
        Then, create short paragraphs of the main points and summarize the information in concise highlighted points within a list. Please choose appropriate emojis for each highlight.
        Use the following template for your output:
        Summary
        Highlights
        Conclusion
        [Emoji] Bullet Point
        Note: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.
        `;

        const messages = [
          { role: 'system', content: 'You are a powerful assistant' },
          { role: 'user', content: prompt },
        ];
      
        const summary = await fetchOpenAICompletion(messages, res);
        summaries.push(summary);
      }

      
      const combinedSummary = summaries
      .map((summary, index) => `<h2> パート ${index + 1}</h2><br>${summary}`)
      .join('<br>');

      console.log({combinedSummary})
      saveDataSummarize(videoId, {summary:combinedSummary})
      return { summary: combinedSummary };
    }

    res.write('event: end\n');
    res.write('data: {"videoId": "'+videoId+'"}\n\n');
    res.flush(); // Flush the response to send the data immediately
    res.end();
    return

    const embedLink = `https://www.youtube.com/embed/${videoId}`;
    const iframeEmbed = `<div style="text-align:center;width:100%;"><iframe width="560" height="315" src="${embedLink}" frameborder="0" allowfullscreen></iframe></div>`;

    const contentHtml = `${iframeEmbed}<br>${content.summary}`;
    console.log(`Content fetched: ${contentHtml.substring(0, 100)}...`); // Displaying first 100 characters for brevity

    saveDataSummarize(req.user, videoId, content)
      return
      const response = await postArticleToWordpress({
        user: req.user,
        title: title,
        content: contentHtml
      });
  
      console.log('Article successfully posted to Wordpress:', response);
  
  } catch (err) {
      console.error('Error encountered:', err);
      res.write('data: {"error": "Internal server error"}\n\n');
      res.end();
  }
});

// Define the /openai/ebook route
router.post('/openai/ebook', async (req, res) => {
  console.log('Received request to /openai/ebook');

  try {
    const { topic, language, keywords, userChapters , aiCheckbox} = req.body;

    console.log(`Write an ebook about "${topic}" in ${language}`);
    console.log({ topic, language, keywords, userChapters, aiCheckbox })

    //res.status(200).json({ message: 'This is a test' });
    //return 
    
    const bookId = createBookChapters(req.user,req.body);
  
    res.redirect(`/dashboard/app/openai/ebook/`);

  } catch (err) {
    console.error('Error encountered:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/openai/edit-book', async (req, res) => {
  const {bookID, keyPath, newValue} = req.body;

  let bookData;
  if (keyPath.includes('.')) {
      const parts = keyPath.split('.');
      bookData = {};
      let current = bookData;

      for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = newValue;
  } else {
      bookData = {[keyPath]: newValue};
  }

  const bookCollection = global.db.collection('books');

  try {
    const updateResponse = await bookCollection.updateOne({ _id: new ObjectId(bookID) }, { $set: bookData });

    if(updateResponse.matchedCount == 0) {
        // Handle no document found with given ID
        return res.status(404).send({ success: false, message: "No document found with the given ID" });
    }

    res.send({ success: true });
  } catch(err) {
      res.status(500).send({ success: false, message: err.message });
  }
});
router.post('/openai/regen-ebook', async (req, res) => {
  const {bookID, keyPath, newValue} = req.body;

  console.log('Request for regen-ebook', keyPath)

  let bookData;
  if (keyPath.includes('.')) {
      const parts = keyPath.split('.');
      bookData = {};
      let current = bookData;

      for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = newValue;
  } else {
      bookData = {[keyPath]: newValue};
  }

  const bookCollection = global.db.collection('books');

  try {
    const book = await bookCollection.findOne({ _id: new ObjectId(bookID) })

    const chapterPrompt = `
    I'd like a paraphrase of the following content: ${newValue}. 
    Your response must be in ${book.language}.
    `;
    
    const gptResponse = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: chapterPrompt,
        max_tokens: newValue.length + 50,
        temperature: 0.6,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.5
    });
    /*
    try {
      
          const messages = [
            { role: 'system', content: 'You are a powerful assistant' },
            { role: 'user', content: chapterPrompt },
          ];
          var completion = await openai.createChatCompletion({
            model: process.env.COMPLETIONS_MODEL,
            messages,
            max_tokens: 1000 // Specify the maximum token limit
          });
          completion = completion.data.choices[0].message.content
      
          console.log(completion)
    } catch (error) {
      console.log(error)
    }
    */
    
    res.send({ success: true, data:gptResponse.data.choices[0].text.trim() });
  } catch(err) {
      res.status(500).send({ success: false, message: err.message });
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
    const { videoId } = req.query;
    
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

const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');


router.post('/downloadFileFromURL', async (req, res) => {

  try{
    const url = req.body.url;
    const itemID = req.body.itemID
    const item = await global.db.collection('medias').findOne({ _id: new ObjectId(itemID) })

    if(item.filePath){
      res.json({url:item.filePath.replace('public','')})
      return
    }
    const {fileName,filePath} = generateFilePathFromUrl(process.env.DOWNLOAD_DIRECTORY,url)
    console.log(`Page URL : ${url}`)
    const videoSource = await downloadVideo(url, filePath, itemID);
    console.log(`Downloaded : ${filePath}`)
    res.json({url:filePath.replace('public','')})
  }catch(error){
    console.log(error)
  }

});  

router.post('/dl', async (req, res) => {
  const video_id = req.body.video_id;
  const title = req.body.title || 'vid';
  console.log('File download requested for video_id:', video_id);

  try {

    const url = await getHighestQualityVideoURL(video_id,req.user,false);

    if (!url) {
      console.log('Video URL not found for video_id:', video_id);
      res.status(404).json({ error: 'Video URL not found.' });
      return;
    }

    if(!url.includes('http')){
      saveData(req.user, video_id, {isdl:true})
      res.status(200).json({ message: 'ダウンロードされました' });
      return;
    }

    console.log('Downloading from URL:', url);

    let download_directory = process.env.DOWNLOAD_DIRECTORY
    if (url.includes('youtube.com')) {
      download_directory = download_directory+'/youtube';
    }

    const {fileName,filePath} = generateFilePathFromUrl(download_directory,url,title)

    // Create download folder if it doesn't exist
    await fs.promises.mkdir(download_directory, { recursive: true });

    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(video_id)})

    if (url.includes('youtube.com')) {
      await downloadYoutubeVideo(download_directory,filePath,foundElement.video_id)
    } else {
      await downloadFileFromURL(filePath,url)
    }

    // After the file is downloaded, do the same things for both YouTube videos and other types of files

    console.log('File downloaded:', fileName);

    updateSameElements(foundElement,{filePath:filePath.replace('public',''), isdl:true,isdl_data:new Date()})
    // Send a success status response after the file is downloaded
    res.status(200).json({ message: 'アイテムが成功的に保存されました。' });

  } catch (err) {
    console.log('Error occurred while downloading file:', err.message);
    res.status(500).json({ error: err.message });
  }
});
function generateFilePathFromUrl(download_directory,url,title='dl'){
  // Get file name from the URL
  const fileExtension = getFileExtension(url)
  let extension = getFileExtension(url) == '' ? '.mp4':fileExtension;
  let sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, ''); // This will keep only alphanumeric characters
  let fileName = `${sanitizedTitle}_${Date.now()}${extension}`;
  let filePath = path.join(download_directory, fileName);
  return {fileName,filePath}
}
async function downloadFileFromURL(filePath,url) {
  // If it's not a YouTube video, download it directly
  const response = await axios.get(url, { responseType: 'stream', maxContentLength: 10 * 1024 * 1024 });
  console.log('Received response for URL:', url);

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function downloadYoutubeVideo(download_directory,filePath,video_id) {
  const info = await ytdl.getInfo(video_id);
  //console.log(info.formats);

  const videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
  const audioFormat = ytdl.chooseFormat(info.formats.filter(format => !format.videoCodec), { quality: 'highestaudio' });
  
  // Define temporary file paths
  let videoFilePath = path.join(download_directory, `video_${Date.now()}.mp4`);
  let audioFilePath = path.join(download_directory, `audio_${Date.now()}.mp4`);

  // Download video
  const videoDownload = ytdl.downloadFromInfo(info, { format: videoFormat });
  videoDownload.pipe(fs.createWriteStream(videoFilePath));

  // Download audio
  const audioDownload = ytdl.downloadFromInfo(info, { format: audioFormat });
  audioDownload.pipe(fs.createWriteStream(audioFilePath));

  // Wait for both downloads to finish
  await Promise.all([
    new Promise((resolve, reject) => {
      videoDownload.on('end', resolve);
      videoDownload
      .on('error', (err) => {
        console.error('Error occurred while videoDownload files:', err);
        reject(err);
      });
    }),
    new Promise((resolve, reject) => {
      audioDownload.on('end', resolve);
      audioDownload
      .on('error', (err) => {
        console.error('Error occurred while audioDownload files:', err);
        reject(err);
      });
    })
  ]);


  // Merge video and audio files
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoFilePath)
      .input(audioFilePath)
      .outputOptions('-map', '0:v', '-map', '1:a')
      .saveToFile(filePath) // Adding .mp4 extension
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        console.error('Error occurred while merging files:', err, stderr);
        reject(err);
      });
  });

  // Delete temporary files
  fs.unlinkSync(videoFilePath);
  fs.unlinkSync(audioFilePath);

}
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

router.get('/searchSubreddits', async (req, res)=> {
  const db = req.app.locals.db;
  let query=req.query.query;

  let result = await searchSubreddits(query)
  result=result.filter(item => item.r18.toString() == req.user.nsfw.toString())

  res.send(result)
})

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
  let { element_id, category} = req.body;

  if (!element_id ) {
    return res.status(400).json({ message: 'IDまたはカテゴリが提供されていません' });
  }
  if(!category){
      // Find the current user's data
    const user = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });

    // Check if the category "All" already exists
    let base_category = user.categories && user.categories.find(cat => cat.name === 'All');

    // If the category already exists, return its ID in an array
    category = [base_category.id];
  }
  try {
    // このエレメントIDに関連するソースを見つける (Find the source related to this element_id)
    const element = await global.db.collection('medias').findOne({ _id: new ObjectId(element_id) });
    const source = element.source; // ソースの取得 (Assuming 'source' is the field you want to match)

    console.log({source})
    if(source && source != undefined){
      // 同じソースを持つすべてのエレメントを更新する (Update all elements with the same source)
      const result = await global.db.collection('medias').updateMany(
        { source: source }, // 条件 (Criteria: Match all documents with the same source)
        {
          $pull: { categories: category.toString() }, // カテゴリの削除 (Removing the category)
          $set: { hide: true } // 非表示フィールドを追加 (Add hide field)
        }
      );   
      console.log(`Updated ${result.modifiedCount} elements with the same source.`);

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: '要素が見つかりませんでした' });
      }

    }else{
      const result = await global.db.collection('medias').updateOne(
        { _id: new ObjectId(element_id) }, // 条件 (Criteria: Match all documents with the same source)
        {
          $pull: { categories: category.toString() }, // カテゴリの削除 (Removing the category)
          $set: { hide: true } // 非表示フィールドを追加 (Add hide field)
        }
      );   
      console.log(`Updated ${result.modifiedCount} elements with the same source.`);

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: '要素が見つかりませんでした' });
      }
    }

    console.log('メディアが正常に更新されました');
    res.status(200).json({ message: 'この要素はもう表示されません' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' });
  }
});


router.post('/hideHistory', async (req, res) => {
  const { query, category } = req.body;
  console.log('クエリを非表示にする:', query); // Hide the query: query
  if (!query) {
    return res.status(400).json({ message: 'クエリが提供されていません' }); // Query not provided
  }

  const userId = req.user._id; // Assuming you are getting userId from a logged in user
  
  try {
    // Getting all the medias that match the query
    const medias = await global.db.collection('medias').find({ query }).toArray();
    
    // Looping through each media and removing the category from the categories array
    for (const media of medias) {
      await global.db.collection('medias').updateOne(
        { _id: media._id }, // 条件 (Criteria)
        { 
          $pull: { categories: category } ,
          $set:{hide_query:true}
        }
      );
    }
    
    console.log('メディアが正常に更新されました'); // Media has been successfully updated

    res.status(200).json({ message: 'この要素はもう表示されません' }); // This element won't be displayed anymore
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' }); // An error occurred
  }
});

router.post('/category/add', async (req, res) => {
  const { categoryName, mode } = req.body;
  const userId = req.user._id; // Assuming user ID is available in the request

  try {
    // Retrieve the current user's data
    const user = await global.db.collection('users').findOne({ _id: new ObjectID(userId) });

    // Check if a category with the same name already exists
    if (user.categories && user.categories.some(cat => cat.name === categoryName)) {
      return res.status(400).json({ message: 'この名前のカテゴリは既に存在します' }); // A category with this name already exists
    }

    // Create a category object with a unique ID
    const category = { id: new ObjectID(), name: categoryName, mode };

    // Add the new category to the user's categories object
    await global.db.collection('users').updateOne(
      { _id: new ObjectID(userId) },
      { $push: { categories: category } }
    );

    res.status(200).json({ message: 'カテゴリが追加されました', categoryId: category.id }); // Category has been added
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' }); // An error occurred
  }
});

router.post('/category/edit', async (req, res) => {
  const { categoryId, newName, newMode } = req.body;
  const userId = req.user._id; // Assuming user ID is available in the request

  try {
    // Update the category name and mode in the user's categories object
    await global.db.collection('users').updateOne(
      { _id: new ObjectID(userId), 'categories.id': new ObjectID(categoryId) },
      { $set: { 'categories.$.name': newName, 'categories.$.mode': newMode } }
    );

    res.status(200).json({ message: 'カテゴリが更新されました' }); // Category has been updated
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' }); // An error occurred
  }
});
router.post('/category/remove', async (req, res) => {
  const { categoryId } = req.body;
  const userId = req.user._id; // Assuming user ID is available in the request

  try {
    // Remove the category from the user's categories object
    await global.db.collection('users').updateOne(
      { _id: new ObjectID(userId) },
      { $pull: { categories: { id: new ObjectID(categoryId) } } }
    );

    res.status(200).json({ message: 'カテゴリが削除されました' }); // Category has been removed
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' }); // An error occurred
  }
});

// ルーターを定義して '/loadpage' への POST リクエストを処理します
router.post('/loadpage', async (req, res) => {
console.log('API request loadmore')
try {
    // リクエストボディをコンソールにログ

    const data = { 
      nsfw: req.user.nsfw == 'true',
      searchTerm: req.body.searchterm || req.body.searchTerm , 
      page: req.body.page ,
      mode: req.body.mode 
    }
    
    let scrapedData = await ManageScraper(
      data.searchTerm,
      data.nsfw,
      data.mode,
      req.user, 
      parseInt(data.page)
      );
  
    // JSON 応答を送る
    res.status(200).json({
      status: '成功', // Status as success
      message: 'ページが正常にロードされました' // Message indicating the page has been successfully loaded
    });
} catch (error) {
  console.log(error)
  res.status(500).json({
    status: 'Error', // Status as success
    message: 'An error occured' // Message indicating the page has been successfully loaded
  });
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

function getFileExtension(urlString) {
    const parsedUrl = new URL(urlString);
    const pathname = parsedUrl.pathname;
    const filename = path.basename(pathname);
    const fileExtension = path.extname(filename);
    return fileExtension;
}

module.exports = router;