const WebSocket = require('ws');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// 日志记录
const logStream = fs.createWriteStream('./proxy-server.log', { flags: 'a' });
function logToBoth(...args) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
  process.stdout.write(msg);
  logStream.write(msg);
}
console.log = (...args) => logToBoth(...args);
console.error = (...args) => logToBoth(...args);

class MCPProxyServer {
  constructor(port = 3001) {
    this.port = port;
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      let mcpProcess = null;
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('Received from browser:', data);
          
          if (data.method === 'connect' && data.params.config) {
            mcpProcess = this.connectToMCPServer(ws, data.params.config);
          } else if (mcpProcess && mcpProcess.stdin) {
            // 转发消息到MCP进程
            const messageStr = JSON.stringify(data) + '\n';
            console.log('Forwarding to MCP:', messageStr.trim());
            mcpProcess.stdin.write(messageStr);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        if (mcpProcess) {
          mcpProcess.kill();
        }
      });
    });
  }

  connectToMCPServer(ws, config) {
    console.log('Starting MCP server with config:', JSON.stringify(config, null, 2));
    
    const { command, args } = config;
    
    const mcpProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false // 不需要shell，因为我们已经通过cmd.exe
    });

    console.log('MCP process started with PID:', mcpProcess.pid);

    // 处理stdout - 这里是JSON-RPC响应
    mcpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('MCP stdout:', output);
      
      // 分行处理，每行可能是一个JSON响应
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          console.log('Sending to browser:', response);
          ws.send(JSON.stringify(response));
        } catch (error) {
          console.log('Non-JSON stdout:', line);
        }
      });
    });

    // 处理stderr - 这里通常是状态信息，不需要转发
    mcpProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      console.log('MCP stderr (status):', errorOutput);
      // 不转发stderr到浏览器，因为这通常是状态信息
    });

    mcpProcess.on('close', (code) => {
      console.log(`MCP Server process exited with code ${code}`);
    });

    mcpProcess.on('error', (error) => {
      console.error('MCP process error:', error);
      ws.send(JSON.stringify({
        id: null,
        error: { code: -1, message: `MCP process error: ${error.message}` }
      }));
    });

    return mcpProcess;
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`MCP Proxy Server running on port ${this.port}`);
    });
  }
}

const proxy = new MCPProxyServer(3001);
proxy.start();