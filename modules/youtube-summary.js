const express = require('express');
const { YoutubeTranscript } = require('youtube-transcript');
const natural = require('natural');
const { Configuration, OpenAIApi } = require('openai');
const {formatDateToDDMMYYHHMMSS,findElementIndex,saveData, fetchOpenAICompletion} = require('../services/tools')


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

  return chunks
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
