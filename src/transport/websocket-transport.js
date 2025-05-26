// WebSocket传输
class WebSocketTransport {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async send(method, params) {
    const id = ++this.messageId;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));
    });
  }

  onMessage(event) {
    const response = JSON.parse(event.data);
    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve, reject } = this.pendingRequests.get(response.id);
      if (response.error) {
        reject(response.error);
      } else {
        resolve(response.result);
      }
      this.pendingRequests.delete(response.id);
    }
  }
}