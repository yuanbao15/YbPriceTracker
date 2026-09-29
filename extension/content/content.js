// 内容脚本 - 注入到电商网站页面
(function() {
    'use strict';
    
    // 当前平台
    let currentPlatform = null;
    let currentProductId = null;
    
    // 初始化
    function init() {
        currentPlatform = detectPlatform();
        if (!currentPlatform) {
            console.log('YbPriceTracker: 不是支持的电商平台');
            return;
        }
        
        console.log(`YbPriceTracker: 检测到平台 ${currentPlatform}`);
        
        // 延迟提取商品ID，等待页面加载
        setTimeout(() => {
            currentProductId = extractProductId();
            if (!currentProductId) {
                console.log('YbPriceTracker: 未能提取到商品ID，当前URL:', window.location.href);
                return;
            }
            
            console.log(`YbPriceTracker: 提取到商品ID ${currentProductId}`);
            
            // 注入价格追踪按钮
            injectTrackerButton();
            
            // 如果是商品详情页，显示历史价格
            if (isProductPage()) {
                showPriceHistoryBadge();
            }
        }, 1000);
    }
    
    // 检测当前平台
    function detectPlatform() {
        const url = window.location.href;
        
        if (url.includes('jd.com') || url.includes('jd.hk')) {
            return 'jd';
        } else if (url.includes('taobao.com') || url.includes('tmall.com')) {
            return 'taobao';
        } else if (url.includes('pinduoduo.com') || url.includes('pdd.com')) {
            return 'pdd';
        }
        
        return null;
    }
    
    // 提取商品ID
    function extractProductId() {
        const url = window.location.href;
        
        try {
            switch (currentPlatform) {
                case 'jd':
                    // 支持多种京东链接格式
                    // https://item.jd.com/100012345678.html
                    // https://item.m.jd.com/product/100012345678.html
                    // https://m.jd.com/product/100012345678.html
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
                    try {
                        const tbObj = new URL(url);
                        // 常规 query 参数
                        const tbId = tbObj.searchParams.get('id') 
                            || tbObj.searchParams.get('item_id')
                            || tbObj.searchParams.get('itemId');
                        if (tbId) return tbId;
                        // 兜底：URL 中任意 id=xxx 数字
                        const tbMatch = url.match(/[?&#]id=(\d{6,})/) || url.match(/item_id=(\d{6,})/);
                        return tbMatch ? tbMatch[1] : null;
                    } catch (e) {
                        const m = url.match(/[?&#]id=(\d{6,})/);
                        return m ? m[1] : null;
                    }
                    
                case 'pdd':
                    const pddObj = new URL(url);
                    return pddObj.searchParams.get('goods_id') || 
                           url.match(/goods_id=(\d+)/)?.[1];
                    
                default:
                    return null;
            }
        } catch (error) {
            console.error('YbPriceTracker: 提取商品ID失败', error);
            return null;
        }
    }
    
    // 判断是否是商品详情页
    function isProductPage() {
        const url = window.location.href;
        
        switch (currentPlatform) {
            case 'jd':
                return url.includes('item.jd.com');
            case 'taobao':
                return url.includes('item.taobao.com') || url.includes('detail.tmall.com');
            case 'pdd':
                return url.includes('goods.html') || url.includes('goods.pinduoduo.com');
            default:
                return false;
        }
    }
    
    // 注入追踪按钮
    function injectTrackerButton() {
        // 创建按钮容器
        const container = document.createElement('div');
        container.id = 'ybprice-tracker-btn';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
        `;
        
        // 创建按钮（用插件预置图标统一视觉）
        const button = document.createElement('button');
        const iconUrl = chrome.runtime.getURL('icons/icon16.png');
        button.innerHTML = `<img src="${iconUrl}" width="16" height="16" style="vertical-align: middle; margin-right: 6px; border-radius: 3px;"/> 添加到追踪`;
        button.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });
        
        button.addEventListener('click', () => {
            addCurrentProduct();
        });
        
        container.appendChild(button);
        document.body.appendChild(container);
    }
    
    // 添加当前商品
    async function addCurrentProduct() {
        const title = getProductTitle();
        const url = window.location.href;
        
        // 重新提取商品ID（防止初始化时页面未加载完）
        if (!currentProductId) {
            currentProductId = extractProductId();
        }
        
        if (!currentProductId) {
            showNotification('错误', '无法识别商品ID，请确保在商品详情页');
            return;
        }
        
        // 获取当前页面上的价格和图片
        const priceInfo = getCurrentPrice();
        const image = getProductImage();
        console.log('YbPriceTracker: 准备添加商品', { title, priceInfo, image });
        
        try {
            const response = await fetch('http://localhost:3777/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: currentPlatform,
                    product_id: String(currentProductId),
                    title: title || '未知商品',
                    url: url,
                    current_price: priceInfo.price,
                    original_price: priceInfo.originalPrice,
                    image_url: image,
                    desire_level: 3
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('✅ 成功', '商品已添加到价格追踪');
                updateButton('✓ 已添加', '#52c41a');
            } else {
                if (data.error.includes('已存在')) {
                    showNotification('提示', '该商品已在追踪列表中');
                    updateButton('✓ 已在列表', '#faad14');
                } else {
                    showNotification('错误', data.error || '添加失败');
                }
            }
        } catch (error) {
            console.error('YbPriceTracker: 添加商品失败', error);
            showNotification('错误', '无法连接到后端服务');
        }
    }
    
    // 获取商品标题
    function getProductTitle() {
        const selectors = {
            'jd': [
                '.sku-name',
                '.itemInfo-wrap .sku-name',
                'h1.item-name'
            ],
            'taobao': [
                '.ItemHeader--mainTitle--3CIjqW5',      // 新版淘宝/天猫
                '[class*="ItemHeader--mainTitle"]',
                '.tb-main-title',
                'h3.tb-main-title',
                '[data-title]',
                'h1',
                'title'
            ],
            'pdd': [
                '.goods-detail-name',
                '.goods-name',
                '[class*="goods-name"]',
                'h1'
            ]
        };
        
        const platformSelectors = selectors[currentPlatform] || [];
        
        for (const selector of platformSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = (element.textContent || '').trim();
                if (text) return text;
                const dataTitle = element.getAttribute('data-title');
                if (dataTitle) return dataTitle;
            }
        }
        
        // 兜底：使用页面标题
        return document.title.replace(/-.*$/, '').trim();
    }
    
    // 更新按钮状态
    function updateButton(text, color) {
        const button = document.querySelector('#ybprice-tracker-btn button');
        if (button) {
            button.innerHTML = text;
            button.style.background = color;
            
            // 3秒后恢复
            setTimeout(() => {
                const iconUrl = chrome.runtime.getURL('icons/icon16.png');
                button.innerHTML = `<img src="${iconUrl}" width="16" height="16" style="vertical-align: middle; margin-right: 6px; border-radius: 3px;"/> 添加到追踪`;
                button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 3000);
        }
    }
    
    // 获取当前页面上的价格
    function getCurrentPrice() {
        let price = null;
        let originalPrice = null;
        
        try {
            // 各平台的价格选择器（使用模糊匹配，兼容 class hash 后缀变化）
            const priceSelectorsByPlatform = {
                'jd': [
                    '.summary-price .price',          // 新版京东详情页价格
                    '.p-price .price',
                    '.p-price .price-text', 
                    '.J-p-price',
                    '.dd-num',
                    '.p-price-num',
                    '[class*="price"] .price',
                    '.item-detail-price',
                    '[class*="Summary"] [class*="price"]'
                ],
                // 淘宝/天猫（含新版 detail 2.0）
                // 实际 DOM：<div class="highlightPrice--xxx"><span class="symbol">￥</span><span class="text">252</span></div>
                //          <div class="subPrice--xxx"><span class="text">￥</span><span class="text">299</span></div>
                'taobao': [
                    '[class*="highlightPrice"] [class*="text"]:not([class*="title"])',  // 现价（highlightPrice 里的 text，排除 title）
                    '[class*="priceText"]',
                    '[class*="Price--priceText"]',
                    '[class*="priceNow"]',
                    '[class*="price-now"]',
                    '.tb-rmb-num',
                    '#J_StrPrice .tb-rmb-num',
                    '.tm-promo-price .tm-price',
                    '#J_PromoPriceNum',
                    '.price .tb-rmb-num'
                ],
                // 拼多多
                'pdd': [
                    '[class*="goods-price"]',
                    '[class*="price-"]',
                    '[class*="priceText"]',
                    '.goods-detail-price',
                    '.price-now',
                    '#goodsPrice'
                ]
            };
            
            // 原价选择器
            const originalSelectorsByPlatform = {
                'jd': ['.p-price .del-price', '.p-price .origin-price', '.p-price-original', '[class*="origin-price"]'],
                'taobao': [
                    '[class*="subPrice"] [class*="text"]:not([class*="title"]):last-child',  // subPrice 里最后一个 text 是原价
                    '[class*="originPrice"]',
                    '[class*="origin-price"]',
                    '.tb-rmb-num.orig-price'
                ],
                'pdd': ['[class*="origin-price"]', '[class*="originPrice"]']
            };
            
            // 各平台通用的兜底价格阈值
            const MIN_PRICE_THRESHOLD = 10;
            const MIN_FALLBACK_THRESHOLD = 50;

            // 通用的价格解析工具
            const parsePriceFromText = (text) => {
                if (!text) return null;
                // 先尝试匹配 ¥/￥ 符号后的数字
                let match = text.match(/[¥￥]\s*([\d,]+\.?\d*)/);
                if (!match) {
                    // 再尝试纯数字（整个文本只包含数字）
                    match = text.match(/^\s*([\d,]+\.?\d*)\s*$/);
                }
                if (!match) return null;
                const p = parseFloat(match[1].replace(/,/g, ''));
                return (isNaN(p) || p < MIN_PRICE_THRESHOLD) ? null : p;
            };
            
            // 尝试从选择器提取价格
            const extractFromSelectors = (selectors, threshold) => {
                for (const selector of selectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            const p = parsePriceFromText(element.textContent.trim());
                            if (p && p > threshold) return p;
                        }
                    } catch (e) { /* 非法 selector 跳过 */ }
                }
                return null;
            };
            
            // 淘宝/天猫专用：从 highlightPrice / subPrice 提取
            const extractTaobaoPrice = () => {
                try {
                    // 现价：highlightPrice 里的 text 元素（排除 title）
                    const highlightEl = document.querySelector('[class*="highlightPrice"]');
                    if (highlightEl) {
                        const textEls = highlightEl.querySelectorAll('[class*="text"]:not([class*="title"])');
                        for (const el of textEls) {
                            const p = parsePriceFromText(el.textContent.trim());
                            if (p) return p;
                        }
                    }
                    // 原价：subPrice 里的 text 元素（有多个，取最后一个非符号的数字）
                    const subEl = document.querySelector('[class*="subPrice"]');
                    if (subEl) {
                        const textEls = Array.from(subEl.querySelectorAll('[class*="text"]:not([class*="title"])'));
                        for (let i = textEls.length - 1; i >= 0; i--) {
                            const p = parsePriceFromText(textEls[i].textContent.trim());
                            if (p) return p;
                        }
                    }
                } catch (e) { /* ignore */ }
                return null;
            };
            
            // 1) 淘宝/天猫优先用专用提取
            if (currentPlatform === 'taobao') {
                price = extractTaobaoPrice();
            }
            
            // 2) 用平台通用选择器提取（如果淘宝专用提取失败）
            if (!price) {
                price = extractFromSelectors(priceSelectorsByPlatform[currentPlatform] || [], MIN_PRICE_THRESHOLD);
            }
            originalPrice = extractFromSelectors(originalSelectorsByPlatform[currentPlatform] || [], MIN_PRICE_THRESHOLD);
            
            // 3) 淘宝/天猫从 meta 标签兜底
            if (!price && (currentPlatform === 'taobao')) {
                const metaSelectors = [
                    'meta[property="product:price:amount"]',
                    'meta[itemprop="price"]',
                    'meta[property="og:price:amount"]',
                    'meta[name="product-price"]',
                    'meta[name="price"]'
                ];
                for (const sel of metaSelectors) {
                    const meta = document.querySelector(sel);
                    if (meta) {
                        const p = parseFloat(meta.getAttribute('content'));
                        if (!isNaN(p) && p > MIN_PRICE_THRESHOLD) {
                            price = p;
                            break;
                        }
                    }
                }
            }
            
            // 4) 通用兜底：从页面文本中扫描 ¥/￥xx（阈值 50）
            if (!price) {
                const bodyText = document.body.innerText;
                const priceMatches = bodyText.match(/[¥￥]\s*([\d,]+\.?\d+)/g) || [];
                for (const match of priceMatches) {
                    const p = parsePriceFromText(match);
                    if (p && p > MIN_FALLBACK_THRESHOLD) {
                        price = p;
                        break;
                    }
                }
            }
            
            // 5) 拼多多额外兜底：window 全局数据
            if (!price && currentPlatform === 'pdd') {
                try {
                    const rawPrice = window.__INITIAL_STATE__?.goods?.price
                        || window.rawData?.store?.initDataObj?.goods?.price;
                    if (rawPrice) {
                        const p = parseFloat(String(rawPrice).replace(/[^\d.]/g, ''));
                        if (!isNaN(p) && p > MIN_PRICE_THRESHOLD) {
                            price = p;
                        }
                    }
                } catch (e) { /* ignore */ }
            }
            
            // 6) 淘宝/天猫：window.__INITIAL_STATE__ / g_config 兜底
            if (!price && (currentPlatform === 'taobao')) {
                try {
                    const candidates = [
                        window.__INITIAL_STATE__?.item?.price,
                        window.__INITIAL_STATE__?.price,
                        window.__GLOBAL_STATE__?.item?.price,
                        window.g_config?.item?.price,
                        window.g_config?.price
                    ];
                    for (const c of candidates) {
                        if (c) {
                            const p = parseFloat(String(c).replace(/[^\d.]/g, ''));
                            if (!isNaN(p) && p > MIN_PRICE_THRESHOLD) {
                                price = p;
                                break;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
            }
            
            // 7) 最后兜底：扫描页面中带 ¥/￥ 的数字，取出现次数最多的（mode，更可能是主商品价格）
            if (!price) {
                const bodyText = document.body.innerText;
                const allPrices = (bodyText.match(/[¥￥]\s*([\d,]+\.?\d+)/g) || [])
                    .map(m => {
                        const n = m.match(/[¥￥]\s*([\d,]+\.?\d+)/);
                        return n ? parseFloat(n[1].replace(/,/g, '')) : null;
                    })
                    .filter(p => !isNaN(p) && p > MIN_FALLBACK_THRESHOLD && p < 1000000);
                if (allPrices.length > 0) {
                    // 统计每个价格出现次数
                    const countMap = {};
                    for (const p of allPrices) {
                        countMap[p] = (countMap[p] || 0) + 1;
                    }
                    // 取出现次数最多的价格（mode）
                    // 同等次数下取价格更高的（主商品价通常高于配件价）
                    let bestPrice = null, bestCount = 0;
                    for (const [p, c] of Object.entries(countMap)) {
                        const num = parseFloat(p);
                        if (c > bestCount || (c === bestCount && num > bestPrice)) {
                            bestPrice = num;
                            bestCount = c;
                        }
                    }
                    if (bestPrice != null) {
                        price = bestPrice;
                    }
                }
            }
            
            console.log('YbPriceTracker: 获取到价格', price, '原价', originalPrice);
        } catch (e) {
            console.error('YbPriceTracker: 获取价格失败', e);
        }
        
        return { price, originalPrice: originalPrice || price };
    }
    
    // 获取商品图片（缩略图）
    function getProductImage() {
        const selectors = {
            'jd': [
                '#spec-list img',
                '.product-intro .pic-item img',
                '[class*="product"] img[src*="jd"]',
                '#J_ImgBooth',
                '.main-img img',
                'img[data-src*="img"]',
                '#spec-items img'
            ],
            'taobao': [
                '[class*="PicGallery"] img',
                '[class*="mainPic"] img',
                '[class*="main-pic"] img',
                '[class*="mainPic"] img[data-src]',
                '[class*="gallery"] img',
                '#J_ImgBooth',
                '.tb-thumb img',
                'img[src*="alicdn"]',
                'img[data-src*="alicdn"]',
                'img[srcset*="alicdn"]',
                '[class*="mainPic"] [class*="img"]',
                '[data-src*="alicdn"]'
            ],
            'pdd': [
                '[class*="goods-gallery"] img',
                '[class*="goods-img"] img',
                '[class*="gallery"] img',
                '.goods-detail-gallery img',
                'img[src*="pinduoduo"]',
                'img[src*="pddimg"]'
            ]
        };
        
        const isValidSrc = (src) => {
            return src && !src.startsWith('data:') && !src.startsWith('blob:') && 
                   (src.startsWith('http') || src.startsWith('//'));
        };
        
        const normalizeSrc = (src) => {
            if (!src) return null;
            // 协议相对 URL 补全为 https
            if (src.startsWith('//')) src = 'https:' + src;
            // 去掉 OSS 缩略参数（防盗链 403）
            src = src.replace(/\?x-oss-process=[^&]*/, '').replace(/[&?]x-oss-process=[^&]*/, '');
            return src.startsWith('http') ? src : null;
        };
        
        const extractSrc = (el) => {
            if (!el) return null;
            // 优先 src，再 data-src，再 srcset 第一张
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original');
            if (!isValidSrc(src) && el.getAttribute('srcset')) {
                const first = el.getAttribute('srcset').split(',')[0].trim().split(' ')[0];
                if (isValidSrc(first)) src = first;
            }
            return normalizeSrc(src);
        };
        
        // 1) 平台选择器
        const platformSelectors = selectors[currentPlatform] || [];
        for (const selector of platformSelectors) {
            try {
                const els = document.querySelectorAll(selector);
                for (const el of els) {
                    const src = extractSrc(el);
                    if (src) return src;
                }
            } catch (e) { /* ignore */ }
        }
        
        // 2) 全局兜底：找 alicdn / jd / pinduoduo 的图片（跳过图标、小图）
        try {
            const imgs = document.querySelectorAll('img');
            const candidates = [];
            for (const img of imgs) {
                const src = extractSrc(img);
                if (!src) continue;
                const w = parseInt(img.getAttribute('width')) || img.naturalWidth || 0;
                const h = parseInt(img.getAttribute('height')) || img.naturalHeight || 0;
                // 优先选正方形大图（商品主图特征）
                if (w > 80 && h > 80) {
                    candidates.push({ src, w, h, score: Math.abs(w - h) < 50 ? 100 : 0 });
                }
            }
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score || b.w - a.w);
                return candidates[0].src;
            }
        } catch (e) { /* ignore */ }
        
        return null;
    }
    
    // 显示价格历史徽章
    async function showPriceHistoryBadge() {
        try {
            console.log(`[YbPriceTracker] 查询商品: platform=${currentPlatform}, product_id=${currentProductId}`);
            const response = await fetch(`http://localhost:3777/api/products?platform=${currentPlatform}&product_id=${currentProductId}`);
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                const product = data.data[0];
                console.log(`[YbPriceTracker] 查到商品: id=${product.id}, title=${product.title}, price=${product.current_price}`);
                injectPriceBadge(product);
                // 已在追踪列表中：把当前页面实时价格上报后端，丰富历史数据
                reportCurrentPriceToBackend(product.id);
            } else {
                console.log(`[YbPriceTracker] 未找到商品或不在追踪列表中`);
            }
        } catch (error) {
            console.warn('[YbPriceTracker] 查询商品失败:', error);
        }
    }
    
    // 将当前页面 DOM 上读到的价格上报后端（写入价格历史）
    // 这是获取历史数据最可靠的途径 —— 用户每次访问商品页都会补一条记录
    async function reportCurrentPriceToBackend(productId) {
        try {
            const priceInfo = getCurrentPrice();
            if (!priceInfo || !priceInfo.price) return;
            await fetch('http://localhost:3777/api/prices/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: currentPlatform,
                    product_id: String(currentProductId),
                    price: priceInfo.price,
                    original_price: priceInfo.originalPrice
                })
            });
            console.log('YbPriceTracker: 已上报当前价格 ¥' + priceInfo.price);
        } catch (e) {
            // 静默
        }
    }
    
    // 注入价格徽章
    function injectPriceBadge(product) {
        window.__ybprice_product__ = product;
        // 创建徽章
        const badge = document.createElement('div');
        badge.id = 'ybprice-badge';
        badge.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99998;
            background: white;
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
            min-width: 200px;
        `;
        
        const trend = product.price_trend || {};
        const trendColor = getTrendColor(trend.trend);
        
        badge.innerHTML = `
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">📊 YbPriceTracker</div>
            <div style="font-size: 18px; font-weight: 600; color: #e4393c; margin-bottom: 4px;">
                ¥${product.current_price}
            </div>
            <div style="font-size: 11px; color: ${trendColor}; margin-bottom: 8px;">
                ${trend.emoji || ''} ${trend.message || '暂无历史数据'}
            </div>
            <div style="font-size: 11px; color: #999;">
                历史最低: ¥${product.lowest_price || '--'}
            </div>
            <div style="font-size: 11px; color: #999;">
                意向等级: ${'★'.repeat(product.desire_level)}${'☆'.repeat(5 - product.desire_level)}
            </div>
            <a id="ybprice-badge-link" href="javascript:void(0)" style="
                display: block;
                margin-top: 10px;
                text-align: center;
                font-size: 12px;
                color: #667eea;
                text-decoration: none;
            ">📈 查看历史图表 →</a>
        `;
        
        document.body.appendChild(badge);

        // 绑定"查看历史图表"点击事件，打开本地 charts.html
        const badgeLink = badge.querySelector('#ybprice-badge-link');
        if (badgeLink) {
            badgeLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const product = window.__ybprice_product__;
                if (product) {
                    const chartsUrl = chrome.runtime.getURL('charts.html') + '?productId=' + product.id + '&title=' + encodeURIComponent(product.title || '') + '&url=' + encodeURIComponent(product.url || '');
                    chrome.runtime.sendMessage({ action: 'openTab', url: chartsUrl });
                }
            });
        }

        
        // 5秒后自动隐藏（可点击展开）
        setTimeout(() => {
            badge.style.opacity = '0.7';
            badge.addEventListener('mouseenter', () => {
                badge.style.opacity = '1';
            });
            badge.addEventListener('mouseleave', () => {
                badge.style.opacity = '0.7';
            });
        }, 5000);
    }
    
    // 获取趋势颜色
    function getTrendColor(trend) {
        const colors = {
            'lowest': '#52c41a',
            'good': '#52c41a',
            'below_avg': '#faad14',
            'above_avg': '#fa8c16',
            'high': '#ff4d4f'
        };
        return colors[trend] || '#666';
    }
    
    // 显示通知
    function showNotification(title, message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999;
            background: white;
            border-radius: 8px;
            padding: 15px 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
            animation: slideDown 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px; color: #666;">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后移除
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        @keyframes slideUp {
            from {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            to {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
    `;
    document.head.appendChild(style);
    
    // 启动
    init();
    
    // 监听来自 popup 的请求（获取当前页商品信息：标题、价格）
    // 让弹窗的"添加当前页面商品"按钮能复用 content script 已验证的 DOM 价格提取逻辑
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.action === 'getProductInfo') {
            // 淘宝/天猫/拼多多详情页价格是动态渲染的，先等一下再提取
            const doExtract = () => {
                try {
                    const title = getProductTitle();
                    const priceInfo = getCurrentPrice();
                    const image = getProductImage();
                    // 如有需要重新提取 ID（防止页面初始未加载完）
                    if (!currentProductId) {
                        currentProductId = extractProductId();
                    }
                    sendResponse({
                        platform: currentPlatform,
                        productId: currentProductId,
                        title: title || null,
                        price: priceInfo.price,
                        originalPrice: priceInfo.originalPrice,
                        image: image,
                        url: window.location.href
                    });
                } catch (e) {
                    console.error('YbPriceTracker: 响应 getProductInfo 失败', e);
                    sendResponse({
                        platform: currentPlatform,
                        productId: currentProductId,
                        title: null,
                        price: null,
                        originalPrice: null,
                        image: null,
                        url: window.location.href,
                        error: e && e.message
                    });
                }
            };
            // 立即提取（不等待，由 background 轮询重试）
            doExtract();
            return true;  // 异步返回
        }
    });
})();
