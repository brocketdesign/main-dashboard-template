const express = require('express');
const router = express.Router();

// Require and use 'express-session' middleware
const session = require('express-session');

router.get('/',(req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard'); // Redirect to the dashboard if user is logged in
  }
  // Set the mode to 1 in the session
  req.session.mode = '1';

  console.log('Top page requested');
  res.render('index'); // Render the top page template
});
module.exports = router;
