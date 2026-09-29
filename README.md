# YbPriceTracker 🛒💰

> **一个跑在自己电脑上的电商价格追踪助手 —— Chrome 浏览器插件 + 本地 Node.js 后端**

智能追踪 **京东 / 淘宝 / 天猫 / 拼多多** 商品价格，自动记录历史价格曲线，
告诉你 **"现在是好价吗？该不该买？"**，帮你以最优价格买下心仪商品。

[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](#-chrome-扩展)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](#-快速开始)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](#1-初始化数据库)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#-license)

---

## 📖 这是什么？

**YbPriceTracker 的形态是一个 Chrome 第三方浏览器插件**（Manifest V3），
不是网站、不是 App、也不是一个需要注册登录的云服务。

它的工作方式是：

```
你平时逛京东/淘宝/拼多多  ──►  插件在商品页面上默默帮你干活
                                    │
                         ① 读取当前价格、标题、主图
                         ② 页面上注入一个「添加追踪」按钮 + 价格徽章
                         ③ 把价格上报到本机后端，写入历史记录
                                    │
                                    ▼
                        本机 Node.js 服务（localhost:3777）
                          · 存进 MySQL
                          · 定时任务继续每天自动抓价
                          · 分析历史价格，判断是否好价
                          · 算出「建议入手价」
```

**核心思路：不依赖任何第三方比价网站的账号和数据，价格历史是你自己攒出来的。**
数据全部存在你自己的 MySQL 里，后端只监听 `localhost`，不对外网暴露。

---

## 🎯 应用场景

### 场景一：想买但觉得贵，先加进追踪列表"挂着"（最典型）

你在京东看到一台显示器，当前 ¥1999，感觉会降但不想天天来盯。

1. 在商品页右下角点一下插件注入的 **「📊 添加到追踪」**
2. 设置**意向等级**（1~5 星）——这是后续所有建议的基础
3. 从此每天自动抓价，攒出价格曲线
4. 降到你的心理价位时，插件弹出降价提醒

> 不用收藏夹、不用记事本、不用每天手动查价。

### 场景二：判断"现在这个价，到底算不算好价？"

商品页标着"限时直降 300"、"原价 2299 现价 1999"——**到底是真便宜还是套路？**

打开历史价格图表，一眼看到：

- 近 7 / 30 / 90 / 180 天 / 1 年的价格曲线
- 历史最低价、最高价、平均价
- 当前价处在什么位置（🟢 历史最低 / 🟡 价格合理 / 🔴 高位）
- **0~100 分的购买时机评分** + 具体理由

很多商品的"促销价"其实就是它的日常价，曲线一看就露馅。

### 场景三：大促之前提前布局（618 / 双 11）

大促前一两周把想买的东西全加进追踪，
让它在促销前后密集记录价格波动。
大促当天拿曲线对比，直接判断这个"大促价"是不是真的低。

### 场景四：想买但可以等，交给时间

意向等级定低一点（1~2 星），插件会建议你等到 **10 分位价 / 历史最低价** 再入手；
意向等级高（5 星）则建议在 **75 分位价** 就可以下手，不必死等。
**同一件商品，买不买的答案本来就取决于你有多想要它。**

### 场景五：记录买过的价格，避免"二次被割"

标记为已购买后保留价格记录。以后再看到同款，能立刻翻出自己当初多少钱买的。

---

## ✨ 功能特性

### Chrome 扩展（浏览器端）

| 功能 | 说明 |
|------|------|
| 🔘 页面注入按钮 | 商品详情页右下角自动注入「📊 添加到追踪」按钮 |
| 💰 多平台价格识别 | 针对京东/淘宝/天猫/拼多多的 DOM 结构分别提取，含多级兜底 |
| 🖼️ 主图自动抓取 | 自动识别商品主图，含协议补全与防盗链处理 |
| 📈 价格徽章 | 已追踪商品在页面上直接显示价格趋势 |
| 📊 历史图表 | 内置 `charts.html`，Chart.js 绘制多时间跨度曲线 |
| 🕘 慢慢买历史回传 | 打开慢慢买历史价格页时自动解析走势数据并回传本地（补齐冷启动历史） |
| 🖱️ 右键菜单 / 桌面通知 | 快捷添加、降价提醒 |
| ⚙️ 设置页面 | 配置后端地址、抓取时间、提醒阈值 |

### Node.js 后端（本地服务）

| 功能 | 说明 |
|------|------|
| 🗄️ 商品管理 | 增删改查、意向等级（1-5 星）、状态流转（监控中/已购买/不感兴趣） |
| ⏰ 定时抓价 | node-cron 分平台调度，时区锁定 `Asia/Shanghai` |
| 🕷️ 网页抓取 | Puppeteer + stealth 插件，随机延迟 3~8 秒防风控 |
| 📉 价格历史 | 每次抓取/上报都落库，支持统计与清理 |
| 🧠 价格分析引擎 | 趋势判断、购买时机评分、最优购买价（分位数策略） |
| 🔔 通知系统 | 降价、历史最低、目标价达成提醒 |
| 🔌 RESTful API | 20+ 接口，接口清单见 [API.md](API.md) |

### 平台支持

| 平台 | 价格抓取 | 说明 |
|------|---------|------|
| **京东** | ✅ 完整 | 重点支持，每天 5 个时段抓取（价格波动大） |
| **淘宝 / 天猫** | ✅ 支持 | 每天抓取，含新版 detail 2.0 页面结构适配 |
| **拼多多** | ✅ 支持 | 百亿补贴商品重点追踪 |
| 慢慢买 | ✅ 辅助数据源 | 非电商平台，作为历史价格补充来源 |

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────┐
│  Chrome 扩展（Manifest V3）                    │
│  ├─ content script   页面价格识别 + UI 注入     │
│  ├─ background       事件调度、右键菜单、通知    │
│  ├─ popup            商品列表、标签页、快捷添加   │
│  ├─ options          设置页                     │
│  └─ charts.html      Chart.js 历史曲线          │
└───────────────────┬──────────────────────────┘
                    │ HTTP  →  http://localhost:3777
                    ▼
┌──────────────────────────────────────────────┐
│  Node.js 后端（Express，仅本机运行）             │
│  ├─ routes/controllers    RESTful API          │
│  ├─ services/scraper      三平台抓取器           │
│  ├─ services/scheduler    node-cron 定时任务     │
│  ├─ utils/priceAnalyzer   价格分析引擎           │
│  └─ utils/notification    通知服务              │
└───────────────────┬──────────────────────────┘
                    │ mysql2
                    ▼
┌──────────────────────────────────────────────┐
│  MySQL 8.0                                    │
│  products / price_history / coupons /         │
│  notifications / user_config                  │
└──────────────────────────────────────────────┘
```

### 技术栈

| 层 | 技术 |
|----|------|
| 扩展 | Manifest V3、原生 JS、Chart.js、Chrome Storage API |
| 后端 | Node.js、Express 4、node-cron、Winston |
| 抓取 | Puppeteer 21、puppeteer-extra + stealth、Cheerio、Axios |
| 数据库 | MySQL 8.0（mysql2） |
| 安全 | Helmet、CORS、express-rate-limit |

---

## 📁 项目结构

```
YbPriceTracker/
├── server/                          # Node.js 后端
│   ├── src/
│   │   ├── config/database.js       # MySQL 连接池
│   │   ├── controllers/             # 商品/价格/抓取/通知 控制器
│   │   ├── models/                  # Product.js、PriceHistory.js
│   │   ├── routes/index.js          # 全部路由定义
│   │   ├── services/
│   │   │   ├── scraper/             # baseScraper + jd/taobao/pdd 抓取器
│   │   │   ├── scheduler/scrapeJob.js   # 定时抓取任务
│   │   │   ├── priceUpdateJob.js    # 批量价格更新（axios 轻量方案）
│   │   │   └── simplePriceService.js
│   │   ├── utils/
│   │   │   ├── priceAnalyzer.js     # 价格分析引擎（核心）
│   │   │   ├── notificationService.js
│   │   │   └── logger.js            # Winston
│   │   └── app.js                   # 服务入口
│   ├── test/api.test.js             # Jest 接口测试
│   ├── .env.example                 # 环境变量模板
│   └── package.json
│
├── extension/                       # Chrome 扩展
│   ├── manifest.json                # MV3 清单
│   ├── background/background.js     # Service Worker
│   ├── content/
│   │   ├── content.js               # 页面注入与价格识别（核心）
│   │   ├── content.css
│   │   └── manmanbuy.js             # 慢慢买历史回传
│   ├── popup/                       # 弹窗：监控中/已购买/价格下降
│   ├── options/                     # 设置页
│   ├── icons/
│   └── charts.html                  # 历史价格图表
│
├── database/schema.sql              # 建表脚本
├── API.md                           # 接口文档
├── INSTALL.md                       # 安装指南
├── QUICKSTART.md                    # 5 分钟快速开始
├── PROJECT_SUMMARY.md               # 项目总结
└── README.md
```

---

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 18
- **MySQL** ≥ 8.0
- **Chrome** / Edge 等 Chromium 内核浏览器

### 1. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

或手动创建后导入：

```sql
CREATE DATABASE yb_price_tracker DEFAULT CHARACTER SET utf8mb4;
```

```bash
mysql -u root -p yb_price_tracker < database/schema.sql
```

### 2. 配置并启动后端

```bash
cd server
npm install

# 复制环境变量模板并修改数据库密码
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

启动成功会看到：

```
✅ 数据库连接成功
🚀 YbPriceTracker 服务已启动
📍 地址: http://localhost:3777
```

验证：浏览器访问 <http://localhost:3777/api/health>

### 3. 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 打开右上角 **「开发者模式」**
3. 点击 **「加载已解压的扩展程序」**
4. 选择本项目的 **`extension`** 文件夹
5. 建议把扩展图标固定到工具栏

> 本项目未上架 Chrome 应用商店，采用**开发者模式加载**的方式安装。

### 4. 开始使用

访问任意京东/淘宝/天猫/拼多多商品详情页：

- 页面右下角会出现 **「📊 添加到追踪」** 按钮，点一下即可加入追踪
- 或点击工具栏扩展图标 → **「+ 添加当前页面商品」**

---

## ⚙️ 配置说明

### 环境变量（`server/.env`）

```env
# 服务端口
PORT=3777

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yb_price_tracker

# 日志级别
LOG_LEVEL=info

# 定时任务（cron 表达式，时区固定 Asia/Shanghai）
JD_CRON=0 0,6,12,18,22 * * *      # 京东：每天 0/6/12/18/22 点
TAOBAO_CRON=0 10 * * *            # 淘宝：每天 10 点
PDD_CRON=0 9,21 * * *             # 拼多多：每天 9/21 点
```

完整模板见 [`server/.env.example`](server/.env.example)。

### 抓取调度建议

| 平台 | 建议频率 | 原因 |
|------|---------|------|
| 京东 | 每天 5 次 | 价格波动大，促销频繁 |
| 淘宝/天猫 | 每天 1 次 | 价格相对稳定 |
| 拼多多 | 每天 2 次 | 百亿补贴价格变动快 |

---

## 🧠 价格判断逻辑

### 趋势判断（`priceAnalyzer.js`）

对比**当前价**与**近 30 天均价**：

| 条件 | 标识 | 结论 |
|------|------|------|
| 当前价 ≤ 历史最低价 | 🟢 | 历史最低价，强烈建议入手 |
| 低于均价 ≥ 15% | 🟢 | 非常好价，非常推荐入手 |
| 低于均价 5% ~ 15% | 🟢 | 好价，推荐入手 |
| 均价 ± 5% 以内 | 🟡 | 价格合理，可以考虑 |
| 高于均价 5% ~ 15% | 🟠 | 价格偏高，建议等待 |
| 高于均价 ≥ 15% | 🔴 | 价格高位，强烈建议等待 |

### 购买时机评分（0~100 分）

| 因素 | 影响 |
|------|------|
| 价格趋势 | 最低价 +50 / 非常好价 +40 / 好价 +30 / 合理 +10 / 偏高 −10 / 高位 −20 |
| 意向等级 | 每高于 3 星 +10 |
| 优惠券 | 按折扣力度加分，最多 +20 |
| 价格波动性 | 波动 > 20% 时 −5（提示等待低点） |
| 超出预算 | −30 |
| 需求紧急 | +15 |

最终分数映射为：**强烈推荐入手（≥80）/ 推荐入手（≥60）/ 可以考虑（≥40）/ 建议再等等（≥20）/ 不建议现在入手**。

### 最优购买价（按意向等级选分位数）

| 意向等级 | 建议入手价 | 策略 |
|---------|-----------|------|
| ⭐⭐⭐⭐⭐ 非常想要 | 75 分位 | 不必死等，75 分位内即可入手 |
| ⭐⭐⭐⭐ 比较想要 | 中位数 | 中位数附近入手 |
| ⭐⭐⭐ 一般 | 25 分位 | 等到 25 分位 |
| ⭐⭐ 可有可无 | 10 分位 | 等到 10 分位 |
| ⭐ 随便看看 | 历史最低 | 只在历史最低价出手 |

---

## 📡 API 一览

完整文档见 [API.md](API.md)。

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/products` | GET / POST | 商品列表 / 添加商品 |
| `/api/products/stats` | GET | 统计信息 |
| `/api/products/:id` | GET / PUT / DELETE | 商品详情 / 更新 / 删除 |
| `/api/products/:id/analysis` | GET | 价格分析报告 |
| `/api/products/:id/buy` | POST | 标记为已购买 |
| `/api/prices/:productId/history` | GET | 价格历史 |
| `/api/prices/:productId/stats` | GET | 价格统计 |
| `/api/prices/drops` | GET | 降价商品列表 |
| `/api/prices/record` | POST | 扩展上报价格（核心写入接口） |
| `/api/prices/update-all` | POST | 批量更新所有商品价格 |
| `/api/scrape/:platform` | POST | 手动触发抓取 |
| `/api/scrape/status` | GET | 抓取任务状态 |
| `/api/notifications` | GET | 通知列表 |

---

## 📊 开发进度

### ✅ 已完成

- [x] 项目结构搭建
- [x] 数据库设计与建表脚本（`database/schema.sql`）
- [x] 后端 RESTful API（商品 / 价格 / 抓取 / 通知）
- [x] 数据模型层（`Product`、`PriceHistory`）
- [x] 京东价格抓取器（Puppeteer + stealth）
- [x] 淘宝/天猫价格抓取器（含新版 detail 2.0 适配）
- [x] 拼多多价格抓取器
- [x] 定时抓取任务（node-cron，分平台调度）
- [x] 价格分析引擎（趋势 / 评分 / 最优价）
- [x] 通知服务（降价 / 历史最低 / 目标价）
- [x] Chrome 扩展 MV3 骨架（manifest / background / content / popup / options）
- [x] 页面价格识别与多级兜底提取
- [x] 页面按钮与价格徽章注入
- [x] 历史价格图表（Chart.js，多时间跨度）
- [x] 商品管理 UI（监控中 / 已购买 / 价格下降 三个标签页）
- [x] 意向等级（1-5 星）与购买记录
- [x] 扩展价格上报接口 `/api/prices/record`
- [x] 慢慢买历史价格回传（补齐冷启动历史数据）
- [x] 接口测试（Jest）

### 🚧 进行中

- [ ] 抓取成功率优化（京东/拼多多反爬对抗，重试与代理支持）
- [ ] 优惠券自动抓取与叠加计算（数据表已就绪，抓取待完善）
- [ ] 跨平台同款比价（目前以单商品追踪为主）

### 📋 规划中

- [ ] 扩展到更多平台（唯品会、抖音商城等）
- [ ] 数据导出 / 导入（CSV、JSON 备份）
- [ ] 独立 Web 管理界面（不依赖浏览器插件查看数据）
- [ ] 价格预测与智能推荐
- [ ] 移动端查看方案
- [ ] Docker 一键部署
- [ ] 上架 Chrome 应用商店

> 进度状态以代码实际实现为准。想了解各文件的详细说明，见 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)。

---

## 🔒 隐私与安全

- **数据自持**：所有数据存放在你自己的 MySQL 中，不上传任何第三方服务器
- **本地闭环**：后端仅监听本机，扩展通过 `http://localhost:3777` 通信
- **无账号体系**：不需要注册、登录，不收集任何个人信息
- **SQL 注入防护**：全部使用参数化查询
- **请求限流**：`express-rate-limit` 保护接口
- **日志记录**：Winston 记录操作与错误，便于排查

> ⚠️ **注意**：`server/.env` 已在 `.gitignore` 中，请勿把数据库密码提交到仓库。

---

## ❓ 常见问题

**Q：扩展连不上后端？**
1. 确认后端已启动：访问 <http://localhost:3777/api/health>
2. 检查防火墙是否拦截 3777 端口
3. 打开扩展的 Service Worker 控制台查看报错

**Q：抓取失败 / 价格抓不到？**
电商平台反爬策略变化频繁，抓取器会随之失效。可尝试：
- 降低抓取频率，避免触发风控
- 在商品页手动点一次「添加到追踪」，由浏览器侧直接读取真实 DOM 价格（最可靠）
- 查看 `server/logs/error.log` 定位具体原因

**Q：历史数据太少，判断不准？**
新加入的商品没有历史积累。可以通过打开该商品的**慢慢买历史价格页**，
扩展会自动解析并回传历史走势，快速补齐数据。

**Q：修改抓取时间？**
编辑 `server/.env` 中的 `JD_CRON` / `TAOBAO_CRON` / `PDD_CRON`，重启服务生效。

**Q：手动触发一次抓取？**
```bash
curl -X POST http://localhost:3777/api/scrape/jd
```

---

## 🤝 贡献

欢迎提交 Issue 和 PR：

1. Fork 本仓库
2. 创建分支 `git checkout -b feature/your-feature`
3. 提交改动 `git commit -m 'feat: add something'`
4. 推送 `git push origin feature/your-feature`
5. 发起 Pull Request

**特别欢迎**：各平台抓取选择器的适配更新（电商页面结构变动频繁）。

---

## 📄 License

[MIT](LICENSE)

## ⚠️ 免责声明

本项目仅供**个人学习与技术研究**使用。
请合理控制抓取频率，遵守目标网站的服务条款与 `robots.txt`。
因使用本项目产生的任何后果由使用者自行承担。

## 🙏 致谢

[Express](https://expressjs.com/) · [Puppeteer](https://pptr.dev/) · [Chart.js](https://www.chartjs.org/) · [MySQL](https://www.mysql.com/) · [Winston](https://github.com/winstonjs/winston)

---

<p align="center">如果这个项目帮你省下了钱，欢迎点个 ⭐ Star</p>
