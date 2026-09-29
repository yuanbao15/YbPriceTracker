const scrapeJob = require('../services/scheduler/scrapeJob');
const logger = require('../utils/logger');

const scrapeController = {
    // 手动触发抓取
    async triggerScrape(req, res) {
        try {
            const { platform } = req.params;
            
            if (!['jd', 'taobao', 'pdd'].includes(platform)) {
                return res.status(400).json({
                    success: false,
                    error: '不支持的平台，可选: jd, taobao, pdd'
                });
            }

            const result = await scrapeJob.triggerScrape(platform);
            
            res.json({
                success: true,
                data: result,
                message: `${platform} 抓取任务已触发`
            });
        } catch (error) {
            logger.error('手动触发抓取失败:', error);
            res.status(500).json({
                success: false,
                error: '触发抓取失败'
            });
        }
    },

    // 获取抓取任务状态
    async getStatus(req, res) {
        try {
            const status = scrapeJob.getStatus();
            
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            logger.error('获取抓取状态失败:', error);
            res.status(500).json({
                success: false,
                error: '获取状态失败'
            });
        }
    },

    // 启动/停止抓取任务
    async toggleScrape(req, res) {
        try {
            const { platform, action } = req.params;
            
            if (!['jd', 'taobao', 'pdd'].includes(platform)) {
                return res.status(400).json({
                    success: false,
                    error: '不支持的平台'
                });
            }

            if (action === 'start') {
                scrapeJob.start();
                res.json({
                    success: true,
                    message: `${platform} 抓取任务已启动`
                });
            } else if (action === 'stop') {
                scrapeJob.stop();
                res.json({
                    success: true,
                    message: `${platform} 抓取任务已停止`
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: '无效的操作，可选: start, stop'
                });
            }
        } catch (error) {
            logger.error('切换抓取任务失败:', error);
            res.status(500).json({
                success: false,
                error: '操作失败'
            });
        }
    }
};

module.exports = scrapeController;
