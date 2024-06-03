const axios = require('axios');
const { ObjectId } = require('mongodb');

// Function to get a new token from the API using axios
async function fetchNewToken() {
    try {
        const response = await axios.get('http://api.redgifs.com/v2/auth/temporary', {
            headers: { 'Accept': 'application/json' }
        });
        if (response.data && response.data.token) {
            return response.data.token;
        } else {
            throw new Error('Failed to fetch new token');
        }
    } catch (error) {
        throw new Error(error.message || 'Error fetching new token');
    }
}

// Function to get the token from the database or fetch a new one if needed
async function getToken() {
    const tokensCollection = global.db.collection('tokens');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const result = await tokensCollection.findOne({ createdAt: { $gte: twentyFourHoursAgo } });
        if (result) {
            console.log(`Use saved token`)
            return result.token;
        } else {
            console.log(`Fetch a new token`)
            const newToken = await fetchNewToken();
            const newTokenDocument = {
                token: newToken,
                createdAt: new Date()
            };
            await tokensCollection.insertOne(newTokenDocument);
            return newToken;
        }
    } catch (err) {
        throw err;
    }
}

module.exports = { getToken };
