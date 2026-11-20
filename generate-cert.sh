#!/bin/sh
# Local-only self-signed certificate for the one-time Flickr OAuth callback.
set -eu
umask 077
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout key.pem -out cert.pem \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
printf 'Created key.pem and cert.pem for local OAuth (both gitignored).\n'
