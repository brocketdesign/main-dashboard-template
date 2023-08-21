const { Configuration, OpenAIApi } = require('openai');
const { ObjectId } = require('mongodb');

const openAIConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiClient = new OpenAIApi(openAIConfig);

const bookCollection = global.db.collection('books');
const userCollection = global.db.collection('users');

const MAX_TOKENS = 1000

async function fetchBookDetails(user, data) {

    const { topic, language, keywords, userChapters , aiCheckbox} = data;

    const promptTemplate = `
    write the details for a book about "${topic}". 
    The book content and details must be in ${language}.
    The main keywords are : ${keywords.join(', ')}.
    ${aiCheckbox=='true'?'':`Use those chapters for the book : ${userChapters.join('\n - ')}`}
    Respond without comment, only using this JSON template : 
    {
        "book": {
            "language": "${language}",
            "title": "{{book_title}:{book_sub_title}}",
        },
        "tone": "{{book_tone}}",
        "chapters": [
            {
                "title": "{{chapter_1_title}}",
                "sub_chapters": [
                    {
                        "title": "{{sub_chapter_1_1}}"
                    },
                    {
                        "title": "{{sub_chapter_1_2}}"
                    }
                ]
            },
            {
                "title": "{{chapter_2_title}}",
                "sub_chapters": [
                    {
                        "title": "{{sub_chapter_2_1}}"
                    },
                    {
                        "title": "{{sub_chapter_2_2}}"
                    }
                ]
            },
            {
                "title": "{{chapter_3_title}}",
                "sub_chapters": [
                    {
                        "title": "{{sub_chapter_3_1}}"
                    },
                    {
                        "title": "{{sub_chapter_3_2}}"
                    }
                ]
            }
        ]
    }    
    `; 

    const MatchingBooks = await bookCollection.findOne(
        {
            $or: [
                { 'topic': topic },
                { 'title': topic }  // assuming title is the variable containing the book's title
            ]
        }
    );
    
    
    if (MatchingBooks) {
        console.log('Details founded')
        return MatchingBooks
    }
    console.log('Generate details for the ebook')

    const gptResponse = await openaiClient.createCompletion({
        model: "text-davinci-003",
        prompt: promptTemplate,
        max_tokens: MAX_TOKENS,
        temperature: 0.6,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.5
    });

    let bookDetails = gptResponse.data.choices[0].text.trim();

    try {
        bookDetails = JSON.parse(bookDetails);
    } catch (error) {
        console.log(bookDetails)
        console.log('Error parsing the returned JSON:', error);
        return false;
    }
    bookDetails = bookDetails.book
    bookDetails.topic = topic;
    bookDetails.book_content = [];
    bookDetails.date = new Date()

    
    // Insert the book details into the 'books' collection
    const insertedBook = await bookCollection.insertOne(bookDetails);

    // Get the generated book ID
    const bookId = insertedBook.insertedId;

    // Update the user's books array with this ID
    await userCollection.updateOne(
        { _id: new ObjectId(user._id) },
        { $push: { bookIds: bookId } }
    );
    bookDetails._id = bookId
    console.log(bookDetails)
    console.log(bookDetails.chapters[0])
    return bookDetails;
}

async function generateChapterContent(user, bookDetails, chapterIndex) {
    const book = bookDetails;

    const chapterPrompt = `I am writing a book, "${book.title}". ${book.description}. The genre is ${book.genre}.
    The book content is in ${book.language}.
    Write a chapter about "${book.chapters[chapterIndex].title}". The writing tone must be ${book.tone}.
    Respond without comment,do not write the chapter title in your response, only the chapter content.`; // same as before

    const gptResponse = await openaiClient.createCompletion({
        model: "text-davinci-003",
        prompt: chapterPrompt,
        max_tokens: MAX_TOKENS,
        temperature: 0.6,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.5
    });

    const chapterContent = {
        index: chapterIndex,
        title: book.chapters[chapterIndex].title,
        content: gptResponse.data.choices[0].text.trim()
    };

    await bookCollection.updateOne(
        { _id: new ObjectId(bookDetails._id) },
        { $push: { "book_content": chapterContent } }
    );

    return chapterContent;
}

async function generateSubChapterContent(user, bookDetails, chapterIndex, subChapterIndex) {
    const book = bookDetails;
    
    // Ensure chapter and sub-chapter indices are valid
    if (!book.chapters[chapterIndex] || !book.chapters[chapterIndex].sub_chapters[subChapterIndex]) {
        throw new Error("Invalid chapter or sub-chapter index");
    }

    const keyPoints = book.chapters[chapterIndex].sub_chapters[subChapterIndex].key_points;

    // Create a plain text representation of the key points list
    const keyPointsList = keyPoints.join('\n -'); // Join key points with line breaks

    const subChapterPrompt = `I am writing a book, "${book.title}". ${book.description}. The genre is ${book.genre}.
    The book content is in ${book.language}.
    This is part of Chapter "${book.chapters[chapterIndex].title}". 
    Write a sub-chapter about "${book.chapters[chapterIndex].sub_chapters[subChapterIndex].title}". 
    Here a the key points that you need to follow in this sub chapter: 
    - ${keyPointsList}
    The writing tone must be ${book.tone}. 
    Respond without comment, do not write the sub-chapter title in your response, only the sub-chapter content.`;

    const gptResponse = await openaiClient.createCompletion({
        model: "text-davinci-003",
        prompt: subChapterPrompt,
        max_tokens: MAX_TOKENS,
        temperature: 0.6,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.5
    });

    const subChapterContent = {
        chapterIndex: chapterIndex, 
        subChapterIndex: subChapterIndex,
        title: book.chapters[chapterIndex].sub_chapters[subChapterIndex].title,
        content: gptResponse.data.choices[0].text.trim()
    };

    await bookCollection.updateOne(
        { _id: new ObjectId(bookDetails._id), "book_content.index": chapterIndex },
        { $push: { "book_content.$.sub_chapters_content": subChapterContent } }
    );

    return subChapterContent;
}


async function createBookChapters(user, data) {
    const { topic, language, keywords, userChapters , aiCheckbox} = data;

    let bookDetails = await fetchBookDetails(user, data);

    if(!bookDetails) {
        return false
    };

    console.log('Generating chapters...');
    const chapters = [];

    for (let chapterIndex = 0; chapterIndex < bookDetails.chapters.length; chapterIndex++) {
        const currentChapter = bookDetails.chapters[chapterIndex];
        console.log(`Generating chapter ${chapterIndex + 1}/${bookDetails.chapters.length}: ${currentChapter.title}`);
        const chapter = await generateChapterContent(user, bookDetails, chapterIndex);
        chapters.push(chapter.content);

        if (currentChapter.sub_chapters) {
            for (let subChapterIndex = 0; subChapterIndex < currentChapter.sub_chapters.length; subChapterIndex++) {
                console.log(`Generating sub-chapter ${subChapterIndex + 1}/${currentChapter.sub_chapters.length}: ${currentChapter.sub_chapters[subChapterIndex].title}`);
                const subChapter = await generateSubChapterContent(user, bookDetails, chapterIndex, subChapterIndex);
                chapters.push(subChapter.content);
            }
        }
    }

    const formattedBook = chapters.join('<br>');
    console.log(`Your ebook ${bookDetails.title} is ready !`)
    return bookDetails._id;
}

module.exports= createBookChapters