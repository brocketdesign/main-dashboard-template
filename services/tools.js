const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');


// Initialize OpenAI with your API key
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

function formatDateToDDMMYYHHMMSS() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).substr(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ddmmyyhhmmss = `${day}${month}${year}${hours}${minutes}${seconds}`;
  return ddmmyyhhmmss;
}

async function findElementIndex(user,video_id){
  const userId = user._id;
  const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  const AllData = userInfo.scrapedData || [] ;
  const foundElement = AllData.find(item => item.video_id === video_id);
  const elementIndex = AllData.findIndex(item => item.video_id === video_id);
  return {elementIndex,foundElement};
}


async function saveData(user, documentId, update){
  try {
    console.log(documentId)
    const { elementIndex, foundElement } = await findElementIndex(user, documentId);

    if (elementIndex === -1) {
      console.log('Element with video_id not found.');
      return;
    }

    const userId = user._id;
    const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
    const AllData = userInfo.scrapedData || [];
    AllData[elementIndex] = Object.assign({}, AllData[elementIndex], update);

    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { scrapedData: AllData } }
    );

    return true
  } catch (error) {
    console.log('Error while updating element:', error);
    return false
  }
}

async function translateText(text,lang) {
  let summary = '';
  
  const gptResponse = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Translate the following text in ${lang} :${text} `,
    max_tokens: 1000,
    temperature: 0,
  });
  
  return gptResponse.data.choices[0].text.trim();
}

module.exports = { formatDateToDDMMYYHHMMSS, findElementIndex, saveData ,translateText }