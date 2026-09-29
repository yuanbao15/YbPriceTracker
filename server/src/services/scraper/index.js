const JDScraper = require('./jdScraper');
const TaobaoScraper = require('./taobaoScraper');
const PddScraper = require('./pddScraper');

class ScraperService {
    constructor() {
        this.scrapers = {
            jd: new JDScraper(),
            taobao: new TaobaoScraper(),
            pdd: new PddScraper()
        };
    }

    // 获取对应平台的抓取器
    getScraper(platform) {
        const scraper = this.scrapers[platform];
        if (!scraper) {
            throw new Error(`不支持的平台: ${platform}`);
        }
        return scraper;
    }

    // 抓取单个商品
    async scrape(platform, productId) {
        const scraper = this.getScraper(platform);
        return await scraper.scrape(productId);
    }

    // 批量抓取
    async scrapeBatch(platform, productIds) {
        const scraper = this.getScraper(platform);
        return await scraper.scrapeBatch(productIds);
    }

    // 关闭所有抓取器
    async closeAll() {
        for (const scraper of Object.values(this.scrapers)) {
            await scraper.close();
        }
    }
}

// 单例模式
const scraperService = new ScraperService();

module.exports = scraperService;
