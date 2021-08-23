import {Client as PahoMQTTClient, Message as PahoMQTTMessage} from  'paho-mqtt/paho-mqtt';

class SimpleMqttClient {
  host;
  port;
  username;
  password;

  client;
  messageListeners = {};

  constructor(host, port, username, password) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.client = new PahoMQTTClient(host, port, 'SimpleClient' + Date.now() + parseInt(Math.random()*1000));

    this.client.onConnectionLost = (error) => {
      console.log(`mqtt client disconnected: ${error.errorMessage}.`, error);
    };

    this.client.onMessageArrived = (message)=>{
      try {
        console.debug(`mqtt message:.`, message.payloadString)
        this.messageListeners[message.topic].forEach(l => l(message.payloadString, message.topic));  
      } catch (error) {
        console.debug(`mqtt error: ${JSON.stringify(error)}.`);
      }
    };

  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.debug('Connecting to mqtt server.');
      this.client.connect({
        userName : this.username,
        password : this.password,
        useSSL: false, // true, 
        reconnect: true,
        onSuccess : () => {
          this.#clientConnected()
          resolve();
        }
      });
    });
  }

  async disconnect() {
    this.client.disconnect();
  }

  subscribeListener(subtopic, listener) {
    const topic = `rooms/demo/state/${subtopic}`;
    if (this.client.isConnected() === true) {
      this.client.subscribe(topic);
    }
    if (this.messageListeners[topic] === undefined) {
      this.messageListeners[topic] = [];
    }
    this.messageListeners[topic].push(listener);
  }

  #clientConnected() {
    console.log(`Mqtt client connected to ${this.host}.`);
    const topics = Object.keys(this.messageListeners);
    topics.forEach(t => this.client.subscribe(t))
    console.log(`Subscribed to ${JSON.stringify(topics)}.`);
  }

  emitMessage(topicName, body, qos, retained) {
    const message = new PahoMQTTMessage(typeof body === 'string' ? body : JSON.stringify(body));
    message.destinationName = `rooms/demo/state/${topicName}`;
    if (qos) message.qos = qos;
    if (retained) message.retained = retained;
    this.client.send(message);
  }    
}

export default SimpleMqttClient;
export { hub };