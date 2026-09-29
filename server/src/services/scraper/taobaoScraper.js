const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

class TaobaoScraper extends BaseScraper {
    constructor() {
        super();
        this.platform = 'taobao';
    }

    // 抓取淘宝商品价格
    async scrape(productId) {
        const startTime = Date.now();
        let page = null;

        try {
            page = await this.newPage();
            
            // 淘宝商品URL
            const url = `https://item.taobao.com/item.htm?id=${productId}`;
            
            logger.info(`开始抓取淘宝商品: ${productId}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // 等待价格元素加载
            await this.waitForSelector('.tb-rmb-num, .price-text', 10000);
            await this.randomDelay(2000, 3000);

            // 获取价格信息
            const priceInfo = await this.extractPriceInfo(page);
            
            // 获取商品标题
            const title = await this.safeGetText.call({ page }, '.tb-main-title') ||
                          await this.safeGetText.call({ page }, 'h3.tb-main-title') ||
                          await this.safeGetText.call({ page }, '[data-title]');

            // 获取优惠券信息
            const coupons = await this.extractCoupons(page);

            const result = {
                platform: this.platform,
                product_id: productId,
                title: title,
                current_price: priceInfo.currentPrice,
                original_price: priceInfo.originalPrice,
                coupons: coupons,
                promotions: [],
                scraped_at: new Date(),
                duration_ms: Date.now() - startTime
            };

            logger.info(`淘宝商品抓取成功: ${productId} - ¥${priceInfo.currentPrice}`);
            return { success: true, data: result };

        } catch (error) {
            logger.error(`淘宝商品抓取失败: ${productId}`, error);
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
                '.tb-rmb-num',
                '.price-text',
                '.tm-price',
                '.tb-rmb-num .price'
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
                '.tb-rmb-num .origin-price',
                '.tm-price .origin-price',
                '.price-original'
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
            logger.warn('提取淘宝价格信息出错:', error);
        }

        return result;
    }

    // 提取优惠券信息
    async extractCoupons(page) {
        const coupons = [];

        try {
            // 等待优惠券区域
            await this.waitForSelector('.tb-coupon, .coupon-item', 3000);

            // 获取所有优惠券
            const couponElements = await page.$$('.tb-coupon-item, .coupon-item');

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

            // 获取店铺优惠券
            const shopCoupon = await this.safeGetText.call({ page }, '.shop-coupon');
            if (shopCoupon) {
                const shopMatch = shopCoupon.match(/满(\d+)减(\d+)/);
                if (shopMatch) {
                    coupons.push({
                        type: '店铺券',
                        min_amount: parseFloat(shopMatch[1]),
                        discount_amount: parseFloat(shopMatch[2]),
                        text: shopCoupon
                    });
                }
            }

        } catch (error) {
            logger.warn('提取淘宝优惠券信息出错:', error);
        }

        return coupons;
    }
}

module.exports = TaobaoScraper;
