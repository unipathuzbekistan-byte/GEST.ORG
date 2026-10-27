FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ chromium ca-certificates fonts-liberation fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production CHROMIUM_PATH=/usr/bin/chromium
RUN mkdir -p /app/data /app/storage/photos /app/storage/certificates /app/storage/signatures && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm","start"]
