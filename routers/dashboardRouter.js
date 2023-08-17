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
  res.render(`chatgpt-${req.params.app}.pug`, { user:req.user, title:'ChatGPT '+req.params.app });
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

  console.log('Dashboard page requested');
  const { mode } = req.params; // Get the 'mode' parameter from the route URL
  let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
  nsfw = req.user.nsfw === 'true'?true:false
  page = parseInt(page) || 1

  if(!searchTerm){
    res.redirect(`/dashboard/app/${mode}/history`); // Pass the user data and scrapedData to the template
    return
  }
  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';

  let scrapedData = await ManageScraper(searchTerm,nsfw,mode,req.user, page);

  res.render(`search`, { user: req.user, searchTerm, scrapedData, mode, page, title: `Mode ${mode} : ${searchTerm}` }); // Pass the user data and scrapedData to the template
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/fav', ensureAuthenticated,ensureMembership, async (req, res) => {

  console.log('Dashboard page requested');
  const { mode } = req.params; // Get the 'mode' parameter from the route URL
  let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
  nsfw = req.user.nsfw === 'true'?true:false
  page = parseInt(page) || 1

  if(!searchTerm){
    res.redirect(`/dashboard/app/${mode}/history`); // Pass the user data and scrapedData to the template
    return
  }
  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';

  let scrapedData = await getUserScrapedData(req.user, searchTerm, mode, nsfw, page) ;

  if (mode == 4) {
    //check for object with the same source and keep only one
    let uniqueData = [];
    let seenSources = new Set();
    
    for (let item of scrapedData) {
        if (!seenSources.has(item.source)) {
            seenSources.add(item.source);
            uniqueData.push(item);
        }
    }
    
    scrapedData = uniqueData; // Now, scrapedData contains unique items based on the source property.
  }
  
  res.render(`search`, { user: req.user, searchTerm, scrapedData:scrapedData.reverse(), mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template
});
// Helper function to get user's scraped data based on criteria
function getUserScrapedData(user, url, mode, nsfw, page) {
  let userScrapedData = user.scrapedData || [];
  let userScrapedDataWithCurrentPage;

  if(url){
    userScrapedDataWithCurrentPage = userScrapedData.filter(item => 
       item.query == url && 
       item.mode == mode && 
       item.nsfw == nsfw && 
       !item.hide && 
       //item.page == page &&
       item.filePath
      );
  }else{
    userScrapedDataWithCurrentPage = userScrapedData.filter(item => 
        item.mode == mode && 
        item.nsfw == nsfw && 
        !item.hide && 
        //item.page == page &&
        item.filePath
    ); 
  }
  return userScrapedDataWithCurrentPage.slice(0,50);
}

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/history', ensureAuthenticated, ensureMembership, async (req, res) => {

console.log('Dashboard history page requested');
const { mode } = req.params; // Get the 'mode' parameter from the route URL

// If 'mode' is not provided, use the mode from the session (default to '1')
const currentMode = mode || req.session.mode || '1';
const userId = new ObjectId(req.user._id);
try {
// Assuming you have the MongoDB client instance available as global.db
const userInfo = await global.db.collection('users').findOne({ _id: userId });

if (userInfo) {
  const scrapedData = userInfo.scrapedData || []; // Get the scrapedData array from userInfo
  const nsfw = req.user.nsfw === 'true'
  let data = []
  try {
    // Filter the scrapedData array based on the 'mode'
    const filteredData = scrapedData.filter(item => item.mode === mode && item.nsfw === nsfw && item.hide_query != true);
    // Create an object where the key is the 'query' and the value is an array of up to four items matching that 'query'.
    const queryMap = filteredData.reduce((acc, item) => {
      if (!item.query) {
        // If item.query is not defined or is falsy, skip to the next item.
        return acc;
      }
    
      const key = `${item.query}${item.page}`; // Combine query and page to create the key
    
      if (!acc[key]) {
        acc[key] = []; // If this combined key is not already in the object, add it with an empty array as the value.
      }
    
      if (acc[key].length < 4) {
        // If the array for this combined key has less than four items, add the current item.
        if (item.hide !== true) {
          acc[key].push(item);
        }
      }
    
      return acc;
    }, {});
    
    // Sort the items in each array by the 'page' property
    for (const key in queryMap) {
      queryMap[key].sort((a, b) => a.page - b.page);
    }
    
    data = queryMap;
  } catch (error) {
    console.log(error)
  }

  res.render('history', { user: req.user, data, mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

} else {
  console.log('User not found in the database.');
  res.status(500).send('User not found in the databaser');
}

} catch (err) {
    console.error('Error while querying the database:', err);
    res.status(500).send('Internal Server Error');
}
});

module.exports = router;
