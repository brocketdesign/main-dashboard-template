const express = require('express');
const multer = require('multer');
const {formatDateToDDMMYYHHMMSS} = require('../services/tools')

const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const { email, sendEmail } = require('../services/email')
const axios = require('axios'); // Import axios at the top of your file

const { ObjectId } = require('mongodb');

router.get('/setting', (req, res) => {
  console.log('User setting page requested');
  res.render('user-setting',{user:req.user}); // Render the login template
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_STORAGE_FOLDER);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${req.user._id}-${formatDateToDDMMYYHHMMSS()}.jpg`);
  }
});


const upload = multer( {storage: storage });

router.post('/updateProfile', upload.fields([{ name: 'profileImage' }, { name: 'bannerImage' }, {name : 'imageUpload'}]), async (req, res) => {

  try {
      let user

      if(req.body.resetToken){
        // Find the user with the matching reset token
        user = await global.db.collection('users').findOne({ resetToken : req.body.resetToken });
      }else{
        user = req.user
      }

      const userId = user._id;  // Retrieve user ID from req object
      const updatedInfo = req.body;  // Retrieve updated data from form submission
      updatedInfo.galleryImages = user.galleryImages || []

      //console.log(req.body) 
      //console.log(req.files) 

      if (req.files) {

        let profileImage = req.files['profileImage'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['profileImage'][0].filename}` : null;
        let bannerImage = req.files['bannerImage'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['bannerImage'][0].filename}` : null;
        let galleryImage = req.files['imageUpload'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['imageUpload'][0].filename}` : null;

        // If a file was uploaded, add the file path to the user's data
        if (profileImage) {
          updatedInfo.profileImage = profileImage;
        }
        if (bannerImage) {
          updatedInfo.bannerImage = bannerImage;
        }
        if (galleryImage) {
          // Assuming updatedInfo.galleryImages is initially an empty array or already an array
          updatedInfo.galleryImages.push(galleryImage);
        }
      }
      if(updatedInfo.userPassword){
        updatedInfo.password = await bcrypt.hash(updatedInfo.userPassword, 10);
        user.password = updatedInfo.password

        const EmailData = {
          username: user.username, 
        };
    
        sendEmail(user.email, 'password update', EmailData)
          .then(() => console.log('Email sent!'))
          .catch(error => console.error(`Error sending email: ${error}`));

      }
      // Use global.db to get a reference to the users collection
      const usersCollection = global.db.collection('users');

      // Update user in the collection
      await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updatedInfo });

      if(req.body.resetToken){
        await global.db.collection('users').updateOne({ resetToken : req.body.resetToken },{$set:{resetToken:false,validityToken:false}});
      }
      
      res.json({ status: 'success', message: 'Profile updated successfully' });
  } catch (error) {
    console.log(error)
      res.json({ status: 'error', message: 'An error occurred while updating the profile.' });
  }
});

router.get('/login', (req, res) => {
  console.log('Login page requested');
  res.render('user-login'); // Render the login template
});

router.post('/login', passport.authenticate('local', {
  failureRedirect: '/user/login',
  failureFlash: 'Invalid username or password.'
}), async (req, res) => {
  try {

    const updatedUserDetails = {
      // ... copy over the properties from req.user you want to retain
      ...req.user,
      // ... and include any updates you want to make
      lastLogin: new Date()
    };
  
    // Now you can update the user session with the new details
    req.login(updatedUserDetails, (err) => {
      if (err) {
        return next(err);
      }

      console.log({userId:req.user._id})
      // After successful authentication, connect the user to the download server
      //connectUserToTheDownloadServer(req.user);
      
      // If successful, inform the user with a flash message
      req.flash('info', 'You are now logged in and connected to the download server!');
      
      // Redirect to the dashboard
      res.redirect('/dashboard');
    });


  } catch (error) {
    // If there is an error, handle it appropriately
    console.error('Login or connection to download server failed:', error);
    req.flash('error', 'There was an issue logging in or connecting to the download server.');
    res.redirect('/user/login');
  }
});


async function connectUserToTheDownloadServer(user) {
  try {
    // Make a POST request to the download server
    const response = await axios.post('http://192.168.10.115:3100/api/connectUser', {
      user: user
    });

    // Log the response from the download server for debugging
    console.log('Connected to download server:', response.data);
    
    // You might want to return something here, depending on your use case
    return response.data;
  } catch (error) {
    // Log the error if the request fails
    console.error('Error connecting to the download server:', error);
    throw error; // Optionally throw the error to be handled by the caller
  }
}


router.get('/signup', (req, res) => {
  console.log('Signup page requested');
  res.render('user-signup'); // Render the signup template
});

router.get('/logout', (req, res) => {
  console.log('Logout requested');

  req.logout(function(err) {
    req.session.destroy((err) => {
      if (err) {
        console.log('Error : Failed to destroy the session during logout.', err);
      } else {
        req.user = null;
        console.log('Logout response: Redirecting to /login');
        res.redirect('/user/login');
      }
    });
  });
  
});

router.get('/resetpassword', async (req, res) => {
  const resetToken = req.query.resetToken || false; // Assuming the token is passed as a query parameter

  try {
    // Find the user with the matching reset token
    const user = await global.db.collection('users').findOne({ resetToken });

    if (!user) {
      // No user found with the provided reset token
      return res.render('user-resetpassword', { error: 'Invalid reset token' });
    }

    if (new Date() > user.validityToken) {
      // The token has expired
      return res.render('user-resetpassword', { error: 'Reset token has expired' });
    }

    // Valid reset token, proceed with password reset
    res.render('user-resetpassword', { resetToken });

  } catch (err) {
    console.error('Error during password reset:', err);
    res.render('user-resetpassword', { error: 'Error during password reset' });
  }
});


router.post('/resetpassword', async (req, res, next) => {
  const crypto = require('crypto');

  const { email } = req.body;
  console.log(`Password reset request: ${JSON.stringify(req.body)}`);
  
  try {
    const existingUser = await global.db.collection('users').findOne(
      { $or: [{ email: email }] }
    );
  
    if (!existingUser) {
      req.flash('error', 'We could not find your email in our database'); // Set an error flash message
      return res.redirect('/user/resetpassword');
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const validity = new Date();
    validity.setMinutes(validity.getMinutes() + 10);
    const protocol = req.protocol;
    const host = req.get('host');
    const link = `${protocol}://${host}/user/resetpassword?resetToken=${resetToken}`;


    await global.db.collection('users').updateOne({_id:new ObjectId(existingUser._id)},{$set:{resetToken:resetToken,validityToken:validity}})
    
    const EmailData = {
      username: existingUser.username, 
      resetToken: resetToken,
      link:link
    };

    sendEmail(email, 'password reset', EmailData)
      .then(() => console.log('Email sent!'))
      .catch(error => console.error(`Error sending email: ${error}`));


    req.flash('info', 'We sent you an email with a reset password link valide for 10 minutes.'); // Set an info flash message
    res.redirect('/user/resetpassword');
  } catch (err) {
    console.log('Signup error:', err);
    return next(err);
  }
});

router.post('/nsfw', async (req, res, next) => {
  const { nsfw } = req.body;
  try{
    await global.db.collection('users').updateOne({_id: new ObjectId(req.user._id)},{$set:{nsfw}}) 
    res.status(200).json({message:'NSFW sttatus updated'});
  }catch(err){
    console.log('User is not connected')
    res.status(500).json({message:'NSFW sttatus updated failed'});
  }

});

router.post('/signup', async (req, res, next) => {
  const { email, username, password } = req.body;
  console.log(`Signup request: ${JSON.stringify(req.body)}`);
  
  try {
    const existingUser = await global.db.collection('users').findOne(
      { $or: [{ email: email }, { username: username }] }
    );
  
    if (existingUser) {
      req.flash('error', 'User with the same email or username already exists.'); // Set an error flash message
      return res.redirect('/user/signup');
    }
  
    const hash = await bcrypt.hash(password, 10);

    await global.db.collection('users').insertOne({ email: email, username: username, password: hash, nsfw:false  });
 
    const welcomeEmailData = {
      FIRSTNAME: username, 
    };

    sendEmail(email, 'welcome', welcomeEmailData)
      .then(() => console.log('Email sent!'))
      .catch(error => console.error(`Error sending email: ${error}`));


    req.flash('info', 'Successfully signed up! You can now log in.'); // Set an info flash message
    res.redirect('/user/login');
  } catch (err) {
    console.log('Signup error:', err);
    return next(err);
  }
});

router.post('/isOldPasswordCorrect', (req, res) => {
  const { oldPassword } = req.body;
  const storedPassword = req.user.password;

  bcrypt.compare(oldPassword, storedPassword).then(isMatch => {
    if (isMatch) {
      console.log('LocalStrategy: Old Passwords match.');
      res.status(200).json({ isMatch: true });
    } else {
      console.log('LocalStrategy: Old Passwords do not match.');
      res.status(200).json({ isMatch: false });
    }
  }).catch(err => {
    console.error(err);
    res.status(500).json({ message: 'An error occurred while verifying the old password.' });
  });
});

router.post('/reset', async (req, res) => {
  const { mode } = req.body;
  console.log('Reset data for mode:',mode)
  try{
    if(!mode){
      console.log('All data reseted ! For user:',req.user.id)
      await global.db.collection('users').updateOne({_id: new ObjectId(req.user._id)},
      {$set:{
        scrapInfo:{},
        scrapedData:[],
      }})
    }
    res.status(200).json({ message: 'Data deleted' });
  }catch{
    res.status(500).json({ message: 'An error occurred while deleting data.' });

  }

});

module.exports = router;
