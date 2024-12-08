const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const getHighestQualityVideoURL = require("../modules/getHighestQualityVideoURL")
const ensureAuthenticated = require('../middleware/authMiddleware');
const streamVideoSegments = require('../modules/streamVideoSegments')
const {
  formatDateToDDMMYYHHMMSS,
  saveData, 
  downloadVideo, 
  downloadVideoRedGIF,
  updateSameElements,
  fetchOpenAICompletion,
  fetchOllamaCompletion,
  moduleCompletionOllama,
  initCategories,
  findDataInMedias,
  saveDataSummarize,
  generateFilePathFromUrl,
  getOpenaiTypeForUser,
  calculatePayloadWidth,
  findTotalPage,
  updateUserScrapInfo
} = require('../services/tools')
const fetch = require('node-fetch');
const FormData = require('form-data');
const pornCategories = require('../services/categories')
const pdfToChunks = require('../modules/pdf-parse')
const multer = require('multer');
const searchSubreddits = require('../modules/search.subreddits')
const summarizeVideo = require('../modules/youtube-summary')
const postArticleToWordpress = require('../modules/postArticleToWordpress')
const createBookChapters = require('../modules/createBookChapters')
const {ManageScraper,AsyncManageScraper} = require('../modules/ManageScraper');
const { exec } = require('child_process');
const axios = require('axios');
const path = require('path');

const fs = require('fs');
const url = require('url');
const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');
const tf = require('@tensorflow/tfjs-node-gpu');

function clearGpuMemory() {
    tf.disposeVariables();
    tf.engine().startScope();
    tf.engine().endScope();
}

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

// GET route to fetch islazyload value based on mode
router.get('/islazyload', async (req, res) => {
  try {
    if(!req.user){
      res.status(500).json({ error: 'User not found' });
      return
    }
      const mode = parseInt(req.query.mode);
      const userID = new ObjectId(req.user._id); // Assuming you have user ID in req.user

      const user = await global.db.collection('users').findOne({ _id: userID });
      if (!user) {
          return res.status(404).json({ error: 'User not found' });
      }

      const isLazyLoad = user.lazyLoadModes && user.lazyLoadModes[mode];
      res.json({ islazyload: isLazyLoad || false });
  } catch (error) {
      console.error('Error fetching islazyload:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// POST route to update islazyload value based on mode
router.post('/islazyload', async (req, res) => {
  try {
      const { islazyload, mode } = req.body;
      const userID = new ObjectId(req.user._id); // Assuming you have user ID in req.user

      const updateResult = await global.db.collection('users').updateOne(
          { _id: userID },
          { $set: { [`lazyLoadModes.${mode}`]: islazyload } }
      );

      if (updateResult.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      res.json({ success: true });
  } catch (error) {
      console.error('Error updating islazyload:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new route to handle the streaming
router.get('/streamVideo/:itemID', async (req, res) => {
  const itemID = req.params.itemID;
  const item = await global.db.collection('actresses_profile').findOne({ _id: new ObjectId(itemID) })
  const videoUrl = item.link
  console.log(`Initiating streaming for ${videoUrl}`);
  // Set headers for SSE
  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.flushHeaders(); // Flush the headers to establish the SSE connection
  
  try {
    await streamVideoSegments(videoUrl, res);
  } catch (err) {
    console.error(`Streaming failed: ${err}`);
    res.status(500).end();
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
          { role: 'system', content: 'You are a powerful assistant. That respond in markdown if necessary.' },
          { role: 'user', content: prompt },
      ];

      //const fullCompletion = await fetchOpenAICompletion(messages, res);
      const fullCompletion = await fetchOllamaCompletion(messages, res);

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

router.get('/openai/chat', async(req,res) => {
  try {
      const userOpenaiDocs = await getOpenaiTypeForUser(req.user._id, 'chat');
      res.send(userOpenaiDocs.reverse())
  } catch (error) {
      res.send([])
  }
})
// Ollama Completion
router.get('/ollama/completion/', async (req, res) => {
  const { prompt,max_tokens } = req.body
  const response = await moduleCompletionOllama({prompt,max_tokens})
  res.send(response)
});


// ルーターを定義して '/loadpage' への POST リクエストを処理します
router.post('/loadpage', async (req, res) => {
  const isSafari = (userAgent) => {
    return /^((?!chrome|android).)*safari/i.test(userAgent);
  };
  try {
    const userAgent = req.headers['user-agent'];
    let { searchterm, nsfw, page, mode, fav } = req.body; // Added fav to body
    nsfw = req.user.nsfw === 'true' ? true : false;
    page = parseInt(page) || 1;

    if (fav === 'true') {
      // Handle the case where `fav` is true, return favorite data directly
      let query_obj = {
        mode: mode,
        nsfw: nsfw,
        fav_user_list: req.user._id,
        hidden_item: { $exists: false }
      };

      if (searchterm) {
        query_obj.searchterm = { $regex: searchterm };
      }

      if (searchterm === 'All') {
        query_obj = {
          mode: mode,
          nsfw: nsfw,
          isdl: true,
          hidden_item: { $exists: false }
        };
      }

      const totalPage = await findTotalPage(req.user._id, query_obj, 30);
      let scrapedData = await findDataInMedias(req.user._id, page, query_obj);
      scrapedData = scrapedData.reverse();

      res.render(`search-result`, {
        user: req.user,
        scrapedData,
        isSafari: isSafari(userAgent),
        searchterm,
        mode,
        page,
        totalPage,
        title: `Mode ${mode} : ${searchterm}`
      });

      return;
    }

    // Normal flow if `fav` is false
    let currentQuery = { searchterm, nsfw, page, mode };
    console.log({ mode, page, searchterm, nsfw });

    if (!searchterm) {
      res.redirect(`/dashboard/app/${mode}/history`);
      return;
    }

    const currentMode = mode || req.session.mode || '1';

    await initCategories(req.user._id);
    let scrapedData = await ManageScraper(searchterm, nsfw, mode, req.user, page);

    if (mode == 2 || mode == 1) {
      AsyncManageScraper(searchterm, nsfw, mode, req.user, page);
    }

    updateUserScrapInfo(req.user._id, page, searchterm, mode).then(async () => {
      const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });
      scrapInfo = userInfo.scrapInfo.find(info => info.searchterm === searchterm);
    });

    const totalPage = await findTotalPage(req.user._id, currentQuery, 30);

    res.render(`search-result`, {
      user: req.user,
      scrapedData,
      isSafari: isSafari(userAgent),
      searchterm,
      mode,
      page,
      totalPage,
      title: `Mode ${mode} : ${searchterm}`
    });

  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred while scraping.');
  }
});


  router.post('/addtofav', async (req, res) => {
    const {video_id,mode}=req.body
    const user = req.user
    const result = await addUserToFavList(user, video_id, mode)
    if(result.modifiedCount>0){
      res.status(200).json({message:'Add media to favorites.',status:true})
    }else{
      res.status(200).json({message:'Error when adding media.',status:false})
    }
  })
  router.post('/removeFromFav', async (req, res) => {
    const {video_id,mode}=req.body
    const user = req.user
    const result = await removeUserFromFavList(user, video_id, mode)
    if(result.modifiedCount>0){
      res.status(200).json({message:'Remove media from favorites.',status:false})
    }else{
      res.status(200).json({message:'Error when removing media.',status:true})
    }
  })
  async function removeUserFromFavList(user, video_id, mode) {
    const myCollection = `medias_${mode}`
    const videoObjectId = new ObjectId(video_id);
  
    // Log the intent to remove user from the favorite list for debugging
    //console.log(`Attempting to remove user ${user._id} from fav_user_list for video ${videoObjectId}`);
  
    try {
      // Perform the update operation
      const updateResult = await global.db.collection(myCollection).updateOne(
        { _id: new ObjectId(videoObjectId) }, // Use the ObjectId of the video
        { $pull: { fav_user_list: user._id } } // Use $pull to remove the user ID
      );
  
      // Log the result of the update operation
      if (updateResult.matchedCount === 1 && updateResult.modifiedCount === 1) {
        console.log(`Successfully removed user ${user._id} from fav_user_list for video ${videoObjectId}`);
      } else if (updateResult.matchedCount === 0) {
        console.log(`No media found with ID: ${videoObjectId}`);
      } else {
        console.log(`User ${user._id} was not in the fav_user_list for video ${videoObjectId}`);
      }
  
      // Return the update result
      return updateResult;
    } catch (error) {
      // If there's an error in the try block, catch it and log it
      console.error('Error removing user from fav_user_list:', error);
      throw error; // Re-throw the error to handle it further up the call stack if necessary
    }
  }
  
  // Async function to add a user to the favorite list of a media element
async function addUserToFavList(user, video_id,mode) {
  const myCollection = `medias_${mode}`
  const foundElement = await global.db.collection(myCollection).findOne({_id:new ObjectId(video_id)})

  // Log the intent to add user to the favorite list for debugging
  //console.log(`Attempting to add user ${user._id} to fav_user_list for video ${foundElement._id}`);

  try {
    // Perform the update operation
    const updateResult = await global.db.collection(myCollection).updateOne(
      { _id: foundElement._id }, // Use the _id of the foundElement
      { $addToSet: { fav_user_list: user._id } } // Use $addToSet to avoid duplicates
    );

    // Log the result of the update operation
    //console.log('Update Result:', updateResult);

    // Check if the update operation was acknowledged and a document was modified
    if (updateResult.matchedCount === 1 && updateResult.modifiedCount === 1) {
      //console.log(`Successfully added user ${user._id} to fav_user_list for video ${foundElement._id}`);
    } else if (updateResult.matchedCount === 0) {
      console.log(`No media found with ID: ${foundElement._id}`);
    } else {
      //console.log(`User ${user._id} was already in the fav_user_list for video ${foundElement._id}`);
    }

    // Return the update result
    return updateResult;
  } catch (error) {
    // If there's an error in the try block, catch it and log it
    console.error('Error adding user to fav_user_list:', error);
    throw error; // Re-throw the error to handle it further up the call stack if necessary
  }
}

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

// Update user's favorite country
router.post('/update-country', ensureAuthenticated, async (req, res) => {
  try {
    // Get the country from the request body
    const { country } = req.body;
    // Get the user ID from the request object
    const userId = new ObjectId(req.user._id);

    // Update the user's favorite country in the database
    const result = await global.db.collection('users').updateOne(
      { _id: userId },
      { $set: { favoriteCountry: country } }
    );

    // Check if the update was successful
    if (result.modifiedCount === 1) {
      //console.log(`Successfully updated favorite country for user with ID: ${userId}`);
      res.json({ status: 'success', message: 'Favorite country updated successfully' });
    } else {
      //console.log(`Failed to update favorite country for user with ID: ${userId}`);
      res.json({ status: 'error', message: 'Failed to update favorite country' });
    }
  } catch (error) {
    console.log(`An error occurred while updating favorite country: ${error}`);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
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
router.get('/downloading', async (req, res) => {
  const data = await global.db.collection('medias').find({isdl:false}).toArray()
  res.json({ data });
});

router.post('/resetDownloadStatus', async (req, res) => {
  const { itemId } = req.body
  const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(itemId)})
  await updateSameElements(foundElement,{isdl:false,isdl_data:new Date(),filePath:null})
  res.status(200).json({ message: 'Retry download item' });

})
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');


router.post('/downloadFileFromURL', async (req, res) => {

  try{
    const {url,itemID,mode} = req.body;
    const myCollection = `medias_${mode}`
    const item = await global.db.collection(myCollection).findOne({ _id: new ObjectId(itemID) })
   
    if(item && item.filePath){
      console.log(item.filePath)
      //res.json({url:item.filePath.replace('public','')})
      //return
    }
    const {fileName,filePath} = generateFilePathFromUrl('public/downloads/',url)
    console.log(`Page URL : ${url}`)
    const videoSource = await downloadVideoRedGIF(url, filePath, itemID, myCollection);
    console.log(`Downloaded : ${filePath}`)

    updateSameElements(item, myCollection, {filePath:filePath.replace('public',''), isdl:true,isdl_end:new Date()})
    res.json({url:filePath.replace('public','')})
  }catch(error){
    console.log(error)
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

router.get('/searchSubreddits', async (req, res)=> {
  const db = req.app.locals.db;
  let query=req.query.query;

  let result = await searchSubreddits(query)
  result=result.filter(item => item.r18 && item.r18.toString() == req.user.nsfw.toString())

  res.send(result)
})

// API routers for generative image AI
router.get('/current-model', async (req, res) => {
  try {
    const currentModel = await global.sdapi.getCurrentModel();
    res.json({ model: currentModel });
  } catch (err) {
    res.status(200).send({status:false,message:'Error fetching current model'});
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
    console.log(err);
    res.status(200).send({status:false,message:'Error changing model'});
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await global.db.collection('categories').find().toArray();
    res.json(categories);
  } catch (err) {
    res.status(500).send('Ahoy! Trouble fetching categories.');
  }
});
// I'm assuming you have a function that calculates the width based on the height and aspect ratio
function getWidthForAspectRatio(height, ratio) {
  const [widthRatio, heightRatio] = ratio.split(':').map(Number);
  return Math.round((height * widthRatio) / heightRatio);
}
function getClosestAllowedDimension(height, ratio) {
  const [widthRatio, heightRatio] = ratio.split(':').map(Number);
  const targetAspectRatio = widthRatio / heightRatio;

  // Define allowed dimensions
  const allowedDimensions = [
    { width: 1024, height: 1024 }, { width: 1152, height: 896 },
    { width: 1216, height: 832 }, { width: 1344, height: 768 },
    { width: 1536, height: 640 }, { width: 640, height: 1536 },
    { width: 768, height: 1344 }, { width: 832, height: 1216 },
    { width: 896, height: 1152 }
  ];

  // Sort dimensions by closeness to the target aspect ratio
  const sortedDimensions = allowedDimensions.sort((a, b) => {
    const ratioA = a.width / a.height;
    const ratioB = b.width / b.height;
    return Math.abs(ratioA - targetAspectRatio) - Math.abs(ratioB - targetAspectRatio);
  });

  // Return the first (closest) dimension
  return sortedDimensions[0];
}

//LOCAL GENERATION

const default_prompt = 'ultra realistic 8k cg, picture-perfect face, flawless, clean, masterpiece, professional artwork, famous artwork, cinematic lighting, cinematic bloom, perfect face, beautiful face, beautiful eyes, ((perfect female body, narrow waist, small breast, wide hips)),'
const default_negative_prompt = 'illustration, 3d, 2d, painting, cartoons, sketch, (worst quality:1.9), (low quality:1.9), (normal quality:1.9), lowres, bad anatomy, bad hands, vaginas in breasts, ((monochrome)), ((grayscale)), collapsed eyeshadow, multiple eyeblows, (cropped), oversaturated, extra limb, missing limbs, deformed hands, long neck, long body, imperfect, (bad hands), signature, watermark, username, artist name, conjoined fingers, deformed fingers, ugly eyes, imperfect eyes, skewed eyes, unnatural face, unnatural body, error, bad image, bad photo, worst quality, low quality:1.5), clothes, lingerie, monochrome, blurry, condom, text, logo, ((child)), ((underage)), ((teenage)), crossed eyes, plain background, futa girl, futa, Sfw censored Blurry pixelated out of frame low resolution poor quality grainy monochrome gloves, horns, lowres, disfigured, ostentatious, ugly, oversaturated, grain, low resolution, disfigured, blurry, bad anatomy, disfigured, poorly drawn face, mutant, mutated, extra limb, ugly, poorly drawn hands, missing limbs, blurred, floating limbs, disjointed limbs, deformed hands, blurred out of focus, long neck, long body, ugly, disgusting, bad drawing, childish, cut off cropped, distorted, imperfect, surreal, bad hands, text, error, extra digit, fewer digits, cropped , worst quality, missing limbs, imperfect anatomy, Oriental, Asian, shiny skin, oily skin, unrealistic lighting, fake, airbrushed skin, deformed, blur, blurry, bokeh, warp hard bokeh, gaussian, out of focus, out of frame, obese, (odd proportions, asymmetrical), super thin, fat,dialog, words, fonts, teeth, ((((ugly)))), (((duplicate))), ((morbid)), monochrome, b&w, [out of frame], extra fingers, mutated hands, ((poorly drawn hands)), ((poorly drawn face)), (((mutation))), (((deformed))), ((ugly)), blurry, ((bad anatomy)), (((bad proportions))), ((extra limbs)), cloned face, (((disfigured))), out of frame, ugly, extra limbs, (bad anatomy), ((gross proportions)), (malformed limbs), ((missing arms)), ((missing legs)), (((extra arms))), (((extra legs))), mutated hands, (fused fingers), (too many fingers), (((long neck))), (worst quality:1.5), (low quality:1.5), (normal quality:1.5), lowres, bad anatomy, bad hands, vaginas in breasts, ((monochrome)), ((grayscale)), collapsed eyeshadow, multiple eyeblows, (cropped), oversaturated, extra limb, missing limbs, deformed hands, long neck, long body, imperfect, (bad hands), signature, watermark, username, artist name, conjoined fingers, deformed fingers, ugly eyes, imperfect eyes, skewed eyes, unnatural face, unnatural body, error, painting by bad-artist, 1girl with penis, 1girl with masculine features, backlight, (worst quality, low quality:1.2), watermark, logo, bad anatomy, topless, fat, bad anatomy'

router.post('/txt2img', async (req, res) => {
  // Call this function before making your API calls
  clearGpuMemory();

  const prompt = req.body.prompt ? req.body.prompt : default_prompt;
  const negative_prompt = req.body.negativePrompt || '';
  const aspectRatio = req.body.aspectRatio;
  // Calculate the width based on the aspect ratio and the fixed height of 768
  const width = getWidthForAspectRatio(1112, aspectRatio);

  const payload = {
    prompt,
    negative_prompt,
    width, // Use the calculated width
    height: 1112, // Fixed height as provided
    sampler_name: 'Euler a',
    steps: 8,
  };

  console.log(payload)
  console.log(`Local txt2img`)
  try {
    const result = await global.sdapi.txt2img(payload);
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, result.image, aspectRatio);
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
router.post('/img2img', async (req, res) => {
  // Call this function before making your API calls
  clearGpuMemory();

  const prompt = req.body.prompt ? default_prompt + req.body.prompt : default_prompt;
  const negative_prompt = `` // req.body.negativePrompt || default_negative_prompt;
  const aspectRatio = req.body.aspectRatio;
  const imagePath = req.body.imagePath;
  const isRoop = req.query.isRoop == 'true'
  const baseFacePath = req.body.baseFace
  const roopScriptPath = path.join(__dirname, '../public/model/inswapper_128.onnx');
  if (fs.existsSync(roopScriptPath)) {
    console.log('File exists:', roopScriptPath);
  } else {
    console.log('File does not exist:', roopScriptPath);
    return res.status(400).send('Roop script not founded');
  }
  // Validate the imagePath
  if (!imagePath) {
    return res.status(400).send('An image path must be provided for img2img.');
  }

  try {
    let image; // This will hold the sharp object
    
    try {
      // Let's see if this flies as a URL
      new URL(imagePath);
      const response = await axios.get(imagePath, { responseType: 'arraybuffer' });
      image = sharp(response.data);
    } catch (error) {
      // Oops! Not a URL, must be a local path!
      image = sharp(imagePath);
    }
    // Calculate the width based on the aspect ratio and the fixed height of 768
    const metadata = await image.metadata();
    // Prepare the payload
    let payload = {
      init_images: [image],  // Using the sharp object here
      prompt,
      negative_prompt,
      width:metadata.width,
      height: metadata.height,
      strength: 0.8,
      num_inference_steps: 8,
      steps: 8,
      guidance_scale: 7.5,
      num_images_per_prompt: 1,
      eta: 0.0,
      sampler_name: 'DPM++ 2M'
    };
    console.log(payload)
    console.log(`Local img2img`)
    // Conditionally add scripts for isRoop
    if (isRoop) {
          
      let baseFace64; // This will hold the base64 string
      try {
        // Let's see if this flies as a URL
        new URL(baseFacePath);
        const response = await axios.get(baseFacePath, { responseType: 'arraybuffer' });
        baseFace = sharp(response.data);
        baseFace64 = await baseFace.clone() // Clone the sharp object to use for base64 conversion
          .jpeg() // Convert to JPEG
          .toBuffer()
          .then(buffer => buffer.toString('base64'));
      } catch (error) {
        // Oops! Not a URL, must be a local path!
        baseFace = sharp(baseFacePath);
        baseFace64 = await baseFace.clone() // Clone the sharp object to use for base64 conversion
          .jpeg() // Convert to JPEG
          .toBuffer()
          .then(buffer => buffer.toString('base64'));
      }
      const args = [baseFace64, true, '0', roopScriptPath, 'CodeFormer', 1, null, 1, 'None', false, true];
      payload["alwayson_scripts"] = { "roop": { "args": args } };
      payload["denoising_strength"] =  0.05
      payload["num_inference_steps"] =  2
    }
    

    // Call the img2img method of your API
    const result = await global.sdapi.img2img(payload);

    // Save the resulting image to the database
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, result.image, aspectRatio);

    // Ensure that the output folder exists
    await ensureFolderExists('./public/output');
    
    // Save the resulting image to a file
    const outputImagePath = `./public/output/${imageID}.png`;
    await result.image.toFile(outputImagePath);
    
    // Convert the resulting image to Base64 for the response
    const base64Image = await convertImageToBase64(outputImagePath);
    
    // Send the response
    res.json({ image_id: imageID, image: base64Image });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});

const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
const diffusionHeaders = {
  'Authorization': `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`,
  'Accept': 'image/*'
};

async function fetchStabilityMagic(data) {
  try {
    const formData = new FormData();
    formData.append('prompt', data.prompt);
    formData.append('output_format', 'jpeg');

    const response = await axios.post(
      STABILITY_API_URL,
      formData,
      {
        headers: {
          ...diffusionHeaders,
          ...formData.getHeaders(),
        },
        responseType: 'arraybuffer',
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status !== 200) {
      throw new Error(`${response.status}: ${response.data.toString()}`);
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Oopsie-daisy! Trouble in paradise: ', error.message);
    if (error.response) {
      console.error('Error response status: ', error.response.status);
      console.error('Error response headers: ', error.response.headers);
      console.error('Error response data: ', error.response.data);
    } else {
      console.error('Error without response: ', error);
    }
    throw error;
  }
}

async function transmogrifyImage(data) {
  try {
    const response = await axios.post(
      STABILITY_API_URL,
      data,
      {
        headers: {
          ...data.getHeaders(),
          Accept: 'image/*',
          Authorization: `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`
        },
        responseType: 'arraybuffer',
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status !== 200) {
      throw new Error(`The server is being a bit grumpy: ${response.status}: ${response.data ? response.data.toString() : 'No response data'}`);
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Whoops! Hit a snag: ', error.message);
    if (error.response) {
      console.error('Error response status: ', error.response.status);
      console.error('Error response headers: ', error.response.headers);
      console.error('Error response data: ', error.response.data);
    } else {
      console.error('Error without response: ', error);
    }
    throw error;
  }
}

function createStabilityPayload(imagePath, prompt) {
  const formData = new FormData();

  formData.append('init_image', fs.readFileSync(imagePath), 'init_image.png');
  formData.append('init_image_mode', 'IMAGE_STRENGTH');
  formData.append('image_strength', 0.35);
  formData.append('steps', 40);
  formData.append('seed', 0);
  formData.append('cfg_scale', 5);
  formData.append('samples', 1);
  formData.append('prompt', prompt);
  formData.append('text_prompts[0][text]', prompt);
  formData.append('text_prompts[0][weight]', 1);
  formData.append('text_prompts[1][text]', 'blurry, bad');
  formData.append('text_prompts[1][weight]', -1);

  return formData;
}


router.post('/stablediffusion/txt2img', async (req, res) => {
  const { prompt, aspectRatio } = req.body;
  const closestDimension = getClosestAllowedDimension(1024, aspectRatio);
  const stableDiffusionPayload = {
    prompt: prompt,
    width: closestDimension.width,
    height: closestDimension.height,
    steps: 20,
    seed: 0,
    cfg_scale: 5,
    samples: 1,
    text_prompts: [
      { text: prompt, weight: 1 },
      { text: 'bad,blurry', weight: -1 }
    ]
  };
  console.log(stableDiffusionPayload)
  console.log(`txt2img`)
  try {
    await ensureFolderExists('./public/output');

    const imageBuffer = await fetchStabilityMagic(stableDiffusionPayload);
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, imageBuffer, aspectRatio);

    const imagePath = `./public/output/${imageID}.png`;
    await fs.promises.writeFile(imagePath, imageBuffer);

    const base64Image = await convertImageToBase64(imagePath);
    res.json({ image_id: imageID, image: base64Image });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});


router.post('/stablediffusion/img2img', async (req, res) => {
  const { prompt, negative_prompt, aspectRatio, imagePath } = req.body;

  if (!imagePath) {
    return res.status(400).send('An image path must be provided for img2img.');
  }

  try {
    
    console.log(`img2img`)
    const stabilityPayload = createStabilityPayload(imagePath, prompt);
    const resultImageBuffer = await transmogrifyImage(stabilityPayload);
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, resultImageBuffer, aspectRatio);

    await ensureFolderExists('./public/output');
    const outputImagePath = `./public/output/${imageID}.png`;
    await fs.promises.writeFile(outputImagePath, resultImageBuffer);

    const base64ResultImage = await convertImageToBase64(outputImagePath);
    res.json({ image_id: imageID, image: base64ResultImage });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});



// Hugging Face API Configuration
const API_URL_Hugging = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
const HuggingFaceHeaders = {
  Authorization: "Bearer "+process.env.HUGGINGFACEAPI
};
async function queryHuggingFaceAPI(data) {


  try {
    const response = await fetch(API_URL_Hugging, {
      HuggingFaceHeaders,
      method: "POST",
      body: JSON.stringify(data),
    });

    // Check if the response is successful
    if (!response.ok) {
      //throw new Error(`HTTP error! status: ${response.status}`);
      throw new Error(`Non-200 response: ${await response.text()}`)

    }

    const imageBytes = await response.arrayBuffer();

    return Buffer.from(imageBytes);
  } catch (error) {
    console.error("Oops! Ran into an issue: ", error.message);
    // Handle the error based on your app's flow
    // Maybe return a default value or rethrow the error
    throw error; // or return something else
  }
}

router.post('/huggingface/txt2img', async (req, res) => {
  const prompt = req.body.prompt;
  const negative_prompt = req.body.negative_prompt;
  const aspectRatio = req.body.aspectRatio;

  // Calculate the width based on the aspect ratio and the fixed height of 512
  const width = getWidthForAspectRatio(768, aspectRatio);

  const huggingFacePayload = {
    inputs: prompt.length === 0 ? default_prompt : default_prompt+prompt,
    parameters: {
        "num_inference_steps": 20, 
        "width": width,              
        "height": 768,            
        "negative_prompt": negative_prompt.length === 0 ? default_negative_prompt : negative_prompt,
    }
  };
  const stableDiffusionPayload = {
    steps: 40,
	width: 1024,
	height: 1024,
	seed: 0,
	cfg_scale: 5,
	samples: 1,
	text_prompts: [
	  {
	    "text": prompt,
	    "weight": 1
	  },
	  {
	    "text": 'bad,blurry',
	    "weight": -1
	  }
	],
  };
  try {
    // Ensure that the output folder exists
    await ensureFolderExists('./public/output');

    const imageBuffer = await queryHuggingFaceAPI(stableDiffusionPayload);
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, imageBuffer, aspectRatio);

    const imagePath = `./public/output/${imageID}.png`;

    const fs2 = require('fs').promises; // Notice the .promises here
    await fs2.writeFile(imagePath, imageBuffer);

    const base64Image = await convertImageToBase64(imagePath);
    res.json({ image_id: imageID, image: base64Image });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});
// /img2img router
router.post('/huggingface/img2img', async (req, res) => {
  const prompt = req.body.prompt;
  const negative_prompt = req.body.negative_prompt;
  const aspectRatio = req.body.aspectRatio;
  const imagePath = req.body.imagePath;

  // Validate the imagePath
  if (!imagePath) {
    return res.status(400).send('An image path must be provided for img2img.');
  }

  // Calculate the width based on the aspect ratio and the fixed height of 768
  const width = getWidthForAspectRatio(768, aspectRatio);

  try {
    // Load and convert the image to base64 using sharp
    const imageBuffer = await sharp(imagePath)
      .resize(width, 768) // Optional: Resize to match the output dimensions
      .toBuffer();
    const base64Image = imageBuffer.toString('base64');

    // Prepare the payload for the Hugging Face API
    const huggingFacePayload = {
      inputs: {
          prompt: prompt.length === 0 ? default_prompt : prompt,  // Text prompt
          init_image: base64Image,  // Base64 encoded initial image
          negative_prompt: negative_prompt.length === 0 ? default_negative_prompt : negative_prompt,  // Negative prompt
      },
      parameters: {
          strength: 0.8,              // Transformation strength of the reference image
          num_inference_steps: 50,    // Number of denoising steps
          guidance_scale: 7.5,        // Guidance scale value
          num_images_per_prompt: 1,   // Number of images to generate per prompt
          eta: 0.0,                   // Eta parameter for DDIMScheduler
          width: width,                 // Width of the output image
          height: 768,                // Height of the output image
          // Add other parameters as needed
      }
  };
  

    // Call the Hugging Face API
    const resultImageBuffer = await queryHuggingFaceAPI(huggingFacePayload);

    // Save the resulting image to the database
    const imageID = await saveImageToDB(global.db, req.user._id, prompt, resultImageBuffer, aspectRatio);

    // Ensure that the output folder exists
    await ensureFolderExists('./public/output');
    
    // Save the resulting image to a file
    const outputImagePath = `./public/output/${imageID}.png`;
    await fs.writeFile(outputImagePath, resultImageBuffer);
    
    // Convert the resulting image to Base64 for the response
    const base64ResultImage = await convertImageToBase64(outputImagePath);
    
    // Send the response
    res.json({ image_id: imageID, image: base64ResultImage });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating image');
  }
});

router.get('/sdimage/:id', async (req, res) => {
  try {
    const imageID = req.params.id;
    const image = await getImageFromDB(db, imageID);
    if (image === "Image not found") {
      res.status(404).send("Ahoy! No image found with that ID!");
    } else {
      res.json(image);
    }
  } catch (error) {
    res.status(500).send("Oops! Something went wrong in our image quest.");
  }
});

router.get('/sdgallery', ensureAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // This is your images-per-page setting

    const base64Images = await getUserImage(req, page, limit);
    
    // Prepare the JSON response
    const response = {
      user: req.user, 
      images: base64Images, 
      currentPage: page,
      hasNextPage: base64Images.length === limit
    };

    // Send the JSON response to the client
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error retrieving user images.' });
  }
});

async function getUserImage(req, page = 1, limit = 20){
  const images = req.user.images || [];
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const paginatedImages = images.slice(startIndex, endIndex);
  const base64Images = await getImageArray(paginatedImages) ;

  return base64Images.reverse()
}

async function getImageArray(images){
  const base64Images = [];
  for (const image of images) {
    if (image && image.image_id) {
      const imagePath = `./public/output/${image.image_id}.png`;
      if (fs.existsSync(imagePath)) {
        const imageBuffer = await fs.promises.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // Retrieve the prompt from the images collection based on the image_id
        const imageCollection = db.collection('images');
        const imageDoc = await imageCollection.findOne({ _id: new ObjectId(image.image_id) });
        const prompt = imageDoc.prompt;

        base64Images.push({ image: base64Image,imagePath, prompt: prompt, imageId:image.image_id });
      }
    }
  }
  return base64Images
}
router.post('/hide', async (req, res) => {
  let { element_id, category, mode } = req.body;
  
  const myCollection = `medias_${mode}`;

  if (!element_id) {
    return res.status(400).json({ message: 'IDまたはカテゴリが提供されていません' });
  }

  if (!category) {
    const user = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりませんでした' });
    }

    let base_category = user.categories && user.categories.find(cat => cat.name === 'All');
    
    if (!base_category) {
      return res.status(404).json({ message: 'カテゴリ "All" が見つかりませんでした' });
    }

    category = [base_category.id];
  }

  try {

    const element = await global.db.collection(myCollection).updateOne(
      { _id: new ObjectId(element_id) },
      { $pull: { categories: category.toString() } }
    );
    const setHidden = await global.db.collection(myCollection).updateOne(
      { _id: new ObjectId(element_id) },
      { $set: { hidden_item: true } }
    );
    const doc = await global.db.collection(myCollection).findOne(
      { _id: new ObjectId(element_id) },
    );
    const hideMany = await global.db.collection(myCollection).updateMany(
      { imageUrl: doc.imageUrl },
      { $set: { hidden_item: true } }
    );
    res.status(200).json({ message: 'The medias is hidden' });
  } catch (err) {
    console.log('Error:', err);
    res.status(500).json({ message: 'エラーが発生しました' });
  }
});



router.post('/getTopPage', async (req, res) => {
  const {mode} = req.body
  const userId = new ObjectId(req.user._id);
  const nsfw = req.user.nsfw == 'true'
  try {

    if(mode == 5){
      let data = await ManageScraper(false,nsfw,mode,req.user, 0);
      res.status(200).json({data,status:true})
      return
    }
    const {scrapeTopPage} = require(`../modules/scraper/scrapeMode${mode}`)
    const data = await scrapeTopPage(mode)
    res.status(200).json({data})
  } catch (error) {
    res.status(500)
  }
});

router.post('/getSBtop', async (req, res) => {
  const {mode,extractor} = req.body
  const userId = new ObjectId(req.user._id);
  const nsfw = req.user.nsfw == 'true'
  try {
    const data = await scrapeWebsiteTopPageFromOtherServer(mode, nsfw, userId,extractor)
    res.status(200).json({data})
  } catch (error) {
    res.status(500)
  }
});
async function scrapeWebsiteTopPageFromOtherServer(mode, nsfw, userId,extractor) {
  try {
    // Make a POST request to the download server
    const response = await axios.post('http://192.168.10.115:3100/api/scrapeWebsiteTopPage', {
      mode, nsfw, userId,extractor
    });
    // You might want to return something here, depending on your use case

    return response.data.result;
  } catch (error) {
    // Log the error if the request fails
    console.error('Error connecting to the download server:');
    //throw error; // Optionally throw the error to be handled by the caller
  }
}
router.post('/intemInfo', async (req, res) => {

  const {mode,itemId} = req.body
  const userId = new ObjectId(req.user._id);
  try {
    const mediasCollection = global.db.collection(`medias_${mode}`);
    const media = await mediasCollection.findOne({
        _id : new ObjectId(itemId)
      });
      res.json({status:true,media}); 
  } catch (error) {
    console.log(error)
    res.json({status:false});
  }
});

router.post('/history', async (req, res) => {
  const {mode} = req.body
  const userId = new ObjectId(req.user._id);
  const nsfw = req.user.nsfw == 'true'

  try{
    const userInfo = await global.db.collection('users').findOne({_id:new ObjectId(req.user._id)})

    const medias = await findDataInMedias(userId, false, {
      mode: mode,
      nsfw: nsfw,
      hide_query: { $exists: false },
    });

    const isValidMode = (item, mode) => item.mode !== undefined && parseInt(item.mode) === parseInt(mode);
    const isRedditUrl = (item) => item.url && item.url.includes('/r/');
    const hasValidSearchTerm = (item) => item.searchterm !== undefined;

    // Filter items based on the mode and search term validity
    const filteredByMode = userInfo.scrapInfo.filter(item => isValidMode(item, mode) && hasValidSearchTerm(item));
    //console.log("Filtered by Mode:", filteredByMode);

    // Filter items based on being a Reddit URL and mode being 9
    const filteredByReddit = userInfo.scrapInfo.filter(item => parseInt(mode) === 9 && isRedditUrl(item));
    //console.log("Filtered by Reddit URL:", filteredByReddit);

    // Combine the two filtered lists, ensuring uniqueness if necessary
    const combinedResults = [...filteredByMode, ...filteredByReddit.filter(item => !filteredByMode.includes(item))];
    //console.log("Combined Filtered Results:", combinedResults);

    const data = mapArrayHistory(medias,combinedResults,mode,userInfo.scrapInfo)

    const categories = await global.db.collection('category').find({nsfw}).toArray()

    res.json({status:true,data,categories}); 
  } catch (error) {
    console.log(error)
    res.json({status:false});
  }
});
function mapArrayHistory(medias, combinedResults, mode, scrapInfo) {
  let queryMap = {};
  medias.forEach(item => {
    const itemMaxPage = findPageByUrl(scrapInfo,item.searchterm)
    if(item.searchterm && parseInt(item.page) == parseInt(itemMaxPage)){
      let key = item.searchterm.trim()

      item.searchterm.trim();
  
      if (!queryMap[key]) {
        queryMap[key] = [];
      }
  
      if (queryMap[key].length < 1 && item.hide !== true) {
        queryMap[key].push(item);
      }
    }
  });

  for (let key in queryMap) {
    if (queryMap[key].length === 0) {
        //delete queryMap[key];
    }
  }
  return queryMap
}
function findPageByUrl(scrapInfo,searchterm) {
  const result = scrapInfo.find(obj => obj.searchterm === searchterm);
  return result ? result.page : null;
}

router.post('/hideHistory', async (req, res) => {
  const { searchterm } = req.body;
  console.log('Hiding searchterm:', searchterm);
  if (!searchterm) {
    return res.status(400).json({ message: 'Search term not provided' });
  }

  const userId = req.user._id;

  try {

    // Optionally, update the medias collection to hide media associated with this searchterm
    await global.db.collection('medias').updateMany(
      { searchterm: searchterm.trim(), userId: new ObjectId(userId) },
      { $set: { hide_query: true } }
    );

    // Update the user's scrapInfo to remove or mark this searchterm as hidden
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { scrapInfo: { searchterm: searchterm.trim() } } }
    );

    console.log('Search term hidden successfully');

    res.status(200).json({ message: 'This search term will no longer be displayed' });
  } catch (err) {
    console.error('Error hiding search term:', err);
    res.status(500).json({ message: 'An error occurred' });
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
router.post('/scrapeWebsiteTopPage', async (req,res)=>{
  const userId = req.user._id;
  const {mode, nsfw}=req.body
  const  scrapeWebsiteFromOtherServer = async (mode, nsfw, userId) => {
    try {
      const response = await axios.post('http://192.168.10.115:3100/api/getVideoFromSB', {
       mode, nsfw, userId
      });
      // You might want to return something here, depending on your use case
  
      return response.data.result;
    } catch (error) {
      // Log the error if the request fails
      console.error('Error connecting to the download server:');
      //throw error; // Optionally throw the error to be handled by the caller
    }
  }
  try {
      const data = await scrapeWebsiteFromOtherServer(mode, nsfw, userId)
      console.log(data)
      res.status(200).json({data,status:true})
  } catch (error) {
    res.status(500).json({data,status:false})
  }

});

router.get('/userID',(req,res)=>{
  return req.user._id;
})

router.post('/reboot-port', (req, res) => {
  console.log('Reboot request received');
  
  // Commands to stop and restart the service running on port 3000
  const stopCommand = 'sudo systemctl stop rakubun-dl';
  const startCommand = 'sudo systemctl start rakubun-dl';  

  // First, stop the service
  exec(stopCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error stopping the service: ${error.message}`);
      return res.status(500).send('Failed to stop the service: ' + error.message);
    }
    if (stderr) {
      console.error(`stderr while stopping: ${stderr}`);
      return res.status(500).send('Error output while stopping: ' + stderr);
    }
    console.log(`Service stopped. stdout: ${stdout}`);

    // Then, start the service
    exec(startCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting the service: ${error.message}`);
        return res.status(500).send('Failed to start the service: ' + error.message);
      }
      if (stderr) {
        console.error(`stderr while starting: ${stderr}`);
        return res.status(500).send('Error output while starting: ' + stderr);
      }
      console.log(`Service restarted. stdout: ${stdout}`);
      res.send('Port 3000 has been closed and reopened.');
    });
  });
});

async function saveImageToDB(db, userID, prompt, image, aspectRatio) {
  const imageID = new ObjectId();
  const collection = db.collection('images');
  await collection.insertOne({
    _id: imageID,
    user_id: userID,
    prompt,
    aspectRatio
  });
    // Save the image in the user's document
    const userCollection = db.collection('users');
    await userCollection.updateOne(
      { _id: new ObjectId(userID) },
      { $push: { images: { image_id: imageID } } }
    );
  
  return imageID;
}
async function getImageFromDB(db, imageID) {
  const collection = db.collection('images');
  const image = await collection.findOne({ _id: new ObjectId(imageID) });
  return image || "Image not found"; // In case the image ID plays hide and seek and isn't found
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