FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install -g npm
RUN npm install --only=production
RUN npm install reflect-metadata tslib

COPY . .
EXPOSE 8090

CMD ["node", "main"]
