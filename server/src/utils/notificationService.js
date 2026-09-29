const logger = require('./logger');

class NotificationService {
    constructor() {
        this.notifications = [];
    }

    // 添加通知
    addNotification(type, title, message, data = {}) {
        const notification = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            type, // 'price_drop', 'coupon', 'system'
            title,
            message,
            data,
            read: false,
            created_at: new Date()
        };

        this.notifications.unshift(notification);
        
        // 只保留最近100条通知
        if (this.notifications.length > 100) {
            this.notifications = this.notifications.slice(0, 100);
        }

        logger.info(`新通知: ${title} - ${message}`);
        return notification;
    }

    // 获取所有通知
    getNotifications(limit = 50) {
        return this.notifications.slice(0, limit);
    }

    // 获取未读通知数
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    // 标记为已读
    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
        }
    }

    // 标记所有为已读
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
    }

    // 价格下降通知
    notifyPriceDrop(product, oldPrice, newPrice) {
        const dropPercent = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
        
        return this.addNotification(
            'price_drop',
            '价格下降提醒',
            `${product.title} 价格下降了 ${dropPercent}%！\n原价: ¥${oldPrice} → 现价: ¥${newPrice}`,
            {
                productId: product.id,
                platform: product.platform,
                oldPrice,
                newPrice,
                dropPercent: parseFloat(dropPercent)
            }
        );
    }

    // 达到目标价格通知
    notifyTargetPriceReached(product, targetPrice) {
        return this.addNotification(
            'target_reached',
            '目标价格达成',
            `${product.title} 已达到目标价格 ¥${targetPrice}！\n当前价格: ¥${product.current_price}`,
            {
                productId: product.id,
                platform: product.platform,
                targetPrice,
                currentPrice: product.current_price
            }
        );
    }

    // 历史最低价通知
    notifyHistoricalLow(product) {
        return this.addNotification(
            'historical_low',
            '历史最低价',
            `${product.title} 当前为历史最低价 ¥${product.current_price}！`,
            {
                productId: product.id,
                platform: product.platform,
                currentPrice: product.current_price
            }
        );
    }

    // 优惠券可用通知
    notifyCouponAvailable(product, coupon) {
        return this.addNotification(
            'coupon',
            '优惠券可用',
            `${product.title} 有新的优惠券可用！\n满 ${coupon.min_amount} 减 ${coupon.discount_amount}`,
            {
                productId: product.id,
                platform: product.platform,
                coupon
            }
        );
    }

    // 系统通知
    notifySystem(title, message) {
        return this.addNotification('system', title, message);
    }

    // 清除旧通知
    cleanup(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const beforeCount = this.notifications.length;
        this.notifications = this.notifications.filter(n => n.created_at > cutoffDate);
        const afterCount = this.notifications.length;
        
        logger.info(`清理了 ${beforeCount - afterCount} 条旧通知`);
        return beforeCount - afterCount;
    }
}

// 单例模式
const notificationService = new NotificationService();

module.exports = notificationService;
