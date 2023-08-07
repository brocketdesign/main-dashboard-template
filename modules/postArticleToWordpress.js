const wordpress = require("wordpress");

async function postArticleToWordpress({ user, title, content }) {
  const client = wordpress.createClient({
    url: user.wpURL,
    username: user.wpUsername,
    password: user.wpPassword
  });

  if (!content) {
    throw new Error("Article content is required");
  }
  return new Promise((resolve, reject) => {
    client.newPost({
      title: title,
      content: content,
      status: user.wpPostStatus || 'publish' || 'draft'
    }, (error, id) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          status: 'success',
          message: `Article posted successfully with ID: ${id}`,
          link: `${user.wpURL}/`
        });
      }
    });
  });
}

module.exports = postArticleToWordpress;
