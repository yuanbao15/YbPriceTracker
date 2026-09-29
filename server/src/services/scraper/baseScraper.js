const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../../utils/logger');

puppeteer.use(StealthPlugin());

class BaseScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    // 初始化浏览器
    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080'
                ]
            });
        }
        return this.browser;
    }

    // 创建新页面
    async newPage() {
        await this.init();
        this.page = await this.browser.newPage();

        // 设置用户代理
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // 设置视口
        await this.page.setViewport({ width: 1920, height: 1080 });

        // 设置额外请求头
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });

        return this.page;
    }

    // 关闭浏览器
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    // 等待并选择器
    async waitForSelector(selector, timeout = 10000) {
        try {
            await this.page.waitForSelector(selector, { timeout });
            return true;
        } catch (error) {
            logger.warn(`等待选择器超时: ${selector}`);
            return false;
        }
    }

    // 安全获取文本
    async safeGetText(selector) {
        try {
            const element = await this.page.$(selector);
            if (element) {
                return await this.page.evaluate(el => el.textContent.trim(), element);
            }
        } catch (error) {
            logger.warn(`获取文本失败: ${selector}`);
        }
        return null;
    }

    // 安全获取属性
    async safeGetAttribute(selector, attribute) {
        try {
            const element = await this.page.$(selector);
            if (element) {
                return await this.page.evaluate(
                    (el, attr) => el.getAttribute(attr),
                    element,
                    attribute
                );
            }
        } catch (error) {
            logger.warn(`获取属性失败: ${selector}`);
        }
        return null;
    }

    // 等待随机时间（模拟人类行为）
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min) + min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 滚动页面
    async scrollPage() {
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    // 抽象方法：子类必须实现
    async scrape(productId) {
        throw new Error('scrape方法必须在子类中实现');
    }

    // 抽象方法：解析价格
    parsePrice(priceStr) {
        if (!priceStr) return null;
        const match = priceStr.match(/[\d,]+\.?\d*/);
        if (match) {
            return parseFloat(match[0].replace(/,/g, ''));
        }
        return null;
    }
}

module.exports = BaseScraper;
