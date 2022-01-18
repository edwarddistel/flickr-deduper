// Confirms working Oauth
function testLogin(flickr) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await flickr.test.login();
      if (response && response.body) {
        resolve(response.body);
      } else {
        resolve(response);
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  testLogin,
};
