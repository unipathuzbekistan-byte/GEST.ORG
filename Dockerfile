FROM node:18-alpine

# node-gyp va Python xatoligini to'g'rilash
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]