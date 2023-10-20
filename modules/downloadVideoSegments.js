const puppeteer = require('puppeteer');
const m3u8Parser = require('m3u8-parser');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const ffmpeg = require('fluent-ffmpeg');

const convertToMp4 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .on('end', () => {
        console.log('Conversion finished');
        resolve();
      })
      .on('error', (err) => {
        console.log('Conversion error: ' + err);
        reject(err);
      })
      .run();
  });
};

const combineSegments = (newSegmentFile, finalVideoFile) => {
  // Read the segment data from the new segment file
  const segmentData = fs.readFileSync(newSegmentFile);

  // Append the segment data to the final video file
  fs.appendFileSync(finalVideoFile, segmentData);

  // Remove the new segment file after appending its content
  fs.unlinkSync(newSegmentFile);

  //console.log(`Appended and removed ${newSegmentFile}`);
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

const createFolder = (folderPath) => {

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    //console.log(`Folder created at ${folderPath}`);
  }
  return folderPath;
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

const downloadSegments = async (page, parser, basePath, folderPath, itemID) => {
  return new Promise(async (resolve, reject) => {
    const downloadedSegments = new Set();
    const finalVideoFile = path.join(folderPath, `final_video_${new ObjectId(itemID)}.ts`);
    const batchSize = 10; // Number of segments in each batch
    const tempFiles = [];

    try {
      const fetchSegment = async (segment, segmentFileName) => {
        //console.log(`Fetching segment: ${segmentFileName}`);
        const tsUrl = `${basePath}${segment.uri}`;
        const tsData = await page.evaluate(async (url) => {
          const res = await fetch(url);
          const buffer = await res.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        }, tsUrl);
        
        const fullPath = path.join(folderPath, segmentFileName);
        fs.writeFileSync(fullPath, Buffer.from(tsData));
        return fullPath;
      };

      for (let i = 0; i < parser.manifest.segments.length; i += batchSize) {
        const tempFile = path.join(folderPath, `temp_${new ObjectId(itemID)}_${i / batchSize}.ts`);
        tempFiles.push(tempFile);
        console.log(`Process: ${i+1}/${parser.manifest.segments.length}`)
        const promises = [];
        for (let j = i; j < i + batchSize && j < parser.manifest.segments.length; j++) {
          const segment = parser.manifest.segments[j];
          const segmentFileName = `video_${new ObjectId(itemID)}_${j}.ts`;
          if (downloadedSegments.has(segmentFileName)) continue;

          downloadedSegments.add(segmentFileName);
          promises.push(fetchSegment(segment, segmentFileName).then((fullPath) => {
            combineSegments(fullPath, tempFile);
          }));
        }

        // Wait for all segments in this batch to be downloaded and combined
        await Promise.all(promises);
      }

      // Combine all the temporary files into the final video file
      for (const tempFile of tempFiles) {
        combineSegments(tempFile, finalVideoFile);
      }

      resolve(finalVideoFile);
    } catch (error) {
      reject(error);
    }
  });
};


const downloadVideoSegments = (url, folderPath, itemID) => {
  return new Promise(async (resolve, reject) => {
    const { browser, page } = await initializePuppeteer();
    await navigateToPage(page, url);

    folderPath = createFolder(folderPath);

    const onResponse = async (response) => {
      const contentType = response.headers()['content-type'];

      if (contentType && contentType === 'application/vnd.apple.mpegurl') {
        const m3u8Url = response.url();
        //console.log(`Found .m3u8 URL: ${m3u8Url}`);
        
        try {
          // Remove the event listener after the first .m3u8 URL is found
          page.removeListener('response', onResponse);

          const parser = await fetchAndParseM3U8(page, m3u8Url);
          console.log(`Number of segments: ${parser.manifest.segments.length}`);

          const basePath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

          try {
            const finalVideoFilePath = await downloadSegments(page, parser, basePath, folderPath, itemID);
            //console.log("Final video file path:", finalVideoFilePath);

            // Close the browser and resolve the Promise with the file path
            await browser.close();
            const outputPath = await convertVideo(finalVideoFilePath);
            resolve(outputPath);

          } catch (error) {
            console.error("An error occurred:", error);

            // Close the browser and reject the Promise
            await browser.close();
            reject(error);
          }
        } catch (error) {
          console.error(`An error occurred: ${error}`);
          reject(error);
        }
      }
    };

    page.on('response', onResponse);
  });
};

async function convertVideo(finalVideoFilePath) {
  const inputPath = finalVideoFilePath;
  const outputPath = finalVideoFilePath.replace('.ts','.mp4');

  try {
    await convertToMp4(inputPath, outputPath);
    return outputPath
  } catch (error) {
    console.error('An error occurred:', error);
    return false
  }
}

module.exports = downloadVideoSegments;
