# YbPriceTracker 安装指南

## 前置要求

1. **Node.js** (版本 >= 16.0.0)
2. **MySQL** (版本 >= 5.7)
3. **Chrome 浏览器** (版本 >= 88)

## 安装步骤

### 1. 数据库初始化

首先，确保你的 MySQL 服务正在运行，然后执行以下命令创建数据库和表：

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE yb_price_tracker DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 退出 MySQL 命令行
exit;

# 导入表结构
mysql -u root -p yb_price_tracker < D:\Code\YB-2026\YbPriceTracker\database\schema.sql
```

### 2. 配置后端服务

进入 `server` 目录并配置环境变量：

```bash
cd D:\Code\YB-2026\YbPriceTracker\server
```

编辑 `.env` 文件，修改数据库连接信息：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=yb_price_tracker
```

### 3. 安装依赖并启动服务

```bash
# 安装依赖
npm install

# 启动服务（开发模式）
npm run dev

# 或者生产模式
npm start
```

服务启动后，你会看到：
```
✅ 数据库连接成功
🚀 YbPriceTracker 服务已启动
📍 地址: http://localhost:3777
```

### 4. 安装 Chrome 扩展

1. 打开 Chrome 浏览器
2. 在地址栏输入 `chrome://extensions/` 并回车
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择目录：`D:\Code\YB-2026\YbPriceTracker\extension`
6. 扩展安装完成后，你会在浏览器右上角看到扩展图标

## 验证安装

### 1. 测试后端服务

在浏览器中访问：http://localhost:3777/api/health

应该返回：
```json
{
  "success": true,
  "message": "YbPriceTracker API is running",
  "timestamp": "2024-..."
}
```

### 2. 测试 Chrome 扩展

1. 打开京东商品页面（例如：https://item.jd.com/100012345678.html）
2. 页面右下角应该出现 "📊 添加到追踪" 按钮
3. 点击按钮，商品将被添加到追踪列表
4. 点击浏览器右上角的扩展图标，可以看到已添加的商品

## 常见问题

### Q: 数据库连接失败怎么办？

A: 检查以下几点：
1. MySQL 服务是否正在运行
2. `.env` 文件中的数据库配置是否正确
3. 数据库用户是否有足够的权限

### Q: Chrome 扩展无法加载怎么办？

A: 检查以下几点：
1. 确保开启了 "开发者模式"
2. 选择的是 `extension` 文件夹，而不是其子文件夹
3. 检查 `manifest.json` 文件是否有语法错误

### Q: 无法添加商品怎么办？

A: 检查以下几点：
1. 后端服务是否正在运行（http://localhost:3777）
2. 是否在支持的电商平台页面（京东、淘宝、拼多多）
3. 是否在商品详情页（而不是搜索结果页）

### Q: 定时任务没有执行怎么办？

A: 检查以下几点：
1. 后端服务是否正在运行
2. 检查日志文件 `server/logs/` 中是否有错误信息
3. 确保商品状态为 "watching"（监控中）

## 目录结构说明

```
YbPriceTracker/
├── server/                 # 后端服务
│   ├── src/               # 源代码
│   ├── logs/              # 日志文件（自动生成）
│   ├── node_modules/      # 依赖包（自动生成）
│   ├── .env               # 环境变量配置
│   └── package.json       # 项目配置
│
├── extension/              # Chrome 扩展
│   ├── background/        # 后台脚本
│   ├── content/           # 内容脚本
│   ├── popup/             # 弹出窗口
│   ├── options/           # 设置页面
│   ├── icons/             # 图标（需要自行添加）
│   └── manifest.json      # 扩展配置
│
├── database/               # 数据库脚本
│   └── schema.sql         # 建表 SQL
│
└── README.md              # 项目说明
```

## 下一步

安装完成后，你可以：

1. **添加商品**：在京东、淘宝、拼多多商品页面点击 "添加到追踪" 按钮
2. **查看价格历史**：在扩展弹出窗口中点击 "历史价格" 按钮
3. **设置提醒**：在扩展设置页面配置价格下降提醒
4. **查看统计**：在扩展弹出窗口中查看商品统计信息

## 技术支持

如果遇到问题，请检查：

1. **日志文件**：`server/logs/error.log` 和 `server/logs/combined.log`
2. **浏览器控制台**：按 F12 打开开发者工具，查看 Console 标签
3. **扩展错误**：在 `chrome://extensions/` 页面查看扩展错误信息

## 更新日志

### v1.0.0 (2024-09-23)
- 初始版本发布
- 支持京东、淘宝、拼多多商品追踪
- 价格历史图表
- 定时抓取任务
- Chrome 扩展
