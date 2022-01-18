#!/bin/bash
openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem -subj "/C=US/ST=NY/L=NYC/O=localhost/OU=localhost/CN=localhost"
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
rm csr.pem
mv key.pem src/key.pem
mv cert.pem src/cert.pem