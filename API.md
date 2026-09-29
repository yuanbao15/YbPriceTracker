# YbPriceTracker API 文档

## 基础信息

- **Base URL**: `http://localhost:3777/api`
- **Content-Type**: `application/json`

## 响应格式

所有 API 响应都遵循以下格式：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## 健康检查

### GET /health

检查服务是否正常运行。

**响应示例**：
```json
{
  "success": true,
  "message": "YbPriceTracker API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 商品管理

### GET /products

获取商品列表。

**查询参数**：
- `platform` - 平台筛选：`jd`, `taobao`, `pdd`
- `status` - 状态筛选：`watching`, `bought`, `not_interested`
- `desire_level` - 意向等级：1-5
- `search` - 搜索关键词
- `orderBy` - 排序方式：`desire_level DESC, updated_at DESC`
- `limit` - 返回数量限制
- `offset` - 偏移量

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "platform": "jd",
      "product_id": "100012345678",
      "title": "iPhone 15 Pro",
      "url": "https://item.jd.com/100012345678.html",
      "current_price": 7999.00,
      "lowest_price": 7499.00,
      "highest_price": 8999.00,
      "desire_level": 5,
      "status": "watching",
      "price_stats": {
        "min_price": 7499.00,
        "max_price": 8999.00,
        "avg_price": 8199.00,
        "record_count": 30
      },
      "today_changes": 2,
      "price_trend": {
        "trend": "good",
        "emoji": "🟢",
        "message": "好价！比30天均价低5.2%",
        "diff": -5.2
      }
    }
  ],
  "total": 1
}
```

### GET /products/stats

获取商品统计信息。

**响应示例**：
```json
{
  "success": true,
  "data": {
    "total": 10,
    "watching": 8,
    "bought": 2,
    "jd_count": 5,
    "taobao_count": 3,
    "pdd_count": 2,
    "price_drops": [
      {
        "id": 1,
        "title": "iPhone 15 Pro",
        "platform": "jd",
        "current_price": 7499.00,
        "lowest_price": 7499.00,
        "avg_price": 8199.00,
        "drop_percentage": 8.54
      }
    ]
  }
}
```

### GET /products/:id

获取单个商品详情。

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "jd",
    "product_id": "100012345678",
    "title": "iPhone 15 Pro",
    "url": "https://item.jd.com/100012345678.html",
    "current_price": 7999.00,
    "lowest_price": 7499.00,
    "highest_price": 8999.00,
    "desire_level": 5,
    "status": "watching",
    "price_history": [ ... ],
    "price_stats": { ... },
    "today_changes": [ ... ],
    "price_trend": { ... }
  }
}
```

### GET /products/:id/analysis

获取商品价格分析报告。

**查询参数**：
- `days` - 分析天数，默认 30

**响应示例**：
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "title": "iPhone 15 Pro",
      "platform": "jd",
      "currentPrice": 7999.00,
      "desireLevel": 5
    },
    "analysis": {
      "trend": "good",
      "emoji": "🟢",
      "message": "好价！比30天均价低5.2%",
      "suggestion": "推荐入手，价格低于平均水平",
      "diffFromAvg": -5.2,
      "priceRange": 1500.00,
      "rangePercent": 18.3
    },
    "optimal": {
      "min": 7499.00,
      "max": 8999.00,
      "avg": 8199.00,
      "percentile10": 7599.00,
      "percentile25": 7799.00,
      "percentile50": 8199.00,
      "percentile75": 8499.00,
      "recommendedPrice": 8499.00,
      "strategy": "意向强烈，建议在75分位价格内入手"
    },
    "buyingAdvice": {
      "score": 72,
      "recommendation": "推荐入手",
      "reasons": [
        "价格低于均价",
        "意向等级高"
      ],
      "analysis": { ... }
    },
    "summary": {
      "currentPrice": "¥7999",
      "trend": "🟢 好价！比30天均价低5.2%",
      "recommendation": "推荐入手",
      "score": "72/100",
      "reasons": [ ... ]
    }
  }
}
```

### POST /products

添加新商品。

**请求体**：
```json
{
  "platform": "jd",
  "product_id": "100012345678",
  "title": "iPhone 15 Pro",
  "url": "https://item.jd.com/100012345678.html",
  "image_url": "https://img.jd.com/xxx.jpg",
  "current_price": 7999.00,
  "original_price": 8999.00,
  "desire_level": 5,
  "note": "急需购买"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "jd",
    "product_id": "100012345678",
    "title": "iPhone 15 Pro",
    "current_price": 7999.00,
    "lowest_price": 7999.00,
    "highest_price": 7999.00,
    "desire_level": 5,
    "status": "watching"
  },
  "message": "商品添加成功"
}
```

### PUT /products/:id

更新商品信息。

**请求体**：
```json
{
  "desire_level": 4,
  "note": "可以等等"
}
```

### DELETE /products/:id

删除商品。

**响应示例**：
```json
{
  "success": true,
  "message": "商品已删除"
}
```

### POST /products/:id/buy

标记商品为已购买。

**请求体**：
```json
{
  "bought_price": 7499.00
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "bought",
    "bought_price": 7499.00,
    "bought_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "已标记为购买"
}
```

---

## 价格管理

### GET /prices/:productId/history

获取商品价格历史。

**查询参数**：
- `days` - 天数，默认 30

**响应示例**：
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": 1,
        "product_id": 1,
        "price": 7999.00,
        "original_price": 8999.00,
        "coupon_info": "[{\"type\":\"满减券\",\"min_amount\":5000,\"discount_amount\":200}]",
        "recorded_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "stats": {
      "min_price": 7499.00,
      "max_price": 8999.00,
      "avg_price": 8199.00,
      "record_count": 30
    }
  }
}
```

### GET /prices/:productId/stats

获取商品价格统计。

### GET /prices/drops

获取价格下降的商品。

**查询参数**：
- `threshold` - 下降百分比阈值，默认 5

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "iPhone 15 Pro",
      "platform": "jd",
      "product_id": "100012345678",
      "current_price": 7499.00,
      "lowest_price": 7499.00,
      "avg_price": 8199.00,
      "drop_percentage": 8.54
    }
  ]
}
```

### POST /prices/cleanup

清理旧的价格记录。

**查询参数**：
- `days` - 保留天数，默认 90

---

## 抓取任务

### POST /scrape/:platform

手动触发抓取任务。

**路径参数**：
- `platform` - 平台：`jd`, `taobao`, `pdd`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "platform": "jd",
    "total": 5,
    "success": 4,
    "failed": 1,
    "errors": []
  },
  "message": "jd 抓取任务已触发"
}
```

### GET /scrape/status

获取抓取任务状态。

**响应示例**：
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "jobs": [
      { "platform": "jd", "running": true },
      { "platform": "taobao", "running": true },
      { "platform": "pdd", "running": true }
    ]
  }
}
```

### POST /scrape/:platform/:action

启动/停止抓取任务。

**路径参数**：
- `platform` - 平台
- `action` - 操作：`start`, `stop`

---

## 通知管理

### GET /notifications

获取所有通知。

**查询参数**：
- `limit` - 返回数量，默认 50

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "type": "price_drop",
      "title": "价格下降提醒",
      "message": "iPhone 15 Pro 价格下降了 5.2%！",
      "data": {
        "productId": 1,
        "oldPrice": 7999.00,
        "newPrice": 7499.00
      },
      "read": false,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "unread_count": 3
}
```

### GET /notifications/unread-count

获取未读通知数。

### PUT /notifications/:id/read

标记通知为已读。

### PUT /notifications/read-all

标记所有通知为已读。

### POST /notifications/cleanup

清理旧通知。

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如商品已存在） |
| 500 | 服务器内部错误 |

---

## 示例代码

### JavaScript (Fetch)

```javascript
// 获取商品列表
const response = await fetch('http://localhost:3777/api/products');
const data = await response.json();

// 添加商品
const response = await fetch('http://localhost:3777/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'jd',
    product_id: '100012345678',
    title: 'iPhone 15 Pro',
    url: 'https://item.jd.com/100012345678.html',
    desire_level: 5
  })
});

// 手动触发抓取
const response = await fetch('http://localhost:3777/api/scrape/jd', {
  method: 'POST'
});
```

### cURL

```bash
# 获取商品列表
curl http://localhost:3777/api/products

# 添加商品
curl -X POST http://localhost:3777/api/products \
  -H "Content-Type: application/json" \
  -d '{"platform":"jd","product_id":"100012345678","title":"iPhone 15 Pro","url":"https://item.jd.com/100012345678.html","desire_level":5}'

# 手动触发抓取
curl -X POST http://localhost:3777/api/scrape/jd
```
