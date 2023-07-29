function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/user/login'); // Redirect to login page if not authenticated
  }
}

module.exports = ensureAuthenticated;
