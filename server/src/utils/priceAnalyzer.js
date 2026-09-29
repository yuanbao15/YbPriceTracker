const logger = require('./logger');

class PriceAnalyzer {
    // 分析价格趋势
    static analyzePriceTrend(product, priceStats) {
        if (!priceStats || !priceStats.avg_price) {
            return {
                trend: 'unknown',
                emoji: '❓',
                message: '暂无历史数据',
                suggestion: '需要更多数据来分析'
            };
        }

        const currentPrice = parseFloat(product.current_price);
        const avgPrice = parseFloat(priceStats.avg_price);
        const minPrice = parseFloat(priceStats.min_price);
        const maxPrice = parseFloat(priceStats.max_price);

        // 计算与均价的差异
        const diffFromAvg = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(1);
        
        // 计算价格波动范围
        const priceRange = maxPrice - minPrice;
        const rangePercent = (priceRange / avgPrice * 100).toFixed(1);

        // 判断趋势
        let trend, emoji, message, suggestion;

        if (currentPrice <= minPrice) {
            trend = 'lowest';
            emoji = '🟢';
            message = `历史最低价！比30天均价低${Math.abs(diffFromAvg)}%`;
            suggestion = '强烈建议入手，这是历史最低价！';
        } else if (diffFromAvg <= -15) {
            trend = 'very_good';
            emoji = '🟢';
            message = `非常好价！比30天均价低${Math.abs(diffFromAvg)}%`;
            suggestion = '非常推荐入手，价格处于低位';
        } else if (diffFromAvg <= -5) {
            trend = 'good';
            emoji = '🟢';
            message = `好价！比30天均价低${Math.abs(diffFromAvg)}%`;
            suggestion = '推荐入手，价格低于平均水平';
        } else if (diffFromAvg <= 5) {
            trend = 'fair';
            emoji = '🟡';
            message = `价格合理，接近30天均价`;
            suggestion = '可以考虑入手，价格适中';
        } else if (diffFromAvg <= 15) {
            trend = 'above_avg';
            emoji = '🟠';
            message = `高于均价${diffFromAvg}%，建议等待`;
            suggestion = '价格偏高，建议等待降价';
        } else {
            trend = 'high';
            emoji = '🔴';
            message = `价格较高，高于均价${diffFromAvg}%`;
            suggestion = '价格处于高位，强烈建议等待';
        }

        return {
            trend,
            emoji,
            message,
            suggestion,
            diffFromAvg: parseFloat(diffFromAvg),
            priceRange: priceRange.toFixed(2),
            rangePercent: parseFloat(rangePercent)
        };
    }

    // 判断是否是购买时机
    static isGoodTimeToBuy(product, priceStats, userPreferences = {}) {
        const analysis = this.analyzePriceTrend(product, priceStats);
        const currentPrice = parseFloat(product.current_price);
        const desireLevel = product.desire_level || 3;

        // 基础评分
        let score = 0;
        const reasons = [];

        // 1. 价格趋势评分
        switch (analysis.trend) {
            case 'lowest':
                score += 50;
                reasons.push('历史最低价');
                break;
            case 'very_good':
                score += 40;
                reasons.push('非常好价');
                break;
            case 'good':
                score += 30;
                reasons.push('价格低于均价');
                break;
            case 'fair':
                score += 10;
                reasons.push('价格合理');
                break;
            case 'above_avg':
                score -= 10;
                reasons.push('价格偏高');
                break;
            case 'high':
                score -= 20;
                reasons.push('价格处于高位');
                break;
        }

        // 2. 意向等级评分
        score += (desireLevel - 3) * 10;
        if (desireLevel >= 4) {
            reasons.push('意向等级高');
        }

        // 3. 优惠券加分
        if (product.coupons && product.coupons.length > 0) {
            const totalCouponDiscount = product.coupons.reduce((sum, coupon) => {
                return sum + (coupon.discount_amount || 0);
            }, 0);
            
            if (totalCouponDiscount > 0) {
                score += Math.min(totalCouponDiscount / currentPrice * 100, 20);
                reasons.push(`有优惠券，可减¥${totalCouponDiscount}`);
            }
        }

        // 4. 价格波动性
        if (analysis.rangePercent > 20) {
            reasons.push('价格波动大，建议等待低点');
            score -= 5;
        }

        // 5. 用户偏好
        if (userPreferences.maxBudget && currentPrice > userPreferences.maxBudget) {
            score -= 30;
            reasons.push('超出预算');
        }

        if (userPreferences.urgency === 'high') {
            score += 15;
            reasons.push('需求紧急');
        }

        // 计算最终评分
        const finalScore = Math.max(0, Math.min(100, score + 50));

        // 生成建议
        let recommendation;
        if (finalScore >= 80) {
            recommendation = '强烈推荐入手！';
        } else if (finalScore >= 60) {
            recommendation = '推荐入手';
        } else if (finalScore >= 40) {
            recommendation = '可以考虑';
        } else if (finalScore >= 20) {
            recommendation = '建议再等等';
        } else {
            recommendation = '不建议现在入手';
        }

        return {
            score: finalScore,
            recommendation,
            reasons,
            analysis
        };
    }

    // 计算最优购买价格
    static calculateOptimalPrice(priceHistory, desireLevel) {
        if (!priceHistory || priceHistory.length === 0) {
            return null;
        }

        const prices = priceHistory.map(p => parseFloat(p.price)).filter(p => !isNaN(p));
        
        if (prices.length === 0) {
            return null;
        }

        // 计算各种价格指标
        const sorted = [...prices].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        // 计算百分位数
        const percentile10 = sorted[Math.floor(sorted.length * 0.1)];
        const percentile25 = sorted[Math.floor(sorted.length * 0.25)];
        const percentile50 = sorted[Math.floor(sorted.length * 0.5)];
        const percentile75 = sorted[Math.floor(sorted.length * 0.75)];

        // 根据意向等级推荐价格
        let recommendedPrice;
        let strategy;

        switch (desireLevel) {
            case 5: // 非常想要
                recommendedPrice = percentile75;
                strategy = '意向强烈，建议在75分位价格内入手';
                break;
            case 4: // 比较想要
                recommendedPrice = percentile50;
                strategy = '意向较强，建议在中位数价格附近入手';
                break;
            case 3: // 一般
                recommendedPrice = percentile25;
                strategy = '意向一般，建议等待价格降至25分位';
                break;
            case 2: // 可有可无
                recommendedPrice = percentile10;
                strategy = '意向较低，建议等待价格降至10分位';
                break;
            case 1: // 随便看看
                recommendedPrice = min;
                strategy = '意向很低，建议等待历史最低价';
                break;
            default:
                recommendedPrice = percentile50;
                strategy = '建议在中位数价格附近入手';
        }

        return {
            min,
            max,
            avg: avg.toFixed(2),
            percentile10,
            percentile25,
            percentile50,
            percentile75,
            recommendedPrice: recommendedPrice.toFixed(2),
            strategy
        };
    }

    // 生成价格报告
    static generatePriceReport(product, priceStats, priceHistory) {
        const analysis = this.analyzePriceTrend(product, priceStats);
        const optimal = this.calculateOptimalPrice(priceHistory, product.desire_level);
        const buyingAdvice = this.isGoodTimeToBuy(product, priceStats);

        return {
            product: {
                id: product.id,
                title: product.title,
                platform: product.platform,
                currentPrice: product.current_price,
                desireLevel: product.desire_level
            },
            analysis,
            optimal,
            buyingAdvice,
            summary: {
                currentPrice: `¥${product.current_price}`,
                trend: `${analysis.emoji} ${analysis.message}`,
                recommendation: buyingAdvice.recommendation,
                score: `${buyingAdvice.score}/100`,
                reasons: buyingAdvice.reasons
            }
        };
    }
}

module.exports = PriceAnalyzer;
