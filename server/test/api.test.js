const request = require('supertest');
const app = require('../src/app');

describe('API 测试', () => {
    // 健康检查
    test('GET /api/health 应返回成功', async () => {
        const response = await request(app)
            .get('/api/health')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('running');
    });

    // 获取商品列表
    test('GET /api/products 应返回商品列表', async () => {
        const response = await request(app)
            .get('/api/products')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    // 添加商品
    test('POST /api/products 应添加商品', async () => {
        const productData = {
            platform: 'jd',
            product_id: '100012345678',
            title: '测试商品',
            url: 'https://item.jd.com/100012345678.html',
            current_price: 99.99,
            desire_level: 4
        };

        const response = await request(app)
            .post('/api/products')
            .send(productData)
            .expect('Content-Type', /json/)
            .expect(201);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.platform).toBe('jd');
        expect(response.body.data.title).toBe('测试商品');
    });

    // 获取单个商品
    test('GET /api/products/:id 应返回商品详情', async () => {
        // 先添加一个商品
        const addResponse = await request(app)
            .post('/api/products')
            .send({
                platform: 'taobao',
                product_id: '987654321',
                title: '淘宝商品',
                url: 'https://item.taobao.com/item.htm?id=987654321'
            });
        
        const productId = addResponse.body.data.id;

        const response = await request(app)
            .get(`/api/products/${productId}`)
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(productId);
    });

    // 标记为已购买
    test('POST /api/products/:id/buy 应标记为已购买', async () => {
        // 先添加一个商品
        const addResponse = await request(app)
            .post('/api/products')
            .send({
                platform: 'pdd',
                product_id: '123456789',
                title: '拼多多商品',
                url: 'https://mobile.yangkeduo.com/goods.html?goods_id=123456789'
            });
        
        const productId = addResponse.body.data.id;

        const response = await request(app)
            .post(`/api/products/${productId}/buy`)
            .send({ bought_price: 79.99 })
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('bought');
        expect(response.body.data.bought_price).toBe(79.99);
    });

    // 获取价格历史
    test('GET /api/prices/:productId/history 应返回价格历史', async () => {
        // 先添加一个商品
        const addResponse = await request(app)
            .post('/api/products')
            .send({
                platform: 'jd',
                product_id: '100012345679',
                title: '价格历史测试商品',
                url: 'https://item.jd.com/100012345679.html',
                current_price: 199.99
            });
        
        const productId = addResponse.body.data.id;

        const response = await request(app)
            .get(`/api/prices/${productId}/history`)
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.history)).toBe(true);
    });

    // 获取价格下降商品
    test('GET /api/prices/drops 应返回价格下降商品', async () => {
        const response = await request(app)
            .get('/api/prices/drops')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    // 手动触发抓取
    test('POST /api/scrape/jd 应触发京东抓取', async () => {
        const response = await request(app)
            .post('/api/scrape/jd')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('京东');
    });

    // 获取抓取状态
    test('GET /api/scrape/status 应返回抓取状态', async () => {
        const response = await request(app)
            .get('/api/scrape/status')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('isRunning');
    });
});
