const fs = require('fs');

const path = './src/data/albumData.json';
const jsVersion = './src/data/albumData.js';
const { albumDataBase } = require('./helpers');

// Load the Flickr data previously saved to a file to save on calls to API
function fileDataRead() {
  try {
    let data;
    if (fs.existsSync(path)) {
      data = JSON.parse(fs.readFileSync(path));
      const defaultKeys = albumDataBase();
      Object.keys(defaultKeys).forEach((key) => {
        if (!data[key]) {
          if (Array.isArray(defaultKeys[key])) {
            data[key] = [];
          } else {
            data[key] = {};
          }
        }
      });
      console.log(`Loaded data from ${path}`);
    } else {
      console.log(`No saved data file at ${path}`);
    }
    return data;
  } catch (err) {
    console.log('Error loading data from file. ', err);
    return null;
  }
}

// Write Flickr data to API
function fileDataWrite(data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data), {
      encoding: 'utf8',
      flag: 'w',
    });
    const content = `const albumData = ${JSON.stringify(data)};`;
    fs.writeFileSync(jsVersion, content, { encoding: 'utf8', flag: 'w' });
    console.log(`Data successfully written to ${path}`);
  } catch (err) {
    console.log(`Error writing data to ${path}`, err);
  }
}

// Add photos to the ugly array for possible later deletion
function addToUgly(req, albumData) {
  try {
    if (req && req.photoIdsUgly) {
      const uglyPhotos = req.photoIdsUgly.includes('%2C')
        ? [...req.photoIdsUgly.split('%2C')]
        : req.photoIdsUgly;
      if (albumData) {
        if (!albumData.photoIdsUgly) {
          albumData.photoIdsUgly = [];
        } else {
          uglyPhotos.forEach((uglyPhotoId) => {
            if (!albumData.photoIdsUgly.includes(uglyPhotoId)) {
              albumData.photoIdsUgly.pish(uglyPhotoId);
            }
          });
        }
      }
    }
    console.log('Added ugly photos to the list.');
  } catch (err) {
    console.log('Error adding ugly photos to the list', err);
  }
}

module.exports = {
  addToUgly,
  fileDataRead,
  fileDataWrite,
};
