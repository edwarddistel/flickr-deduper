FROM node:17-slim

WORKDIR /usr/app
COPY package*.json ./
COPY . .
COPY .env .env
RUN apt-get update && apt-get install -y cron vim curl
COPY flickr-cron /etc/cron.d/flickr-cron
RUN chmod 0644 /etc/cron.d/flickr-cron
RUN crontab /etc/cron.d/flickr-cron
RUN npm install
CMD ["cron", "-f"]
RUN npm run forever