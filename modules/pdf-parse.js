const fs = require('fs');
const pdfParse = require('pdf-parse');
const kuromoji = require('kuromoji');

function pdfToText(filePath) {
    return new Promise((resolve, reject) => {
        let dataBuffer = fs.readFileSync(filePath);

        pdfParse(dataBuffer).then(function(data) {
            resolve(data.text);
        }).catch(function(error) {
            reject(error);
        });
    });
}
function textToChunks(texts, wordLength = 150, startPage = 1) {
    return new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, tokenizer) => {
            if (err) {
                console.log(err)
                reject(err);
            } else {
                let chunks = [];
                let textToks = texts.map(t => tokenizer.tokenize(t).map(token => token.surface_form));

                for (let idx = 0; idx < textToks.length; idx++) {
                    let words = textToks[idx];
                    for (let i = 0; i < words.length; i += wordLength) {
                        let chunk = words.slice(i, i + wordLength);
                        if ((i + wordLength) > words.length && (chunk.length < wordLength) && (textToks.length != (idx + 1))) {
                            textToks[idx + 1] = chunk.concat(textToks[idx + 1]);
                            continue;
                        }
                        chunk = chunk.join('').trim();
                        chunk = `[Page no. ${idx + startPage}] ${chunk}`;
                        chunks.push(chunk);
                    }
                }
                console.log(chunks)
                resolve(chunks);
            }
        });
    });
}


function pdfToChunks(filePath, wordLength = 150, startPage = 1) {
    return pdfToText(filePath).then(text => {
        return textToChunks([text], wordLength, startPage);
    });
}

module.exports = pdfToChunks;
