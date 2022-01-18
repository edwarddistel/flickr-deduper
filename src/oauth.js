require('dotenv').config();
const https = require('https');
const fs = require('fs');
const { parse } = require('url');
const Flickr = require('flickr-sdk');

// needed to run HTTPS locally
const certFiles = {
  key: `${__dirname}/key.pem`,
  cert: `${__dirname}/cert.pem`,
  csr: `${__dirname}/csr.pem`,
};

const envars = [
  'FLICKR_CONSUMER_KEY',
  'FLICKR_CONSUMER_SECRET',
  'FLICKR_REQUEST_TOKEN',
  'FLICKR_REQUEST_TOKEN_SECRET',
  'FLICKR_OAUTH_TOKEN',
  'FLICKR_OAUTH_TOKEN_SECRET',
  'FLICKR_OAUTH_TOKEN_VERIFIER',
  'FLICKR_ALBUM_ID',
  'LOCAL_KEY_FILE',
  'LOCAL_CERT_FILE',
  'USER_ID',
];

// Check envars to ensure they were successfully loaded before starting the program
function checkEnvars() {
  envars.forEach((envar) => {
    if (!process.env[envar]) {
      console.error(`Error, the environment variable ${envar} was not found.`);
      process.exit(1);
    }
  });
}

// Replaces the .env file with the credentials obtained from Flickr
function replaceEnvars() {
  let str = '';
  envars.forEach((envar) => {
    str += `${envar}=${process.env[envar]}
    `;
  });
  try {
    fs.writeFileSync('./.env', str, { encoding: 'utf8', flag: 'w' });
    console.log('Replaced .env values');
  } catch (err) {
    console.log('Error replacing the .env file', err);
  }
}

function checkHttpsCert() {
  try {
    if (!fs.existsSync(certFiles.key) || !fs.existsSync(certFiles.cert)) {
      // See https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/
      console.error(`Error, need to generate cert files. Enter these commands: 
            openssl genrsa -out key.pem
            openssl req -new -key key.pem -out csr.pem
            openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
            rm csr.pem
          `);
    }
  } catch (err) {
    console.error('Error, check Https certf', err);
  }
}

checkEnvars();
checkHttpsCert();
const options = {
  key: fs.readFileSync(certFiles.key),
  cert: fs.readFileSync(certFiles.cert),
};
const oauth = new Flickr.OAuth(
  process.env.FLICKR_CONSUMER_KEY,
  process.env.FLICKR_CONSUMER_SECRET,
);

function getRequestToken(req, res) {
  oauth
    .request('http://localhost:3000/oauth/callback')
    .then((_res) => {
      if (
        _res
        && _res.body
        && _res.body.oauth_callback_confirmed === 'true'
        && _res.body.oauth_token
        && _res.body.oauth_token_secret
      ) {
        process.env.FLICKR_REQUEST_TOKEN = _res.body.oauth_token;
        process.env.FLICKR_REQUEST_TOKEN_SECRET = _res.body.oauth_token_secret;
        console.log('successfully retrieved OAUTH Tokens.');

        res.statusCode = 302;
        res.setHeader(
          'location',
          oauth.authorizeUrl(process.env.FLICKR_REQUEST_TOKEN, 'delete'),
        );
        res.end();
      } else {
        console.error(
          'Error getting oauth_callback, oauth_token, oauth_token_secret back from the request.',
        );
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(
        'Failure to authenticate with the Flickr API using your credentials.',
        err,
      );
      res.statusCode = 400;
      res.end(err.message);
    });
}

function verifyRequestToken(req, res, query) {
  const requestToken = query.oauth_token;
  const oauthVerifier = query.oauth_verifier;

  // retrieve the request secret from the database
  const requestTokenSecret = process.env.FLICKR_REQUEST_TOKEN_SECRET;

  oauth
    .verify(requestToken, oauthVerifier, requestTokenSecret)
    .then((_res) => {
      const oauthToken = _res.body.oauth_token;
      const oauthTokenSecret = _res.body.oauth_token_secret;

      // store the oauth token and secret in the database
      process.env.FLICKR_OAUTH_TOKEN = oauthToken;
      process.env.FLICKR_OAUTH_TOKEN_SECRET = oauthTokenSecret;
      process.env.FLICKR_OAUTH_TOKEN_VERIFIER = oauthVerifier;

      // log all tokens for debugging
      Object.keys(process.env).forEach((key) => {
        if (key.includes('FLICKR')) {
          console.log(`${key}: ${process.env[key]}`);
        }
      });

      // create a new Flickr API client using the oauth plugin
      const flickr = new Flickr(oauth.plugin(oauthToken, oauthTokenSecret));

      // make an API call on behalf of the user
      flickr.test.login().pipe(res);
      replaceEnvars();
    })
    .catch((err) => {
      res.statusCode = 400;
      res.end(err.message);
    });
}

https
  .createServer(options, (req, res) => {
    const url = parse(req.url, true);

    switch (url.pathname) {
      case '/':
        return getRequestToken(req, res);
      case '/oauth/callback':
        return verifyRequestToken(req, res, url.query);
      default:
        res.statusCode = 404;
        res.end();
    }
  })
  .listen(3000, () => {
    console.log('Open your browser to https://localhost:3000');
  });
