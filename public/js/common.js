// 添加页面加载动画
document.addEventListener('DOMContentLoaded', () => {
  // 添加页面淡入效果
  document.body.classList.add('loaded');
  
  // 为所有卡片添加延迟出现动画
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('visible');
    }, 100 * index);
  });
  
  // 添加页脚
  addFooter();
});

// 添加页脚
function addFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <p>© ${new Date().getFullYear()} 网易云解灰 API 服务 | 基于 Hono 构建</p>
    </div>
  `;
  document.body.appendChild(footer);
}

// 格式化JSON显示
function formatJSON(json, element) {
  try {
    // 尝试解析JSON字符串
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    
    // 创建格式化的HTML
    const html = syntaxHighlight(JSON.stringify(obj, null, 2));
    
    // 设置HTML内容
    element.innerHTML = html;
    
    // 添加成功状态
    if (obj.success === true) {
      element.classList.add('success');
      element.classList.remove('error');
    } else if (obj.success === false) {
      element.classList.add('error');
      element.classList.remove('success');
    }
  } catch (e) {
    // 如果解析失败，直接显示文本
    element.textContent = json;
    element.classList.add('error');
    element.classList.remove('success');
  }
}

// JSON语法高亮
function syntaxHighlight(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// 显示加载状态
function showLoading(element) {
  element.innerHTML = '<div class="loading-text">加载中...</div>';
  element.classList.remove('success', 'error');
}

// 显示错误状态
function showError(element, message) {
  element.innerHTML = `<div class="status error">错误</div><div>${message}</div>`;
  element.classList.add('error');
  element.classList.remove('success');
}

// 复制内容到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败', 'error');
  });
}

// 显示提示消息
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // 显示提示
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}
