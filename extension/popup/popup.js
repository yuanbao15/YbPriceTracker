// API 基础地址
const API_BASE = 'http://localhost:3777/api';

// 当前选中的标签
let currentTab = 'watching';

// 当前排序方式：created_at | desire_level
let currentSort = 'created_at';

// 降幅排序方向：true=升序（降得多在前），false=降序（涨得多在前）
let dropSortAsc = true;

// 平台筛选：all | jd | taobao | pdd
let currentPlatform = 'all';

// 是否按平台分组展示
let groupByPlatform = false;

// 当前商品数据
let products = [];
let stats = null;

// DOM 元素
const elements = {
    totalCount: document.getElementById('total-count'),
    watchingCount: document.getElementById('watching-count'),
    dropsCount: document.getElementById('drops-count'),
    productList: document.getElementById('product-list'),
    addProductBtn: document.getElementById('add-product-btn'),
    priceDropAlert: document.getElementById('price-drop-alert'),
    alertText: document.getElementById('alert-text'),
    tabs: document.querySelectorAll('.tab')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    updateSortRow();
    await loadData();
    setupEventListeners();
    checkPriceDrops();
    restoreRefreshState();  // 恢复进行中的刷新进度
    restoreRefreshResult(); // 恢复完成结果（5 分钟内有效）
});

// 定时清除状态提示（保留 5 分钟）
let clearStatusTimer = null;
function scheduleClearStatus() {
    if (clearStatusTimer) clearTimeout(clearStatusTimer);
    clearStatusTimer = setTimeout(() => {
        const statusDiv = document.getElementById('update-status');
        if (statusDiv) statusDiv.textContent = '';
        // 同时清除 storage 里的完成结果
        try { chrome.storage.local.remove('lastRefreshResult'); } catch (e) {}
    }, 5 * 60 * 1000);  // 5 分钟
}

// 保存完成结果到 storage（popup 关闭后仍能恢复显示）
async function saveRefreshResult(successCount, failCount) {
    try {
        await chrome.storage.local.set({
            lastRefreshResult: {
                successCount,
                failCount,
                finishedAt: Date.now()
            }
        });
    } catch (e) { /* ignore */ }
}

// 恢复完成结果（popup 重开时，若还在 5 分钟内则显示）
async function restoreRefreshResult() {
    try {
        const { lastRefreshResult } = await chrome.storage.local.get('lastRefreshResult');
        if (!lastRefreshResult) {
            console.log('[YbPriceTracker] 无 lastRefreshResult 可恢复');
            return;
        }
        
        const { successCount, failCount, finishedAt } = lastRefreshResult;
        const elapsed = Date.now() - finishedAt;
        const MAX_AGE = 5 * 60 * 1000;  // 5 分钟
        
        console.log('[YbPriceTracker] 恢复刷新结果:', successCount, failCount, 'elapsed=', elapsed);
        
        if (elapsed > MAX_AGE) {
            // 超过 5 分钟，清除
            console.log('[YbPriceTracker] 结果超过 5 分钟，清除');
            try { chrome.storage.local.remove('lastRefreshResult'); } catch (e) {}
            return;
        }
        
        // 显示结果 + 计算剩余时间继续保留
        const statusDiv = document.getElementById('update-status');
        if (statusDiv) {
            statusDiv.textContent = `✅ 采集完成: 成功 ${successCount}, 失败 ${failCount}`;
            statusDiv.style.color = '#52c41a';
            console.log('[YbPriceTracker] 提示已恢复显示');
        }
        // 剩余时间后清除
        const remainMs = MAX_AGE - elapsed;
        if (clearStatusTimer) clearTimeout(clearStatusTimer);
        clearStatusTimer = setTimeout(() => {
            const sd = document.getElementById('update-status');
            if (sd) sd.textContent = '';
            try { chrome.storage.local.remove('lastRefreshResult'); } catch (e) {}
        }, remainMs);
    } catch (e) {
        console.warn('[YbPriceTracker] 恢复刷新结果失败:', e);
    }
}

// 恢复进行中的刷新状态（popup 重开时）
async function restoreRefreshState() {
    try {
        const { refreshState } = await chrome.storage.local.get('refreshState');
        if (!refreshState || refreshState.phase !== 'running') {
            // 没有进行中的刷新，确保按钮可用
            const refreshBtn = document.getElementById('refresh-prices-btn');
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 刷新所有价格';
            }
            return;
        }
        
        // 检查是否卡死（超过 60 秒没更新 → 强制重置）
        const now = Date.now();
        const lastUpdate = refreshState.lastUpdate || 0;
        if (now - lastUpdate > 60 * 1000) {
            console.warn('[YbPriceTracker] 刷新状态过期，强制重置');
            await chrome.runtime.sendMessage({ action: 'resetRefreshLock' });
            const refreshBtn = document.getElementById('refresh-prices-btn');
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 刷新所有价格';
            }
            return;
        }
        
        const { total, done, currentTitle, successCount, failCount } = refreshState;
        const refreshBtn = document.getElementById('refresh-prices-btn');
        const statusDiv = document.getElementById('update-status');
        
        // 禁用按钮，显示进度
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ 刷新中...';
        }
        if (statusDiv) {
            const shortTitle = (currentTitle || '').slice(0, 10);
            const ellipsis = (currentTitle && currentTitle.length > 10) ? '…' : '';
            statusDiv.textContent = `⏳ ${done}/${total} ${shortTitle}${ellipsis} (✓${successCount} ✗${failCount})`;
            statusDiv.style.color = '#667eea';
        }
        
        // 持续监听进度（直到完成）
        const listener = (message) => {
            if (!message || message.action !== 'refreshProgress') return;
            const { total, done, phase, currentTitle, successCount, failCount } = message;
            if (!statusDiv) return;
            if (phase === 'done') {
                // 先保存 + 显示提示（确保不被 loadData 覆盖）
                saveRefreshResult(successCount, failCount);
                scheduleClearStatus(); showRefreshDoneStatus(successCount, failCount);
                statusDiv.textContent = `✅ 采集完成: 成功 ${successCount}, 失败 ${failCount}`;
                statusDiv.style.color = '#52c41a';
                console.log('[YbPriceTracker] 刷新完成（恢复），提示已显示:', successCount, failCount);
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '🔄 刷新所有价格';
                }
                chrome.runtime.onMessage.removeListener(listener);
                setTimeout(() => loadData(), 100);
            } else if (phase === 'running') {
                const shortTitle = (currentTitle || '').slice(0, 10);
                const ellipsis = (currentTitle && currentTitle.length > 10) ? '…' : '';
                statusDiv.textContent = `⏳ ${done}/${total} ${shortTitle}${ellipsis} (✓${successCount} ✗${failCount})`;
                statusDiv.style.color = '#667eea';
            }
        };
        chrome.runtime.onMessage.addListener(listener);
    } catch (e) {
        console.warn('恢复刷新状态失败:', e);
        // 出错也要恢复按钮
        const refreshBtn = document.getElementById('refresh-prices-btn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 刷新所有价格';
        }
    }
}

// 设置事件监听
function setupEventListeners() {
    // 标签切换
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            updateSortRow();
            renderProducts();
        });
    });

    // 添加商品按钮
    elements.addProductBtn.addEventListener('click', addCurrentPageProduct);
    
    // 刷新价格按钮
    const refreshBtn = document.getElementById('refresh-prices-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAllPrices);
    }

    // 监控中/已购买：切换添加时间 / 意向排序
    const sortTime = document.getElementById('sort-time');
    const sortDesire = document.getElementById('sort-desire');
    if (sortTime && sortDesire) {
        sortTime.addEventListener('click', () => {
            currentSort = 'created_at';
            sortTime.classList.add('active');
            sortDesire.classList.remove('active');
            loadData();
        });
        sortDesire.addEventListener('click', () => {
            currentSort = 'desire_level';
            sortDesire.classList.add('active');
            sortTime.classList.remove('active');
            loadData();
        });
    }

    // 价格下降页签：降幅排序按钮（用于切换升降序）
    const sortDrop = document.getElementById('sort-drop');
    if (sortDrop) {
        sortDrop.addEventListener('click', () => {
            // 切换降幅排序方向：默认降序（降幅从大到小）→ 升序
            dropSortAsc = !dropSortAsc;
            sortDrop.textContent = dropSortAsc ? '📉 降幅↓' : '📉 降幅↑';
            renderProducts();
        });
    }

    // 平台筛选
    document.querySelectorAll('.platform-chip[data-platform]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.platform-chip[data-platform]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentPlatform = chip.dataset.platform;
            renderProducts();
        });
    });

    // 分组展示切换
    const groupToggle = document.getElementById('group-toggle');
    if (groupToggle) {
        groupToggle.addEventListener('click', () => {
            groupByPlatform = !groupByPlatform;
            groupToggle.classList.toggle('active', groupByPlatform);
            renderProducts();
        });
    }
}

// 根据当前页签显示/隐藏对应的排序按钮
function updateSortRow() {
    const normalRow = document.getElementById('sort-normal');
    const dropsRow = document.getElementById('sort-drops');
    const sortLabel = document.getElementById('sort-label');
    if (!normalRow || !dropsRow) return;

    if (currentTab === 'drops') {
        normalRow.style.display = 'none';
        dropsRow.style.display = 'flex';
        if (sortLabel) sortLabel.textContent = '价格下降 · 按降幅排序：';
    } else if (currentTab === 'watching' || currentTab === 'bought') {
        normalRow.style.display = 'flex';
        dropsRow.style.display = 'none';
        if (sortLabel) sortLabel.textContent = '排序：';
    } else {
        // 其他情况都隐藏
        normalRow.style.display = 'none';
        dropsRow.style.display = 'none';
        if (sortLabel) sortLabel.textContent = '';
    }
}

// 刷新所有商品价格
// 通过 background 无感知采集，进度实时显示（3/8 风格）
async function refreshAllPrices() {
    const refreshBtn = document.getElementById('refresh-prices-btn');
    const statusDiv = document.getElementById('update-status');
    
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ 刷新中...';
    }
    if (statusDiv) {
        statusDiv.textContent = '准备采集...';
        statusDiv.style.color = '#667eea';
    }
    
    // 监听 background 的进度广播（收到 done 才移除，不要在 finally 移除）
    const progressListener = (message) => {
        if (!message || message.action !== 'refreshProgress') return;
        const { total, done, phase, currentTitle, successCount, failCount } = message;
        if (!statusDiv) return;
        
        if (phase === 'done') {
            // 先保存 + 显示提示（确保不被 loadData 覆盖）
            saveRefreshResult(successCount, failCount);
            scheduleClearStatus(); showRefreshDoneStatus(successCount, failCount);
            statusDiv.textContent = `✅ 采集完成: 成功 ${successCount}, 失败 ${failCount}`;
            statusDiv.style.color = '#52c41a';
            console.log('[YbPriceTracker] 刷新完成，提示已显示:', successCount, failCount);
            chrome.runtime.onMessage.removeListener(progressListener);
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 刷新所有价格';
            }
            // 最后再 loadData（避免覆盖提示）
            setTimeout(() => loadData(), 100);
        } else if (phase === 'running') {
            // 显示 3/8 风格进度 + 当前商品名 + 成功/失败计数
            const shortTitle = (currentTitle || '').slice(0, 10);
            const ellipsis = (currentTitle && currentTitle.length > 10) ? '…' : '';
            statusDiv.textContent = `⏳ ${done}/${total} ${shortTitle}${ellipsis} (✓${successCount} ✗${failCount})`;
            statusDiv.style.color = '#667eea';
        }
    };
    chrome.runtime.onMessage.addListener(progressListener);
    
    try {
        // 委托给 background service worker 执行后台采集
        const resp = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'refreshAllPrices' }, (response) => resolve(response));
        });
        // 注意：不在 finally 移除 listener，因为 background 可能还在广播进度
        // listener 会在收到 phase: 'done' 时自动移除
        const data = resp || {};
        if (!data.success) {
            if (statusDiv) {
                statusDiv.textContent = '❌ 采集失败: ' + (data.error || '未知错误');
                statusDiv.style.color = '#ff4d4f';
            }
            chrome.runtime.onMessage.removeListener(progressListener);
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 刷新所有价格';
            }
        }
    } catch (error) {
        console.error('刷新价格失败:', error);
        if (statusDiv) {
            statusDiv.textContent = '❌ 采集异常，请检查扩展/后端服务';
            statusDiv.style.color = '#ff4d4f';
        }
        chrome.runtime.onMessage.removeListener(progressListener);
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 刷新所有价格';
        }
    }
}

// 加载数据
async function loadData() {
    try {
        // 加载统计数据
        const statsResponse = await fetch(`${API_BASE}/products/stats`);
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            if (statsData.success) {
                stats = statsData.data;
                updateStats();
            }
        }

        // 加载商品列表（按当前排序方式）
        const productsResponse = await fetch(`${API_BASE}/products?orderBy=${currentSort}`);
        if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            if (productsData.success) {
                products = productsData.data;
                renderProducts();
            }
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('无法连接到后端服务，请确保服务已启动');
    }
}

// 更新统计信息
function updateStats() {
    if (stats) {
        elements.totalCount.textContent = stats.total || 0;
        elements.watchingCount.textContent = stats.watching || 0;
        elements.dropsCount.textContent = stats.price_drops?.length || 0;
    }
    // 调试日志
    console.log('YbPriceTracker: 统计信息', stats);
    console.log('YbPriceTracker: 商品列表', products);
}

// 渲染商品列表
function renderProducts() {
    const filteredProducts = filterProducts();
    
    if (filteredProducts.length === 0) {
        elements.productList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 01-8 0"></path>
                </svg>
                <p>${getEmptyMessage()}</p>
            </div>
        `;
        return;
    }

    // 分组模式：按平台分组，每组带标题头
    if (groupByPlatform) {
        const groups = groupByPlatformFn(filteredProducts);
        elements.productList.innerHTML = groups.map(group => `
            <div class="platform-group">
                <div class="platform-group-header">
                    <span class="platform-group-icon">${getPlatformIcon(group.platform)}</span>
                    <span class="platform-group-title">${getPlatformName(group.platform)}</span>
                    <span class="platform-group-count">${group.items.length}</span>
                </div>
                <div class="platform-group-list">
                    ${group.items.map(p => createProductCard(p)).join('')}
                </div>
            </div>
        `).join('');
    } else {
        elements.productList.innerHTML = filteredProducts.map(product => createProductCard(product)).join('');
    }
    
    // 绑定商品卡片事件
    bindProductCardEvents();
}

// 筛选商品
function filterProducts() {
    // 先按页签筛选
    let list;
    switch (currentTab) {
        case 'watching':
            list = products.filter(p => p.status === 'watching');
            break;
        case 'bought':
            list = products.filter(p => p.status === 'bought');
            break;
        case 'drops': {
            list = products.filter(p => 
                p.price_trend && p.price_trend.diff < 0 && p.status === 'watching'
            );
            // 按降幅排序
            list.sort((a, b) => {
                const diffA = a.price_trend.diff || 0;
                const diffB = b.price_trend.diff || 0;
                return dropSortAsc ? diffA - diffB : diffB - diffA;
            });
            break;
        }
        default:
            list = products.slice();
    }

    // 再按平台筛选
    if (currentPlatform && currentPlatform !== 'all') {
        list = list.filter(p => p.platform === currentPlatform);
    }

    return list;
}

// 按平台分组返回 [{platform, items}, ...]
function groupByPlatformFn(list) {
    const groups = [];
    const order = ['jd', 'taobao', 'pdd'];
    for (const platform of order) {
        const items = list.filter(p => p.platform === platform);
        if (items.length > 0) {
            groups.push({ platform, items });
        }
    }
    return groups;
}

// 获取空状态消息
function getEmptyMessage() {
    switch (currentTab) {
        case 'watching':
            return '还没有监控的商品\n点击下方按钮添加';
        case 'bought':
            return '还没有已购买的商品';
        case 'drops':
            return '暂时没有价格下降的商品';
        default:
            return '暂无数据';
    }
}

// 创建商品卡片
function createProductCard(product) {
    const desireStars = '★'.repeat(product.desire_level || 3) + '☆'.repeat(5 - (product.desire_level || 3));
    const platformClass = `platform-${product.platform}`;
    const platformName = getPlatformName(product.platform);
    const platformIcon = getPlatformIcon(product.platform);
    const createdTime = formatTime(product.created_at);
    
    // 补全图片协议（//gw.alicdn.com/... → https://gw.alicdn.com/...）
    let rawImage = product.image_url || '';
    if (rawImage.startsWith('//')) rawImage = 'https:' + rawImage;
    // 去掉 OSS 缩略参数（防盗链 403）
    rawImage = rawImage.replace(/\?x-oss-process=[^&]*/, '').replace(/[&?]x-oss-process=[^&]*/, '');
    const hasImage = rawImage.length > 0 && rawImage.startsWith('http');
    
    return `
        <div class="product-card ${hasImage ? 'has-image' : ''}" data-id="${product.id}">
            ${hasImage ? `<img class="product-thumb" src="${rawImage}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22 viewBox=%220 0 56 56%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2256%22 height=%2256%22/%3E%3Ctext x=%2228%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%23bbb%22 font-size=%2210%22%3E无图%3C/text%3E%3C/svg%3E'"/>` : ''}
            <div class="product-info">
                <div class="product-header">
                    <div class="product-title">${product.title || '未知商品'}</div>
                    <span class="platform-badge ${platformClass}">${platformIcon}${platformName}</span>
                </div>
                
                <div class="product-meta">
                    <span class="desire-stars" title="点击修改购买意向" data-id="${product.id}" data-level="${product.desire_level || 3}">${desireStars}</span>
                    <span class="meta-divider"></span>
                    <span class="current-price">${product.current_price ? '¥' + Number(product.current_price).toFixed(2) : '暂无价格'}</span>
                    ${product.original_price && Number(product.original_price) !== Number(product.current_price) ? 
                        `<span class="original-price">¥${Number(product.original_price).toFixed(2)}</span>` : ''}
                    ${product.initial_price && Number(product.initial_price) !== Number(product.current_price) ? 
                        `<span class="initial-price" title="添加时价格">添加¥${Number(product.initial_price).toFixed(2)}</span>` : ''}
                    ${product.target_price ? 
                        `<span class="target-price" data-id="${product.id}" data-target="${product.target_price}" title="点击修改预期价格">🎯¥${Number(product.target_price).toFixed(2)}</span>` : ''}
                    ${product.price_trend ? 
                        `<span class="price-trend trend-${getTrendClass(product.price_trend.trend)}">${product.price_trend.emoji}</span>` : ''}
                    ${product.price_trend && product.price_trend.diff < 0 ? 
                        `<span class="drop-percent">↓${Math.abs(product.price_trend.diff).toFixed(1)}%</span>` : ''}
                    <button class="btn-open-source" data-url="${encodeURIComponent(product.url || '')}" title="访问商品页面">↗</button>
                    ${createdTime ? `<span class="product-added-time">${createdTime}</span>` : ''}
                </div>
                
                ${product.price_trend && product.price_trend.trend !== 'none' ? 
                    `<div class="trend-msg">${product.price_trend.message}</div>` : ''}
                
                <div class="product-actions">
                    <button class="btn btn-primary view-history" data-id="${product.id}">历史</button>
                    <button class="btn view-mmb" data-url="${encodeURIComponent(product.url || '')}" data-id="${product.id}">慢慢买</button>
                    <button class="btn set-target" data-id="${product.id}" data-target="${product.target_price || ''}" title="设置预期价格">🎯 目标价</button>
                    ${product.status === 'watching' ? 
                        `<button class="btn btn-success mark-bought" data-id="${product.id}">已购</button>
                         <button class="btn btn-danger remove-product" data-id="${product.id}">移除</button>` : 
                        `<button class="btn view-detail" data-id="${product.id}">详情</button>`}
                </div>
            </div>
        </div>
    `;
}

// 绑定商品卡片事件
function bindProductCardEvents() {
    // 查看历史价格
    document.querySelectorAll('.view-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            viewPriceHistory(productId);
        });
    });

    // 查看慢慢买走势（直接在浏览器新标签打开，用户已登录即可看完整走势）
    document.querySelectorAll('.view-mmb').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const encUrl = e.target.dataset.url;
            if (encUrl) {
                const productUrl = decodeURIComponent(encUrl);
                chrome.tabs.create({ url: `https://tool.manmanbuy.com/HistoryLowest.aspx?url=${encodeURIComponent(productUrl)}` });
            }
        });
    });

    // 访问商品页面（打开商品来源页）
    document.querySelectorAll('.btn-open-source').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const encUrl = e.currentTarget.dataset.url;
            if (encUrl) {
                chrome.tabs.create({ url: decodeURIComponent(encUrl) });
            }
        });
    });

    // 标记为已购买
    document.querySelectorAll('.mark-bought').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            markAsBought(productId);
        });
    });

    // 设置预期价格
    document.querySelectorAll('.set-target').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.id;
            const currentTarget = e.currentTarget.dataset.target;
            setTargetPrice(productId, currentTarget);
        });
    });

    // 点击预期价格标签也弹出设置
    document.querySelectorAll('.target-price').forEach(el => {
        el.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.id;
            const currentTarget = e.currentTarget.dataset.target;
            setTargetPrice(productId, currentTarget);
        });
    });

    // 移除商品
    document.querySelectorAll('.remove-product').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            removeProduct(productId);
        });
    });

    // 购买意向星级：支持点击 + 水平拖拽（滑轨式）
    document.querySelectorAll('.desire-stars').forEach(star => {
        let dragging = false;
        let startLevel = 0;
        let lastLevel = 0;
        let moved = false;

        // 根据水平位置计算星级（1-5）
        const calcLevel = (clientX) => {
            const rect = star.getBoundingClientRect();
            const ratio = (clientX - rect.left) / rect.width;
            const level = Math.ceil(ratio * 5);
            return Math.max(1, Math.min(5, level));
        };

        const updateDisplay = (level) => {
            const stars = '★'.repeat(level) + '☆'.repeat(5 - level);
            star.textContent = stars;
            star.dataset.level = level;
        };

        // 指针按下：开始拖拽
        star.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = true;
            moved = false;
            startLevel = parseInt(star.dataset.level) || 3;
            lastLevel = startLevel;
            star.classList.add('dragging');
            star.setPointerCapture(e.pointerId);
            // 立即响应按下位置
            const level = calcLevel(e.clientX);
            if (level !== lastLevel) {
                lastLevel = level;
                updateDisplay(level);
            }
        });

        // 指针移动：滑轨式跟随
        star.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            moved = true;
            const level = calcLevel(e.clientX);
            if (level !== lastLevel) {
                lastLevel = level;
                updateDisplay(level);
            }
        });

        // 指针松开：提交
        star.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            dragging = false;
            star.classList.remove('dragging');
            try { star.releasePointerCapture(e.pointerId); } catch (err) {}

            const finalLevel = parseInt(star.dataset.level) || 3;
            // 点击（没拖动）→ 循环 +1；拖动 → 直接设值
            if (!moved) {
                const next = startLevel >= 5 ? 1 : startLevel + 1;
                updateDisplay(next);
                changeDesireLevel(star.dataset.id, next);
            } else if (finalLevel !== startLevel) {
                changeDesireLevel(star.dataset.id, finalLevel);
            }
        });

        // 指针离开/取消：还原
        star.addEventListener('pointercancel', (e) => {
            if (!dragging) return;
            dragging = false;
            star.classList.remove('dragging');
            try { star.releasePointerCapture(e.pointerId); } catch (err) {}
            updateDisplay(startLevel);
        });
    });
}

// 设置预期价格
async function setTargetPrice(productId, currentTarget) {
    const newTarget = prompt(
        `设置预期价格（低于此价时提醒）\n当前预期价: ${currentTarget ? '¥' + currentTarget : '未设置'}\n不设置则默认：低于添加价 85% 时提醒`,
        currentTarget || ''
    );
    // 用户点取消
    if (newTarget === null) return;
    
    // 空字符串 = 清除预期价格
    const targetValue = newTarget.trim() === '' ? null : parseFloat(newTarget);
    if (newTarget.trim() !== '' && (isNaN(targetValue) || targetValue <= 0)) {
        showError('请输入有效价格');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_price: targetValue })
        });
        const data = await response.json();
        if (data.success) {
            showSuccess(targetValue ? `预期价已设为 ¥${targetValue.toFixed(2)}` : '已清除预期价');
            await loadData();
        } else {
            showError(data.error || '设置失败');
        }
    } catch (error) {
        console.error('设置预期价失败:', error);
        showError('设置失败');
    }
}

// 修改购买意向
async function changeDesireLevel(productId, level) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ desire_level: level })
        });
        const data = await response.json();
        if (data.success) {
            showSuccess(`意向已设为 ${'★'.repeat(level)}${'☆'.repeat(5-level)}`);
            await loadData();
        } else {
            showError(data.error || '修改失败');
        }
    } catch (error) {
        console.error('修改意向失败:', error);
        showError('修改失败');
    }
}

// 格式化时间显示
function formatTime(dt) {
    if (!dt) return '';
    try {
        const d = new Date(dt);
        const now = new Date();
        const diff = now - d;
        if (diff < 60 * 1000) return '刚刚';
        if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '小时前';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const today = new Date();
        if (y === today.getFullYear()) return `${m}-${day}`;
        return `${y}-${m}-${day}`;
    } catch (e) {
        return '';
    }
}

// 添加当前页面商品
async function addCurrentPageProduct() {
    try {
        // 获取当前标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            showError('无法获取当前页面');
            return;
        }

        // 检查是否是支持的平台
        const platform = detectPlatform(tab.url);
        if (!platform) {
            showError('当前页面不是支持的电商平台\n支持：京东、淘宝、拼多多');
            return;
        }

        // 提取商品ID（与 content.js 保持一致的多模式匹配）
        const productId = extractProductId(tab.url, platform);
        console.log('YbPriceTracker popup: URL=', tab.url, 'platform=', platform, 'productId=', productId);
        if (!productId) {
            showError('无法识别商品ID，请确保在商品详情页\n当前URL: ' + tab.url);
            return;
        }

        // 尝试从 content script 获取页面上的实时价格（与悬浮按钮行为一致）
        let currentPrice = null;
        let originalPrice = null;
        let title = tab.title;
        let imageUrl = null;
        try {
            const resp = await chrome.tabs.sendMessage(tab.id, { action: 'getProductInfo' });
            if (resp && typeof resp === 'object') {
                currentPrice = resp.price ?? null;
                originalPrice = resp.originalPrice ?? null;
                if (resp.title) title = resp.title;
                if (resp.image) imageUrl = resp.image;
            }
        } catch (e) {
            // content script 可能未注入（非商品页/刷新后未加载），忽略并继续
            console.warn('YbPriceTracker popup: 无法从 content script 获取价格，将仅以无价格入库', e && e.message);
        }

        // 发送到后端
        const body = {
            platform,
            product_id: String(productId),
            title: title || '未知商品',
            url: tab.url,
            desire_level: 3
        };
        if (currentPrice) {
            body.current_price = currentPrice;
            body.original_price = originalPrice || currentPrice;
        }
        if (imageUrl) {
            body.image_url = imageUrl;
        }

        const response = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('商品添加成功！');
            await loadData();
        } else {
            showError(data.error || '添加失败');
        }
    } catch (error) {
        console.error('添加商品失败:', error);
        showError('添加失败，请检查后端服务是否运行');
    }
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

// 提取商品ID（与 content.js 保持一致的规则，确保弹窗路径与悬浮按钮路径都能识别）
function extractProductId(url, platform) {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        
        switch (platform) {
            case 'jd':
                // 支持多种京东链接格式：
                // https://item.jd.com/100012345678.html
                // https://item.m.jd.com/product/100012345678.html
                // https://m.jd.com/product/100012345678.html
                // https://m.jd.com/ware/detail.json?wareId=xxx
                // ?sku=xxx
                const jdPatterns = [
                    /\/(\d{5,})\.html/,           // item.jd.com/xxx.html
                    /\/product\/(\d{5,})/,        // /product/xxx
                    /wareId=(\d{5,})/,            // ?wareId=xxx
                    /sku=(\d{5,})/,               // ?sku=xxx
                    /\/(\d{5,})(?:\.html|$)/      // 通用数字ID
                ];
                for (const pattern of jdPatterns) {
                    const match = url.match(pattern);
                    if (match) return match[1];
                }
                return null;
                
            case 'taobao':
                // https://item.taobao.com/item.htm?id=123456789
                // https://detail.tmall.com/item.htm?id=123456789
                // 新版 detail 2.0：/item.htm?id=xxx 或 /item/xxx
                const taobaoId = urlObj.searchParams.get('id')
                    || urlObj.searchParams.get('item_id')
                    || urlObj.searchParams.get('itemId');
                if (taobaoId) return taobaoId;
                // 兜底：URL 中任意 id=xxx 数字
                const tbMatch = url.match(/[?&#]id=(\d{6,})/) || url.match(/item_id=(\d{6,})/);
                return tbMatch ? tbMatch[1] : null;
                
            case 'pdd':
                // https://mobile.yangkeduo.com/goods.html?goods_id=123456789
                const pddId = urlObj.searchParams.get('goods_id');
                if (pddId) return pddId;
                const pddMatch = url.match(/goods_id=(\d+)/);
                return pddMatch ? pddMatch[1] : null;
                
            default:
                return null;
        }
    } catch (error) {
        console.error('YbPriceTracker popup: 解析URL失败:', error, url);
        return null;
    }
}

// 查看价格历史 —— 打开本地图表窗口（内含慢慢买对照链接）
async function viewPriceHistory(productId) {
    try {
        const product = products.find(p => p.id == productId);
        if (!product) {
            showError('未找到商品');
            return;
        }

        // 打开本地图表窗口（无论是否有历史数据都打开，空数据会提示去慢慢买回传）
        chrome.windows.create({
            url: `charts.html?productId=${productId}&title=${encodeURIComponent(product.title)}&url=${encodeURIComponent(product.url || '')}`,
            type: 'popup',
            width: 960,
            height: 720
        });
    } catch (error) {
        console.error('获取价格历史失败:', error);
        showError('获取价格历史失败');
    }
}

// 标记为已购买
async function markAsBought(productId) {
    try {
        const product = products.find(p => p.id == productId);
        const boughtPrice = product?.current_price;

        const response = await fetch(`${API_BASE}/products/${productId}/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bought_price: boughtPrice })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('已标记为购买');
            await loadData();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('标记购买失败:', error);
        showError('操作失败');
    }
}

// 移除商品
async function removeProduct(productId) {
    if (!confirm('确定要移除这个商品吗？')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('商品已移除');
            await loadData();
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除商品失败:', error);
        showError('删除失败');
    }
}

// 检查价格下降
async function checkPriceDrops() {
    try {
        const response = await fetch(`${API_BASE}/prices/drops?threshold=5`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            elements.priceDropAlert.style.display = 'flex';
            elements.alertText.textContent = `有 ${data.data.length} 个商品价格下降超过5%！`;
        }
    } catch (error) {
        // 静默处理
    }
}

// 获取平台名称
function getPlatformName(platform) {
    const names = {
        'jd': '京东',
        'taobao': '淘宝',
        'pdd': '拼多多'
    };
    return names[platform] || platform;
}

// 获取平台 Logo（内联 SVG，不依赖外部资源）
function getPlatformIcon(platform) {
    const icons = {
        // 京东：红色狗头抽象（"京"字红色方块）
        'jd': `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="4" fill="#e4393c"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">京</text></svg>`,
        // 淘宝：橙色"淘"字
        'taobao': `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="4" fill="#ff6a00"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">淘</text></svg>`,
        // 拼多多：红色"拼"字
        'pdd': `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="4" fill="#e02e24"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">拼</text></svg>`
    };
    return icons[platform] || '';
}

// 获取趋势样式类
function getTrendClass(trend) {
    const classes = {
        'lowest': 'lowest',
        'good': 'good',
        'below_avg': 'below',
        'above_avg': 'above',
        'high': 'high',
        'none': 'none'
    };
    return classes[trend] || 'below';
}

// 显示成功消息（非阻塞 toast，2.5 秒后消失）
function showSuccess(message) {
    showToast(message, '#52c41a');
}

// 显示错误消息（非阻塞 toast，3.5 秒后消失）
function showError(message) {
    showToast(message, '#ff4d4f', true);
}

// toast 通用实现
function showToast(message, color, isError) {
    const statusDiv = document.getElementById('update-status');
    // 优先在状态区显示
    if (statusDiv) {
        statusDiv.textContent = (isError ? '❌ ' : '✅ ') + message;
        statusDiv.style.color = color;
    }
    // 额外显示一个顶部 toast
    try {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;top:8px;left:8px;right:8px;z-index:99999;background:${color};color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
        t.textContent = (isError ? '❌ ' : '✅ ') + message;
        document.body.appendChild(t);
        setTimeout(() => { t.style.transition='opacity 0.3s'; t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, isError ? 3500 : 2500);
    } catch (e) {}
}
