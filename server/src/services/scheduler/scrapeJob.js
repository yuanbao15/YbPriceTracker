const cron = require('node-cron');
const { Product, PriceHistory } = require('../../models');
const scraperService = require('../scraper');
const logger = require('../../utils/logger');

class ScrapeJob {
    constructor() {
        this.jobs = {};
        this.isRunning = false;
    }

    // 启动所有定时任务
    start() {
        // 京东：每天 0点、6点、12点、18点、22点
        this.jobs.jd = cron.schedule(process.env.JD_CRON || '0 0,6,12,18,22 * * *', () => {
            this.scrapePlatform('jd');
        }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
        });

        // 淘宝：每天 10点
        this.jobs.taobao = cron.schedule(process.env.TAOBAO_CRON || '0 10 * * *', () => {
            this.scrapePlatform('taobao');
        }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
        });

        // 拼多多：每天 9点、21点
        this.jobs.pdd = cron.schedule(process.env.PDD_CRON || '0 9,21 * * *', () => {
            this.scrapePlatform('pdd');
        }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
        });

        logger.info('✅ 定时任务已启动');
        logger.info('  - 京东: ' + (process.env.JD_CRON || '0 0,6,12,18,22 * * *'));
        logger.info('  - 淘宝: ' + (process.env.TAOBAO_CRON || '0 10 * * *'));
        logger.info('  - 拼多多: ' + (process.env.PDD_CRON || '0 9,21 * * *'));
    }

    // 停止所有定时任务
    stop() {
        Object.values(this.jobs).forEach(job => job.stop());
        logger.info('定时任务已停止');
    }

    // 手动触发抓取
    async triggerScrape(platform) {
        logger.info(`手动触发抓取: ${platform}`);
        return await this.scrapePlatform(platform);
    }

    // 抓取指定平台的商品
    async scrapePlatform(platform) {
        if (this.isRunning) {
            logger.warn('上一次抓取任务仍在运行，跳过本次');
            return { success: false, message: '上一次抓取任务仍在运行' };
        }

        this.isRunning = true;
        const startTime = Date.now();
        const results = {
            platform,
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        try {
            // 获取该平台需要抓取的商品
            const products = await Product.getForScraping(platform, 50);
            results.total = products.length;

            if (products.length === 0) {
                logger.info(`没有需要抓取的${platform}商品`);
                return { success: true, data: results };
            }

            logger.info(`开始抓取 ${platform} 平台，共 ${products.length} 个商品`);

            // 逐个抓取
            for (const product of products) {
                try {
                    const scrapeResult = await scraperService.scrape(platform, product.product_id);

                    if (scrapeResult.success) {
                        // 更新商品价格
                        await Product.updatePrice(product.id, scrapeResult.data.current_price);

                        // 记录价格历史
                        await PriceHistory.record(
                            product.id,
                            scrapeResult.data.current_price,
                            scrapeResult.data.original_price,
                            scrapeResult.data.coupons,
                            scrapeResult.data.promotions
                        );

                        results.success++;
                        logger.info(`✅ ${product.title} - ¥${scrapeResult.data.current_price}`);
                    } else {
                        results.failed++;
                        results.errors.push({
                            product_id: product.id,
                            title: product.title,
                            error: scrapeResult.error
                        });
                        logger.error(`❌ ${product.title}: ${scrapeResult.error}`);
                    }

                    // 随机延迟，避免被封
                    await this.randomDelay(3000, 8000);

                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        product_id: product.id,
                        title: product.title,
                        error: error.message
                    });
                    logger.error(`抓取商品失败: ${product.title}`, error);
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`🎉 ${platform} 抓取完成: 成功 ${results.success}/${results.total}，耗时 ${(duration / 1000).toFixed(1)}秒`);

            // 记录抓取日志
            await this.logScrape(platform, results, duration);

            return { success: true, data: results };

        } catch (error) {
            logger.error(`${platform} 抓取任务异常:`, error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    // 记录抓取日志
    async logScrape(platform, results, duration) {
        // 这里可以添加日志记录到数据库
        logger.info(`[抓取日志] ${platform}: ${JSON.stringify(results)}`);
    }

    // 随机延迟
    async randomDelay(min, max) {
        const delay = Math.floor(Math.random() * (max - min) + min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 获取任务状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            jobs: Object.keys(this.jobs).map(key => ({
                platform: key,
                running: true // cron任务默认运行中
            }))
        };
    }
}

// 单例模式
const scrapeJob = new ScrapeJob();

module.exports = scrapeJob;
