# Dockerfile
FROM node:20-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY wait-for.sh /app/wait-for.sh
RUN chmod +x /app/wait-for.sh

CMD ["/app/wait-for.sh", "legalclick-db:5432", "--", "node", "backend/index.js"]
