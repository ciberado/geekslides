class LocalHub {

  channel;
  messageListeners = {};

  constructor() {
    this.channel = null;
  }

  async connect() {
    console.debug(`Connecting to the broadcast channel.`);
    return new Promise((resolve, reject) => {
        this.channel = new BroadcastChannel(location.origin + location.port + location.pathname);
        this.channel.onmessage = (evt)=>{
            console.debug(`Broadcast channel message:.`, evt.data);
            // The listeners expects to receive a string as payload
            this.messageListeners[evt.data.topic]?.forEach(l => l(JSON.stringify(evt.data.payload), evt.data.topic));  
        };

        resolve();
    });
  }

  async disconnect() {
    console.debug(`Disconnecting broadcast channel.`);
    this.channel.close();
  }

  subscribeListener(topic, listener) {
    if (this.messageListeners[topic] === undefined) {
      this.messageListeners[topic] = [];
    }
    this.messageListeners[topic].push(listener);
  }

  emitMessage(topicName, body) {
    const message = {
        payload : body,
        topic : topicName
    };
    this.channel.postMessage(message);
  }    
}

export default LocalHub;
