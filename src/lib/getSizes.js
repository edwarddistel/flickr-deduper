// Get the URLs for each photo
async function getSizes(flickr, albumData) {
  try {
    let response;
    if (albumData && albumData.photoIds && albumData.photoIds.length > 0) {
      for (let i = 0; i < albumData.photoIds.length; i++) {
        const id = albumData.photoIds[i];
        if (
          albumData
          && albumData.photoMap
          && albumData.photoMap[id]
          && !albumData.photoMap[id].url
        ) {
          console.log(`Getting photo ${i}, id ${id}...`);
          try {
            response = await flickr.photos.getSizes({ photo_id: id });
            if (response && response.status && response.status === 200) {
              const url = response.body.sizes.size.at(-1).source;
              // const id = response.body.sizes.size.at(-1).url.split("/").at(-4);
              albumData.photoMap[id] = {};
              albumData.photoMap[id].url = url;
            }
          } catch (err) {
            console.error('Error getting photo sizes', err);
          }
        }
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Problem getting photo sizes', err);
  }
}

module.exports = {
  getSizes,
};
