// 后台服务脚本
const API_BASE = 'http://localhost:3777/api';

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('YbPriceTracker 扩展已安装');
    
    // 创建右键菜单
    chrome.contextMenus.create({
        id: 'add-to-tracker',
        title: '添加到价格追踪',
        contexts: ['page', 'link']
    });
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'add-to-tracker') {
        addToTracker(tab);
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'addProduct') {
        addProduct(request.data)
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开放
    }
    
    // 注意：getProductInfo 是 content script 的消息（用于取页面价格）
    // background 不应拦截，否则会和 content script 响应冲突
    // 如需从 DB 查询商品，使用 getProductFromDb
    if (request.action === 'getProductFromDb') {
        getProductInfo(request.productId, request.platform)
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // 打开新标签页（content script 请求，如打开历史图表）
    if (request.action === 'openTab') {
        chrome.tabs.create({ url: request.url });
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'refreshAllPrices') {
        refreshAllPrices()
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // 强制重置刷新锁（popup 卡死时用）
    if (request.action === 'resetRefreshLock') {
        refreshInProgress = false;
        try { chrome.storage.local.remove('refreshState', () => { void chrome.runtime.lastError; }); } catch (e) {}
        console.log('[YbPriceTracker] 刷新锁已强制重置');
        sendResponse({ success: true });
        return true;
    }
});

// 添加商品到追踪
async function addToTracker(tab) {
    try {
        const platform = detectPlatform(tab.url);
        if (!platform) {
            showNotification('错误', '当前页面不是支持的电商平台');
            return;
        }

        const productId = extractProductId(tab.url, platform);
        if (!productId) {
            showNotification('错误', '无法识别商品ID');
            return;
        }

        const result = await addProduct({
            platform,
            product_id: productId,
            title: tab.title,
            url: tab.url,
            desire_level: 3
        });

        if (result.success) {
            showNotification('成功', '商品已添加到价格追踪');
        } else {
            showNotification('错误', result.error || '添加失败');
        }
    } catch (error) {
        console.error('添加商品失败:', error);
        showNotification('错误', '添加失败，请检查后端服务');
    }
}

// 添加商品API
async function addProduct(productData) {
    const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    });
    
    return await response.json();
}

// 获取商品信息API
async function getProductInfo(productId, platform) {
    const response = await fetch(`${API_BASE}/products?platform=${platform}&product_id=${productId}`);
    return await response.json();
}

// 检测平台
function detectPlatform(url) {
    if (!url) return null;
    
    if (url.includes('jd.com') || url.includes('jd.hk')) {
        return 'jd';
    } else if (url.includes('taobao.com') || url.includes('tmall.com')) {
        return 'taobao';
    } else if (url.includes('pinduoduo.com') || url.includes('pdd.com')) {
        return 'pdd';
    }
    
    return null;
}

// 提取商品ID（与 content.js / popup.js 保持一致）
function extractProductId(url, platform) {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        switch (platform) {
            case 'jd':
                const jdPatterns = [
                    /\/(\d{5,})\.html/,
                    /\/product\/(\d{5,})/,
                    /wareId=(\d{5,})/,
                    /sku=(\d{5,})/,
                    /\/(\d{5,})(?:\.html|$)/
                ];
                for (const p of jdPatterns) {
                    const m = url.match(p);
                    if (m) return m[1];
                }
                return null;
            case 'taobao':
                return urlObj.searchParams.get('id')
                    || urlObj.searchParams.get('item_id')
                    || urlObj.searchParams.get('itemId')
                    || (url.match(/[?&#]id=(\d{6,})/) || [])[1]
                    || (url.match(/item_id=(\d{6,})/) || [])[1]
                    || null;
            case 'pdd':
                return urlObj.searchParams.get('goods_id') ||
                       (url.match(/goods_id=(\d+)/) || [])[1] || null;
            default:
                return null;
        }
    } catch (error) {
        console.error('解析URL失败:', error);
        return null;
    }
}

// 刷新所有监控中商品的价格
// 通过后台逐个打开商品页 -> content script 读取价格 -> 上报后端
// 广播进度给 popup（popup 可能已关闭，静默忽略）
function broadcastProgress(payload) {
    try {
        chrome.runtime.sendMessage({ action: 'refreshProgress', ...payload }, () => {
            // 忽略 "no receiving end" 错误（popup 已关闭）
            void chrome.runtime.lastError;
        });
    } catch (e) { /* 静默 */ }
}

let refreshInProgress = false;
let refreshStartTime = 0;
const REFRESH_LOCK_TIMEOUT = 30 * 1000; // 30 秒后自动释放锁（快速恢复，防止卡死）
const MAX_CONCURRENT = 2; // 同时采集 2 个商品（Chrome 后台标签过多会节流）
const GLOBAL_TIMEOUT = 2 * 60 * 1000; // 全局兜底 2 分钟，超过强制结束

// 检查并释放过期锁
function checkRefreshLock() {
    if (refreshInProgress && Date.now() - refreshStartTime > REFRESH_LOCK_TIMEOUT) {
        console.warn('[YbPriceTracker] 刷新锁超时，强制释放');
        refreshInProgress = false;
    }
}

// 保存进度到 storage（popup 重开时可恢复）
async function saveProgressState(state) {
    try {
        await chrome.storage.local.set({ refreshState: state });
    } catch (e) { /* 静默 */ }
}

async function refreshAllPrices() {
    checkRefreshLock();
    if (refreshInProgress) {
        return { success: false, error: '刷新正在进行中，请稍候' };
    }
    refreshInProgress = true;
    refreshStartTime = Date.now();
    
    try {
        const resp = await fetch(`${API_BASE}/products?status=watching`);
        // 检查响应是否是 JSON（避免限流时返回 HTML 导致解析错误）
        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await resp.text();
            throw new Error(`后端返回非 JSON（${resp.status}）: ${text.slice(0, 100)}`);
        }
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || '获取商品列表失败');
        const products = data.data || [];
        if (products.length === 0) {
            broadcastProgress({ total: 0, done: 0, phase: 'done', successCount: 0, failCount: 0 });
            await saveProgressState(null);
            return { success: true, successCount: 0, failCount: 0 };
        }

        const total = products.length;
        let done = 0;
        let successCount = 0, failCount = 0;
        let nextIndex = 0;
        
        // 更新进度（广播 + 存 storage）
        const updateProgress = (phase, currentTitle) => {
            const payload = { total, done, phase, currentTitle, successCount, failCount, lastUpdate: Date.now() };
            broadcastProgress(payload);
            saveProgressState(phase === 'done' ? null : payload);
        };
        
        updateProgress('running', '');
        
        // 并发采集：一次最多 MAX_CONCURRENT 个
        const worker = async () => {
            while (nextIndex < total) {
                const idx = nextIndex++;
                const product = products[idx];
                // 广播开始采集（done 不变，显示当前商品）
                updateProgress('running', product.title);
                
                try {
                    console.log(`[YbPriceTracker] 采集价格 ${done + 1}/${total}: ${product.title}`);
                    const price = await scrapePriceInBackground(product);
                    if (price != null && !isNaN(price)) {
                        // 上报后端（失败不影响主流程）
                        try {
                            const recResp = await fetch(`${API_BASE}/prices/record`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    platform: product.platform,
                                    product_id: String(product.product_id),
                                    price: price
                                })
                            });
                            const recContentType = recResp.headers.get('content-type') || '';
                            if (recContentType.includes('application/json')) {
                                const recData = await recResp.json();
                                // 检查是否触发降价提醒
                                if (recData.success && recData.data && recData.data.price_drop) {
                                    console.log(`[YbPriceTracker] 🔔 降价提醒: ${product.title} ¥${price}`);
                                    showNotification(
                                        '🔔 降价提醒',
                                        `${product.title.slice(0, 30)} 降至 ¥${price}，低于预期 ¥${recData.data.threshold.toFixed(2)}`
                                    );
                                }
                            } else {
                                console.warn(`[YbPriceTracker] 上报价格返回非 JSON（${recResp.status}）`);
                            }
                        } catch (recErr) {
                            console.warn(`[YbPriceTracker] 上报价格失败:`, recErr && recErr.message);
                        }
                        successCount++;
                        console.log(`[YbPriceTracker] ✅ ${product.title} = ¥${price}`);
                    } else {
                        failCount++;
                        console.warn(`[YbPriceTracker] ❌ ${product.title} 采集失败`);
                    }
                } catch (e) {
                    console.warn('采集失败', product.title, e && e.message);
                    failCount++;
                }
                
                // 完成一个：原子递增 + 立即广播进度
                done++;
                updateProgress('running', product.title);
                
                // 短暂间隔，避免请求过快
                await new Promise(r => setTimeout(r, 50));
            }
        };
        
        // 启动 N 个并发 worker
        const workers = [];
        for (let i = 0; i < Math.min(MAX_CONCURRENT, total); i++) {
            workers.push(worker());
        }
        
        // 全局兜底超时：2 分钟强制结束（防止 worker 卡死）
        const globalTimeout = new Promise((resolve) => {
            setTimeout(() => {
                console.warn('[YbPriceTracker] 全局超时，强制结束');
                resolve('timeout');
            }, GLOBAL_TIMEOUT);
        });
        
        await Promise.race([Promise.all(workers), globalTimeout]);
        
        updateProgress('done', '');
        return { success: true, successCount, failCount };
    } catch (error) {
        console.error('[YbPriceTracker] 刷新过程异常:', error);
        broadcastProgress({ total: 0, done: 0, phase: 'done', successCount: 0, failCount: 0 });
        await saveProgressState(null);
        return { success: false, error: error && error.message };
    } finally {
        refreshInProgress = false;
    }
}

// 在后台标签页打开商品页，等待 content script 返回价格
// 使用最小化窗口实现无感知采集（用户看不到页面闪烁）
function scrapePriceInBackground(product) {
    return new Promise((resolve) => {
        let tabId = null;
        let windowId = null;
        let settled = false;
        let listener = null;
        let priceRequested = false;
        let timeoutId = null;
        
        const cleanup = () => {
            if (listener) { 
                try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) {}
                listener = null;
            }
            if (timeoutId) {
                try { clearTimeout(timeoutId); } catch (e) {}
                timeoutId = null;
            }
        };
        
        const done = (val) => {
            if (settled) return;
            settled = true;
            cleanup();
            // 关闭后台标签页
            if (tabId) {
                try { chrome.tabs.remove(tabId); } catch (e) {}
            }
            resolve(val);
        };

        // 向 content script 发消息取价，智能轮询（检测到价格立即返回）
        const tryGetPrice = async (maxMs) => {
            const start = Date.now();
            let attempt = 0;
            console.log(`[YbPriceTracker] 开始取价轮询: ${product.title} (tabId=${tabId}, maxMs=${maxMs})`);
            while (Date.now() - start < maxMs) {
                if (settled) return null;
                attempt++;
                try {
                    const resp = await new Promise((res) => {
                        chrome.tabs.sendMessage(tabId, { action: 'getProductInfo' }, (r) => {
                            if (chrome.runtime.lastError) {
                                // 记录错误，便于排查
                                if (attempt <= 3) {
                                    console.warn(`[YbPriceTracker] sendMessage 第${attempt}次失败:`, chrome.runtime.lastError.message);
                                }
                                res(null);
                            } else {
                                res(r);
                            }
                        });
                    });
                    if (resp) {
                        if (resp.price && !isNaN(resp.price)) {
                            console.log(`[YbPriceTracker] 取价成功（第 ${attempt} 次，${Date.now() - start}ms）= ¥${resp.price}`);
                            return resp.price;
                        } else if (attempt <= 3) {
                            console.log(`[YbPriceTracker] 第${attempt}次响应但无价格:`, JSON.stringify(resp).slice(0, 200));
                        }
                    } else if (attempt <= 3) {
                        console.log(`[YbPriceTracker] 第${attempt}次无响应（resp=null）`);
                    }
                } catch (e) {
                    if (attempt <= 3) console.warn(`[YbPriceTracker] sendMessage 第${attempt}次异常:`, e && e.message);
                }
                await new Promise(r => setTimeout(r, 300));
            }
            console.warn(`[YbPriceTracker] 取价超时（${maxMs}ms，尝试 ${attempt} 次）`);
            return null;
        };

        // 先注册监听器（在 create 之前），避免 tabId 赋值前漏掉事件
        listener = (updatedTabId, changeInfo) => {
            if (tabId != null && updatedTabId === tabId && changeInfo.status === 'complete' && !priceRequested && !settled) {
                priceRequested = true;
                cleanup();
                console.log(`[YbPriceTracker] 页面加载完成: ${product.title}`);
                setTimeout(async () => {
                    if (settled) return;
                    // 手动注入 content script（MV3 后台标签页可能不自动注入）
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            files: ['content/content.js']
                        });
                        console.log(`[YbPriceTracker] content script 已注入: ${product.title}`);
                    } catch (e) {
                        console.warn(`[YbPriceTracker] content script 注入失败:`, e && e.message);
                    }
                    // 智能轮询最长 8 秒（给页面充足渲染时间），检测到价格立即返回
                    const price = await tryGetPrice(8000);
                    console.log(`[YbPriceTracker] 取价结果: ${product.title} = ${price}`);
                    done(price);
                }, 200);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // 用后台标签页打开（content script 能正常注入）
        // active: false 不抢焦点，创建后立即 hide（Chrome 107+ 隐藏到隐藏标签组）
        chrome.tabs.create({ url: product.url, active: false }, (tab) => {
            if (settled) {
                try { chrome.tabs.remove(tab.id); } catch (e) {}
                return;
            }
            tabId = tab.id;
            // 立即隐藏标签（不显示在标签栏）
            try {
                chrome.tabs.hide([tab.id], () => {
                    // hide 失败也没关系，标签只是会短暂出现
                    void chrome.runtime.lastError;
                });
            } catch (e) {}
        });
        
        // 超时保护（25 秒）
        timeoutId = setTimeout(() => {
            console.warn(`[YbPriceTracker] 商品采集超时（15秒）: ${product.title}`);
            done(null);
        }, 15000);
    });
}

// 显示通知
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message
    });
}

// 定期检查价格下降（每小时）
chrome.alarms.create('check-price-drops', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'check-price-drops') {
        try {
            const response = await fetch(`${API_BASE}/prices/drops?threshold=5`);
            const data = await response.json();
            
            if (data.success && data.data.length > 0) {
                showNotification(
                    '价格下降提醒',
                    `有 ${data.data.length} 个商品价格下降超过5%！`
                );
            }
        } catch (error) {
            // 静默处理
        }
    }
});

console.log('YbPriceTracker 后台服务已启动');
