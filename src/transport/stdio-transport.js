// src/transport/stdio-transport.js
class StdioTransport {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.proxyUrl = config.proxyUrl || 'ws://localhost:3001';
    this.connected = false;
    this.debugMode = true; // 启用调试模式
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[StdioTransport]', ...args);
    }
  }

  async connect() {
    this.log('开始连接到代理服务器:', this.proxyUrl);
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.proxyUrl);
      
      this.ws.onopen = () => {
        this.log('WebSocket连接已建立');
        
        // 发送连接配置
        const connectMessage = {
          method: 'connect',
          params: {
            config: this.config.mcpConfig
          }
        };
        
        this.log('发送配置到代理服务器:', connectMessage);
        this.ws.send(JSON.stringify(connectMessage));
        
        // 监听第一个消息或超时
        let resolved = false;
        const connectionTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.connected = true;
            this.log('连接超时，但标记为已连接');
            resolve();
          }
        }, 5000); // 减少等待时间到5秒

        // 如果收到任何消息，认为连接成功
        const onFirstMessage = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimer);
            this.connected = true;
            this.log('收到第一个消息，连接成功');
            resolve();
          }
        };

        this.ws.addEventListener('message', onFirstMessage, { once: true });
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket错误:', error);
        reject(new Error('Failed to connect to proxy server'));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        this.log('WebSocket连接关闭:', event.code, event.reason);
        this.connected = false;
      };

      // 连接超时
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          this.log('连接超时');
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async send(method, params) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    this.log('发送请求:', method, message);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(message));
      
      // 增加超时时间到60秒，特别是对于initialize
      const timeout = method === 'initialize' ? 60000 : 30000;
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.log(`请求超时: ${method} (${timeout}ms)`);
          reject(new Error(`Timeout: ${method}`));
        }
      }, timeout);
    });
  }

  async sendNotification(method, params) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const message = {
      jsonrpc: "2.0",
      method,
      params
    };

    this.log('发送通知:', method, message);
    this.ws.send(JSON.stringify(message));
    return Promise.resolve();
  }

  handleMessage(event) {
    try {
      const response = JSON.parse(event.data);
      this.log('收到响应:', response);
      
      if (response.id && this.pendingRequests.has(response.id)) {
        const { resolve, reject, method } = this.pendingRequests.get(response.id);
        this.pendingRequests.delete(response.id);
        
        if (response.error) {
          this.log(`请求失败 ${method}:`, response.error);
          reject(new Error(response.error.message || JSON.stringify(response.error)));
        } else {
          this.log(`请求成功 ${method}:`, response.result);
          resolve(response.result);
        }
      } else {
        this.log('收到通知或无匹配的响应:', response);
      }
    } catch (error) {
      this.log('解析消息失败:', error, 'Raw:', event.data);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StdioTransport;
} else {
  window.StdioTransport = StdioTransport;
}