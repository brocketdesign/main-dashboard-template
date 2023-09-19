const express = require('express');
const router = express.Router();
const axios = require('axios');

// Require and use 'express-session' middleware
const session = require('express-session');

router.get('/',async(req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard'); // Redirect to the dashboard if user is logged in
  }
  // Set the mode to 1 in the session
  req.session.mode = '1';

  let ngrok = process.env.NGROK 

  res.render('index',{ngrok}); // Render the top page template
});
module.exports = router;
