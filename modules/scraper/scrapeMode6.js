// Twitter download
const puppeteer = require('puppeteer');

async function scrapeMode(url, mode, nsfw, page, user) {
    try {
        const videoSource = await fetchVideoSrc(url)
        return [{link:videoSource}];
      } catch (error) {
        console.error('Oops, something went wrong!', error);
        return null;
      }
}

async function fetchVideoSrc(targetUrl) {
  const browser = await puppeteer.launch({headless:'new'});
  const page = await browser.newPage();

  // Intercept network requests
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'stylesheet' || request.resourceType() === 'image') {
      // Abort requests for stylesheets and images
      request.abort();
    } else {
      // Allow all other requests
      request.continue();
    }
  });
  try {
    // Navigate to the page
    await page.goto('https://twidropper.com/');

    // Enter the URL in the input field
    await page.type('#url', targetUrl);

    // Click the download button
    await page.click('#downBtn');

    // Wait for navigation or a specific element that indicates the page has loaded
    // Wait for the element with the class .video_box to appear
    await page.waitForSelector('.video_box');


    // Get the video source URL
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video'); // Modify if the video selector is different
      return video ? video.src : null;
    });

    await browser.close();
    return videoSrc;
  } catch (error) {
    console.error('Error in fetchVideoSrc:', error);
    await browser.close();
    return null;
  }
}

module.exports = {scrapeMode,fetchVideoSrc};
