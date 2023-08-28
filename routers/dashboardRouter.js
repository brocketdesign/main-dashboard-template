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
  filterHiddenElement,
  getOpenaiTypeForUser,
  initCategories
} = require('../services/tools')

const ManageScraper = require('../modules/ManageScraper');

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
  console.log(userOpenaiDocs)
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

  try {
      // Retrieve categories from MongoDB
      const categories = await global.db.collection('categories').find().toArray();
      const models = await global.sdapi.getSdModels()
  
      res.render('stable-diffusion-index', { user:req.user, categories,models,mode:'stable-diffusion', title:'Stable Diffusion' });
  
  } catch (error) {
    console.log('error')
    req.flash('error','Stable diffusion API is not ready')
    res.redirect('/dashboard/app/stable-diffusion/gallery')
  }
  });
  
router.get('/app/stable-diffusion/gallery', ensureAuthenticated,ensureMembership, async (req, res) => {
  try {
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

          base64Images.push({ image: base64Image, prompt: prompt });
        }
      }
    }

    // Render the gallery page with the retrieved image data
    res.render('stable-diffusion-gallery', { user: req.user, images: base64Images, mode:'stable-diffusion', title:'Stable Diffusion Gallery' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving user images.');
  }
});

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

// Route for handling '/dashboard/:mode'
router.get('/app/:mode', ensureAuthenticated,ensureMembership, async (req, res) => {

  try {
      const { mode } = req.params; // Get the 'mode' parameter from the route URL
      let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
      nsfw = req.user.nsfw === 'true'?true:false
      page = parseInt(page) || 1
    
      console.log(`Dashboard mode ${mode} requested`);
    
      if(!searchTerm){
        res.redirect(`/dashboard/app/${mode}/history`); // Pass the user data and scrapedData to the template
        return
      }
      // If 'mode' is not provided, use the mode from the session (default to '1')
      const currentMode = mode || req.session.mode || '1';
    
      await initCategories(req.user._id)
      let scrapedData = await ManageScraper(searchTerm,nsfw,mode,req.user, page);

      let scrapInfo  
      try {
        scrapInfo = req.user.scrapInfo.find(info => info.url === searchTerm);
        console.log({scrapInfo})
      } catch (error) {
        console.log(error)
      }
      res.render(`search`, { user: req.user, result:true, searchTerm, scrapedData, scrapInfo, mode, page, title: `Mode ${mode} : ${searchTerm}` }); // Pass the user data and scrapedData to the template
    
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred while scraping.');
  }
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/fav', ensureAuthenticated,ensureMembership, async (req, res) => {

  console.log('Dashboard page requested');
  const { mode } = req.params; // Get the 'mode' parameter from the route URL
  let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
  nsfw = req.user.nsfw === 'true'?true:false
  page = parseInt(page) || 1

  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';

  try{
    let query_obj = {
      query: {
        $regex: searchTerm,
      },
      mode:mode,
      nsfw:nsfw,
      isdl:true,
    }
    if(!searchTerm){
      console.log('Should see all')
      query_obj = {
        mode:mode,
        nsfw:nsfw,
        isdl:true,
      }
    }
    let medias = await findDataInMedias(req.user._id, query_obj);
    console.log(`Found ${medias.length} element(s).`)
    medias = getUniqueElementBySource(medias)
    res.render(`search`, { user: req.user,result:true, searchTerm, scrapedData:medias.reverse(), mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template

  }catch(err){
    console.log(err)
    res.render(`search`, { user: req.user, searchTerm, scrapedData:[], mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template

  }
  
});

function getUniqueElementBySource(medias) {
  // Map the sources and filter those that are undefined
  const undefinedSources = medias.filter(object => object.link === undefined);

  let uniqueData = [];
  let seenSources = new Set();
  
  for (let item of medias) {
    if (item.link === undefined) {
        continue; // Skip undefined sources, as we've already collected them
    }
    
    if (!seenSources.has(item.link)) {
        seenSources.add(item.link);
        uniqueData.push(item);
    }
}

  // Combine unique data with the undefined sources
  return [...uniqueData, ...undefinedSources]; // Now, the return value contains unique items based on the source property and all items with an undefined source.
}


// Route for handling '/dashboard/:mode'
router.get('/app/:mode/history', ensureAuthenticated, ensureMembership, async (req, res) => {

  console.log('Dashboard history page requested');
  const { mode, categoryId } = req.params; // Get the 'mode' parameter from the route URL

  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';
  const userId = new ObjectId(req.user._id);

  const nsfw = req.user.nsfw === 'true'

  try{

    const medias = await findDataInMedias(userId, {
      mode: mode,
      nsfw: nsfw,
      hide_query: { $exists: false },
    }, categoryId);

    console.log(`Found ${medias.length} items.`)
    const data = mapArrayHistory(medias)
    const userOpenAi = await mapArrayOpenai(req.user)
    res.render('history', { user: req.user,userOpenAi, data, mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

  } catch (error) {
    console.log(error);
    res.render('history', { user: req.user, data:[], mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

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

function mapArrayHistory(medias) {
  let highestPagePerQuery = {}; // Map to keep track of the highest page for each query
  let queryMap = {};

  medias.forEach(item => {
    if (!item.query) return;

    const page = parseInt(item.page);

    // If this is the highest page for this query, update highestPagePerQuery
    if (!highestPagePerQuery[item.query] || page > highestPagePerQuery[item.query]) {
      highestPagePerQuery[item.query] = page;
    }
  });

  // Iterate through filteredData again, adding items to queryMap only if they are on the highest page for that query
  medias.forEach(item => {
    if (!item.query) return;

    const page = parseInt(item.page);

    if (page === highestPagePerQuery[item.query]) {
      const key = item.query;
      if (!queryMap[key]) {
        queryMap[key] = [];
      }

      if (queryMap[key].length < 4 && item.hide !== true) {
        queryMap[key].push(item);
      }
    }
  });

  return queryMap; // Return an object with one set of data for each query, containing the items for the highest page
}
module.exports = router;
