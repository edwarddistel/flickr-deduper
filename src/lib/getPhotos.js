// If the object has a valid date on it
// Add it to albumData.photoIds arr if it's not already there
// Add it to albumData.dateTakenArr if it's not already there
// Map that epoch date to albumData.dateTakenMap if not already done so
function addPhotosToArr(arr, albumData) {
  arr.forEach((item) => {
    if (!item.datetaken) {
      console.log(`No date taken value for ${item.id}`);
    }
    const epochDate = Date.parse(item.datetaken);
    if (Number.isNaN(epochDate)) {
      console.log('problem with ', epochDate);
    } else {
      if (!albumData.photoIds.includes(item.id)) {
        albumData.photoIds.push(item.id);
        if (!albumData.photoMap[item.id]) {
          albumData.photoMap[item.id] = { dateTaken: item.datetaken };
        }
      }
      if (!albumData.dateTakenArr.includes(epochDate)) {
        albumData.dateTakenArr.push(epochDate);
      }
      if (!albumData.dateTakenMap[epochDate]) {
        albumData.dateTakenMap[epochDate] = [item.id];
      } else {
        albumData.dateTakenMap[epochDate].push(item.id);
        albumData.dupes.total++;
      }
      const index = albumData.photosLastSeen.indexOf(item.id);
      if (index > -1) {
        albumData.photosLastSeen.splice(index, 1);
      }
    }
  });
}

// After photos have been deleted and the new list of photos fetched, remove missing photos from the photo ID array
function removeMissingIds(albumData) {
  albumData.photosLastSeen.forEach((photoId) => {
    const index = albumData.photoIds.indexOf(photoId);
    if (index > -1) {
      albumData.photoIds.splice(index, 1);
    }
    if (albumData.photoMap[photoId]) {
      delete albumData.photoMap[photoId];
    }
  });
  albumData.photosLastSeen = [];
}

// Hit the Flickr API to get photos from a set, then loop through remaining pages and store response data
async function getPhotoIDs(flickr, albumParams, albumData) {
  return new Promise(async (resolve, reject) => {
    try {
      // Need a first request to know how many pages of data there are
      console.log('Getting first page of data...');
      const initialResponse = await flickr.photosets.getPhotos(albumParams);
      albumData.photosLastSeen = albumData.photoIds.slice();
      albumData.photoIds = [];
      albumData.dateTakenArr = [];
      albumData.dupes.total = 0;
      // eslint-disable-next-line no-restricted-syntax
      for (const prop of Object.getOwnPropertyNames(albumData.dateTakenMap)) {
        delete albumData.dateTakenMap[prop];
      }
      addPhotosToArr(initialResponse.body.photoset.photo, albumData);

      // Update page total
      albumParams.pageTotal = initialResponse.body.photoset.pages;

      // Get the rest of the image IDs
      for (let i = 2; i <= albumParams.pageTotal; i++) {
        console.log(`Getting page ${i}...`);
        const params = JSON.parse(JSON.stringify(albumParams));
        params.page = i;
        const data = await flickr.photosets.getPhotos(params);
        addPhotosToArr(data.body.photoset.photo, albumData);
        if (i === albumParams.pageTotal) {
          removeMissingIds(albumData);
          console.log('Done getting photos.');
          resolve(albumData);
        }
      }
    } catch (err) {
      console.error('Error: ', err.body);
      reject(err);
    }
  });
}

module.exports = {
  getPhotoIDs,
};
