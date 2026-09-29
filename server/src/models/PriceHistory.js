const { pool } = require('../config/database');

class PriceHistory {
    // 记录价格历史
    // recordedAt 可选：指定记录时间（用于回传第三方历史数据），格式 'YYYY-MM-DD HH:MM:SS'
    static async record(productId, price, originalPrice = null, couponInfo = null, promotionInfo = null, recordedAt = null) {
        const [result] = await pool.execute(
            `INSERT INTO price_history
            (product_id, price, original_price, coupon_info, promotion_info, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                productId,
                price,
                originalPrice,
                couponInfo ? JSON.stringify(couponInfo) : null,
                promotionInfo ? JSON.stringify(promotionInfo) : null,
                recordedAt || new Date()
            ]
        );
        return result.insertId;
    }

    // 获取商品的价格历史
    static async getByProductId(productId, days = 30) {
        const [rows] = await pool.execute(
            `SELECT * FROM price_history 
             WHERE product_id = ? 
             AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             ORDER BY recorded_at ASC`,
            [productId, days]
        );
        return rows;
    }

    // 获取商品价格统计
    static async getPriceStats(productId, days = 30) {
        const [rows] = await pool.execute(
            `SELECT 
                MIN(price) as min_price,
                MAX(price) as max_price,
                AVG(price) as avg_price,
                COUNT(*) as record_count,
                MIN(recorded_at) as first_record,
                MAX(recorded_at) as last_record
             FROM price_history 
             WHERE product_id = ? 
             AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [productId, days]
        );
        return rows[0];
    }

    // 获取最近N条价格记录
    static async getRecent(productId, limit = 10) {
        const [rows] = await pool.execute(
            `SELECT * FROM price_history 
             WHERE product_id = ? 
             ORDER BY recorded_at DESC 
             LIMIT ?`,
            [productId, limit]
        );
        return rows;
    }

    // 获取今日价格变动
    static async getTodayChanges(productId) {
        const [rows] = await pool.execute(
            `SELECT * FROM price_history 
             WHERE product_id = ? 
             AND DATE(recorded_at) = CURDATE()
             ORDER BY recorded_at ASC`,
            [productId]
        );
        return rows;
    }

    // 获取价格下降的商品（用于提醒）
    static async getPriceDrops(threshold = 5) {
        const [rows] = await pool.execute(`
            SELECT 
                p.id,
                p.title,
                p.platform,
                p.product_id,
                p.current_price,
                p.lowest_price,
                ph_avg.avg_price,
                ((ph_avg.avg_price - p.current_price) / ph_avg.avg_price * 100) as drop_percentage
            FROM products p
            JOIN (
                SELECT product_id, AVG(price) as avg_price
                FROM price_history
                WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY product_id
            ) ph_avg ON p.id = ph_avg.product_id
            WHERE p.status = 'watching'
            AND p.current_price < ph_avg.avg_price * (1 - ? / 100)
            ORDER BY drop_percentage DESC
        `, [threshold]);
        return rows;
    }

    // 清理旧的价格记录（保留最近N天）
    static async cleanup(days = 90) {
        const [result] = await pool.execute(
            'DELETE FROM price_history WHERE recorded_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        return result.affectedRows;
    }
}

module.exports = PriceHistory;
