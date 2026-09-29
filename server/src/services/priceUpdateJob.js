const axios = require('axios');
const logger = require('../utils/logger');
const { Product, PriceHistory } = require('../models');

class PriceUpdateJob {
    // 更新所有监控中的商品价格
    static async updateAllPrices() {
        try {
            const products = await Product.findAll({ status: 'watching' });
            logger.info(`开始更新 ${products.length} 个商品的价格`);

            let successCount = 0;
            let failCount = 0;

            for (const product of products) {
                try {
                    let priceResult = null;

                    if (product.platform === 'jd') {
                        priceResult = await this.getJDPrice(product.product_id);
                    }

                    if (priceResult && priceResult.success) {
                        // 更新商品价格
                        await Product.updatePrice(product.id, priceResult.price);
                        
                        // 记录价格历史
                        await PriceHistory.record(
                            product.id,
                            priceResult.price,
                            priceResult.originalPrice || priceResult.price
                        );

                        successCount++;
                        logger.info(`✅ ${product.title} - ¥${priceResult.price}`);
                    } else {
                        failCount++;
                        logger.warn(`❌ ${product.title} - 获取价格失败: ${priceResult?.error || '未知'}`);
                    }

                    // 延迟避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    failCount++;
                    logger.error(`更新商品价格失败: ${product.title}`, err);
                }
            }

            logger.info(`价格更新完成: 成功 ${successCount}, 失败 ${failCount}`);
            return { success: true, successCount, failCount };
        } catch (error) {
            logger.error('批量更新价格失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 获取京东价格
    static async getJDPrice(productId) {
        try {
            // 使用京东商品详情页获取价格
            const url = `https://item.jd.com/${productId}.html`;
            logger.info(`获取京东价格: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9'
                },
                timeout: 20000
            });

            const html = response.data;
            logger.info('京东页面长度:', html.length);
            
            // 从HTML中提取价格 - 京东页面中的价格通常在JS变量中
            const pricePatterns = [
                /\"p\":\"([\d.]+)\"/,           // "p":"1999.00"
                /\"price\":\"([\d.]+)\"/,       // "price":"1999.00"
                /\"op\":\"([\d.]+)\"/,           // "op":"1999.00"
                /\"m\":\"([\d.]+)\"/,           // "m":"1999.00"
                /\"jdPrice\":\"([\d.]+)\"/,     // "jdPrice":"1999.00"
                /class="price"[^>]*>¥?([\d.]+)/, // class="price">¥1999.00
                /¥\s*([\d,]+\.?\d*)/,           // ¥1999.00
            ];
            
            let price = null;
            let originalPrice = null;
            
            for (const pattern of pricePatterns) {
                const match = html.match(pattern);
                if (match) {
                    const parsedPrice = parseFloat(match[1].replace(/,/g, ''));
                    logger.info(`匹配到价格: ${match[1]} -> ${parsedPrice}`);
                    if (!isNaN(parsedPrice) && parsedPrice > 100) {
                        if (!price) {
                            price = parsedPrice;
                        } else if (!originalPrice) {
                            originalPrice = parsedPrice;
                        }
                        if (price && originalPrice) break;
                    }
                }
            }
            
            if (price) {
                return {
                    success: true,
                    price: price,
                    originalPrice: originalPrice || price
                };
            }
            
            return { success: false, error: '未从页面提取到价格' };
        } catch (error) {
            logger.error('获取京东价格失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 更新单个商品价格
    static async updateProductPrice(productId) {
        try {
            const product = await Product.findById(productId);
            if (!product) {
                return { success: false, error: '商品不存在' };
            }

            let priceResult = null;
            if (product.platform === 'jd') {
                priceResult = await this.getJDPrice(product.product_id);
            }

            if (priceResult && priceResult.success) {
                await Product.updatePrice(product.id, priceResult.price);
                await PriceHistory.record(
                    product.id,
                    priceResult.price,
                    priceResult.originalPrice || priceResult.price
                );

                return {
                    success: true,
                    price: priceResult.price,
                    originalPrice: priceResult.originalPrice
                };
            }

            return { success: false, error: '获取价格失败' };
        } catch (error) {
            logger.error('更新单个商品价格失败:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = PriceUpdateJob;
