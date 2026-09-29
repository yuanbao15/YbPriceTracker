const axios = require('axios');
const logger = require('../utils/logger');

class SimplePriceService {
    // 通过京东API获取价格
    static async getJDPrice(productId) {
        try {
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
            
            // 从HTML中提取价格
            const pricePatterns = [
                /\"p\":\"([\d.]+)\"/,
                /\"price\":\"([\d.]+)\"/,
                /\"op\":\"([\d.]+)\"/,
                /\"m\":\"([\d.]+)\"/,
                /\"jdPrice\":\"([\d.]+)\"/,
                /class="price"[^>]*>¥?([\d.]+)/,
                /¥\s*([\d,]+\.?\d*)/,
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

    // 获取商品价格（根据平台）
    static async getPrice(platform, productId) {
        switch (platform) {
            case 'jd':
                return await this.getJDPrice(productId);
            case 'taobao':
            case 'pdd':
                return { success: false, error: '暂不支持该平台' };
            default:
                return { success: false, error: '不支持的平台' };
        }
    }
}

module.exports = SimplePriceService;
