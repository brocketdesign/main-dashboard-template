const express = require('express');
const { YoutubeTranscript } = require('youtube-transcript');
const natural = require('natural');
const { Configuration, OpenAIApi } = require('openai');
const {formatDateToDDMMYYHHMMSS,findElementIndex,saveData} = require('../services/tools')


// Initialize OpenAI with your API key
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function getTranscript(videoId) {
  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  const text = transcript.map(t => t.text).join(' ');
  return text;
}

function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text);
  return words;
}

async function summarizeText(text) {
    let summary = '';
    
    const gptResponse = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `以下の内容を要約してください \n\n${text}\n\n そして、主要なポイントの短い段落にし、リストの中で簡潔にハイライトされた情報にまとめてください。各ハイライトには適切な絵文字を選んでください。
      あなたの出力は以下のテンプレートを使用してください:
            <h3> 要約 </h3>
            <h3> ハイライト </h3>
            <h3> 結論 </h3>
            - [絵文字] バレットポイント
      `,
      max_tokens: 1000,
      temperature: 0,
    });
    
    return gptResponse.data.choices[0].text.trim();
}


  function chunkText(text, maxTokens) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';
  
    for (const word of words) {
      // +1 for the space
      if ((currentChunk + ' ' + word).length > maxTokens) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk += ' ' + word;
      }
    }
  
    // Push the last chunk
    if (currentChunk !== '') {
      chunks.push(currentChunk);
    }
  
    return chunks;
  }

async function summarizeVideo(user,videoId) {
  const checkSUmmary = await isSummarized (user,videoId)
  if (checkSUmmary){
    console.log('Video has already been summarized')
    return {summary:checkSUmmary.summary}
  }

  console.log('Summarizing the video')
  const transcript = await getTranscript(videoId);
  const keywords = extractKeywords(transcript);
  const chunks = chunkText(transcript, 3946);
  const summaries = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Summarize section ${i + 1}/${chunks.length}`);
    const summary = await summarizeText(chunks[i]);
    summaries.push(summary);
}

  
  const combinedSummary = summaries
  .map((summary, index) => `<h2> パート ${index + 1}</h2><br>${summary}`)
  .join('<br>');

  return { summary: combinedSummary, keywords };
}

async function isSummarized (user,videoId) {

  const { elementIndex, foundElement } = await findElementIndex(user,videoId);
  if(foundElement.summary){
    return foundElement
  }
  return false

}

// Usage
/*
summarizeVideo('PIrkVICLhkM')
  .then(result => console.log(result.summary))
  .catch(err => console.error(err));
*/

module.exports = summarizeVideo
