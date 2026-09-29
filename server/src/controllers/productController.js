const { Product, PriceHistory } = require('../models');
const PriceAnalyzer = require('../utils/priceAnalyzer');
const SimplePriceService = require('../services/simplePriceService');
const logger = require('../utils/logger');

// 计算价格趋势（独立函数）
function calculatePriceTrend(product, stats) {
    const recordCount = parseInt(stats?.record_count) || 0;
    
    if (!stats || !stats.avg_price || recordCount === 0) {
        return { 
            trend: 'none', 
            emoji: '⏳', 
            message: '等待采集历史价格，多刷几次后可分析趋势',
            record_count: recordCount 
        };
    }

    const currentPrice = parseFloat(product.current_price);
    const avgPrice = parseFloat(stats.avg_price);
    
    if (isNaN(currentPrice) || isNaN(avgPrice)) {
        return { 
            trend: 'none', 
            emoji: '⏳', 
            message: '等待采集历史价格，多刷几次后可分析趋势',
            record_count: recordCount 
        };
    }
    
    const diff = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(1);
    const dropAmount = (avgPrice - currentPrice).toFixed(2);

    if (product.lowest_price && currentPrice <= parseFloat(product.lowest_price)) {
        return { trend: 'lowest', emoji: '🟢', message: `历史最低价！比30天均价低${Math.abs(diff)}%`, diff: parseFloat(diff), drop_amount: parseFloat(dropAmount), record_count: recordCount };
    } else if (diff <= -10) {
        return { trend: 'good', emoji: '🟢', message: `好价！比30天均价低${Math.abs(diff)}%`, diff: parseFloat(diff), drop_amount: parseFloat(dropAmount), record_count: recordCount };
    } else if (diff <= 0) {
        return { trend: 'below_avg', emoji: '🟡', message: `低于均价${Math.abs(diff)}%，可以考虑`, diff: parseFloat(diff), drop_amount: parseFloat(dropAmount), record_count: recordCount };
    } else if (diff <= 10) {
        return { trend: 'above_avg', emoji: '🟠', message: `高于均价${diff}%，建议再等等`, diff: parseFloat(diff), drop_amount: 0, record_count: recordCount };
    } else {
        return { trend: 'high', emoji: '🔴', message: `价格较高，高于均价${diff}%`, diff: parseFloat(diff), drop_amount: 0, record_count: recordCount };
    }
}

const productController = {
    // 获取所有商品
    async getAll(req, res) {
        try {
            const filters = {
                platform: req.query.platform,
                product_id: req.query.product_id,
                status: req.query.status,
                desire_level: req.query.desire_level ? parseInt(req.query.desire_level) : undefined,
                search: req.query.search,
                orderBy: req.query.orderBy,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset) : undefined
            };

            const products = await Product.findAll(filters);
            
            // 为每个商品添加价格统计信息
            const productsWithStats = await Promise.all(
                products.map(async (product) => {
                    try {
                        const stats = await PriceHistory.getPriceStats(product.id, 30);
                        const todayChanges = await PriceHistory.getTodayChanges(product.id);
                        
                        return {
                            ...product,
                            price_stats: stats || null,
                            today_changes: todayChanges ? todayChanges.length : 0,
                            price_trend: calculatePriceTrend(product, stats)
                        };
                    } catch (err) {
                        return {
                            ...product,
                            price_stats: null,
                            today_changes: 0,
                            price_trend: { trend: 'none', emoji: '⏳', message: '等待采集历史价格，多刷几次后可分析趋势', record_count: 0 }
                        };
                    }
                })
            );

            res.json({
                success: true,
                data: productsWithStats,
                total: productsWithStats.length
            });
        } catch (error) {
            logger.error('获取商品列表失败:', error);
            res.status(500).json({
                success: false,
                error: '获取商品列表失败'
            });
        }
    },

    // 获取单个商品详情
    async getById(req, res) {
        try {
            const { id } = req.params;
            const product = await Product.findById(id);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: '商品不存在'
                });
            }

            const priceStats = await PriceHistory.getPriceStats(id, 30);
            const priceHistory = await PriceHistory.getByProductId(id, 30);

            res.json({
                success: true,
                data: {
                    ...product,
                    price_stats: priceStats,
                    price_history: priceHistory,
                    price_trend: calculatePriceTrend(product, priceStats)
                }
            });
        } catch (error) {
            logger.error('获取商品详情失败:', error);
            res.status(500).json({
                success: false,
                error: '获取商品详情失败'
            });
        }
    },

    // 创建商品
    async create(req, res) {
        try {
            const {
                platform,
                product_id,
                title,
                url,
                image_url,
                current_price,
                original_price,
                initial_price,
                target_price,
                desire_level,
                note
            } = req.body;

            // 验证必填字段
            if (!platform || !product_id || !title || !url) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必填字段: platform, product_id, title, url'
                });
            }

            // 检查是否已存在
            const existing = await Product.findByPlatformAndProductId(platform, product_id);
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: '该商品已在追踪列表中'
                });
            }

            // 如果前端未提供价格，尝试获取
            let price = current_price;
            let origPrice = original_price;
            if (!price) {
                try {
                    const priceResult = await SimplePriceService.getPrice(platform, product_id);
                    if (priceResult.success) {
                        price = priceResult.price;
                        origPrice = priceResult.originalPrice || price;
                    }
                } catch (e) {
                    logger.warn('获取价格失败:', e.message);
                }
            }

            const productData = {
                platform,
                product_id,
                title,
                url,
                image_url,
                current_price: price,
                original_price: origPrice || price,
                initial_price: initial_price || price,
                target_price: target_price,
                desire_level: desire_level || 3,
                note
            };

            const product = await Product.create(productData);

            // 记录初始价格历史
            if (price) {
                await PriceHistory.record(product.id, price, origPrice || price);
            }

            logger.info(`商品创建成功: ${product.title}`);

            res.status(201).json({
                success: true,
                data: product,
                message: '商品添加成功'
            });
        } catch (error) {
            logger.error('创建商品失败:', error);
            res.status(500).json({
                success: false,
                error: '创建商品失败'
            });
        }
    },

    // 更新商品
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const existing = await Product.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: '商品不存在'
                });
            }

            const updatedProduct = await Product.update(id, updateData);

            logger.info(`商品更新成功: ${updatedProduct.title}`);

            res.json({
                success: true,
                data: updatedProduct,
                message: '商品更新成功'
            });
        } catch (error) {
            logger.error('更新商品失败:', error);
            res.status(500).json({
                success: false,
                error: '更新商品失败'
            });
        }
    },

    // 删除商品
    async delete(req, res) {
        try {
            const { id } = req.params;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: '商品不存在'
                });
            }

            await Product.delete(id);

            logger.info(`商品删除成功: ${product.title}`);

            res.json({
                success: true,
                message: '商品删除成功'
            });
        } catch (error) {
            logger.error('删除商品失败:', error);
            res.status(500).json({
                success: false,
                error: '删除商品失败'
            });
        }
    },

    // 标记为已购买
    async markAsBought(req, res) {
        try {
            const { id } = req.params;
            const { bought_price } = req.body;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: '商品不存在'
                });
            }

            const updatedProduct = await Product.markAsBought(id, bought_price || product.current_price);

            logger.info(`商品已标记为购买: ${updatedProduct.title} @ ¥${bought_price}`);

            res.json({
                success: true,
                data: updatedProduct,
                message: '已标记为购买'
            });
        } catch (error) {
            logger.error('标记购买失败:', error);
            res.status(500).json({
                success: false,
                error: '标记购买失败'
            });
        }
    },

    // 获取统计
    async getStats(req, res) {
        try {
            const stats = await Product.getStats();
            const priceDrops = await PriceHistory.getPriceDrops(5);

            res.json({
                success: true,
                data: {
                    ...stats,
                    price_drops: priceDrops
                }
            });
        } catch (error) {
            logger.error('获取统计失败:', error);
            res.status(500).json({
                success: false,
                error: '获取统计失败'
            });
        }
    },

    // 获取分析报告
    async getAnalysis(req, res) {
        try {
            const { id } = req.params;
            const { days = 30 } = req.query;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: '商品不存在'
                });
            }

            const priceStats = await PriceHistory.getPriceStats(id, parseInt(days));
            const priceHistory = await PriceHistory.getByProductId(id, parseInt(days));

            const report = PriceAnalyzer.generatePriceReport(product, priceStats, priceHistory);

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('获取商品分析失败:', error);
            res.status(500).json({
                success: false,
                error: '获取商品分析失败'
            });
        }
    }
};

module.exports = productController;