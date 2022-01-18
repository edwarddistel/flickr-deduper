function deleteDupes(flickr, albumData) {
  return new Promise((resolve, reject) => {
    let msg;
    if (albumData.dupes.total > 0) {
      Object.keys(albumData.dateTakenMap).forEach(async (dateTaken) => {
        while (albumData.dateTakenMap[dateTaken].length > 1) {
          albumData.dateTakenMap[dateTaken].sort();
          try {
            console.log(`Deleting ${albumData.dateTakenMap[dateTaken].at(-1)}...`);
            await flickr.photos.delete({
              photo_id: albumData.dateTakenMap[dateTaken].at(-1),
            });
          } catch (err) {
            console.error(`Error attempting to delete ${albumData.dateTakenMap[dateTaken].at(-1)}`);
            reject(err);
          }
          albumData.dateTakenMap[dateTaken].pop();
          albumData.dupes.total--;
        }
      });
      msg = 'Dupes deleted.';
    } else {
      msg = 'No dupes.';
    }
    resolve(msg);
  });
}

module.exports = {
  deleteDupes,
};
