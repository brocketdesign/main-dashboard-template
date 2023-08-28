const express = require('express');
const router = express.Router();
const multer  = require('multer');
const upload = multer();

const summarizeVideo = require('../modules/youtube-summary')
const { 
    fetchOpenAICompletion,
    saveDataSummarize } = require('../services/tools')
const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

router.post('/:type', upload.none(), async (req, res) => {

    const type = req.params.type;
    const videoId = req.query.videoId;
    
    console.log(`Save ${type} data for ${videoId}`)
    console.log('Received data: ',req.body)
  
    try {
      const result = await global.db.collection('openai').insertOne({ 
        userID:req.user._id, 
        data:req.body,
        type,
        videoId
      });
  
      const insertedId = result.insertedId;
      
      global.db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        { $push: {[`openai_${type}`]: insertedId } }
      );
  
      res.json({
        redirect: `/api/openai-video/stream/${type}?id=${insertedId}`,
        insertedId: insertedId
      });
  
    } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
    }
  });

// Define the /openai/summarize route
router.get('/stream/:type', async (req, res) => {
    const type = req.params.type;
    const id = req.query.id;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.flushHeaders(); // Flush the headers to establish the SSE connection
  
    console.log('Received request to '+ type);

    try {
        // Fetch the prompt from the database using the provided id
        const record = await global.db.collection('openai').findOne({ _id: new ObjectId(id) });
        console.log({record})
        if (!record) {
            res.write('data: {"error": "Record not found"}\n\n');
            res.end();
            return;
        }
        const videoId = record.videoId
        const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})
        const title = foundElement.title
        console.log(`Title fetched for video: ${title}`);
        
        const data = record.data
        const chunks = await summarizeVideo(req.user,videoId);

      if (Array.isArray(chunks)) {
        // chunks is an array
        const summaries = [];
  
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Generating section ${i + 1}/${chunks.length}`);
          const prompts = {
                'summarize' : {
                    'jp' : `以下の内容を要約してください \n\n${chunks[i]}\n\n そして、主要なポイントの短い段落にし、リストの中で簡潔にハイライトされた情報にまとめてください。各ハイライトには適切な絵文字を選んでください。\n\n あなたの出力は以下のテンプレートを使用してください:\n要約\nハイライト\n結論\n[絵文字] バレットポイント\n\nNote: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.`,
                    'en' : `Please summarize the following content:\n${chunks[i]}\nThen, create short paragraphs of the main points and summarize the information in concise highlighted points within a list. Please choose appropriate emojis for each highlight.\n\nUse the following template for your output:\n\nSummary\nHighlights\nConclusion\n[Emoji] Bullet Point\n\nNote: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.`
                },
                'snsContent' :{
                    'jp' :`SNSの選択肢に合わせて魅力的な投稿を作成したいと考えています。主要な言語は ${data.language} で、コアメッセージは「${chunks[i]}」。${data.keywordsArray && data.keywordsArray.length > 0?`投稿に関連するキーワードは ${data.keywordsArray.join(', ')}。`:''}ハッシュタグも統合したいです。コメントや翻訳以外の要素なしで、投稿のみをお願いします！`,
                    'en' :`I am looking to craft an engaging post for ${data.snsChoice}. \nThe primary language of my audience is ${data.language}. Write the post in ${data.language}.\n${data.message!=''?`The core message I want to convey is: "${chunks[i]}"`:''}. \n${data.keywordsArray && data.keywordsArray.length>0?`To give you more context, here are some keywords related to my post: ${data.keywordsArray.join(', ')}. `:''}\n\nAnd, I'd like to possibly integrate hashtags.\n\nRespond with the post only, no coments,no translation if not asked !`
                },
                'qa': {
                    'jp': `以下の内容について、5つの質問とその回答を作成してください。\n\n${chunks[i]}\n\n質問と回答は明確で短いものにしてください。Markdown形式で回答してください。注: コメント、翻訳は明示的に要求されない限り不要です。`,
                    'en': `Please create a Q&A consisting of 5 questions and their answers based on the following content:\n\n${chunks[i]}\n\nMake the questions and answers clear and concise. Respond using markdown. Note: Provide the post content only—no comments, no translations unless explicitly requested.`
                  },
                'important': {
                'jp': `以下の内容から重要なポイントを抽出してください。\n\n${chunks[i]}\n\n重要なポイントを箇条書きで明確にしてください。Markdown形式で回答してください。注: コメント、翻訳は明示的に要求されない限り不要です。`,
                'en': `Please extract the important points from the following content:\n\n${chunks[i]}\n\nList the important points clearly in bullet points. Respond using markdown. Note: Provide the post content only—no comments, no translations unless explicitly requested.`
                }
                  
                  
            }
            let prompt = prompts[type][data.language]
          const messages = [
            { role: 'system', content: data.language == 'jp' ? 'あなたは強力な日本語アシスタントです。':'You are a powerful assistant' },
            { role: 'user', content: prompt },
          ];
        
          const summary = await fetchOpenAICompletion(messages, res);
          summaries.push(summary);
          res.write(`data: ${JSON.stringify({ content: "<br><br>" })}\n\n`);
        res.flush(); // Flush the response to send the data immediately
        }

        const combinedSummary = summaries
        .map((summary, index) => `<h2> パート ${index + 1}</h2><br>${summary}`)
        .join('<br>');
  
        console.log({combinedSummary})

        const myObject = {
        openai: {
            [type]: combinedSummary
        }
        };
        saveDataSummarize(videoId, myObject)
      }
  
      res.write('event: end\n');
      res.write('data: {"videoId": "'+videoId+'"}\n\n');
      res.flush(); // Flush the response to send the data immediately
      res.end();

    } catch (err) {
        console.error('Error encountered:', err);
        res.write('data: {"error": "Internal server error"}\n\n');
        res.end();
    }
  });

module.exports = router;
