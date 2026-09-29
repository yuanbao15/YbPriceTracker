const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

class JDScraper extends BaseScraper {
    constructor() {
        super();
        this.platform = 'jd';
    }

    // 抓取京东商品价格
    async scrape(productId) {
        const startTime = Date.now();
        let page = null;

        try {
            page = await this.newPage();
            const url = `https://item.jd.com/${productId}.html`;
            
            logger.info(`开始抓取京东商品: ${productId}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // 等待价格元素加载
            await this.waitForSelector('.p-price .price', 5000);
            await this.randomDelay(1000, 2000);

            // 获取价格信息
            const priceInfo = await this.extractPriceInfo(page);
            
            // 获取商品标题
            const title = await this.safeGetText.call({ page }, '.sku-name') || 
                          await this.safeGetText.call({ page }, '.itemInfo-wrap .sku-name');

            // 获取优惠券信息
            const coupons = await this.extractCoupons(page);

            // 获取促销信息
            const promotions = await this.extractPromotions(page);

            const result = {
                platform: this.platform,
                product_id: productId,
                title: title,
                current_price: priceInfo.currentPrice,
                original_price: priceInfo.originalPrice,
                coupons: coupons,
                promotions: promotions,
                scraped_at: new Date(),
                duration_ms: Date.now() - startTime
            };

            logger.info(`京东商品抓取成功: ${productId} - ¥${priceInfo.currentPrice}`);
            return { success: true, data: result };

        } catch (error) {
            logger.error(`京东商品抓取失败: ${productId}`, error);
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
                '.p-price .price',
                '.p-price .price-text',
                '.summary-price .price',
                '.J-p-price'
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
                '.p-price .del-price',
                '.p-price .origin-price',
                '.summary-price .del-price'
            ];

            for (const selector of originalPriceSelectors) {
                const priceText = await this.safeGetText.call({ page }, selector);
                if (priceText) {
                    result.originalPrice = this.parsePrice(priceText);
                    if (result.originalPrice) break;
                }
            }

            // 如果没有找到原价，使用当前价作为原价
            if (!result.originalPrice && result.currentPrice) {
                result.originalPrice = result.currentPrice;
            }

        } catch (error) {
            logger.warn('提取价格信息出错:', error);
        }

        return result;
    }

    // 提取优惠券信息
    async extractCoupons(page) {
        const coupons = [];

        try {
            // 等待优惠券区域加载
            await this.waitForSelector('.J-coupon-wrap, .coupon-wrap', 3000);

            // 获取所有优惠券
            const couponElements = await page.$$('.J-coupon-item, .coupon-item');

            for (const element of couponElements) {
                try {
                    const couponText = await page.evaluate(el => el.textContent.trim(), element);
                    
                    // 解析优惠券信息
                    const amountMatch = couponText.match(/满(\d+)减(\d+)/);
                    const discountMatch = couponText.match(/减(\d+)/);

                    if (amountMatch || discountMatch) {
                        const coupon = {
                            type: '满减券',
                            min_amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
                            discount_amount: amountMatch ? 
                                parseFloat(amountMatch[2]) : 
                                parseFloat(discountMatch[1]),
                            text: couponText
                        };

                        // 尝试获取领券链接
                        const linkElement = await element.$('a');
                        if (linkElement) {
                            coupon.url = await page.evaluate(el => el.href, linkElement);
                        }

                        coupons.push(coupon);
                    }
                } catch (err) {
                    // 忽略单个优惠券解析错误
                }
            }

            // 获取Plus会员券
            const plusCoupon = await this.safeGetText.call({ page }, '.J-plus-coupon');
            if (plusCoupon) {
                const plusMatch = plusCoupon.match(/满(\d+)减(\d+)/);
                if (plusMatch) {
                    coupons.push({
                        type: 'Plus会员券',
                        min_amount: parseFloat(plusMatch[1]),
                        discount_amount: parseFloat(plusMatch[2]),
                        text: plusCoupon
                    });
                }
            }

        } catch (error) {
            logger.warn('提取优惠券信息出错:', error);
        }

        return coupons;
    }

    // 提取促销信息
    async extractPromotions(page) {
        const promotions = [];

        try {
            const promoSelectors = [
                '.J-promo-list .promo-item',
                '.promotion-list .promo-item',
                '.J-promo-tag'
            ];

            for (const selector of promoSelectors) {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    const text = await page.evaluate(el => el.textContent.trim(), element);
                    if (text && text.length < 100) {
                        promotions.push(text);
                    }
                }
            }

        } catch (error) {
            logger.warn('提取促销信息出错:', error);
        }

        return promotions;
    }

    // 批量抓取商品
    async scrapeBatch(productIds) {
        const results = [];
        
        for (const productId of productIds) {
            const result = await this.scrape(productId);
            results.push(result);
            
            // 随机延迟，避免被封
            await this.randomDelay(2000, 5000);
        }

        return results;
    }
}

module.exports = JDScraper;
