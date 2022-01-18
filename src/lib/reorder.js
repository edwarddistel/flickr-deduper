// Submits an ordered, comma-separated list of photos to be ordered
function reorderPhotos(str, flickr) {
  // console.log(str);  // uncomment to see order of photo IDs being sent
  return flickr.photosets.reorderPhotos({
    photoset_id: process.env.FLICKR_ALBUM_ID,
    photo_ids: str,
  });
}

/* Logic:
- Divide total photos by 500 (requests must be batched in 500s)
- Create enough subarrays for 500 photo blocks
- Distribute photos into subarrays % mod subArray #
- Send batches for ordering
See README for more details on how/why
*/
async function sortByDateTaken(flickr, albumData) {
  if (
    albumData
    && albumData.dateTakenArr
    && albumData.dateTakenArr.length > 0
  ) {
    const dates = [];
    const subArrs = Math.ceil(albumData.dateTakenArr.length / 500);
    for (let i = 0; i < subArrs; i++) {
      dates.push([]);
    }
    const subArrsOffset = subArrs - 1;
    albumData.dateTakenArr
      .sort()
      .reverse()
      .forEach((epochDate, index) => {
        const arrCtr = index % subArrsOffset;
        dates[arrCtr].push(albumData.dateTakenMap[epochDate]);
      });
    for (let j = 0; j < subArrs; j++) {
      console.log(`Reordering batch ${j + 1}...`);
      await reorderPhotos(dates[j].join(','), flickr);
    }
    console.log('Photos reordered.');
  } else {
    console.log('Album empty, nothing to order.');
  }
}

module.exports = {
  sortByDateTaken,
};
