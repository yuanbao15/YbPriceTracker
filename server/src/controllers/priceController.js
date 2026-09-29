const { PriceHistory } = require('../models');
const logger = require('../utils/logger');

const priceController = {
    // 获取商品价格历史
    async getHistory(req, res) {
        try {
            const { productId } = req.params;
            const { days = 30 } = req.query;

            const history = await PriceHistory.getByProductId(productId, parseInt(days));
            const stats = await PriceHistory.getPriceStats(productId, parseInt(days));

            res.json({
                success: true,
                data: {
                    history,
                    stats
                }
            });
        } catch (error) {
            logger.error('获取价格历史失败:', error);
            res.status(500).json({
                success: false,
                error: '获取价格历史失败'
            });
        }
    },

    // 获取价格统计
    async getStats(req, res) {
        try {
            const { productId } = req.params;
            const { days = 30 } = req.query;

            const stats = await PriceHistory.getPriceStats(productId, parseInt(days));

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('获取价格统计失败:', error);
            res.status(500).json({
                success: false,
                error: '获取价格统计失败'
            });
        }
    },

    // 获取价格下降的商品
    async getPriceDrops(req, res) {
        try {
            const { threshold = 5 } = req.query;
            const priceDrops = await PriceHistory.getPriceDrops(parseInt(threshold));

            res.json({
                success: true,
                data: priceDrops
            });
        } catch (error) {
            logger.error('获取价格下降商品失败:', error);
            res.status(500).json({
                success: false,
                error: '获取价格下降商品失败'
            });
        }
    },

    // 清理旧的价格记录
    async cleanup(req, res) {
        try {
            const { days = 90 } = req.query;
            const deletedCount = await PriceHistory.cleanup(parseInt(days));

            logger.info(`清理了 ${deletedCount} 条旧价格记录`);

            res.json({
                success: true,
                message: `清理了 ${deletedCount} 条旧价格记录`,
                data: { deletedCount }
            });
        } catch (error) {
            logger.error('清理价格记录失败:', error);
            res.status(500).json({
                success: false,
                error: '清理价格记录失败'
            });
        }
    }
};

module.exports = priceController;
