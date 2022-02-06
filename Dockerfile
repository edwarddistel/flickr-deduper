FROM node:17-slim

WORKDIR /usr/app
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
COPY package*.json ./
COPY . .
COPY .env .env
RUN apt-get update && apt-get install -y cron vim curl
COPY flickr-cron /etc/cron.d/flickr-cron
RUN chmod 0644 /etc/cron.d/flickr-cron
RUN crontab /etc/cron.d/flickr-cron
RUN npm install
RUN sed -i 's/.query(args)/.param(args)/' ./node_modules/flickr-sdk/services/rest.js
CMD ["cron", "-f"]
RUN npm run forever