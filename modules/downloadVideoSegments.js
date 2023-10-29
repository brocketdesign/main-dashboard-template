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
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('end', () => {
        //console.log('Conversion finished');
        resolve();
      })
      .on('error', (err) => {
        console.log('Conversion error: ' + err);
        reject(err);
      })
      .run();
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

const combineSegments = (finalVideoFile, folderPath, itemID, totalSegments) => {
  return new Promise((resolve, reject) => {
    try {
      let currentIndex = 0;
      const intervalId = setInterval(() => {

        if (currentIndex >= totalSegments) {
          clearInterval(intervalId);
          resolve();
          return;
        }

        const segmentFileName = `video_${new ObjectId(itemID)}_${currentIndex}.ts`;
        const fullPath = path.join(folderPath, segmentFileName);
        const outputPath = fullPath.replace('.ts','.mp4');
        // Check if the segment file exists
        if (!fs.existsSync(fullPath) && !fs.existsSync(outputPath)) {
          //console.log(`Segment ${currentIndex} not found. Waiting for the segment.`);
          return; // Skip the current iteration and wait for the next interval
        }
        if (fs.existsSync(outputPath) && fs.existsSync(finalVideoFile)) {
          currentIndex++;
          return
        }

        // Read the segment data from the new segment file
        const segmentData = fs.readFileSync(fullPath);

        // Append the segment data to the final video file
        fs.appendFileSync(finalVideoFile, segmentData);

        if (!fs.existsSync(outputPath)) {
              // Convert the final TS file to MP4
            convertVideo(fullPath)
            .then((pathToStream) => {
              //fs.unlinkSync(fullPath);
            })
            .catch((error) => {
              console.log('Error during video conversion:', error);
            });

        }

        //console.log(`Appended segment: ${segmentFileName}`); // Debugging line
        currentIndex++;
      }, 0); // Checking every 1 second
    } catch (error) {
      console.log('An error occurred:', error); // Debugging line
      reject(error); // Reject the Promise
    }
  });
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
            resolve(finalVideoFilePath);

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


const downloadSegments = async (page, parser, basePath, folderPath, itemID) => {
  return new Promise(async (resolve, reject) => {
    const downloadedSegments = new Set();
    const finalVideoFile = path.join(folderPath, `final_video_${new ObjectId(itemID)}.ts`);

    const fetchSegment = async (segment, segmentFileName) => {
      const fullPath = path.join(folderPath, segmentFileName);
      if (fs.existsSync(fullPath)) {
        return
      }
      //console.log(`Fetching segment: ${segmentFileName}`);
      const tsUrl = `${basePath}${segment.uri}`;
      const tsData = await page.evaluate(async (url) => {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }, tsUrl);

      fs.writeFileSync(fullPath, Buffer.from(tsData));
      return fullPath;
    };

    try {
      const totalSegments = parser.manifest.segments.length;
      let currentIndex = 0;
      const allCombine = combineSegments(finalVideoFile, folderPath, itemID, totalSegments);
      const processSegments = async () => {
        while (currentIndex < totalSegments) {
          const segment = parser.manifest.segments[currentIndex];
          const segmentFileName = `video_${new ObjectId(itemID)}_${currentIndex}.ts`;
          
          if (downloadedSegments.has(segmentFileName)) {
            currentIndex++;
            continue;
          }

          downloadedSegments.add(segmentFileName);
          const fullPath = await fetchSegment(segment, segmentFileName);
          console.log(`Processed segment: ${currentIndex + 1}/${totalSegments}`);

          currentIndex++;
        }
      };

      // Start 5 parallel downloads
      const parallelDownloads = Array.from({ length: 1 }, () => processSegments());

      await Promise.all(parallelDownloads);
      await allCombine
      // Convert the final TS file to MP4
      convertVideo(finalVideoFile)
      .then((outputPath) => {
        console.log('Video converted successfully.',outputPath);
        fs.unlinkSync(finalVideoFile);
        for (let i = 0 ; i < totalSegments; i++){
          const segmentFileName = `video_${new ObjectId(itemID)}_${currentIndex}.ts`;
          if (fs.existsSync(segmentFileName)) {
            fs.unlinkSync(segmentFileName);
          }
        }
        resolve(outputPath);
      })
      .catch((error) => {
        console.log('Error during video conversion:', error);
        reject(error);
      });

    } catch (error) {
      console.log(`An error occurred: ${error}`);
      reject(error);
    }
  });
};


module.exports = downloadVideoSegments;
