const express = require('express');
const router = express.Router();

const fs = require('fs');
const { ObjectId } = require('mongodb');

const BasicPlan = {
  id: process.env.STRIPE_BASIC_PLAN,
  price: process.env.STRIPE_BASIC_PLAN_PRICE,
  type: process.env.STRIPE_BASIC_PLAN_TYPE
}
const PremiumPlan = {
  id: process.env.STRIPE_PREMIUM_PLAN,
  price: process.env.STRIPE_PREMIUM_PLAN_PRICE,
  type: process.env.STRIPE_PREMIUM_PLAN_TYPE
}

const ensureAuthenticated = require('../middleware/authMiddleware');
const ensureMembership = require('../middleware/ensureMembership');
const { 
  findDataInMedias, 
  findTotalPage,
  filterHiddenElement,
  getOpenaiTypeForUser,
  initCategories
} = require('../services/tools')

const {ManageScraper,AsyncManageScraper} = require('../modules/ManageScraper');

// Route for handling '/dashboard/'
router.get('/', ensureAuthenticated,ensureMembership, async (req, res) => {
  const userId = req.user._id;
  const latestNews = await global.db.collection('latestNews').find().limit(2).toArray();

  // Fetch all book IDs associated with the user
  const userBooks = await global.db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { bookIds: 1 } });

  let books = [];

  if (userBooks && userBooks.bookIds && userBooks.bookIds.length > 0) {
      // Fetch all books' details associated with the user using the bookIds
      books = await global.db.collection('books').find({ _id: { $in: userBooks.bookIds.map(id => new ObjectId(id)) } }).sort({_id:-1}).toArray();
  }
  books = books.slice(0,3)


  // Fetch all memo IDs associated with the user
  const userMemos = await global.db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { memoIds: 1 } });

  let memos = [];

  if (userMemos && userMemos.memoIds && userMemos.memoIds.length > 0) {
      // Fetch all memos' details associated with the user using the memoIds
      memos = await global.db.collection('memo').find({ _id: { $in: userMemos.memoIds.map(id => new ObjectId(id)) } }).sort({_id:-1}).toArray();
  }
  memos = memos;

  res.render('dashboard-top',{user:req.user,latestNews,books,memos,title:"Dashboadr"});
});
// ChatGPT
router.get('/app/openai/ebook/:bookId', ensureAuthenticated, ensureMembership, async (req, res) => {
  const bookId = req.params.bookId;

  // Fetch the book details from the 'books' collection
  const bookDetails = await global.db.collection('books').findOne({ _id: new ObjectId(bookId) });

  if (!bookDetails) {
      return res.redirect('/dashboard/app/openai/ebook');
  }

  res.render('chatgpt-ebook.pug', { user: req.user, bookId, book:bookDetails, title: 'ChatGPT ' + bookDetails.title});
});

router.get('/app/openai/ebook', ensureAuthenticated, ensureMembership, async (req, res) => {
  const userId = req.user._id;

  // Fetch all book IDs associated with the user
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { bookIds: 1 } });
  
  let books = [];

  if (user && user.bookIds && user.bookIds.length > 0) {
      // Fetch all books' details associated with the user using the bookIds
      books = await global.db.collection('books').find({ _id: { $in: user.bookIds.map(id => new ObjectId(id)) } }).sort({_id:-1}).toArray();
  }

  res.render('chatgpt-ebook.pug', { user: req.user, books, title: 'User Books' });
});


router.get('/app/openai/:app', ensureAuthenticated, ensureMembership, async (req, res) => {
  //await global.db.collection('openai').deleteMany()
  const userOpenaiDocs = await getOpenaiTypeForUser(req.user._id, req.params.app);
  res.render(`chatgpt-${req.params.app}.pug`, { user:req.user,userOpenaiDocs, title:'ChatGPT '+req.params.app });
});
async function getBookById(userId, bookId) {
  // Connect to the users collection
  const collection = global.db.collection('users');

  // Find the user with the specified book ID
  const user = await collection.findOne(
      { _id: new ObjectId(userId), "books.book.book_id": bookId },
      { projection: { "books.$": 1 } }  // Project only the matching book
  );

  // If the user is found and has the book, return the book details
  if (user && user.books && user.books.length > 0) {
      return user.books[0].book;
  }

  // If no matching book is found, return null
  return null;
}
// Stable diffusion 
router.get('/app/stable-diffusion', ensureAuthenticated, ensureMembership, async (req, res) => {
  let API = null
  let models = []
  try{
     models = await global.sdapi.getSdModels()
  }catch(err){
    API = `stablediffusion`
  }
  try {
      let base64Images = await getUserImage(req)
      base64Images = base64Images.slice(0,10)
      res.render('stable-diffusion-index', { user:req.user,API,models,images:base64Images,mode:'stable-diffusion', title:'Stable Diffusion' });
  
  } catch (error) {
    console.log(error)
    req.flash('error','Stable diffusion API is not ready')
    res.redirect('/dashboard/app/stable-diffusion/gallery')
  }
  });
  
router.get('/app/stable-diffusion/gallery', ensureAuthenticated,ensureMembership, async (req, res) => {
  try {
    const base64Images = await getUserImage(req)
    // Render the gallery page with the retrieved image data
    res.render('stable-diffusion-gallery', { user: req.user, images: base64Images, mode:'stable-diffusion', title:'Stable Diffusion Gallery' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving user images.');
  }
});

async function getUserImage(req){
  const images = req.user.images || [];
  // Convert the image data to base64
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

        base64Images.push({ image: base64Image, prompt: prompt, imageId:image.image_id });
      }
    }
  }
  return base64Images.reverse()
}

const Parser = require('rss-parser');
const parser = new Parser();

const feedUrls = [
  'https://business.nikkei.com/rss/sns/nb.rdf',
  'https://www.nhk.or.jp/rss/news/cat1.xml',
  'https://www.nhk.or.jp/rss/news/cat6.xml'
];

router.get('/app/news', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const feeds = await Promise.all(feedUrls.map(url => parser.parseURL(url)));
    res.render('news', { user: req.user, feeds, mode: 'news', title: 'ニュース' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving news.');
  }
});
// Function to check if the browser is Safari
const isSafari = (userAgent) => {
  return /^((?!chrome|android).)*safari/i.test(userAgent);
};


router.get('/app/actresses', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const { actressesList, searchActresses } = require('../modules/actressesList');
    const page = parseInt(req.query.page )|| 1
    const searchterm = req.query.searchterm || false
    const debut = req.query.debut || false
    try {
      if(searchterm){
        let actresses = await searchActresses(searchterm)
        res.render('actresses/list', { user: req.user, actresses, page, mode: 'actresses'});
        return
      }
      let actresses = await actressesList(page)
      if(debut){
        actresses = await filterData('actresses',{debut})
      }
      res.render('actresses/list', { user: req.user, actresses, page, mode: 'actresses'});
    } catch (error) {
      console.log(error)
      res.render('actresses/list', { user: req.user, actresses:[], page, mode: 'actresses'});
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving news.');
  }
});
async function filterData(coll,query){
  return await global.db.collection(coll).find(query).toArray()
}
router.get('/app/actresses/profile/:actressID', ensureAuthenticated, ensureMembership, async (req, res) => {
    const page = parseInt(req.query.page) || 1
  try {
    const { actressesProfile, getActressInfoData } = require('../modules/actressesProfile');
    const actressID = req.params.actressID
    const actress_info = await getActressInfoData(actressID)
    const actressData = await actressesProfile(actressID,page)
    res.render('actresses/profile', { user: req.user, actress_info,actressData, page, mode: 'profile'});
  } catch (err) {
    console.error(err);
    res.render('actresses/profile', { user: req.user, actress_info:[], actressData:[], page, mode: 'profile'});
  }
});
// Route for handling '/dashboard/:mode'
router.get('/app/:mode', ensureAuthenticated,ensureMembership, async (req, res) => {
  try {
      const { mode } = req.params; 
      let { searchterm, nsfw, page } = req.query; 
      nsfw = req.user.nsfw === 'true'?true:false
      page = parseInt(page) || 1


      if(!searchterm){
        res.redirect(`/dashboard/app/${mode}/history`); // Pass the user data and scrapedData to the template
        return
      }
      
      res.render(`search`, { 
        user: req.user,
        searchterm, 
        mode, 
        page, 
        title: `Mode ${mode} : ${searchterm}` 
      });

  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred while scraping.');
  }
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/fav', ensureAuthenticated,ensureMembership, async (req, res) => {

  const { mode } = req.params; // Get the 'mode' parameter from the route URL
  let { searchterm, nsfw, page } = req.query; // Get the search term from the query parameter
  nsfw = req.user.nsfw === 'true'?true:false
  page = parseInt(page) || 1

  res.render(`search`, { 
    user: req.user,
    favmode:true, 
    fav:true,
    searchterm, 
    mode, 
    page, 
    title: `Mode ${mode} : ${searchterm}` 
  });
  
});
// Function to get unique elements from the medias array based on fields 'url', 'link', 'source'
function getUniqueElement(medias) {
  console.log("Initial medias array:", medias);

  let result = [];  // Initialize the result array
  let seenIds = new Set();  // Keep track of unique identifiers

  // Loop through each type to filter unique elements
  for (let type of ['url', 'link', 'source']) {
    console.log(`Filtering based on type: ${type}`);
    
    const filteredElements = elementFilter(type, medias);
    
    // Add to result only if the item's id is not already seen
    for (let item of filteredElements) {
      const id = item._id.toString(); // Assuming each item has a unique _id field

      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push(item);
      }
    }
  }
  
  console.log("Final result array:", result);
  return result;  // Return the final result
}

// Function to filter elements based on a specific type
function elementFilter(type, medias) {
  console.log(`Inside elementFilter for type: ${type}`);
  
  // Filter out the elements where the specified type field is undefined
  const undefinedSources = medias.filter(object => object[type] === undefined);
  console.log("Elements with undefined sources:", undefinedSources);

  let uniqueData = [];  // To store unique elements
  let seenSources = new Set();  // To keep track of already seen sources

  // Loop through the medias array
  for (let item of medias) {
    // Skip the item if the type field is undefined
    if (item[type] === undefined) {
      continue;
    }
    
    // If the source is not seen before, add it to the Set and to the uniqueData array
    if (!seenSources.has(item[type])) {
      console.log(`Adding unique item: ${item[type]}`);
      seenSources.add(item[type]);
      uniqueData.push(item);
    }
  }

  // Combine uniqueData with the undefinedSources
  let combinedData = [...uniqueData, ...undefinedSources];
  console.log("Combined Data:", combinedData);
  
  return combinedData;
}

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/history', ensureAuthenticated, ensureMembership, async (req, res) => {

  const { mode } = req.params; // Get the 'mode' parameter from the route URL

  try{

    res.render('history', { user: req.user, mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

  } catch (error) {
    console.log(error);
    res.render('history', { user: req.user, mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

  }

});

async function mapArrayOpenai(user){
  const summarize = user.openai_summarize

  const all_summarize = await findAllOpenAI(summarize)
  const info_summarize = await findAllData(all_summarize)

  return info_summarize
}
async function findAllOpenAI(data){
  let result = [];
  try {
    // Get a reference to the 'openai' collection
    const collection = global.db.collection('openai');

    // Convert string IDs to ObjectIds
    const objectIds = data.map(id => new ObjectId(id));

    // Find all matching documents in the 'openai' collection
    result = await collection.find({
      '_id': { '$in': objectIds }
    }).toArray();


    // Extract the videoId fields into a new array
    result = result.map(doc => doc.videoId);

    // If no documents are found
    if(result.length === 0) {
      console.log("一致するドキュメントはありません。"); // No matching documents
    }

    return result
  } catch (err) {
    console.error("データベースエラー:", err); // Database error
  }
}
async function findAllData(data){
  let result = [];
  try {
    // Get a reference to the 'openai' collection
    const collection = global.db.collection('medias');

    // Convert string IDs to ObjectIds
    const objectIds = data.map(id => new ObjectId(id));

    // Find all matching documents in the 'openai' collection
    result = await collection.find({
      '_id': { '$in': objectIds }
    }).toArray();

    // If no documents are found
    if(result.length === 0) {
      console.log("一致するドキュメントはありません。"); // No matching documents
    }

    return result
  } catch (err) {
    console.error("データベースエラー:", err); // Database error
  }
}


module.exports = router;
