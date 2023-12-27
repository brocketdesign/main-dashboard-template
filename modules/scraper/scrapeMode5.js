const puppeteer = require('puppeteer');

async function scrapeMode5(url, mode, nsfw, pageIndex, user) {
    try {
        // Launch a new browser instance
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });

        // Open a new page
        const page = await browser.newPage();

        // Construct the full URL with the page index
        const url = `https://www.twidouga.net/jp/realtime_t.php?page=${pageIndex}`;

        // Navigate to the URL
        await page.goto(url);

        // Scrape data from the page
        const data = await page.evaluate(() => {
            // This will be executed within the page, where DOM elements are accessible
            const items = Array.from(document.querySelectorAll('#container .item'));
            return items.map(item => {
                const imageUrl = item.querySelector('img')?.src;
                const link = item.querySelector('a')?.href;
                return { imageUrl, link };
            });
        });

        // Close the browser
        await browser.close();

        return data;
    } catch (error) {
        console.error(`Error scraping data: ${error}`);
        throw error;
    }
}

module.exports = scrapeMode5;
