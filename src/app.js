// src/app.js (修复版本)
// 全局变量
let mcpClient = null;
let toolDebugger = null;

// 确保DOM加载完成后再初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing MCP client...');
  
  // 初始化MCP客户端
  mcpClient = new MCPDebugClient();
  toolDebugger = new ToolDebugger(mcpClient);
  
  // 添加到全局window对象，方便调试
  window.mcpClient = mcpClient;
  window.toolDebugger = toolDebugger;
  
  console.log('MCP client initialized:', { mcpClient, toolDebugger });
});

// 连接服务器
async function connectServer() {
  // 确保客户端已初始化
  if (!mcpClient || !toolDebugger) {
    console.error('MCP客户端尚未初始化，请等待页面完全加载');
    return;
  }

  const transportType = document.getElementById('transportType').value;
  let serverUrl = '';
  if (transportType !== 'stdio') {
    const urlInput = document.getElementById('serverUrl');
    serverUrl = urlInput ? urlInput.value : '';
  }
  
  let config;
  if (transportType === 'stdio') {
    let configText = document.getElementById('mcpConfig') ? 
      document.getElementById('mcpConfig').value : 
      document.getElementById('server-config').value;
    try {
      config = JSON.parse(configText);
      // 确保配置格式正确
      config = {
        proxyUrl: 'ws://localhost:3001',
        mcpConfig: config
      };
    } catch (e) {
      document.getElementById('connectionStatus').textContent = 'Failed';
      document.getElementById('connectionStatus').title = '配置JSON解析失败：' + e.message;
      console.error('配置解析失败:', e);
      return;
    }
  } else {
    config = transportType === 'websocket' ? { url: serverUrl } : { baseUrl: serverUrl };
  }

  try {
    console.log('开始连接MCP服务器，配置:', config);
    document.getElementById('connectionStatus').textContent = 'Connecting...';
    
    // 连接MCP客户端
    await mcpClient.connect(transportType, config);
    console.log('MCP客户端连接成功');
    
    // 加载工具并渲染标签
    console.log('开始加载工具...');
    await toolDebugger.loadTools();
    console.log('工具加载完成，工具数量:', mcpClient.tools.length);
    
    document.getElementById('connectionStatus').textContent = 'Connected';
    
  } catch (error) {
    document.getElementById('connectionStatus').textContent = 'Failed';
    document.getElementById('connectionStatus').title = error && error.stack ? 
      error.stack : (error && error.message ? error.message : error);
    console.error('连接失败:', error);
  }
}

// 断开连接功能
function disconnectServer() {
  if (!mcpClient) {
    console.log('MCP客户端未初始化');
    return;
  }

  if (mcpClient.connection) {
    mcpClient.connection.disconnect();
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    
    // 清空工具标签
    const toolsContainer = document.getElementById('toolsTagsContainer');
    if (toolsContainer) {
      toolsContainer.innerHTML = '<p style="color: #666;">Connect to server to see available tools</p>';
    }
    
    // 清空详情和结果
    const toolDetails = document.getElementById('toolDetails');
    if (toolDetails) {
      toolDetails.innerHTML = '<p>Select a tool to see details</p>';
    }
    
    const resultOutput = document.getElementById('resultOutput');
    if (resultOutput) {
      resultOutput.textContent = 'Execute a tool to see results';
      resultOutput.style.color = '';
      resultOutput.style.backgroundColor = '';
    }
    
    // 重置选中的工具
    if (toolDebugger) {
      toolDebugger.selectedTool = null;
    }
    
    console.log('已断开连接并清空界面');
  }
}

// 调试功能 - 移到这里确保能访问到全局变量
function testConnection() {
  console.log('=== 测试连接状态 ===');
  
  if (!mcpClient) {
    console.log('❌ MCP客户端未初始化');
    return;
  }
  
  console.log('✅ MCP客户端已初始化');
  
  if (mcpClient.connection) {
    console.log('✅ 连接对象存在');
    console.log('连接状态:', mcpClient.connection.connected ? '已连接' : '未连接');
  } else {
    console.log('❌ 连接对象不存在');
  }
  
  console.log('工具数量:', mcpClient.tools ? mcpClient.tools.length : 0);
  if (mcpClient.tools && mcpClient.tools.length > 0) {
    console.log('工具列表:', mcpClient.tools.map(t => t.name));
  }
  
  if (!toolDebugger) {
    console.log('❌ ToolDebugger未初始化');
  } else {
    console.log('✅ ToolDebugger已初始化');
    console.log('当前选中工具:', toolDebugger.selectedTool ? toolDebugger.selectedTool.name : '无');
  }
}

function showConnectionInfo() {
  console.log('=== MCP客户端详细信息 ===');
  
  if (!mcpClient) {
    console.log('MCP客户端未初始化');
    return;
  }
  
  console.log('客户端对象:', mcpClient);
  console.log('连接对象:', mcpClient.connection);
  console.log('能力:', mcpClient.capabilities);
  console.log('工具数量:', mcpClient.tools ? mcpClient.tools.length : 0);
  console.log('资源数量:', mcpClient.resources ? mcpClient.resources.length : 0);
  
  // 显示工具详情
  if (mcpClient.tools && mcpClient.tools.length > 0) {
    console.log('=== 工具详情 ===');
    mcpClient.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
    });
  }
}

function exportLogs() {
  const logs = {
    timestamp: new Date().toISOString(),
    initialized: {
      mcpClient: !!mcpClient,
      toolDebugger: !!toolDebugger,
      connection: mcpClient ? !!mcpClient.connection : false
    },
    mcpClient: mcpClient ? {
      connected: mcpClient.connection?.connected || false,
      toolsCount: mcpClient.tools?.length || 0,
      tools: mcpClient.tools?.map(t => t.name) || [],
      capabilities: mcpClient.capabilities
    } : null,
    toolDebugger: toolDebugger ? {
      selectedTool: toolDebugger.selectedTool?.name || null
    } : null,
    page: {
      url: window.location.href,
      userAgent: navigator.userAgent
    }
  };
  
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mcp-debug-logs-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('日志已导出:', logs);
}

// 添加一个初始化检查函数
function checkInitialization() {
  console.log('=== 初始化检查 ===');
  console.log('window.MCPDebugClient:', typeof window.MCPDebugClient);
  console.log('window.ToolDebugger:', typeof window.ToolDebugger);
  console.log('window.StdioTransport:', typeof window.StdioTransport);
  console.log('mcpClient:', mcpClient);
  console.log('toolDebugger:', toolDebugger);
  console.log('window.mcpClient:', window.mcpClient);
  console.log('window.toolDebugger:', window.toolDebugger);
}

// 页面加载完成后自动检查
window.addEventListener('load', () => {
  console.log('页面完全加载完成');
  setTimeout(checkInitialization, 1000); // 1秒后检查初始化状态
});