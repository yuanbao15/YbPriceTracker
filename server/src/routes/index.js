const express = require('express');
const router = express.Router();
const { productController, priceController, scrapeController, notificationController } = require('../controllers');
const PriceUpdateJob = require('../services/priceUpdateJob');
const { Product, PriceHistory } = require('../models');
const logger = require('../utils/logger');

// 商品相关路由
router.get('/products', productController.getAll);
router.get('/products/stats', productController.getStats);
router.get('/products/:id', productController.getById);
router.get('/products/:id/analysis', productController.getAnalysis);
router.post('/products', productController.create);
router.put('/products/:id', productController.update);
router.delete('/products/:id', productController.delete);
router.post('/products/:id/buy', productController.markAsBought);

// 价格相关路由
router.get('/prices/:productId/history', priceController.getHistory);
router.get('/prices/:productId/stats', priceController.getStats);
router.get('/prices/drops', priceController.getPriceDrops);
router.post('/prices/cleanup', priceController.cleanup);

// 价格更新路由
router.post('/prices/update-all', async (req, res) => {
    try {
        const result = await PriceUpdateJob.updateAllPrices();
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/prices/update/:productId', async (req, res) => {
    try {
        const result = await PriceUpdateJob.updateProductPrice(req.params.productId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 扩展程序上报价格（由 content script / background 抓取到的实时价格，或慢慢买历史回传）
// POST /prices/record  body: { product_id, platform, price, original_price?, recorded_at? }
// 通过 platform + product_id 定位商品，更新价格并记录历史
router.post('/prices/record', async (req, res) => {
    try {
        const { platform, product_id, price, original_price, recorded_at } = req.body || {};
        if (!platform || !product_id || price == null) {
            return res.status(400).json({ success: false, error: '缺少参数: platform, product_id, price' });
        }
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice <= 0) {
            return res.status(400).json({ success: false, error: 'price 非法' });
        }

        const product = await Product.findByPlatformAndProductId(platform, String(product_id));
        if (!product) {
            return res.status(404).json({ success: false, error: '商品未在追踪列表中' });
        }

        // 历史回传：如有 recorded_at，仅记录历史，不覆盖 current_price（历史点不应影响当前价）
        if (recorded_at) {
            await PriceHistory.record(
                product.id,
                numPrice,
                original_price != null ? parseFloat(original_price) : numPrice,
                null, null,
                recorded_at
            );
            logger.info(`历史回传: ${product.title} ¥${numPrice} @ ${recorded_at}`);
        } else {
            // 实时上报：更新当前价 + 记录历史
            await Product.updatePrice(product.id, numPrice);
            await PriceHistory.record(
                product.id,
                numPrice,
                original_price != null ? parseFloat(original_price) : numPrice
            );
            logger.info(`扩展上报价格: ${product.title} - ¥${numPrice}`);

            // 降价检测：当前价 ≤ 预期价 或 ≤ 添加价 × 85%
            const initialPrice = parseFloat(product.initial_price) || parseFloat(product.current_price) || 0;
            const targetPrice = parseFloat(product.target_price) || 0;
            const thresholdPrice = targetPrice > 0 ? targetPrice : initialPrice * 0.85;
            
            if (thresholdPrice > 0 && numPrice <= thresholdPrice) {
                logger.info(`🔔 降价提醒: ${product.title} ¥${numPrice} ≤ 目标价 ¥${thresholdPrice.toFixed(2)}`);
                // 返回降价标记给前端
                res.json({
                    success: true,
                    data: { id: product.id, price: numPrice, price_drop: true, threshold: thresholdPrice }
                });
                return;
            }
        }
        res.json({ success: true, data: { id: product.id, price: numPrice, price_drop: false } });
    } catch (error) {
        logger.error('扩展上报价格失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 抓取任务相关路由
router.post('/scrape/:platform', scrapeController.triggerScrape);
router.get('/scrape/status', scrapeController.getStatus);
router.post('/scrape/:platform/:action', scrapeController.toggleScrape);

// 通知相关路由
router.get('/notifications', notificationController.getAll);
router.get('/notifications/unread-count', notificationController.getUnreadCount);
router.put('/notifications/:id/read', notificationController.markAsRead);
router.put('/notifications/read-all', notificationController.markAllAsRead);
router.post('/notifications/cleanup', notificationController.cleanup);

// 健康检查
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'YbPriceTracker API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
