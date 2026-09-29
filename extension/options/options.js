// 设置页面脚本
const API_BASE = 'http://localhost:3777/api';

// DOM 元素
const elements = {
    apiUrl: document.getElementById('api-url'),
    jdCron: document.getElementById('jd-cron'),
    taobaoCron: document.getElementById('taobao-cron'),
    pddCron: document.getElementById('pdd-cron'),
    enableNotifications: document.getElementById('enable-notifications'),
    priceThreshold: document.getElementById('price-threshold'),
    enableSound: document.getElementById('enable-sound'),
    defaultSort: document.getElementById('default-sort'),
    defaultView: document.getElementById('default-view'),
    showBadge: document.getElementById('show-badge'),
    dataRetention: document.getElementById('data-retention'),
    statusIndicator: document.getElementById('status-indicator'),
    connectionStatusText: document.getElementById('connection-status-text'),
    testConnection: document.getElementById('test-connection'),
    saveSettings: document.getElementById('save-settings'),
    resetSettings: document.getElementById('reset-settings'),
    exportData: document.getElementById('export-data'),
    clearData: document.getElementById('clear-data'),
    alertContainer: document.getElementById('alert-container')
};

// 默认设置
const defaultSettings = {
    apiUrl: 'http://localhost:3777',
    jdCron: '0 0,6,12,18,22 * * *',
    taobaoCron: '0 10 * * *',
    pddCron: '0 9,21 * * *',
    enableNotifications: true,
    priceThreshold: 5,
    enableSound: true,
    defaultSort: 'desire_level',
    defaultView: 'watching',
    showBadge: true,
    dataRetention: 90
};

// 当前设置
let currentSettings = { ...defaultSettings };

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    checkConnection();
});

// 加载设置
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        if (result.settings) {
            currentSettings = { ...defaultSettings, ...result.settings };
        }
        applySettings();
    } catch (error) {
        console.error('加载设置失败:', error);
        showAlert('加载设置失败', 'error');
    }
}

// 应用设置到界面
function applySettings() {
    elements.apiUrl.value = currentSettings.apiUrl;
    elements.jdCron.value = currentSettings.jdCron;
    elements.taobaoCron.value = currentSettings.taobaoCron;
    elements.pddCron.value = currentSettings.pddCron;
    elements.enableNotifications.checked = currentSettings.enableNotifications;
    elements.priceThreshold.value = currentSettings.priceThreshold;
    elements.enableSound.checked = currentSettings.enableSound;
    elements.defaultSort.value = currentSettings.defaultSort;
    elements.defaultView.value = currentSettings.defaultView;
    elements.showBadge.checked = currentSettings.showBadge;
    elements.dataRetention.value = currentSettings.dataRetention;
}

// 保存设置
async function saveSettings() {
    try {
        currentSettings = {
            apiUrl: elements.apiUrl.value,
            jdCron: elements.jdCron.value,
            taobaoCron: elements.taobaoCron.value,
            pddCron: elements.pddCron.value,
            enableNotifications: elements.enableNotifications.checked,
            priceThreshold: parseInt(elements.priceThreshold.value),
            enableSound: elements.enableSound.checked,
            defaultSort: elements.defaultSort.value,
            defaultView: elements.defaultView.value,
            showBadge: elements.showBadge.checked,
            dataRetention: parseInt(elements.dataRetention.value)
        };

        await chrome.storage.local.set({ settings: currentSettings });
        
        // 通知后台脚本设置已更新
        chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: currentSettings });
        
        showAlert('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showAlert('保存设置失败', 'error');
    }
}

// 恢复默认设置
function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
        currentSettings = { ...defaultSettings };
        applySettings();
        showAlert('已恢复默认设置', 'info');
    }
}

// 测试连接
async function checkConnection() {
    const indicator = elements.statusIndicator;
    const statusText = elements.connectionStatusText;
    
    indicator.className = 'status-indicator status-checking';
    statusText.textContent = '检查连接中...';
    
    try {
        const response = await fetch(`${currentSettings.apiUrl}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            indicator.className = 'status-indicator status-connected';
            statusText.textContent = '已连接';
            return true;
        } else {
            throw new Error('服务响应异常');
        }
    } catch (error) {
        indicator.className = 'status-indicator status-disconnected';
        statusText.textContent = '连接失败';
        return false;
    }
}

// 导出数据
async function exportData() {
    try {
        const response = await fetch(`${currentSettings.apiUrl}/api/products`);
        const data = await response.json();
        
        if (data.success) {
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ybprice-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showAlert('数据导出成功', 'success');
        } else {
            showAlert('导出失败', 'error');
        }
    } catch (error) {
        console.error('导出数据失败:', error);
        showAlert('导出失败，请检查连接', 'error');
    }
}

// 清除数据
async function clearData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) {
        return;
    }
    
    if (!confirm('再次确认：这将删除所有追踪的商品和历史数据。')) {
        return;
    }
    
    try {
        // 这里可以调用后端API清除数据
        // 或者清除本地存储
        await chrome.storage.local.clear();
        
        showAlert('数据已清除', 'success');
        
        // 重新加载默认设置
        currentSettings = { ...defaultSettings };
        applySettings();
    } catch (error) {
        console.error('清除数据失败:', error);
        showAlert('清除数据失败', 'error');
    }
}

// 设置事件监听
function setupEventListeners() {
    elements.testConnection.addEventListener('click', checkConnection);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    elements.exportData.addEventListener('click', exportData);
    elements.clearData.addEventListener('click', clearData);
}

// 显示提示信息
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    elements.alertContainer.innerHTML = '';
    elements.alertContainer.appendChild(alertDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// 验证 Cron 表达式
function validateCron(expression) {
    const cronRegex = /^(\*|([0-9]|[1-5][0-9])) (\*|([0-9]|[1-2][0-9])) (\*|([1-9]|[1-2][0-9]|3[0-1])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/;
    return cronRegex.test(expression);
}

// 输入验证
elements.jdCron.addEventListener('blur', () => {
    if (!validateCron(elements.jdCron.value)) {
        showAlert('京东抓取时间格式不正确', 'error');
    }
});

elements.taobaoCron.addEventListener('blur', () => {
    if (!validateCron(elements.taobaoCron.value)) {
        showAlert('淘宝抓取时间格式不正确', 'error');
    }
});

elements.pddCron.addEventListener('blur', () => {
    if (!validateCron(elements.pddCron.value)) {
        showAlert('拼多多抓取时间格式不正确', 'error');
    }
});

elements.priceThreshold.addEventListener('blur', () => {
    const value = parseInt(elements.priceThreshold.value);
    if (isNaN(value) || value < 1 || value > 50) {
        showAlert('价格阈值应在1-50之间', 'error');
    }
});
