// Import ObjectId
const { ObjectId } = require("mongodb");

async function resetDownloadList() {
  try {
    // Find documents where 'isdl' is false and convert to an array
    const data = await global.db.collection('medias').find({ isdl: false }).toArray();

    // Log the data that matches the query
    //console.log("Documents with isdl set to false:", data);

    // Remove the 'isdl' field from the documents
    const result = await global.db.collection('medias').updateMany(
      { isdl: false },
      { $unset: { isdl: "" } }
    );

    // Log the result of the update operation
    //console.log("Number of documents modified:", result.modifiedCount);
  } catch (error) {
    // Log any errors that occur
    console.error("An error occurred:", error);
  }
}

// Call the function to reset the download list
resetDownloadList();
