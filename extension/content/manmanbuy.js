// 慢慢买历史价格页 —— 数据回传
// 当扩展打开 https://tool.manmanbuy.com/HistoryLowest.aspx?url=XXX 时，
// 页面自带的 histroyTrendExtend.js 会自动把 url 填入输入框并触发查询；
// 本脚本只负责：等待走势数据出现后回传给后端，丰富本地历史。
// （不主动调用 doSearch() —— 它会用 location.href 跳转，会导致无限刷新）
(function () {
    'use strict';

    const API_BASE = 'http://localhost:3777/api';
    // 防止同一页面会话内重复处理（应对浏览器前进/后退、BFCache 等）
    const HANDLED_FLAG = 'ypt_mmb_handled';

    function getQueryParam(name) {
        try {
            const u = new URL(window.location.href);
            return u.searchParams.get(name) || '';
        } catch (e) { return ''; }
    }

    function parseProduct(url) {
        let platform = null;
        if (url.includes('jd.com') || url.includes('jd.hk')) platform = 'jd';
        else if (url.includes('taobao.com') || url.includes('tmall.com')) platform = 'taobao';
        else if (url.includes('pinduoduo.com') || url.includes('pdd.com')) platform = 'pdd';
        if (!platform) return { platform: null, productId: null };

        let productId = null;
        try {
            const u = new URL(url);
            if (platform === 'jd') {
                const patterns = [/\/(\d{5,})\.html/, /\/product\/(\d{5,})/, /wareId=(\d{5,})/, /sku=(\d{5,})/, /\/(\d{5,})(?:\.html|$)/];
                for (const p of patterns) { const m = url.match(p); if (m) { productId = m[1]; break; } }
            } else if (platform === 'taobao') {
                productId = u.searchParams.get('id') || (url.match(/[?&]id=(\d+)/) || [])[1] || null;
            } else if (platform === 'pdd') {
                productId = u.searchParams.get('goods_id') || (url.match(/goods_id=(\d+)/) || [])[1] || null;
            }
        } catch (e) { /* ignore */ }
        return { platform, productId };
    }

    // 把价格历史数组回传后端
    async function reportHistory(url, data) {
        if (!data || !data.length || !url) return;
        const info = parseProduct(url);
        if (!info.platform || !info.productId) return;

        const records = [];
        for (const item of data) {
            try {
                const ts = Array.isArray(item) ? item[0] : item.time;
                const price = Array.isArray(item) ? item[1] : item.price;
                if (ts == null || price == null) continue;
                const p = parseFloat(price);
                if (isNaN(p) || p <= 0) continue;
                records.push({ time: new Date(Number(ts)).toISOString().slice(0, 19).replace('T', ' '), price: p });
            } catch (e) { /* skip */ }
        }
        if (!records.length) return;

        try {
            const resp = await fetch(`${API_BASE}/products?platform=${info.platform}&product_id=${info.productId}`);
            const json = await resp.json();
            if (!json.success || !json.data || !json.data.length) return;
            const product = json.data[0];

            const seenDays = new Set();
            for (const r of records) {
                const day = r.time.slice(0, 10);
                if (seenDays.has(day)) continue;
                seenDays.add(day);
                await fetch(`${API_BASE}/prices/record`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: info.platform,
                        product_id: String(info.productId),
                        price: r.price,
                        original_price: r.price,
                        recorded_at: r.time
                    })
                }).catch(() => {});
            }
            console.log(`[YbPriceTracker] 慢慢买历史回传 ${records.length} 条 -> 商品 #${product.id}`);
        } catch (e) {
            console.warn('[YbPriceTracker] 回传历史失败', e);
        }
    }

    function waitForChartData(timeoutMs) {
        return new Promise((resolve) => {
            const start = Date.now();
            const timer = setInterval(() => {
                try {
                    if (window.flotChart && Array.isArray(window.flotChart.oldData) && window.flotChart.oldData.length > 0) {
                        clearInterval(timer);
                        resolve(window.flotChart.oldData);
                        return;
                    }
                } catch (e) { /* ignore */ }
                if (Date.now() - start > timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 1000);
        });
    }

    function isLoginPopupShown() {
        try {
            const layer = document.querySelector('.layui-layer');
            if (layer && layer.offsetWidth > 0) return true;
            const iframe = document.querySelector('iframe[src*="login"]');
            if (iframe && iframe.offsetWidth > 0) return true;
        } catch (e) {}
        return false;
    }

    function showLoginHint() {
        try {
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#fff3cd;color:#856404;padding:10px 20px;font-size:14px;border-bottom:2px solid #ffc107;font-family:sans-serif;';
            div.innerHTML = '📊 YbPriceTracker：慢慢买需要登录后才能查询历史价格，请扫码登录后刷新本页，数据会自动回传。';
            document.body.appendChild(div);
        } catch (e) {}
    }

    async function main() {
        const targetUrl = getQueryParam('url');
        if (!targetUrl) return;

        // 防止重复处理（BFCache、反复刷新等）
        if (sessionStorage.getItem(HANDLED_FLAG + '_' + targetUrl) === '1') {
            console.log('[YbPriceTracker] 本会话已处理过该商品，跳过');
            return;
        }
        sessionStorage.setItem(HANDLED_FLAG + '_' + targetUrl, '1');

        console.log('[YbPriceTracker] 慢慢买历史价格页已就绪，目标商品:', targetUrl);
        console.log('[YbPriceTracker] 等待页面自动查询完成（最多90秒）...');

        // 页面自带的 histroyTrendExtend.js 会在 $(document).ready 时自动填充 url 并触发查询
        // 本脚本只等待 flotChart.oldData 填充完成，不主动触发查询（避免 location.href 跳转导致无限刷新）

        const data = await waitForChartData(90000);
        if (data && data.length > 0) {
            console.log(`[YbPriceTracker] 获取到慢慢买走势数据 ${data.length} 条，开始回传`);
            await reportHistory(targetUrl, data);
        } else {
            if (isLoginPopupShown()) {
                console.warn('[YbPriceTracker] 慢慢买要求登录，请扫码登录后刷新');
                showLoginHint();
            } else {
                console.warn('[YbPriceTracker] 未获取到走势数据（商品未收录或查询超时）');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(main, 1500));
    } else {
        setTimeout(main, 1500);
    }
})();
