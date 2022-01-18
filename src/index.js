require('dotenv').config();
const express = require('express');

const app = express();
const port = 3000;

require('./routes')(app);

app.listen(port, () => {
  console.log(`Flickr de-duper listening at http://localhost:${port}`);
});
