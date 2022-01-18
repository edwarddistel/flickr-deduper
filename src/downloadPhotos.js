const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadImage(url) {
  const fileName = url.split('/').at(-1);
  const filePath = path.resolve(__dirname, 'data/backup', fileName);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('end', resolve);
    writer.on('error', reject);
  });
}

async function downloadPhotos(albumData) {
  const mappedPhotos = Object.keys(albumData.photoMap);
  let msg;
  if (mappedPhotos && mappedPhotos.length > 0) {
    const promises = [];
    for (let i = 0; i < mappedPhotos.length; i++) {
      const photoId = mappedPhotos[i];
      const { url } = albumData.photoMap[photoId];
      console.log(`Downloading ${url}`);

      promises.push(downloadImage(url));
    }
    await Promise.all(promises);
    msg = 'Photos downloaded.';
  } else {
    msg = 'No photos downloaded.';
  }
  console.log(msg);
}

module.exports = {
  downloadPhotos,
};
