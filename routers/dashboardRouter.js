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
    // Redirect to 'mode 1'
    res.redirect('/dashboard/app/1');
});
// ChatGPT
router.get('/app/openai/:app', ensureAuthenticated, ensureMembership, async (req, res) => {
  res.render(`chatgpt-${req.params.app}.pug`, { user:req.user, title:'ChatGPT' });
});
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
    console.log({ searchTerm, nsfw, page } )

    // If 'mode' is not provided, use the mode from the session (default to '1')
    const currentMode = mode || req.session.mode || '1';

    let scrapedData = await ManageScraper(searchTerm,nsfw,mode,req.user, page);

    res.render(`search`, { user: req.user, searchTerm, scrapedData, mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template
});

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
    const filteredData = scrapedData.filter(item => item.mode === mode && item.nsfw === nsfw);
    // Create an object where the key is the 'query' and the value is an array of up to four items matching that 'query'.
    const queryMap = filteredData.reduce((acc, item) => {
      if(!item.query){
        // If item.query is not defined or is falsy, skip to the next item.
        return acc;
      }
  
      if(!acc[item.query]) {
        acc[item.query] = []; // If this 'query' is not already a key in the object, add it with an empty array as the value.
      }
      
      if(acc[item.query].length < 4) { 
        // If the array for this 'query' has less than four items, add the current item.
        acc[item.query].push(item);
      }
      return acc;
    }, {});
    data = queryMap
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
