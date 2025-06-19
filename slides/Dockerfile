FROM node:lts

ENV TZ=Europe/Madrid
RUN echo Europe/Madrid > /etc/timezone && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive TZ=Europe/Madrid apt-get install tzdata -y

COPY . /app
WORKDIR /app
RUN npm i

ENTRYPOINT ["npm", "run", "start"]