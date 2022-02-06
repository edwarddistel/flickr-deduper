# Flickr deduper and sorter

You probably shouldn't use this repo.

If it has any use it's probably to show you how to interface with the Flickr API using the [NodeJS Flickr SDK](https://github.com/flickr/flickr-sdk). 

I created this because I upload photos from my iPhone to Flickr using the Flickr iOS app, except it doesn't always work. Sometimes Flickr will re-upload the same image. Other times I fatfinger the upload and upload dupes.

I wanted an app to:
- Dedupe a single photoset
- Reorder the photos by most recently taken
- Automatically grab the URLs of the largest size of all photos in the photoset
- Run as a background service so it can be automatically run every night

Below I explain how to set up a connection with Flickr using the [NodeJS Flickr SDK](https://github.com/flickr/flickr-sdk), I'd recommend just using that. 
But if you're feeling bold and want to try the exact code I wrote for myself, here's a quick overview of the architecture and endpoints.

## Basic architecture
![](/img/flickr-deduper-architecture.png)

The main app is an [Express server](https://www.npmjs.com/package/express) designed to run on your local machine or in a Docker container. It has a bunch of endpoints that receive HTTP requests and interact with the Flickr data in some way.

The other section of code generates local TLS certs you'll need to complete the Oauth process, then runs the code necessary to retrieve the access codes. It's a one-time setup that you'll never need to repeat.

## Getting set up with the Flickr API

1. [Register for an account with Flickr](https://identity.flickr.com/sign-up) if you haven't already, and log in.
1. Go to Flickr's "App Garden" and [create an app](https://www.flickr.com/services/apps/create/apply) by clicking "apply for a non-commercial key"
1. Fill out the form, check the boxes ![](/img/flickr-1.png), hit submit
1. Copy down the **Key** and **Secret** provided to you and store them somewhere safe
1. While logged into Flickr.com, go to the photo album you want to work with and look at the URL. It should be something like `https://www.flickr.com/photos/123456789@N05/albums/123456789123456`. In this example `123456789@N05` is the **user id** and `123456789123456` is the **album ID**. Write yours down
1. Copy `.env.example` in the root folder to `.env`
1. Open `.env` in a text editor
    ```
    FLICKR_CONSUMER_KEY=tbd
    FLICKR_CONSUMER_SECRET=tbd
    FLICKR_REQUEST_TOKEN=tbd
    FLICKR_REQUEST_TOKEN_SECRET=tbd
    FLICKR_OAUTH_TOKEN=tbd
    FLICKR_OAUTH_TOKEN_SECRET=tbd
    FLICKR_OAUTH_TOKEN_VERIFIER=tbd
    FLICKR_ALBUM_ID=tbd
    USER_ID=tbd
    LOCAL_KEY_FILE=key.pem
    LOCAL_CERT_FILE=cert.pem
    ```
    1. `FLICKR_CONSUMER_KEY` and `FLICKR_CONSUMER_SECRET` are the values you just obtained from Flickr
    1. The next 5 (`FLICKR_REQUEST_TOKEN` to `FLICKR_OAUTH_TOKEN_VERIFIER`) will be obtained from the app. Leave them `tbd` for now
    1. Enter your `FLICKR_ALBUM_ID` and `USER_ID` obtained above
    1. Leave `LOCAL_KEY_FILE` and `LOCAL_CERT_FILE` alone
1. Ensure you have NodeJS installed ([instructions](https://nodejs.org/en/download/package-manager/))
1. **Optional:** install `nvm` ([instructions](https://github.com/nvm-sh/nvm)) and run `nvm use` to use the version of NodeJS I specified in the `.nvmrc` file
1. Install the dependencies by running `npm i`
1. Here's where things start to get dicey so buckle up.
    1. Flickr has a [fairly thorough overview of its Oauth process](https://www.flickr.com/services/api/auth.oauth.html) but it's not the most user-friendly walkthrough I've ever seen.
    1. To authorize your app (yes, that's required as part of the Oauth process, generating the key and secret is not enough by itself) you'll need to run a server on your local machine, open that in your web browser, then click the authorize button. The app will record the credentials produced by that process and save them for you in the `.env` file
    1. To make the above more complicated, the process requires the local server be HTTPS, HTTP will not do. So you need to generate a self-signed certificate locally to produce `key.pem` and `cert.pem` files
    1. I have a bash script that will generate those files for you (`generate-cert.sh`) but we can kill two birds with one one by just running `npm run oauth`, which will run that bash script and then start up the server. So let's do that and see what that looks like
    1. If succesful you should see this in your terminal ![](/img/flickr-3.png)
    1. As the terminal says, open your web browser and navigate to [https://localhost:3000](https://localhost:3000).
    1. You'll get a warning that it's unsafe. That's expected, because the cert is self-signed. Click "Advanced" and "Proceed to localhost (unsafe)" ![](/img/flickr-4.png)
    1. You should see the authorization screen in your browser. Click "OK, I'LL AUTHORIZE IT" ![](/img/flickr-5.png)
    1. If it worked, 3 things will happen. First, you will be redirected in your browser to some JSON output that will (if parsed via a Chrome extension) look like this ![](/img/flickr-6.png)
    1. Second, the app should have overwritten your `.env` file to populate all the values like so ![](/img/flickr-7.png)
    1. But maybe that didn't happen, because maybe the process doesn't have write permissions to that folder, or some other reason. As a backup the values should all be outputted to the terminal, where you can manually enter them into your `.env` file ![](/img/flickr-8.png)
    1. You should be able to now interface with the Flickr API! And if the credentials are stored to that `.env` file, you'll never need to repeat that process. But let's test it out
1. Hit `CTRL-C` to interrupt that process and bring you back to the terminal. Now let's run the main app by typing `npm start`. You should see ![](/img/flickr-9.png) There's no saved data file because you haven't loaded any data yet much less saved it to disk.
1. Let's test the API credentials by opening up your browser and going to [http://localhost:3000/test-login](http://localhost:3000/test-login). If that worked you should see
    1. ![](/img/flickr-10.png)

That's it! You now have a working set of credentials to engage with the Flickr API and can write your own programs.

If you want to use the endpoints programmed into this app, here they are.

## Flickr deduper endpoints

| URL | What it does |
------|---------------
| http://localhost:3000/test-login | tests credentials by attempting to log in |
| http://localhost:3000/get-photos | obtains all photo data from album listed in `.env` file |
| http://localhost:3000/get-photosets | lists all photosets associated with user |
| http://localhost:3000/dedupe | dangerous! deletes duplicate photos in the specified album |
| http://localhost:3000/info | return the current data set |
| http://localhost:3000/reorder | attempts to re-sort album by most recently taken photo |
| http://localhost:3000/get-sizes | gets the largest file sizes for photos in the album |
| http://localhost:3000/save-data | saves obtained data to your computer |
| http://localhost:3000/ugly | a POST endpoint to record ugly photos |
| http://localhost:3000/download-photos | download to disk all photo URLs from `/get-sizes` |

`/dedupe` is **dangerous**. It can and will delete photos from your Flickr account **permanently**, so I don't recommend you use it unless you've already stored copies of all the photos (which you can do via `/get-photos`, `/get-sizes`, then `/download-photos`).

If you want to save the data to disk so you don't have to refetch all of it on every run just hit `/save-data`. It will save your data to `src/data`.

Generally tho I don't recommend you use these endpoints but instead write your own interaction with the Flickr API.

One note on the `/reorder` endpoint tho:

## flickr.photoset.reorderPhotos function isn't perfect

Flckr has a strange way of reordering photos that I don't fully understand, but this is the least worst approach I could come up with.

**Problem 1:** Using the standard Flickr SDK for their REST API endpoints (either `photosets.reorderPhotos` or `photosets.editPhotos`) will return a `414` error if there are too many photo IDs, saying:

```
Error: URI Too Long
    at Request.callback (/flickr-deduper/node_modules/superagent/lib/node/index.js:883:15)
    at IncomingMessage.<anonymous> (/flickr-deduper/node_modules/superagent/lib/node/index.js:1127:20)
```

If there's a way around this problem I have yet to find it, possibly the issue is with the Flickr SDK using `superagent` to send the photo IDs as one long string - one would probably have to not use the SDK and POST directly to the REST endpoint with the data payload as JSON, but that means [signing the request](https://www.flickr.com/services/api/auth.oauth.html) -- which is almost tantamount to writing one's own Flickr API SDK.

**Problem 2:** The [Flickr documentation](https://www.flickr.com/services/api/flickr.photosets.reorderPhotos.html) says if a photo ID is not present in the request it doesn't change. But that's not strictly true, if you send batches of 500 photos (roughly the limit of IDs that can fit into a single URI) it will not displace or push the order of the first 500 photos, instead it will oddly splice the order.

E.g.
```
Req 1: Photo1, Photo2, Photo3...
Req 2: Photo501, Photo502, Photo503...
Req 3: Photo1001, Photo1002, Photo1003...
```

In many cases the resulting order will be `Photo1`, `Photo501`, `Photo10001`. But not always! And I'm not sure why. Maybe it's a timing thing and I need to add a wait to these requests so Flickr has more time to process them? Not sure.

While the below is not perfect it roughly puts things in descending order of most recently shot first, using the timestamp of the photo.

It does this by first creating a set of subarrays, however many are needed to support 250 photo IDs at a time.

Then it uses modular arithmetic to distribute photos sequentially into the resulting subarrays.

Once those subarrays are constructed it hits the Flickr REST API with the list of photo IDs. Not perfect but good enough for my purposes.

## Dockerfile

There's a Dockerfile in this repo that builds this app and runs it in a container, and then uses [forever](https://www.npmjs.com/package/forever to run the server as a background daemon.

I run this app in a Docker container on a NAS, then run a cron job on my NAS to copy the data output to a webserver. But that's why `flickr-cron` is in root as well as the `Dockerfile`.

## Good luck

That's it! Good luck.