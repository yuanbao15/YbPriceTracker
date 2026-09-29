const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const routes = require('./routes');
const { testConnection } = require('./config/database');
const scrapeJob = require('./services/scheduler/scrapeJob');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3777;

// 中间件
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: function(origin, callback) {
        // 允许所有来源（开发阶段）
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
app.options('*', cors()); // 预检请求
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加CORS头（双重保障）
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 限流
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10000 // 本地开发，放宽限流（原 100，容易触发）
});
app.use('/api/', limiter);

// 静态文件（可选）
app.use(express.static(path.join(__dirname, '../public')));

// API路由
app.use('/api', routes);

// 根路由
app.get('/', (req, res) => {
    res.json({
        name: 'YbPriceTracker API',
        version: '1.0.0',
        description: '电商价格追踪助手后端服务',
        port: PORT,
        endpoints: {
            health: `GET http://localhost:${PORT}/api/health`,
            products: `GET http://localhost:${PORT}/api/products`,
            product: `GET http://localhost:${PORT}/api/products/:id`,
            createProduct: `POST http://localhost:${PORT}/api/products`,
            updateProduct: `PUT http://localhost:${PORT}/api/products/:id`,
            deleteProduct: `DELETE http://localhost:${PORT}/api/products/:id`,
            priceHistory: `GET http://localhost:${PORT}/api/prices/:productId/history`,
            priceStats: `GET http://localhost:${PORT}/api/prices/:productId/stats`,
            priceDrops: `GET http://localhost:${PORT}/api/prices/drops`
        }
    });
});

// 手动触发抓取的接口
app.post('/api/scrape/:platform', async (req, res) => {
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
});

// 获取抓取任务状态
app.get('/api/scrape/status', (req, res) => {
    res.json({
        success: true,
        data: scrapeJob.getStatus()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    logger.error('未捕获的错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 启动服务
async function startServer() {
    try {
        // 测试数据库连接
        const dbConnected = await testConnection();
        if (!dbConnected) {
            logger.error('数据库连接失败，请检查配置');
            process.exit(1);
        }

        // 启动定时任务
        scrapeJob.start();

        // 启动服务器
        app.listen(PORT, () => {
            logger.info(`🚀 YbPriceTracker 服务已启动`);
            logger.info(`📍 地址: http://localhost:${PORT}`);
            logger.info(`📊 API文档: http://localhost:${PORT}/api/health`);
        });

    } catch (error) {
        logger.error('服务启动失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGTERM', async () => {
    logger.info('收到 SIGTERM 信号，正在关闭...');
    scrapeJob.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('收到 SIGINT 信号，正在关闭...');
    scrapeJob.stop();
    process.exit(0);
});

startServer();

module.exports = app;
