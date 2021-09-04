/**
 * This little piece of code is based on the nice post written by shrey misra
 * https://shrey-misra.medium.com/customizing-your-own-mqtt-broker-with-node-js-4bc8212a1739
 * 
 */

// Seconds between updating the $SYS/greekslides topic with stats. 30 seconds for production, 5 for otherc
const STATS_INTERVAL_SECONDS = process.env.NODE_ENV === 'dev' ? 10 : 30;

// Administrator username and password for this server
const ADMIN_USERNAME = 'administrator';

const winston = require('winston');

const logger = winston.createLogger({
   level: 'info',
   format: winston.format.json(),
   defaultMeta: { service: 'geekslides-broker' },
   transports: [
     new winston.transports.File({ filename: 'error.log', level: 'error' })
   ],
 });
 if (process.env.NODE_ENV !== 'production') {
   logger.add(new winston.transports.Console({
     format: winston.format.simple(),
   }));
}

const password = process.env.ADMIN_PASS || require('generate-password').generate({length: 10, numbers: true});
logger.info(`Use ${password} as password to administrate the broker.`);

const aedes = require('aedes')();

// Port for the standard mqtt tcp server
const port = process.env.TCP_PORT || 1883;
// Port for the websocket server (without TLS!)
const wsPort = process.env.WS_PORT || 8883;
// Port for the secured websocket server (with TLS)
const wssPort = process.env.WSS_PORT || 8443;
// Path to the directory with the certificates (ex: /etc/letsencrypt/live/mydomain.com/)
const wssCertsPath = process.env.CERT_PATH;


// Creation of the TCP server
const tcpServer = require('net').createServer(aedes.handle);
tcpServer.listen(port, function() {
    logger.log('info', 'Aedes MQTT listening on port: ' + port);
});

const ws = require('websocket-stream');

// Creation of the websocket server (non TLS)
const httpServer = require('http').createServer();
ws.createServer({ server: httpServer }, aedes.handle)
httpServer.listen(wsPort, function () {
    logger.log('info', 'Aedes MQTT-WS listening on port: ' + wsPort)
});

// Optional creation of the WSS server (with TLS)
if (wssCertsPath) {
    const fs = require('fs');
    const httpsServer = require('https').createServer({
        key : fs.readFileSync(wssCertsPath + 'privkey.pem'),
        cert : fs.readFileSync(wssCertsPath + 'cert.pem')
    });
    ws.createServer({ server: httpsServer }, aedes.handle);
    httpsServer.listen(wssPort, function() {
        logger.log('info', 'Aedes MQTT-WSS listening on port: ' + wssPort)
    });    
}

/**
 * Represents an mqtt client and helps to record its credentials.
 */
class User {
    id;
    username;
    password;

    constructor(id, username, password) {
        this.id = id;
        this.username = username;
        this.password = password;
    }

    isAdministrator() {
        return this.username === ADMIN_USERNAME && this.password === password;
    }
}

/**
 * A room is an isolated place to exchange messages. They are created by posting to a topic
 * with a name following the pattern `rooms/<room name>/config/password. The payload of the 
 * message will be the password for this room.
 * 
 * Anybody can be subscribed to a room (except if the topic includes the text 'config') but
 * only the clients providing a *client password* matching the one set for the room will
 * be authorized to post messages to it.
 */
class Room {
    name;
    password;

    constructor(name, password) {
        this.name = name;
        this.password = password;
    }

    isAuthorizedToPublish(user) {
        return user.password === this.password;
    }
}

const roomsByName = {};
const usersById = {};

/**
 * 
 * @param {string} topic, following the pattern 'rooms/NAME/xxx/yyyy'.
 * @returns the name, extracted from the topic. Or null if it doesn't follow the convention.
 */
function getRoomNameFromTopic(topic) {
    // extract name of the room, for example "alpha" in "rooms/alpha/control"
    const regex = /rooms\/(.+?)\/.*$/i;
    const match = topic.match(regex);
    // typically [0] should contain the whole string and [1] the room name
    if (!match || match.length != 2) {
        return null;
    }
    return match[1];
}

/**
 *
 * All clients indicating username are going to be considered authenticated. Authorization depends
 * on each room, but password is set by client. That means the user will need different clients for
 * different rooms (unless they all share the same password).
 *  
 * @param {*} client 
 * @param {*} username 
 * @param {*} password 
 * @param {*} callback
 * 
 *  
 * @returns 
 */
aedes.authenticate = (client, username, password, callback) => {
    if (!username) {
        return callback(new Error('Username is required.'));
    }

    password = !password ? '' : Buffer.from(password, 'base64').toString();

    const user = new User(client.id, username, password);
    usersById[user.id] = user;

    logger.log('info', `[CLIENT_AUTHENTICATED] User ${username} connected with client id ${client.id}.`);
    return callback(null, true);
}

aedes.authorizeSubscribe = (client, subscription, callback) => {
    const user = client ? usersById[client.id] : null;
    if (!user?.isAdministrator()) {
        if (subscription.topic.includes('#') || subscription.topic.includes('+')) {
            logger.log('warn', '[SUBS_AUTH_ERROR] Unauthorized subscription to wildcard topics.');
            return callback(new Error('You are not authorized to subscribe on this message topic.'));
        }
        if (subscription.topic.startsWith('rooms') === false) {
            logger.log('warn', '[SUBS_AUTH_ERROR] Unauthorized subscription to root topics.');
            return callback(new Error('You are not authorized to subscribe on this message topic.'));
        }
    }
    return callback(null, subscription);
};
1
// authorizing client to publish on a message topic, or to try to set the configuration of a new room
aedes.authorizePublish = (client, message, callback) => {
    const roomName = getRoomNameFromTopic(message.topic);
    if (roomName === null) {
        logger.log('warn', `[PUB_AUTH_ERROR] Incorrect topic name (${message.topic}).`);
        return callback(new Error('This topic name is not allowed.'));
    }
    
    const user = usersById[client.id];
    let room = roomsByName[roomName];
    
    // new room, let's create it and authorize the post
    if (room === undefined) {
        room = new Room(roomName, user.password);
        roomsByName[roomName] = room;    

        logger.log('info', `[ROOM_CHANGE] New room created with the name ${roomName} by ${user.username}.`);
        return callback(null);
    }
    // existing room, and client has authorization
    if ((room !== undefined) && (room.isAuthorizedToPublish(user))) {
        return callback(null);
    } 

    logger.log('warn', `[PUB_AUTH_ERROR] Client ${client.id} (${user.username} is not authorized to publish to ${message.topic}).`);
    return callback(new Error('You are not authorized to publish on this topic.'));
}

// emitted when a client connects to the broker
aedes.on('client', function (client) {
    logger.log('debug', `[CLIENT_CONNECTED] Client ${(client ? client.id : client)} connected to broker ${aedes.id}`)
});

// emitted when a client disconnects from the broker
aedes.on('clientDisconnect', function (client) {
    delete usersById[client.id];
    logger.log('debug', `[CLIENT_DISCONNECTED] Client ${(client ? client.id : client)} disconnected from the broker ${aedes.id}`);
})

// emitted when a client subscribes to a message topic
aedes.on('subscribe', function (subscriptions, client) {
    logger.log('debug', `[TOPIC_SUBSCRIBED] Client ${(client ? client.id : client)} subscribed to topics: ${subscriptions.map(s => s.topic).join(',')} on broker ${aedes.id}`)
})

// emitted when a client unsubscribes from a message topic
aedes.on('unsubscribe', function (subscriptions, client) {
    logger.log('debug', `[TOPIC_UNSUBSCRIBED] Client ${(client ? client.id : client)} unsubscribed to topics: ${subscriptions.join(',')} from broker ${aedes.id}`)
})

// emitted when a client publishes a message packet on the topic
aedes.on('publish', async function (message, client) {
    // only authorized clients will be able control or configure a room
    if (!client) return;
    const user = usersById[client.id];
    const roomName = getRoomNameFromTopic(message.topic);    
    let room = roomsByName[roomName];

    // if the room didn't exist and the the client is trying to set its password, lets create one
    if (room !== undefined && message.topic === `rooms/${roomName}/config/password`) {
        const password = message.payload.toString();
        room.password = password;
        logger.log('info', `[ROOM_CHANGE] Password changed for room ${roomName} by ${user.username}.`);
    }
})

// Publish basic stats
setInterval(()=>{
    const topic = '$SYS/greekslides';
    const payload = JSON.stringify({
        numberOfRooms : Object.keys(roomsByName).length,
        numberOfUsers : Object.keys(usersById).length
    });2
    logger.info(`[STATS] ${payload}.`);
    aedes.publish({
        cmd: 'publish',
        qos: 0,
        topic: topic,
        payload: Buffer.from(payload),
        retain: false
      });
}, 1000 * STATS_INTERVAL_SECONDS);