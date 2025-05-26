// src/debugger/tool-debugger.js
class ToolDebugger {
  constructor(mcpClient) {
    this.client = mcpClient;
    this.selectedTool = null;
  }

  // 加载所有工具
  async loadTools() {
    try {
      console.log('ToolDebugger: 开始加载工具');
      const result = await this.client.connection.send('tools/list', {});
      this.client.tools = result.tools || [];
      console.log('ToolDebugger: 加载到工具数量:', this.client.tools.length);
      
      // 使用新的标签渲染方法
      this.renderToolsTags();
      
    } catch (error) {
      console.error('ToolDebugger: 加载工具失败:', error);
      this.client.tools = [];
      this.renderToolsTags(); // 即使失败也要渲染空状态
    }
  }

  // 渲染工具标签（新布局）
  renderToolsTags() {
    console.log('ToolDebugger: 开始渲染工具标签，工具数量:', this.client.tools.length);
    
    const container = document.getElementById('toolsTagsContainer');
    if (!container) {
      console.error('找不到toolsTagsContainer容器');
      return;
    }
    
    container.innerHTML = '';

    if (!this.client.tools || this.client.tools.length === 0) {
      container.innerHTML = '<p style="color: #666;">No tools available</p>';
      console.log('ToolDebugger: 没有可用工具');
      return;
    }

    this.client.tools.forEach((tool, index) => {
      const toolTag = document.createElement('span');
      toolTag.className = 'tool-tag';
      toolTag.textContent = tool.name;
      toolTag.title = tool.description; // 鼠标悬停显示描述
      toolTag.onclick = () => this.selectTool(tool);
      container.appendChild(toolTag);
      console.log('ToolDebugger: 添加工具标签:', tool.name);
    });

    console.log('ToolDebugger: 工具标签渲染完成，工具数量:', this.client.tools.length);
  }

  // 选择工具并显示详情
  selectTool(tool) {
    console.log('ToolDebugger: 选择工具:', tool.name);
    this.selectedTool = tool;
    this.renderToolDetails(tool);
    
    // 高亮选中的工具标签
    document.querySelectorAll('.tool-tag').forEach(tag => {
      tag.classList.remove('selected');
    });
    
    // 找到当前点击的工具标签并高亮
    const toolTags = document.querySelectorAll('.tool-tag');
    toolTags.forEach(tag => {
      if (tag.textContent === tool.name) {
        tag.classList.add('selected');
      }
    });
  }

  // 渲染工具详情和参数输入
  renderToolDetails(tool) {
    const container = document.getElementById('toolDetails');
    if (!container) {
      console.error('找不到toolDetails容器');
      return;
    }
    
    let paramsHTML = '';
    if (tool.inputSchema && tool.inputSchema.properties) {
      Object.entries(tool.inputSchema.properties).forEach(([name, schema]) => {
        const required = tool.inputSchema.required?.includes(name) ? '*' : '';
        let placeholder = schema.description || `${schema.type || 'string'} 类型`;
        let exampleValue = this.getExampleValue(tool.name, name);
        
        // 特殊处理数组和对象类型的输入
        let inputType = 'text';
        if (schema.type === 'array' || schema.type === 'object') {
          placeholder += ' (请输入JSON格式)';
        } else if (schema.type === 'boolean') {
          inputType = 'text';
          placeholder += ' (true/false)';
        } else if (schema.type === 'number') {
          inputType = 'number';
        }
        
        paramsHTML += `
          <div class="param-group">
            <label>${name}${required}:</label>
            <input type="${inputType}" 
                   class="param-input" 
                   id="param_${name}"
                   placeholder="${placeholder}"
                   value="${exampleValue}"
                   data-type="${schema.type || 'string'}" />
            <small>${schema.description || ''}</small>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <h4>${tool.name}</h4>
      <p>${tool.description}</p>
      
      <h5>参数:</h5>
      <div class="params-container">
        ${paramsHTML || '<p>此工具不需要参数</p>'}
      </div>
      
      <div class="button-group">
        <button onclick="toolDebugger.executeTool()" class="execute-btn">执行工具</button>
        <button onclick="toolDebugger.clearParams()" class="clear-btn">清空参数</button>
      </div>
      
      <div class="tool-help">
        <strong>💡 提示:</strong>
        <ul>
          ${this.getToolTips(tool.name)}
        </ul>
      </div>
    `;
  }

  // 获取参数示例值
  getExampleValue(toolName, paramName) {
    const examples = {
      'read_file': { 'path': 'test.txt' },
      'write_file': { 'path': 'new-file.txt', 'content': 'Hello MCP World!' },
      'list_directory': { 'path': '.' },
      'search_files': { 'pattern': '*.txt', 'path': '.' },
      'create_directory': { 'path': 'new-folder' },
      'move_file': { 'source': 'old-name.txt', 'destination': 'new-name.txt' },
      'get_file_info': { 'path': '.' },
      'edit_file': { 
        'path': 'file-to-edit.txt', 
        'edits': '[{"oldText": "old content", "newText": "new content"}]' 
      },
      'read_multiple_files': { 'paths': '["file1.txt", "file2.txt"]' }
    };
    
    return examples[toolName]?.[paramName] || '';
  }

  // 清空参数
  clearParams() {
    const paramInputs = document.querySelectorAll('[id^="param_"]');
    paramInputs.forEach(input => {
      input.value = '';
    });
    console.log('ToolDebugger: 参数已清空');
  }

  // 获取工具使用提示
  getToolTips(toolName) {
    const tips = {
      'read_file': [
        '文件路径相对于允许的目录',
        '支持各种文本编码',
        '大文件可能需要较长时间'
      ],
      'write_file': [
        '会覆盖现有文件，请谨慎使用',
        '自动创建不存在的目录',
        '仅支持文本内容'
      ],
      'list_directory': [
        '使用 "." 表示当前目录',
        '使用 ".." 表示上级目录',
        '结果会区分文件和目录'
      ],
      'search_files': [
        '支持通配符，如 *.txt',
        '搜索是递归的',
        '大小写不敏感'
      ],
      'list_allowed_directories': [
        '显示服务器允许访问的所有目录',
        '不需要任何参数'
      ],
      'create_directory': [
        '可以创建多级目录',
        '如果目录已存在，操作会成功',
        '路径必须在允许的目录内'
      ],
      'move_file': [
        '可以重命名或移动文件',
        '如果目标已存在会失败',
        '源和目标都必须在允许目录内'
      ],
      'get_file_info': [
        '获取文件或目录的详细信息',
        '包含大小、创建时间、修改时间等',
        '不会读取文件内容'
      ],
      'edit_file': [
        '基于行的文件编辑',
        'edits参数需要JSON数组格式',
        '返回git样式的差异显示'
      ],
      'read_multiple_files': [
        '同时读取多个文件',
        'paths参数需要JSON数组格式',
        '比逐个读取文件更高效'
      ],
      'directory_tree': [
        '递归显示目录结构',
        '返回JSON格式的树形结构',
        '包含文件和目录类型信息'
      ]
    };
    
    const toolTips = tips[toolName] || ['检查工具文档了解更多用法'];
    return toolTips.map(tip => `<li>${tip}</li>`).join('');
  }

  // 执行工具
  async executeTool() {
    if (!this.selectedTool) {
      this.displayResult({ error: '请先选择一个工具' });
      return;
    }

    try {
      console.log('ToolDebugger: 开始执行工具:', this.selectedTool.name);
      
      // 收集参数
      const params = this.collectParams();
      console.log('ToolDebugger: 收集到的参数:', params);

      // 显示执行中状态
      this.displayResult({ status: '⏳ 执行中，请稍候...' });

      // 执行工具
      const result = await this.client.connection.send('tools/call', {
        name: this.selectedTool.name,
        arguments: params
      });

      console.log('ToolDebugger: 工具执行结果:', result);
      this.displayResult(result);
      
    } catch (error) {
      console.error('ToolDebugger: 工具执行错误:', error);
      this.displayResult({ error: error.message });
    }
  }

  // 收集参数
  collectParams() {
    const params = {};
    const paramInputs = document.querySelectorAll('[id^="param_"]');
    
    paramInputs.forEach(input => {
      const paramName = input.id.replace('param_', '');
      let value = input.value.trim();
      
      if (value === '') return; // 跳过空值
      
      // 类型转换
      const type = input.dataset.type;
      try {
        if (type === 'number') {
          value = Number(value);
          if (isNaN(value)) {
            throw new Error(`参数 ${paramName} 必须是数字`);
          }
        } else if (type === 'boolean') {
          value = value.toLowerCase() === 'true';
        } else if (type === 'object' || type === 'array') {
          value = JSON.parse(value);
        }
        
        params[paramName] = value;
      } catch (e) {
        throw new Error(`参数 ${paramName} 格式错误: ${e.message}`);
      }
    });

    return params;
  }

  // 显示执行结果
  displayResult(result) {
    const container = document.getElementById('resultOutput');
    
    if (!container) {
      console.error('找不到resultOutput容器');
      return;
    }
    
    // 清除之前的样式
    container.style.color = '';
    container.style.backgroundColor = '';
    
    if (!result) {
      container.textContent = '无结果';
      return;
    }

    // 处理简单状态消息
    if (result.status) {
      container.textContent = result.status;
      container.style.color = '#666';
      return;
    }

    // 处理错误
    if (result.error) {
      container.textContent = `❌ 错误: ${result.error}`;
      container.style.color = '#d32f2f';
      container.style.backgroundColor = '#ffebee';
      return;
    }

    // 处理MCP工具的特殊返回格式
    if (result.content && Array.isArray(result.content)) {
      this.displayMCPContent(result, container);
    } else {
      this.displayGenericResult(result, container);
    }
  }

  // 显示MCP内容格式的结果
  displayMCPContent(result, container) {
    let displayText = '';
    
    result.content.forEach((item, index) => {
      if (item.type === 'text') {
        displayText += item.text;
        if (index < result.content.length - 1) {
          displayText += '\n\n--- 分隔符 ---\n\n';
        }
      } else {
        displayText += `[${item.type}] ${JSON.stringify(item, null, 2)}`;
      }
    });
    
    // 根据是否是错误设置样式
    if (result.isError) {
      displayText = '❌ 错误:\n' + displayText;
      container.style.color = '#d32f2f';
      container.style.backgroundColor = '#ffebee';
    } else {
      container.style.color = '#2e7d32';
      container.style.backgroundColor = '#e8f5e9';
      
      // 为特定工具结果添加前缀
      displayText = this.addToolPrefix(displayText);
    }
    
    container.textContent = displayText;
  }

  // 添加工具特定的前缀
  addToolPrefix(text) {
    if (!this.selectedTool) return text;
    
    const prefixes = {
      'list_directory': '📁 目录内容:\n',
      'read_file': '📄 文件内容:\n',
      'write_file': '✅ 文件写入成功:\n',
      'list_allowed_directories': '🔒 允许访问的目录:\n',
      'search_files': '🔍 搜索结果:\n',
      'create_directory': '📁 目录创建成功:\n',
      'move_file': '🔄 文件移动成功:\n',
      'get_file_info': 'ℹ️ 文件信息:\n',
      'edit_file': '✏️ 文件编辑成功:\n',
      'read_multiple_files': '📚 多文件内容:\n',
      'directory_tree': '🌳 目录树结构:\n'
    };
    
    const prefix = prefixes[this.selectedTool.name] || '';
    return prefix + text;
  }

  // 显示通用结果格式
  displayGenericResult(result, container) {
    container.style.color = '#333';
    container.style.backgroundColor = '#f8f8f8';
    
    let displayText;
    try {
      displayText = JSON.stringify(result, null, 2);
    } catch (e) {
      displayText = String(result);
    }
    
    container.textContent = '📋 结果:\n' + displayText;
  }

  // 快速测试常用工具
  quickTest(toolName, params = {}) {
    const tool = this.client.tools.find(t => t.name === toolName);
    if (!tool) {
      console.error(`工具 ${toolName} 不存在`);
      return;
    }
    
    console.log('ToolDebugger: 快速测试工具:', toolName, '参数:', params);
    this.selectTool(tool);
    
    // 填充参数
    Object.entries(params).forEach(([key, value]) => {
      const input = document.getElementById(`param_${key}`);
      if (input) {
        input.value = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    });
    
    // 执行工具
    this.executeTool();
  }

  // 获取当前选中的工具信息
  getSelectedToolInfo() {
    if (!this.selectedTool) {
      return null;
    }
    
    return {
      name: this.selectedTool.name,
      description: this.selectedTool.description,
      inputSchema: this.selectedTool.inputSchema,
      currentParams: this.getCurrentParams()
    };
  }

  // 获取当前参数值
  getCurrentParams() {
    const params = {};
    const paramInputs = document.querySelectorAll('[id^="param_"]');
    
    paramInputs.forEach(input => {
      const paramName = input.id.replace('param_', '');
      if (input.value.trim()) {
        params[paramName] = input.value.trim();
      }
    });
    
    return params;
  }

  // 导出测试用例
  exportTestCase() {
    const toolInfo = this.getSelectedToolInfo();
    if (!toolInfo) {
      alert('请先选择一个工具');
      return;
    }
    
    const testCase = {
      tool: toolInfo.name,
      params: toolInfo.currentParams,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(testCase, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-test-${toolInfo.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('ToolDebugger: 测试用例已导出');
  }

  // 批量测试所有工具
  async batchTest() {
    if (!this.client.tools || this.client.tools.length === 0) {
      console.error('没有可用的工具进行批量测试');
      return;
    }
    
    console.log('ToolDebugger: 开始批量测试，工具数量:', this.client.tools.length);
    
    for (const tool of this.client.tools) {
      console.log(`ToolDebugger: 测试工具 ${tool.name}`);
      
      // 对于需要参数的工具，跳过或使用默认参数
      if (tool.inputSchema && tool.inputSchema.required && tool.inputSchema.required.length > 0) {
        console.log(`跳过需要必需参数的工具: ${tool.name}`);
        continue;
      }
      
      try {
        this.selectTool(tool);
        await this.executeTool();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      } catch (error) {
        console.error(`工具 ${tool.name} 测试失败:`, error);
      }
    }
    
    console.log('ToolDebugger: 批量测试完成');
  }

  // 重置调试器状态
  reset() {
    this.selectedTool = null;
    
    // 清空工具标签容器
    const tagsContainer = document.getElementById('toolsTagsContainer');
    if (tagsContainer) {
      tagsContainer.innerHTML = '<p style="color: #666;">Connect to server to see available tools</p>';
    }
    
    // 清空工具详情
    const detailsContainer = document.getElementById('toolDetails');
    if (detailsContainer) {
      detailsContainer.innerHTML = '<p>Select a tool to see details</p>';
    }
    
    // 清空结果输出
    const resultContainer = document.getElementById('resultOutput');
    if (resultContainer) {
      resultContainer.textContent = 'Execute a tool to see results';
      resultContainer.style.color = '';
      resultContainer.style.backgroundColor = '';
    }
    
    console.log('ToolDebugger: 状态已重置');
  }
}

// 兼容浏览器全局环境
if (typeof window !== 'undefined') {
  window.ToolDebugger = ToolDebugger;
  
  // 添加全局快捷方法
  window.quickTest = function(toolName, params) {
    if (window.toolDebugger) {
      window.toolDebugger.quickTest(toolName, params);
    } else {
      console.error('ToolDebugger not initialized');
    }
  };
  
  // 添加批量测试快捷方法
  window.batchTest = function() {
    if (window.toolDebugger) {
      window.toolDebugger.batchTest();
    } else {
      console.error('ToolDebugger not initialized');
    }
  };
}