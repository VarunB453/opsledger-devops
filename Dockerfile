FROM node:20.15.0-alpine3.20

EXPOSE 8080
ENV DB_HOST=mysql
RUN addgroup -S expense && adduser -S expense -G expense \
    && mkdir /opt/server \
    && chown expense:expense -R /opt/server
WORKDIR /opt/server
COPY package.json package-lock.json /opt/server/
COPY *.js /opt/server/
COPY public/ /opt/server/public/
RUN npm ci --omit=dev
USER expense
CMD [ "node","index.js" ]