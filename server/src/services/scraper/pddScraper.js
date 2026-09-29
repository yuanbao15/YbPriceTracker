const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

class PddScraper extends BaseScraper {
    constructor() {
        super();
        this.platform = 'pdd';
    }

    // 抓取拼多多商品价格
    async scrape(productId) {
        const startTime = Date.now();
        let page = null;

        try {
            page = await this.newPage();
            
            // 拼多多商品URL
            const url = `https://mobile.yangkeduo.com/goods.html?goods_id=${productId}`;
            
            logger.info(`开始抓取拼多多商品: ${productId}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // 等待价格元素加载
            await this.waitForSelector('.goods-price, .price-text', 10000);
            await this.randomDelay(2000, 4000);

            // 获取价格信息
            const priceInfo = await this.extractPriceInfo(page);
            
            // 获取商品标题
            const title = await this.safeGetText.call({ page }, '.goods-detail-name') ||
                          await this.safeGetText.call({ page }, '.goods-name') ||
                          await this.safeGetText.call({ page }, 'h1');

            // 获取优惠券信息
            const coupons = await this.extractCoupons(page);

            // 获取补贴信息
            const subsidyInfo = await this.extractSubsidyInfo(page);

            const result = {
                platform: this.platform,
                product_id: productId,
                title: title,
                current_price: priceInfo.currentPrice,
                original_price: priceInfo.originalPrice,
                coupons: coupons,
                promotions: subsidyInfo,
                scraped_at: new Date(),
                duration_ms: Date.now() - startTime
            };

            logger.info(`拼多多商品抓取成功: ${productId} - ¥${priceInfo.currentPrice}`);
            return { success: true, data: result };

        } catch (error) {
            logger.error(`拼多多商品抓取失败: ${productId}`, error);
            return { 
                success: false, 
                error: error.message,
                duration_ms: Date.now() - startTime
            };
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    // 提取价格信息
    async extractPriceInfo(page) {
        const result = {
            currentPrice: null,
            originalPrice: null
        };

        try {
            // 当前价格
            const priceSelectors = [
                '.goods-price .price-num',
                '.goods-price',
                '.price-text',
                '.goods-detail-price .price'
            ];

            for (const selector of priceSelectors) {
                const priceText = await this.safeGetText.call({ page }, selector);
                if (priceText) {
                    result.currentPrice = this.parsePrice(priceText);
                    if (result.currentPrice) break;
                }
            }

            // 原价
            const originalPriceSelectors = [
                '.goods-price .original-price',
                '.price-original',
                '.goods-detail-price .original-price'
            ];

            for (const selector of originalPriceSelectors) {
                const priceText = await this.safeGetText.call({ page }, selector);
                if (priceText) {
                    result.originalPrice = this.parsePrice(priceText);
                    if (result.originalPrice) break;
                }
            }

            // 如果没有找到原价，使用当前价
            if (!result.originalPrice && result.currentPrice) {
                result.originalPrice = result.currentPrice;
            }

        } catch (error) {
            logger.warn('提取拼多多价格信息出错:', error);
        }

        return result;
    }

    // 提取优惠券信息
    async extractCoupons(page) {
        const coupons = [];

        try {
            // 等待优惠券区域
            await this.waitForSelector('.coupon-tag, .goods-coupon', 3000);

            // 获取所有优惠券
            const couponElements = await page.$$('.coupon-item, .goods-coupon-item');

            for (const element of couponElements) {
                try {
                    const couponText = await page.evaluate(el => el.textContent.trim(), element);
                    
                    // 解析优惠券信息
                    const amountMatch = couponText.match(/满(\d+)减(\d+)/);
                    const discountMatch = couponText.match(/减(\d+)/);
                    const percentMatch = couponText.match(/(\d+)折/);

                    if (amountMatch || discountMatch || percentMatch) {
                        const coupon = {
                            type: percentMatch ? '折扣券' : '满减券',
                            min_amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
                            discount_amount: amountMatch ? 
                                parseFloat(amountMatch[2]) : 
                                discountMatch ? parseFloat(discountMatch[1]) : 0,
                            discount_percent: percentMatch ? parseFloat(percentMatch[1]) : null,
                            text: couponText
                        };

                        coupons.push(coupon);
                    }
                } catch (err) {
                    // 忽略单个优惠券解析错误
                }
            }

        } catch (error) {
            logger.warn('提取拼多多优惠券信息出错:', error);
        }

        return coupons;
    }

    // 提取百亿补贴信息
    async extractSubsidyInfo(page) {
        const promotions = [];

        try {
            // 检查是否有百亿补贴标识
            const subsidyText = await this.safeGetText.call({ page }, '.subsidy-tag, .baiyi-subsidy');
            if (subsidyText) {
                promotions.push('百亿补贴');
            }

            // 检查其他促销信息
            const promoElements = await page.$$('.goods-promotion, .promotion-tag');
            for (const element of promoElements) {
                const text = await page.evaluate(el => el.textContent.trim(), element);
                if (text && text.length < 50) {
                    promotions.push(text);
                }
            }

        } catch (error) {
            logger.warn('提取拼多多补贴信息出错:', error);
        }

        return promotions;
    }
}

module.exports = PddScraper;
