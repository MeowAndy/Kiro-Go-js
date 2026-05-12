/**
 * Kiro-Go 状态查询插件
 * 适用于 TRSS-Yunzai / Miao-Yunzai
 * 命令：#kiro状态 / #kiro查询
 */

// ============ 配置项 ============
const KIRO_BASE_URL = 'http://127.0.0.1:8080'
const KIRO_ADMIN_PASSWORD = 'your-admin-password-here'
// ================================

export class KiroGoStatus extends plugin {
  constructor() {
    super({
      name: 'Kiro-Go状态查询',
      dsc: '查询 Kiro-Go 管理面板统计信息和账号列表',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: /^#kiro(状态|查询)$/i,
          fnc: 'queryStatus'
        }
      ]
    })
  }

  async queryStatus(e) {
    try {
      const headers = { 'X-Admin-Password': KIRO_ADMIN_PASSWORD }

      // 并发请求统计和账号列表
      const [statsRes, accountsRes] = await Promise.all([
        fetch(`${KIRO_BASE_URL}/admin/api/stats`, { headers }),
        fetch(`${KIRO_BASE_URL}/admin/api/accounts`, { headers })
      ])

      if (!statsRes.ok) {
        await e.reply(`❌ 获取统计信息失败: HTTP ${statsRes.status}`)
        return
      }
      if (!accountsRes.ok) {
        await e.reply(`❌ 获取账号列表失败: HTTP ${accountsRes.status}`)
        return
      }

      const stats = await statsRes.json()
      const accounts = await accountsRes.json()

      // 格式化运行时间
      const uptime = formatUptime(stats.uptime)

      // 构建统计信息
      let msg = `🚀 Kiro-Go 运行状态\n`
      msg += `━━━━━━━━━━━━━━━━━━\n`
      msg += `⏱️ 运行时间: ${uptime}\n`
      msg += `📊 总请求数: ${stats.totalRequests ?? 0}\n`
      msg += `✅ 成功请求: ${stats.successRequests ?? 0}\n`
      msg += `❌ 失败请求: ${stats.failedRequests ?? 0}\n`
      msg += `🔤 总Tokens: ${formatNumber(stats.totalTokens ?? 0)}\n`
      msg += `💰 总Credits: ${formatNumber(stats.totalCredits ?? 0)}\n`
      msg += `👥 账号数量: ${accounts.length}\n`
      msg += `━━━━━━━━━━━━━━━━━━\n`
      msg += `📋 账号列表:\n`

      // 构建账号列表
      for (const acc of accounts) {
        const email = maskEmail(acc.email)
        const status = acc.enabled ? '🟢' : '🔴'
        const usage = acc.usagePercent != null ? `${acc.usagePercent}%` : 'N/A'
        const sub = acc.subscriptionTitle || acc.subscriptionType || '未知'

        msg += `\n${status} ${email}\n`
        msg += `   📦 ${sub} | 📈 用量: ${usage}\n`
        msg += `   🔢 请求: ${acc.requestCount ?? 0} | 🔤 ${formatNumber(acc.totalTokens ?? 0)}`
        if (acc.region) msg += ` | 🌍 ${acc.region}`
        msg += `\n`
      }

      await e.reply(msg.trim())
    } catch (err) {
      await e.reply(`❌ 查询失败: ${err.message}`)
    }
  }
}

/**
 * 邮箱脱敏：前3位 + *** + @域名
 */
function maskEmail(email) {
  if (!email) return '***'
  const [local, domain] = email.split('@')
  if (!domain) return email.slice(0, 3) + '***'
  const prefix = local.slice(0, 3)
  return `${prefix}***@${domain}`
}

/**
 * 格式化运行时间（秒 → 可读）
 */
function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '未知'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}时`)
  parts.push(`${m}分`)
  return parts.join('')
}

/**
 * 格式化大数字
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}
