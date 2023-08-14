
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    const videoRequests = [];

    // Enable request interception
    await page.setRequestInterception(true);
    
    // Intercept network requests
    page.on('request', request => {
        if (request.resourceType() === 'media') {
            videoRequests.push(request.url());
        }
        request.continue();
    });

    await page.goto('https://www.redgifs.com/watch/soggymagnificentpacificparrotlet');

    // Wait for the first video element to appear on the page
    await page.waitForSelector('video');

    console.log('Video URLs:', videoRequests);

    await browser.close();

    return videoRequests;
})();
