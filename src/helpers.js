// Base set of parameters for when requesting photos from the Flickr API
function albumParamsBase() {
  return {
    user_id: process.env.USER_ID,
    photoset_id: process.env.FLICKR_ALBUM_ID,
    pageTotal: 1,
    page: 1,
    extras: 'date_taken',
  };
}

// Base set of objects and arrays used for data storage in memory
function albumDataBase() {
  return {
    photoIdsUgly: [],
    photoUrls: [],
    photoIds: [],
    photoMap: {},
    photoSets: [],
    photosLastSeen: [],
    dateTakenArr: [],
    dateTakenMap: {},
    dupes: {},
  };
}

// Format a human readable date for responses from the app
function formatDate() {
  return `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
}

// Counts how many photos are in the ID array but not in the photo map to estimate how long it will take to download them
function countMissingUrls(albumData) {
  let ctr = 0;
  albumData.photoIds.forEach((id) => {
    if (albumData.photoMap[id] && !albumData.photoMap[id].url) {
      ctr++;
    }
  });
  return ctr;
}

module.exports = {
  albumParamsBase,
  albumDataBase,
  formatDate,
  countMissingUrls,
};
