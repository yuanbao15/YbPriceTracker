# YbPriceTracker 快速开始指南

## 🚀 5分钟快速启动

### 1. 初始化数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE yb_price_tracker DEFAULT CHARACTER SET utf8mb4;

# 退出
exit;

# 导入表结构
mysql -u root -p yb_price_tracker < D:\Code\YB-2026\YbPriceTracker\database\schema.sql
```

### 2. 配置并启动后端

```bash
# 进入后端目录
cd D:\Code\YB-2026\YbPriceTracker\server

# 复制配置文件（如果还没有）
# 编辑 .env 文件，修改数据库密码
notepad .env

# 安装依赖
npm install

# 启动服务
npm run dev
```

看到以下输出表示成功：
```
✅ 数据库连接成功
🚀 YbPriceTracker 服务已启动
📍 地址: http://localhost:3777
```

### 3. 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启 **"开发者模式"**（右上角开关）
3. 点击 **"加载已解压的扩展程序"**
4. 选择文件夹：`D:\Code\YB-2026\YbPriceTracker\extension`
5. 扩展安装完成！

## 🎯 使用方法

### 添加商品

**方法一：浏览器按钮**
1. 访问京东/淘宝/拼多多商品页面
2. 点击页面右下角的 **"📊 添加到追踪"** 按钮
3. 商品自动添加到追踪列表

**方法二：扩展弹窗**
1. 点击浏览器右上角的扩展图标
2. 点击 **"+ 添加当前页面商品"**

### 查看商品

1. 点击浏览器右上角的扩展图标
2. 查看所有追踪的商品
3. 点击 **"历史价格"** 查看价格走势图
4. 点击 **"已购买"** 标记购买状态

### 价格提醒

- 当商品价格下降超过 5% 时，会收到通知
- 可在扩展设置中调整提醒阈值

## 📊 功能说明

| 功能 | 说明 |
|------|------|
| 价格追踪 | 每天自动抓取商品价格 |
| 历史价格 | 查看 30 天价格走势图 |
| 价格分析 | 判断当前是否好价 |
| 跨平台比价 | 京东/淘宝/拼多多对比 |
| 优惠券追踪 | 监控可用优惠券 |
| 购买记录 | 记录已购商品价格 |

## 🔧 常见问题

### Q: 扩展无法连接后端？

**A:** 检查以下几点：
1. 后端服务是否正在运行（http://localhost:3777）
2. 浏览器控制台是否有错误（按 F12）
3. 防火墙是否阻止了连接

### Q: 如何修改抓取时间？

**A:** 编辑 `server/.env` 文件：
```env
# 京东：每天 0点、6点、12点、18点、22点
JD_CRON=0 0,6,12,18,22 * * *

# 淘宝：每天 10点
TAOBAO_CRON=0 10 * * *

# 拼多多：每天 9点、21点
PDD_CRON=0 9,21 * * *
```

### Q: 如何查看日志？

**A:** 查看 `server/logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志

### Q: 如何手动触发抓取？

**A:** 使用 API：
```bash
# 京东
curl -X POST http://localhost:3777/api/scrape/jd

# 淘宝
curl -X POST http://localhost:3777/api/scrape/taobao

# 拼多多
curl -X POST http://localhost:3777/api/scrape/pdd
```

## 📝 测试 API

使用浏览器访问：

- 健康检查：http://localhost:3777/api/health
- 商品列表：http://localhost:3777/api/products
- 统计信息：http://localhost:3777/api/products/stats

## 🎨 扩展设置

1. 右键点击扩展图标
2. 选择 **"选项"**
3. 配置：
   - API 地址
   - 定时任务时间
   - 价格提醒阈值
   - 显示设置

## 📱 支持的平台

| 平台 | 状态 | 说明 |
|------|------|------|
| 京东 | ✅ 完全支持 | 价格、优惠券、促销 |
| 淘宝 | ✅ 基础支持 | 价格追踪 |
| 拼多多 | ✅ 基础支持 | 百亿补贴商品 |

## 🔄 更新和维护

### 更新后端
```bash
cd D:\Code\YB-2026\YbPriceTracker\server
git pull
npm install
npm run dev
```

### 更新扩展
1. 访问 `chrome://extensions/`
2. 点击扩展的刷新按钮 🔄

### 清理旧数据
```bash
# 通过 API 清理 90 天前的数据
curl -X POST "http://localhost:3777/api/prices/cleanup?days=90"
```

## 💡 提示

1. **京东商品**价格波动大，建议每天多时段抓取
2. **淘宝商品**价格相对稳定，每天抓取一次即可
3. **拼多多百亿补贴**商品经常变动，建议重点关注
4. 使用 **意向等级**（1-5星）管理商品优先级
5. 定期查看 **价格下降** 提醒，抓住好价时机

## 🆘 获取帮助

1. 查看日志文件：`server/logs/`
2. 检查浏览器控制台：按 F12
3. 查看扩展错误：`chrome://extensions/`
4. 阅读完整文档：`README.md`

---

**祝你购物愉快，省钱又省心！** 🛒💰
