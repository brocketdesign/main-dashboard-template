const puppeteer = require('puppeteer');
const m3u8Parser = require('m3u8-parser');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

// Function to stream segments to a writable HTTP response object
const streamSegment = async (page, segment, basePath, response) => {
  const tsUrl = `${basePath}${segment.uri}`;
  const tsData = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }, tsUrl);
  
  // Write the segment data to the response object, effectively streaming it
  response.write(Buffer.from(tsData));
};

const initializePuppeteer = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  return { browser, page };
};

const navigateToPage = async (page, url) => {
    //console.log(`Navigating to ${url}`);
    await page.goto(url, { 
      headless:false,
      waitUntil: 'networkidle2',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
     });
    //console.log('Clicking on .player');
    await page.click('.player');
  };
  const fetchAndParseM3U8 = async (page, m3u8Url) => {
    const m3u8Content = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return await res.text();
    }, m3u8Url);
    //console.log('Fetched m3u8 content');
  
    const parser = new m3u8Parser.Parser();
    parser.push(m3u8Content);
    parser.end();
  
    return parser;
  };
const streamVideoSegments = async (url, response) => {
  const { browser, page } = await initializePuppeteer();
  await navigateToPage(page, url);

  const onResponse = async (responseEvent) => {
    const contentType = responseEvent.headers()['content-type'];

    if (contentType && contentType === 'application/vnd.apple.mpegurl') {
      const m3u8Url = responseEvent.url();
      console.log(`Found .m3u8 URL: ${m3u8Url}`);
      
      try {
        // Remove the event listener after the first .m3u8 URL is found
        page.removeListener('response', onResponse);

        const parser = await fetchAndParseM3U8(page, m3u8Url);
        console.log(`Number of segments: ${parser.manifest.segments.length}`);

        const basePath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

        // Loop through segments and stream each one
        for (const segment of parser.manifest.segments) {
          await streamSegment(page, segment, basePath, response);
          console.log(`Streamed segment: ${segment.uri}`);
        }

        // Close the browser and end the response
        await browser.close();
        response.end();

      } catch (error) {
        console.log(`An error occurred: ${error}`);

        // Close the browser and end the response
        await browser.close();
        response.status(500).end();
      }
    }
  };

  // Add response event listener
  page.on('response', onResponse);
};

module.exports = streamVideoSegments