// Submits an ordered, comma-separated list of photos to be ordered
async function editPhotos(list, flickr) {
  return flickr.photosets.editPhotos({
    photoset_id: process.env.FLICKR_ALBUM_ID,
    primary_photo_id: process.env.FLICKR_PRIMARY_PHOTO_ID,
    photo_ids: list,
  });
}

// Reorder using galleries.editPhotos instead of photosets.reorderPhotos
async function sortByDateTaken(flickr, albumData) {
  if (
    albumData
    && albumData.dateTakenArr
    && albumData.dateTakenArr.length > 0
  ) {
    const photoIds = [];
    albumData.dateTakenArr
      .sort()
      .reverse()
      .forEach((epochDate) => {
        photoIds.push(albumData.dateTakenMap[epochDate][0]);
      });
    if (!photoIds.includes(process.env.FLICKR_PRIMARY_PHOTO_ID)) photoIds.push(process.env.FLICKR_PRIMARY_PHOTO_ID);
    try {
      const response = await editPhotos(photoIds.join(','), flickr);
      return response;
    } catch (err) {
      console.log('Error reordering photos', err);
    }

    console.log('Photos reordered.');
  } else {
    console.log('Album empty, nothing to order.');
  }
}

module.exports = {
  sortByDateTaken,
};
