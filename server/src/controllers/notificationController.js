const notificationService = require('../utils/notificationService');
const logger = require('../utils/logger');

const notificationController = {
    // 获取所有通知
    async getAll(req, res) {
        try {
            const { limit = 50 } = req.query;
            const notifications = notificationService.getNotifications(parseInt(limit));
            
            res.json({
                success: true,
                data: notifications,
                unread_count: notificationService.getUnreadCount()
            });
        } catch (error) {
            logger.error('获取通知失败:', error);
            res.status(500).json({
                success: false,
                error: '获取通知失败'
            });
        }
    },

    // 获取未读通知数
    async getUnreadCount(req, res) {
        try {
            const count = notificationService.getUnreadCount();
            
            res.json({
                success: true,
                data: { count }
            });
        } catch (error) {
            logger.error('获取未读通知数失败:', error);
            res.status(500).json({
                success: false,
                error: '获取未读通知数失败'
            });
        }
    },

    // 标记为已读
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            notificationService.markAsRead(id);
            
            res.json({
                success: true,
                message: '已标记为已读'
            });
        } catch (error) {
            logger.error('标记通知已读失败:', error);
            res.status(500).json({
                success: false,
                error: '标记通知已读失败'
            });
        }
    },

    // 标记所有为已读
    async markAllAsRead(req, res) {
        try {
            notificationService.markAllAsRead();
            
            res.json({
                success: true,
                message: '已标记所有通知为已读'
            });
        } catch (error) {
            logger.error('标记所有通知已读失败:', error);
            res.status(500).json({
                success: false,
                error: '标记所有通知已读失败'
            });
        }
    },

    // 清除旧通知
    async cleanup(req, res) {
        try {
            const { days = 30 } = req.query;
            const deletedCount = notificationService.cleanup(parseInt(days));
            
            res.json({
                success: true,
                message: `清理了 ${deletedCount} 条旧通知`,
                data: { deletedCount }
            });
        } catch (error) {
            logger.error('清理通知失败:', error);
            res.status(500).json({
                success: false,
                error: '清理通知失败'
            });
        }
    }
};

module.exports = notificationController;
