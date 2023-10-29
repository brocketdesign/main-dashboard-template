const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ObjectId } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const { createParser } = require('eventsource-parser');
const openai = new OpenAIApi(configuration);
const app = express();
const server = http.createServer(app);

function setupWebSocketServer(server) {
    
    const wss = new WebSocket.Server({ server });
    wss.on('connection', (ws) => {

        console.log('New WebSocket connection established!');

        ws.on('message', async (message) => {

            const dataString = message.toString('utf8'); // Convert the Buffer to a UTF-8 string
            const { type, id } = JSON.parse(dataString); // Parse the string as JSON

            if (type === 'openai_stream') {
                try {
                    const record = await global.db.collection('openai').findOne({ _id: new ObjectId(id) });
    
                    if (!record) {
                        ws.send(JSON.stringify({ error: "Record not found" }));
                        return;
                    }
    
                    const prompt = record.prompt;
                    const messages = [
                        { role: 'system', content: 'You are a powerful assistant' },
                        { role: 'user', content: prompt },
                    ];
    
                    let response = await fetch(
                        "https://api.openai.com/v1/chat/completions",
                        {
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                            },
                            method: "POST",
                            body: JSON.stringify({
                                model: process.env.COMPLETIONS_MODEL,
                                messages,
                                temperature: 0.75,
                                top_p: 0.95,
                                // stop: ["\n\n"],
                                frequency_penalty: 0,
                                presence_penalty: 0,
                                max_tokens: 20,
                                stream: true,
                                n: 1,
                            }),
                        }
                    );

                    let fullCompletion = ""; // Variable to collect the entire completion
              
                    const parser = createParser((event) => {
                        if (event.type === 'event') {
                            if (event.data !== "[DONE]") {
                                const content = JSON.parse(event.data).choices[0].delta?.content || "";
                                fullCompletion += content;
                                ws.send(JSON.stringify({ content }));
                            }
                        }
                    });
              
                    for await (const value of response.body?.pipeThrough(new TextDecoderStream())) {
                        // console.log("Received", value);
                        parser.feed(value)
                    }
                    await global.db.collection('openai').updateOne(
                        { _id: new ObjectId(id) },
                        { $set: { completion: fullCompletion } }
                    );
                } catch (error) {
                    console.log(error);
                    ws.send(JSON.stringify({ error: "Internal server error" }));
                }
            }

        });

        ws.send('Hello from WebSocket server!');

    });
}

module.exports = setupWebSocketServer;
