-- YbPriceTracker 数据库表结构
-- 使用前请先创建数据库: CREATE DATABASE yb_price_tracker DEFAULT CHARACTER SET utf8mb4;

USE yb_price_tracker;

-- 平台枚举类型
-- jd: 京东, taobao: 淘宝, pdd: 拼多多

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform ENUM('jd', 'taobao', 'pdd') NOT NULL COMMENT '平台',
    product_id VARCHAR(100) NOT NULL COMMENT '商品ID',
    title VARCHAR(500) NOT NULL COMMENT '商品标题',
    url VARCHAR(1000) NOT NULL COMMENT '商品链接',
    image_url VARCHAR(1000) COMMENT '商品图片',
    current_price DECIMAL(10, 2) COMMENT '当前价格',
    original_price DECIMAL(10, 2) COMMENT '原价',
    lowest_price DECIMAL(10, 2) COMMENT '历史最低价',
    highest_price DECIMAL(10, 2) COMMENT '历史最高价',
    desire_level TINYINT DEFAULT 3 COMMENT '意向等级 1-5 (1=随便看看, 5=马上要买)',
    status ENUM('watching', 'bought', 'not_interested') DEFAULT 'watching' COMMENT '状态',
    bought_price DECIMAL(10, 2) COMMENT '购买价格',
    bought_at DATETIME COMMENT '购买时间',
    note TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_platform_product (platform, product_id),
    INDEX idx_status (status),
    INDEX idx_desire_level (desire_level),
    INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- 价格历史表
CREATE TABLE IF NOT EXISTS price_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL COMMENT '商品ID',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格',
    original_price DECIMAL(10, 2) COMMENT '原价',
    coupon_info JSON COMMENT '优惠券信息',
    promotion_info JSON COMMENT '促销信息',
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
    INDEX idx_product_time (product_id, recorded_at),
    INDEX idx_recorded_at (recorded_at),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格历史表';

-- 优惠券表
CREATE TABLE IF NOT EXISTS coupons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT COMMENT '关联商品ID，NULL表示通用券',
    platform ENUM('jd', 'taobao', 'pdd') NOT NULL COMMENT '平台',
    coupon_type VARCHAR(50) COMMENT '券类型',
    discount_amount DECIMAL(10, 2) COMMENT '优惠金额',
    min_amount DECIMAL(10, 2) COMMENT '满减门槛',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    url VARCHAR(1000) COMMENT '领券链接',
    is_valid TINYINT DEFAULT 1 COMMENT '是否有效',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product (product_id),
    INDEX idx_platform_valid (platform, is_valid),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券表';

-- 价格提醒规则表
CREATE TABLE IF NOT EXISTS price_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL COMMENT '商品ID',
    alert_type ENUM('price_drop', 'reaches_low', 'coupon_available') NOT NULL COMMENT '提醒类型',
    target_price DECIMAL(10, 2) COMMENT '目标价格',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    last_triggered_at DATETIME COMMENT '上次触发时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格提醒规则表';

-- 平台配置表
CREATE TABLE IF NOT EXISTS platform_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform ENUM('jd', 'taobao', 'pdd') NOT NULL COMMENT '平台',
    config_key VARCHAR(100) NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description VARCHAR(500) COMMENT '描述',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_platform_key (platform, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置表';

-- 抓取日志表
CREATE TABLE IF NOT EXISTS scrape_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    platform ENUM('jd', 'taobao', 'pdd') NOT NULL COMMENT '平台',
    product_id INT COMMENT '商品ID',
    status ENUM('success', 'failed', 'skipped') NOT NULL COMMENT '状态',
    error_message TEXT COMMENT '错误信息',
    duration_ms INT COMMENT '耗时(毫秒)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_platform_time (platform, created_at),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='抓取日志表';

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description VARCHAR(500) COMMENT '描述',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户配置表';

-- 插入默认配置
INSERT INTO user_config (config_key, config_value, description) VALUES
('jd_scrape_times', '0,6,12,18,22', '京东每天抓取时间点（小时）'),
('taobao_scrape_time', '10', '淘宝每天抓取时间点'),
('pdd_scrape_times', '9,21', '拼多多每天抓取时间点'),
('price_drop_threshold', '5', '价格下降提醒阈值（百分比）'),
('enable_notification', 'true', '是否启用通知')
ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
