const { pool } = require('../config/database');

class Product {
    // 获取所有商品
    static async findAll(filters = {}) {
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (filters.platform) {
            query += ' AND platform = ?';
            params.push(filters.platform);
        }

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.desire_level) {
            query += ' AND desire_level = ?';
            params.push(filters.desire_level);
        }

        if (filters.search) {
            query += ' AND title LIKE ?';
            params.push(`%${filters.search}%`);
        }

        // 排序：默认按添加时间倒排，支持按购买意向排序
        let orderBy = 'created_at DESC';
        if (filters.orderBy === 'desire_level') {
            orderBy = 'desire_level DESC, created_at DESC';
        } else if (filters.orderBy === 'price') {
            orderBy = 'current_price ASC';
        } else if (filters.orderBy === 'updated_at') {
            orderBy = 'updated_at DESC';
        }
        query += ` ORDER BY ${orderBy}`;

        // 分页
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(filters.limit));
            
            if (filters.offset) {
                query += ' OFFSET ?';
                params.push(parseInt(filters.offset));
            }
        }

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // 根据ID获取商品
    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    // 根据平台和商品ID查找
    static async findByPlatformAndProductId(platform, productId) {
        const [rows] = await pool.execute(
            'SELECT * FROM products WHERE platform = ? AND product_id = ?',
            [platform, productId]
        );
        return rows[0] || null;
    }

    // 创建商品
    static async create(productData) {
        const {
            platform,
            product_id,
            title,
            url,
            image_url = null,
            current_price = null,
            original_price = null,
            initial_price = null,
            target_price = null,
            desire_level = 3,
            note = null
        } = productData;

        const [result] = await pool.execute(
            `INSERT INTO products 
            (platform, product_id, title, url, image_url, current_price, original_price, 
             initial_price, target_price,
             lowest_price, highest_price, desire_level, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                platform,
                product_id,
                title || '',
                url || '',
                image_url,
                current_price,
                original_price,
                initial_price != null ? initial_price : current_price,  // 添加时价格
                target_price,
                current_price, // 最低价初始为当前价
                current_price, // 最高价初始为当前价
                desire_level,
                note
            ]
        );

        return this.findById(result.insertId);
    }

    // 更新商品
    static async update(id, updateData) {
        const fields = [];
        const params = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                params.push(updateData[key]);
            }
        });

        if (fields.length === 0) return this.findById(id);

        params.push(id);
        await pool.execute(
            `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
            params
        );

        return this.findById(id);
    }

    // 更新商品价格
    static async updatePrice(id, newPrice) {
        const product = await this.findById(id);
        if (!product) return null;

        const updates = {
            current_price: newPrice
        };

        // 更新最低价
        if (!product.lowest_price || newPrice < product.lowest_price) {
            updates.lowest_price = newPrice;
        }

        // 更新最高价
        if (!product.highest_price || newPrice > product.highest_price) {
            updates.highest_price = newPrice;
        }

        return this.update(id, updates);
    }

    // 标记为已购买
    static async markAsBought(id, boughtPrice) {
        return this.update(id, {
            status: 'bought',
            bought_price: boughtPrice,
            bought_at: new Date()
        });
    }

    // 删除商品
    static async delete(id) {
        const [result] = await pool.execute(
            'DELETE FROM products WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // 获取统计信息
    static async getStats() {
        const [rows] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'watching' THEN 1 ELSE 0 END) as watching,
                SUM(CASE WHEN status = 'bought' THEN 1 ELSE 0 END) as bought,
                SUM(CASE WHEN platform = 'jd' THEN 1 ELSE 0 END) as jd_count,
                SUM(CASE WHEN platform = 'taobao' THEN 1 ELSE 0 END) as taobao_count,
                SUM(CASE WHEN platform = 'pdd' THEN 1 ELSE 0 END) as pdd_count
            FROM products
        `);
        return rows[0];
    }

    // 获取需要抓取的商品（按平台）
    static async getForScraping(platform, limit = 50) {
        const [rows] = await pool.execute(
            `SELECT * FROM products 
             WHERE platform = ? AND status = 'watching' 
             ORDER BY desire_level DESC, updated_at ASC 
             LIMIT ?`,
            [platform, limit]
        );
        return rows;
    }
}

module.exports = Product;
