const fs = require('fs');
const pdfParse = require('pdf-parse');

function pdfToText(filePath) {
    return new Promise((resolve, reject) => {
        let dataBuffer = fs.readFileSync(filePath);

        pdfParse(dataBuffer).then(function(data) {
            resolve(data.text.substring(0,500));
        }).catch(function(error) {
            reject(error);
        });
    });
}

module.exports = pdfToText;
