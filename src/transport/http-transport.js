// HTTP传输
class HTTPTransport {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async send(method, params) {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params
      })
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.result;
  }
}