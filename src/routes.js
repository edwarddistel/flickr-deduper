const Flickr = require('flickr-sdk');
const { deleteDupes } = require('./lib/dedupe');
const { getPhotoIDs } = require('./lib/getPhotos');
const { getListOfPhotoSets } = require('./lib/getPhotoSets');
const { sortByDateTaken } = require('./lib/reorder');
const { testLogin } = require('./lib/testLogin');
const { getSizes } = require('./lib/getSizes');
const {
  albumParamsBase,
  albumDataBase,
  formatDate,
  countMissingUrls,
} = require('./helpers');
const { fileDataRead, fileDataWrite, addToUgly } = require('./fileData');
const { downloadPhotos } = require('./downloadPhotos');

// Object used to interface with API
const flickr = new Flickr(
  Flickr.OAuth.createPlugin(
    process.env.FLICKR_CONSUMER_KEY,
    process.env.FLICKR_CONSUMER_SECRET,
    process.env.FLICKR_OAUTH_TOKEN,
    process.env.FLICKR_OAUTH_TOKEN_SECRET,
  ),
);

// Used for data storage
let albumParams = albumParamsBase();
let albumData = fileDataRead() || albumDataBase();

module.exports = function (app) {
  app.get('/', (req, res) => {
    res.send({
      date: formatDate(),
      msg: 'Server successfully running',
    });
  });

  app.get('/clear-globals', (req, res) => {
    albumData = albumDataBase();
    albumParams = albumParamsBase();

    res.send({
      date: formatDate(),
      msg: 'Global state reset',
      albumData,
      albumParams,
    });
  });

  app.get('/test-login', async (req, res) => {
    try {
      const results = await testLogin(flickr);
      res.send({
        date: formatDate(),
        msg: 'Tested login',
        output: results,
      });
    } catch (err) {
      console.error('Error testing login', err);
    }
  });

  app.get('/get-photos', async (req, res) => {
    try {
      const results = await getPhotoIDs(flickr, albumParams, albumData);
      res.send({
        date: formatDate(),
        msg: 'Refreshed photo list',
        results,
      });
    } catch (err) {
      console.error('Error getting photos', err);
    }
  });

  app.get('/get-photosets', async (req, res) => {
    try {
      const photosets = await getListOfPhotoSets(flickr, albumData);
      res.send({
        date: formatDate(),
        photosets,
      });
    } catch (err) {
      console.error('Error getting photosets', err);
    }
  });

  app.get('/dedupe', async (req, res) => {
    try {
      const status = await deleteDupes(flickr, albumData);
      res.send({
        date: formatDate(),
        msg: status,
      });
    } catch (err) {
      console.error('Error de-duping', err);
    }
  });

  app.get('/reorder', async (req, res) => {
    try {
      await sortByDateTaken(flickr, albumData);
      res.send({
        date: new Date(),
        msg: 'Photos reordered',
      });
    } catch (err) {
      console.error('Error reordering', err);
    }
  });

  app.get('/get-sizes', (req, res) => {
    try {
      const photoNum = countMissingUrls(albumData);
      const minutes = Math.round((photoNum * 2.5) / 60);
      const time = `Get photo URLs initiated. With ${photoNum} photos it should take ~${minutes} minutes to download all.`;
      getSizes(flickr, albumData);
      res.send({
        date: new Date(),
        msg: 'Sizes retrieved',
        data: time,
      });
    } catch (err) {
      console.error('Error getting photo sizes', err);
    }
  });

  app.get('/save-data', (req, res) => {
    fileDataWrite(albumData);
    res.send({
      date: new Date(),
      msg: 'Data save command initiatied',
    });
  });

  app.post('/ugly', (req, res) => {
    addToUgly(req);
    fileDataWrite(albumData);
    res.send({
      date: new Date(),
      msg: 'Data save command initiatied',
    });
  });

  app.get('/info', (req, res) => {
    res.send({
      date: new Date(),
      info: albumData,
    });
  });

  app.get('/download-photos', (req, res) => {
    downloadPhotos(albumData);
    res.send({
      date: new Date(),
      info: 'Photo download initiated.',
    });
  });
};
