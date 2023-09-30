const { ObjectId } = require('mongodb'); // Import ObjectId from the MongoDB module

// Function to initialize the category collection with an array of unique strings
async function initializeCategories(categoriesArray,nsfw) {
  // Access the MongoDB database instance from the global variable
  const db = global.db;

  // Access or create a 'category' collection
  const categoryCollection = db.collection('category');
  //await db.collection('category').deleteMany()
  // Iterate over the array of categories and add them if they are not already in the collection
  for (const category of categoriesArray) {
    // Create a new ObjectId
    const _id = new ObjectId();

    // Check if the category already exists
    const existingCategory = await categoryCollection.findOne({ name: category });

    if (!existingCategory) {
      // If it doesn't exist, insert the new category
      await categoryCollection.insertOne({ _id, name: category , nsfw});
      //console.log(`Inserted category: ${category}`);
    } else {
      //console.log(`Category ${category} already exists. Skipping.`);
    }
  }
}

﻿let pornCategories = ﻿["Missionary", "Doggy Style", "Cowgirl", "69", "Reverse Cowgirl", "Spoons", "Face Down Doggie", "Standing Up Against a Wall", "Woman on Top", "Man on Top", "Side by Side", "Girl on Girl", "Boy on Boy", "The Coach", "The Pretzel", "The Scissors", "The Saddle", "The Spreader"];

// Initialize the categories
initializeCategories(pornCategories,true)
  .then(() => {
    //console.log('Categories initialization complete.');
  })
  .catch(err => {
    console.log('An error occurred:', err);
  });
