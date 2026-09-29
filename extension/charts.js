// API 基础地址
const API_BASE = 'http://localhost:3777/api';

// 从URL参数获取商品信息
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('productId');
const productTitle = urlParams.get('title') || '商品';
const productUrl = urlParams.get('url') || '';

// 当前选择的天数（默认 30 天，与默认激活按钮一致）
let currentDays = 30;

// 图表实例
let priceChart = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 设置标题
    document.getElementById('product-title').textContent = decodeURIComponent(productTitle);

    // 设置慢慢买链接
    const mmbLink = document.getElementById('mmb-link');
    if (mmbLink && productUrl) {
        mmbLink.href = `https://tool.manmanbuy.com/HistoryLowest.aspx?url=${encodeURIComponent(productUrl)}`;
        mmbLink.style.display = '';
    }

    // 绑定时间范围按钮事件
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDays = parseInt(btn.dataset.days);
            loadPriceHistory();
        });
    });

    // 加载数据（等 Chart.js 就绪后）
    waitForChart().then(() => loadPriceHistory());
});

// 等待 Chart.js 加载完成
function waitForChart(maxWait) {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') { resolve(); return; }
        const start = Date.now();
        const timer = setInterval(() => {
            if (typeof Chart !== 'undefined' || Date.now() - start > (maxWait || 10000)) {
                clearInterval(timer);
                resolve();
            }
        }, 200);
    });
}

// 加载价格历史
async function loadPriceHistory() {
    try {
        // 显示加载状态
        document.getElementById('history-table-body').innerHTML =
            '<tr><td colspan="5" class="loading">加载中...</td></tr>';

        // 获取价格历史
        const response = await fetch(`${API_BASE}/prices/${productId}/history?days=${currentDays}`);
        const data = await response.json();

        if (data.success) {
            const { history, stats } = data.data;

            // 更新价格摘要
            updatePriceSummary(stats, history);

            // 绘制图表
            renderChart(history);

            // 渲染表格
            renderTable(history);
        } else {
            showError('加载失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('加载价格历史失败:', error);
        showError('无法连接到后端服务');
    }
}

// 更新价格摘要
function updatePriceSummary(stats, history) {
    if (!stats) return;

    // 当前价格 = 最新一条历史记录的价格（history 按 recorded_at ASC 排序，最后一条是最新）
    let currentPrice = null;
    if (history && history.length > 0) {
        const last = history[history.length - 1];
        currentPrice = parseFloat(last.price);
    }
    document.getElementById('current-price').textContent =
        currentPrice ? `¥${currentPrice.toFixed(2)}` : '--';
    document.getElementById('lowest-price').textContent =
        stats.min_price ? `¥${parseFloat(stats.min_price).toFixed(2)}` : '--';
    document.getElementById('highest-price').textContent =
        stats.max_price ? `¥${parseFloat(stats.max_price).toFixed(2)}` : '--';
    document.getElementById('avg-price').textContent =
        stats.avg_price ? `¥${parseFloat(stats.avg_price).toFixed(2)}` : '--';
}

// 渲染图表
function renderChart(history) {
    // 无数据时显示空状态提示
    if (!history || history.length === 0) {
        const mmbLink = productUrl
            ? `<a href="https://tool.manmanbuy.com/HistoryLowest.aspx?url=${encodeURIComponent(productUrl)}" target="_blank" style="color:#667eea;">打开慢慢买回传历史数据</a>`
            : '';
        document.getElementById('priceChart').parentElement.innerHTML =
            `<div style="text-align:center;padding:60px 20px;color:#999;">
                <div style="font-size:48px;margin-bottom:12px;">📉</div>
                <div style="font-size:16px;margin-bottom:8px;">暂无价格历史数据</div>
                <div style="font-size:13px;line-height:1.6;">
                    点击「刷新所有价格」可采集当前价格<br>
                    ${mmbLink ? '或' + mmbLink + '（自动回传到本地）<br>' : ''}
                    持续使用后曲线会逐渐丰满
                </div>
            </div>`;
        return;
    }

    // Chart.js 未加载时，显示数据点摘要而不画图
    if (typeof Chart === 'undefined') {
        document.getElementById('priceChart').parentElement.innerHTML =
            `<div style="text-align:center;padding:40px 20px;color:#666;">
                <div style="font-size:14px;margin-bottom:8px;">📊 共 ${history.length} 条价格记录</div>
                <div style="font-size:13px;color:#999;">Chart.js 组件加载失败，但下方表格可正常查看数据</div>
            </div>`;
        return;
    }

    try {
        const ctx = document.getElementById('priceChart').getContext('2d');

        // 如果已有图表，先销毁
        if (priceChart) {
            priceChart.destroy();
        }

        // 准备数据
        const labels = history.map(item => {
            const date = new Date(item.recorded_at);
            return date.toLocaleDateString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            });
        });

        const prices = history.map(item => parseFloat(item.price));

        // 创建图表
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '价格',
                    data: prices,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return `价格: ¥${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '¥' + value;
                            },
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    } catch (e) {
        console.error('绘制图表失败:', e);
        document.getElementById('priceChart').parentElement.innerHTML =
            `<div style="text-align:center;padding:40px 20px;color:#666;">
                <div style="font-size:14px;margin-bottom:8px;">📊 共 ${history.length} 条价格记录</div>
                <div style="font-size:13px;color:#999;">图表绘制失败：${e.message}<br>请查看下方表格数据</div>
            </div>`;
    }
}

// 渲染表格
function renderTable(history) {
    const tbody = document.getElementById('history-table-body');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无价格记录</td></tr>';
        return;
    }

    // 反转顺序，最新的在前面
    const reversedHistory = [...history].reverse();

    let html = '';
    let prevPrice = null;

    reversedHistory.forEach((item, index) => {
        const date = new Date(item.recorded_at);
        const formattedDate = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const price = parseFloat(item.price);
        const originalPrice = item.original_price ? parseFloat(item.original_price) : null;

        // 计算价格变动
        let priceChange = '';
        let changeClass = '';
        if (prevPrice !== null) {
            const change = price - prevPrice;
            if (change > 0) {
                priceChange = `+${change.toFixed(2)}`;
                changeClass = 'up';
            } else if (change < 0) {
                priceChange = change.toFixed(2);
                changeClass = 'down';
            } else {
                priceChange = '0.00';
            }
        }

        // 优惠券信息
        let couponInfo = '-';
        if (item.coupon_info) {
            try {
                const coupons = JSON.parse(item.coupon_info);
                if (Array.isArray(coupons) && coupons.length > 0) {
                    couponInfo = coupons.map(c => c.text || `满${c.min_amount}减${c.discount_amount}`).join(', ');
                }
            } catch (e) {
                // 忽略解析错误
            }
        }

        html += `
            <tr>
                <td>${formattedDate}</td>
                <td>¥${price.toFixed(2)}</td>
                <td>${originalPrice ? `¥${originalPrice.toFixed(2)}` : '-'}</td>
                <td class="price-change ${changeClass}">${priceChange || '-'}</td>
                <td>${couponInfo}</td>
            </tr>
        `;

        prevPrice = price;
    });

    tbody.innerHTML = html;
}

// 显示错误
function showError(message) {
    document.getElementById('history-table-body').innerHTML =
        `<tr><td colspan="5" class="error">${message}</td></tr>`;
}
