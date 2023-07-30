# main-dashboard-template

This repository contains the code for a comprehensive dashboard application. It includes various features such as user authentication, email services, and a payment system.

## Structure

The repository is structured as follows:

- `app.js`: The main application file.
- `emails`: Contains templates for various types of emails that the application can send.
- `middleware`: Contains middleware functions for authentication and membership checks.
- `modules`: Contains various modules used in the application, including a web scraper.
- `public`: Contains static files served by the application, including CSS, JavaScript, and image files.
- `routers`: Contains the application's routers for handling different types of requests.
- `services`: Contains services used by the application, such as email and Firebase services.
- `views`: Contains Pug templates for the application's views.
- 
## Functionalities

This application provides a variety of functionalities, including:

### OpenAI Chat API Integration

The application can send prompts to the OpenAI API and receive responses. This functionality is used to compare text from two uploaded PDF files.

### PDF Comparison

Users can upload two PDF files, which are then converted to text and compared using the OpenAI API.

### File Upload

The application supports file uploads, which is used in the PDF comparison feature.

### User Authentication

The application includes middleware to ensure that users are authenticated.

### Database Operations

The application interacts with a MongoDB database to store and retrieve data related to users and their interactions with the OpenAI API.

### Reddit Data Fetching

The application can fetch data from Reddit based on subreddit and filter parameters.

### Generative Image AI

The application has routes for interacting with a generative image AI. This includes getting the current model, changing the model, and generating an image based on a prompt.

### Video Download

The application can download videos from provided URLs.

### Form Submission

The application supports form submissions and saves the form data to a MongoDB collection.

### Video Fetching

The application can fetch the highest quality video URL for a provided video ID.

### WordPress Integration

The application can post articles to a WordPress site.

## Setup

To set up the application, follow these steps:

1. Clone the repository.
2. Run `npm install` to install the necessary dependencies.
3. Set up the necessary environment variables for the email and Firebase services.
4. Run `node app.js` to start the application.

## Usage

Once the application is running, you can access the dashboard at `http://localhost:3000/dashboard`. The application also includes routes for user login and signup, password reset, and subscription management.

## Contributing

Contributions are welcome! Please submit a pull request with any changes.

## License

This project is licensed under the terms of the [MIT License](LICENSE).
