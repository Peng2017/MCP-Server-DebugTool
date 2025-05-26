// src/core/mcp-client.js
class MCPDebugClient {
  constructor() {
    this.connection = null;
    this.capabilities = null;
    this.tools = [];
    this.resources = [];
    this.debugMode = true;
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[MCPClient]', ...args);
    }
  }

  async connect(transport, serverConfig) {
    try {
      this.log('开始连接，传输类型:', transport);
      this.connection = await this.createTransport(transport, serverConfig);
      
      this.log('建立传输连接...');
      await this.connection.connect();
      
      this.log('初始化MCP协议...');
      await this.initialize();
      
      this.log('加载功能...');
      await this.loadCapabilities();
      
      this.log('更新UI...');
      this.updateUI();
      
      this.log('连接完成！');
    } catch (error) {
      this.log('连接失败:', error);
      throw error;
    }
  }

  async createTransport(type, config) {
    switch (type) {
      case 'websocket':
        return new WebSocketTransport(config.url);
      case 'http':
        return new HTTPTransport(config.baseUrl);
      case 'stdio':
        return new StdioTransport({
          proxyUrl: config.proxyUrl || 'ws://localhost:3001',
          mcpConfig: config.mcpConfig
        });
      default:
        throw new Error(`Unsupported transport: ${type}`);
    }
  }

  async initialize() {
    this.log('开始MCP初始化握手');
    
    // 重试机制
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await this.connection.send('initialize', {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          clientInfo: {
            name: "mcp-debug-client",
            version: "1.0.0"
          }
        });
        
        this.log('初始化成功:', result);
        this.capabilities = result.capabilities;
        
        // 发送initialized通知
        this.log('发送initialized通知');
        if (this.connection.sendNotification) {
          await this.connection.sendNotification('initialized', {});
        } else {
          await this.connection.send('initialized', {});
        }

        // 给服务器时间处理
        this.log('等待服务器处理...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.log('初始化完成');
        return; // 成功退出
        
      } catch (error) {
        retries--;
        this.log(`初始化失败，剩余重试次数: ${retries}`, error.message);
        if (retries === 0) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
      }
    }
  }

  async loadCapabilities() {
    if (this.capabilities?.tools !== undefined) {
      await this.loadTools();
    }
    if (this.capabilities?.resources !== undefined) {
      await this.loadResources();
    }
  }

  async loadTools() {
    try {
      this.log('加载工具列表');
      const result = await this.connection.send('tools/list', {});
      this.tools = result.tools || [];
      this.log('加载到工具数量:', this.tools.length);
    } catch (error) {
      this.log('加载工具失败:', error);
      this.tools = [];
    }
  }

  async loadResources() {
    try {
      this.log('加载资源列表');
      const result = await this.connection.send('resources/list', {});
      this.resources = result.resources || [];
      this.log('加载到资源数量:', this.resources.length);
    } catch (error) {
      this.log('加载资源失败:', error);
      this.resources = [];
    }
  }

  updateUI() {
    this.log('更新UI，触发mcpConnected事件');
    window.dispatchEvent(new CustomEvent('mcpConnected', {
      detail: {
        capabilities: this.capabilities,
        tools: this.tools,
        resources: this.resources
      }
    }));
  }
}

if (typeof window !== 'undefined') {
  window.MCPDebugClient = MCPDebugClient;
}