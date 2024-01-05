require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const compression = require('compression');

const http = require('http');
const LocalStrategy = require('passport-local').Strategy;
const { MongoClient, ObjectId } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);
const { StableDiffusionApi } = require("a1111-webui-api");

const passport = require('passport');
const path = require('path'); // Add path module
const ip = require('ip');
const bcrypt = require('bcrypt');
const app = express();
const WebSocket = require('./routers/WebSocket');
const server = http.createServer(app);
const cors = require('cors');

// Attach the WebSocket server to the HTTP server
WebSocket(server);

const port = process.env.PORT || 3000;

const url = process.env.MONGODB_URL; // Use MONGODB_URL from .env file
const dbName = process.env.MONGODB_DATABASE; // Use MONGODB_DATABASE from .env file

function startServer() {
  MongoClient.connect(url, { useUnifiedTopology: true })
    .then(client => {
      console.log('Connected to MongoDB...');

      const db = client.db(dbName); // Use the database name from .env file
      global.db = db; // Save the db connection in a global variable

      // Create an instance of the StableDiffusionApi
      const sd_api = new StableDiffusionApi({
        host: process.env.SD_HOST,
        port: process.env.SD_PORT, 
        protocol: "http",
        defaultSampler: "DPM++ 2M Karras",
        defaultStepCount: 50,
        safety_checker: true,
        enhance_prompt: true,
      });

      global.sdapi = sd_api; //Save the API for stable diffusion in a global variable
      // Use the express-session middleware
      app.use(
        session({
          secret: process.env.SESSION_SECRET, // Use SESSION_SECRET from .env file
          resave: false,
          saveUninitialized: false,
          store: new MongoDBStore({
            uri: url,
            collection: 'sessions',
          }),
        })
      );

      // Serve static files from the 'public' directory
      app.use(express.static(path.join(__dirname, 'public')));

      // Continue with the remaining code...

      // Passport config
      passport.use(
        new LocalStrategy(function (username, password, done) {
          db.collection('users')
            .findOne({ username: username })
            .then(user => {
              if (!user) {
                console.log('LocalStrategy: No user found with this username.');
                return done(null, false, { message: 'Incorrect username.' });
              }
              console.log('LocalStrategy: User found, comparing passwords...');
              // Use bcrypt to compare the input password with the hashed password in the database
              bcrypt.compare(password, user.password).then(isMatch => {
                if (isMatch) {
                  console.log('LocalStrategy: Passwords match, login successful.');
                  return done(null, user);
                } else {
                  console.log('LocalStrategy: Passwords do not match.');
                  return done(null, false, { message: 'Incorrect password.' });
                }
              });
            })
            .catch(err => {
              console.log('Error in LocalStrategy:', err);
              return done(err);
            });
        })
      );

      passport.serializeUser(function (user, done) {
        done(null, user._id.toString()); // Convert ObjectId to string
      });

      passport.deserializeUser(function (id, done) {
        db.collection('users')
          .findOne({ _id: new ObjectId(id) })
          .then(user => {
            done(null, user);
          })
          .catch(err => {
            done(err, null);
          });
      });
      app.use(cors());
      app.use(compression());
      app.use(flash());
      app.use((req, res, next) => {
        res.locals.messages = req.flash();
        next();
      });
      
      app.use(passport.initialize());
      app.use(passport.session());

      // Add other middleware
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.set('view engine', 'pug');
      app.set('views', './views');

      // Define your routers
      const index = require('./routers/index');
      const api = require('./routers/api');
      const videoOpenai = require('./routers/videoOpenai');
      const user = require('./routers/user');
      const dashboard = require('./routers/dashboard');
      const payment = require('./routers/payment');

      app.use('/', index); // Use the index router for '/'
      app.use('/api', api); // Use the API router for '/api'
      app.use('/api/openai-video', videoOpenai); 
      app.use('/user', user); // Use the user router for '/user'
      app.use('/payment', payment);
      app.use('/dashboard', dashboard);

      

    server.listen(port, () => 
      console.log(`Express running → PORT http://${ip.address()}:${port}`));
    })
    .catch(err => {
      console.log('Error occurred while connecting to MongoDB...\n', err);
    });
}

startServer();
