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
