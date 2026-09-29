# YbPriceTracker 项目总结

## 📋 项目概述

**YbPriceTracker** 是一个电商价格追踪助手，帮助用户智能追踪京东、淘宝、拼多多商品价格，以最优价格购买心仪商品。

## 🎯 核心功能

### 1. 商品管理
- ✅ 添加商品并按意向等级（1-5星）分类管理
- ✅ 支持京东、淘宝、拼多多三大平台
- ✅ 商品状态管理（监控中、已购买、不感兴趣）

### 2. 价格追踪
- ✅ 每日自动抓取商品价格
- ✅ 京东：每天 0点、6点、12点、18点、22点
- ✅ 淘宝：每天 10点
- ✅ 拼多多：每天 9点、21点

### 3. 历史价格分析
- ✅ 30天价格走势图表
- ✅ 历史最低价、最高价、平均价
- ✅ 价格趋势分析（好价/高价/历史最低）

### 4. 智能判断
- ✅ 价格分析引擎
- ✅ 购买时机评分（0-100分）
- ✅ 个性化购买建议
- ✅ 最优购买价格计算

### 5. 通知提醒
- ✅ 价格下降提醒
- ✅ 历史最低价提醒
- ✅ 优惠券可用提醒
- ✅ 目标价格达成提醒

### 6. 购买记录
- ✅ 记录已购商品价格
- ✅ 价格变化回顾

## 🏗️ 技术架构

```
┌─────────────────────────────────────┐
│  Chrome扩展（浏览器端）              │
│  - 商品页面价格采集                  │
│  - 注入价格信息UI                   │
│  - 快捷添加商品                     │
│  - 价格历史图表                     │
└─────────────┬───────────────────────┘
              │ HTTP API
              ▼
┌─────────────────────────────────────┐
│  Node.js后端服务（本地运行）        │
│  - RESTful API                      │
│  - 定时任务调度（node-cron）        │
│  - 价格分析引擎                     │
│  - 通知服务                         │
│  - Puppeteer 网页抓取               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  MySQL数据库                        │
│  - 商品信息表                        │
│  - 价格历史表                        │
│  - 优惠券表                         │
│  - 用户配置表                        │
└─────────────────────────────────────┘
```

## 📁 项目结构

```
YbPriceTracker/
├── server/                     # Node.js 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   │   └── database.js   # 数据库连接
│   │   ├── controllers/       # 控制器
│   │   │   ├── productController.js
│   │   │   ├── priceController.js
│   │   │   ├── scrapeController.js
│   │   │   └── notificationController.js
│   │   ├── models/            # 数据模型
│   │   │   ├── Product.js
│   │   │   └── PriceHistory.js
│   │   ├── routes/            # 路由定义
│   │   │   └── index.js
│   │   ├── services/          # 业务逻辑
│   │   │   ├── scraper/      # 网页抓取器
│   │   │   │   ├── baseScraper.js
│   │   │   │   ├── jdScraper.js
│   │   │   │   ├── taobaoScraper.js
│   │   │   │   └── pddScraper.js
│   │   │   └── scheduler/    # 定时任务
│   │   │       └── scrapeJob.js
│   │   ├── utils/             # 工具函数
│   │   │   ├── logger.js
│   │   │   ├── priceAnalyzer.js
│   │   │   └── notificationService.js
│   │   └── app.js             # 应用入口
│   ├── test/                  # 测试文件
│   ├── .env                   # 环境变量
│   └── package.json
│
├── extension/                  # Chrome 扩展
│   ├── background/            # 后台脚本
│   │   └── background.js
│   ├── content/               # 内容脚本
│   │   ├── content.js
│   │   ├── content.css
│   │   └── manmanbuy.js       # 慢慢买历史价格回传
│   ├── popup/                 # 弹出窗口
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── test-popup.html
│   ├── options/               # 设置页面
│   │   ├── options.html
│   │   └── options.js
│   ├── icons/                 # 图标资源
│   ├── charts.html            # 价格历史图表
│   └── manifest.json          # 扩展配置
│
├── database/                   # 数据库脚本
│   └── schema.sql
│
├── API.md                     # API 文档
├── INSTALL.md                 # 安装指南
├── QUICKSTART.md              # 快速开始
├── PROJECT_SUMMARY.md         # 项目总结
├── README.md                  # 项目说明
├── LICENSE                    # MIT 许可证
└── .gitignore
```

## 🛠️ 技术栈

### 后端
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: MySQL (mysql2)
- **定时任务**: node-cron
- **网页抓取**: Puppeteer + puppeteer-extra-plugin-stealth
- **日志**: Winston
- **安全**: Helmet, CORS, express-rate-limit

### 前端（Chrome 扩展）
- **Manifest**: V3
- **UI**: HTML/CSS/JavaScript
- **图表**: Chart.js
- **存储**: Chrome Storage API

## 📊 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/products` | GET | 获取商品列表 |
| `/api/products/stats` | GET | 获取统计信息 |
| `/api/products/:id` | GET | 获取商品详情 |
| `/api/products/:id/analysis` | GET | 获取价格分析 |
| `/api/products` | POST | 添加商品 |
| `/api/products/:id` | PUT | 更新商品 |
| `/api/products/:id` | DELETE | 删除商品 |
| `/api/products/:id/buy` | POST | 标记购买 |
| `/api/prices/:productId/history` | GET | 价格历史 |
| `/api/prices/:productId/stats` | GET | 价格统计 |
| `/api/prices/drops` | GET | 价格下降商品 |
| `/api/scrape/:platform` | POST | 手动触发抓取 |
| `/api/scrape/status` | GET | 抓取状态 |
| `/api/notifications` | GET | 获取通知 |
| `/api/notifications/unread-count` | GET | 未读通知数 |

## 🚀 快速开始

### 1. 数据库初始化
```bash
mysql -u root -p
CREATE DATABASE yb_price_tracker;
exit;
mysql -u root -p yb_price_tracker < database/schema.sql
```

### 2. 启动后端
```bash
cd server
npm install
npm run dev
```

### 3. 安装扩展
1. 打开 Chrome → `chrome://extensions/`
2. 开启 "开发者模式"
3. 点击 "加载已解压的扩展程序"
4. 选择 `extension` 文件夹

## 💡 使用场景

### 场景 1：追踪京东商品
1. 访问京东商品页面
2. 点击 "📊 添加到追踪" 按钮
3. 设置意向等级（1-5星）
4. 每天自动抓取价格
5. 收到价格下降通知

### 场景 2：查看价格历史
1. 点击扩展图标
2. 选择商品，点击 "历史价格"
3. 查看 30 天价格走势图
4. 分析当前是否好价

### 场景 3：购买决策
1. 查看商品价格分析报告
2. 查看购买时机评分
3. 参考最优购买价格
4. 根据建议决定是否入手

## 🔧 配置说明

### 环境变量 (server/.env)
```env
PORT=3777
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yb_price_tracker
JD_CRON=0 0,6,12,18,22 * * *
TAOBAO_CRON=0 10 * * *
PDD_CRON=0 9,21 * * *
LOG_LEVEL=info
```

## 📈 价格判断逻辑

| 条件 | 标识 | 建议 |
|------|------|------|
| 当前价 = 历史最低价 | 🟢 | 强烈推荐入手 |
| 当前价 < 近30天均价的90% | 🟢 | 好价，可以考虑 |
| 当前价 < 近30天均价 | 🟡 | 价格合理 |
| 当前价 > 近30天均价 | 🟠 | 建议再等等 |
| 当前价 > 近30天均价的110% | 🔴 | 价格较高 |

## 🎨 UI 设计

### Chrome 扩展弹窗
- 顶部统计：追踪商品数、监控中、价格下降
- 标签页切换：监控中、已购买、价格下降
- 商品卡片：标题、平台、价格、趋势、操作按钮

### 价格历史图表
- 时间范围选择：7天、30天、90天、180天、1年
- 价格走势图表（Chart.js）
- 价格摘要：当前价、最低价、最高价、平均价

## 🔒 安全考虑

1. **CORS 配置**：只允许 Chrome 扩展和本地访问
2. **速率限制**：每 IP 每 15 分钟最多 100 个请求
3. **输入验证**：验证所有用户输入
4. **SQL 注入防护**：使用参数化查询
5. **日志记录**：记录所有操作和错误

## 🚧 后续优化

> 详细的进度状态以 [README.md](README.md) 的「开发进度」章节为准。

### 短期（1-2周）
- [x] 添加更多抓取源（慢慢买历史价格回传）
- [ ] 优化抓取稳定性（重试机制、代理支持）
- [ ] 添加数据导出功能
- [ ] 优化移动端显示

### 中期（1-2月）
- [ ] 添加商品分类标签
- [ ] 支持多语言
- [ ] 添加购物清单功能
- [x] 集成浏览器通知（Chrome Notifications API）
- [ ] 完善优惠券自动抓取与叠加计算

### 长期（3-6月）
- [ ] 开发独立 Web 应用
- [ ] 支持更多电商平台
- [ ] AI 智能推荐
- [ ] Docker 一键部署

## 📝 开发日志

### v1.0.0
- ✅ 初始版本发布
- ✅ 支持京东、淘宝、拼多多
- ✅ 价格历史图表
- ✅ 定时抓取任务
- ✅ Chrome 扩展
- ✅ 价格分析引擎
- ✅ 通知系统
- ✅ 扩展价格上报接口 `/api/prices/record`
- ✅ 慢慢买历史价格回传（补齐冷启动历史）

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [Express.js](https://expressjs.com/)
- [Puppeteer](https://pptr.dev/)
- [Chart.js](https://www.chartjs.org/)
- [MySQL](https://www.mysql.com/)

---

**项目路径**: `D:\Code\YB-2026\YbPriceTracker`

**定位**: Chrome 浏览器第三方插件（Manifest V3）+ 本地 Node.js 后端 + MySQL

**最后更新**: 2026年
