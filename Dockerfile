# Self-contained private deployment: the build intentionally embeds local .env credentials.
# Build only on infrastructure you control; the resulting image contains the credentials.
FROM node:26-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src/ ./src/
# Intentionally required: Docker build fails until the operator provides .env.
# This file is gitignored, but MUST NOT be dockerignored.
COPY --chown=node:node .env ./.env
RUN chmod 600 /app/.env && mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
