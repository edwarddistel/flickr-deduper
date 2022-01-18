// List all photosets
function getListOfPhotoSets(flickr, albumData) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await flickr.photosets.getList();
      if (
        data
        && data.body
        && data.body.photosets
        && data.body.photosets.photoset
      ) {
        data.body.photosets.photoset.forEach((set) => {
          if (!albumData.photosets) {
            albumData.photosets = [];
          }
          if (!albumData.photosets.includes(set)) {
            albumData.photosets.push(set);
          }
        });
        resolve(data.body.photosets.photoset);
      } else {
        console.log("Error parsing response, couldn't find the photoset data");
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  getListOfPhotoSets,
};
