FROM node:16-alpine as base
RUN apk update
RUN apk add g++ make py3-pip
WORKDIR /
COPY package*.json /
#COPY /apps /apps/
COPY . .
ENV PORT=8092
EXPOSE ${PORT}

FROM base as production
ENV NODE_ENV=production
RUN npm install -g npm@9.2.0 node-gyp
#RUN npm install
# dependencies that nestjs needs
#RUN npm install reflect-metadata tslib rxjs @nestjs/platform-express
CMD ["npm", "run", "build"]
CMD npm run start:ticker
