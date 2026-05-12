/**
 * Kiro-Go 状态查询插件 v1.3.0
 * 适用于 TRSS-Yunzai / Miao-Yunzai
 * 命令：#kiro状态 / #kiro状态1 / #kiro状态2 ...
 * 支持多实例查询
 */

// ============ 配置项（按需添加更多实例） ============
const KIRO_INSTANCES = [
  {
    name: 'Kiro-1',
    url: 'http://127.0.0.1:8080',
    password: 'your-password-1'
  },
  {
    name: 'Kiro-2',
    url: 'http://127.0.0.1:8081',
    password: 'your-password-2'
  }
  // 可继续添加更多...
]
// ================================

export class KiroGoStatus extends plugin {
  constructor() {
    super({
      name: 'Kiro-Go状态查询',
      dsc: '查询 Kiro-Go 管理面板统计信息和账号列表（多实例）',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: /^#kiro(状态|查询)(\d*)$/i,
          fnc: 'queryStatus'
        }
      ]
    })
  }

  async queryStatus(e) {
    // 解析实例编号
    const match = e.msg.match(/^#kiro(?:状态|查询)(\d*)$/i)
    let idx = 0
    if (match && match[1]) {
      idx = parseInt(match[1]) - 1
    }

    if (idx < 0 || idx >= KIRO_INSTANCES.length) {
      await e.reply(`❌ 实例 #${idx + 1} 不存在，当前共 ${KIRO_INSTANCES.length} 个实例`)
      return
    }

    const instance = KIRO_INSTANCES[idx]

    try {
      const headers = { 'X-Admin-Password': instance.password }

      const [statsRes, accountsRes] = await Promise.all([
        fetch(`${instance.url}/admin/api/stats`, { headers }),
        fetch(`${instance.url}/admin/api/accounts`, { headers })
      ])

      if (!statsRes.ok) {
        await e.reply(`❌ [${instance.name}] 获取统计失败: HTTP ${statsRes.status}`)
        return
      }
      if (!accountsRes.ok) {
        await e.reply(`❌ [${instance.name}] 获取账号失败: HTTP ${accountsRes.status}`)
        return
      }

      const stats = await statsRes.json()
      const accounts = await accountsRes.json()

      // 计算主配额
      let totalUsageCurrent = 0
      let totalUsageLimit = 0
      for (const acc of accounts) {
        totalUsageCurrent += acc.usageCurrent ?? 0
        totalUsageLimit += acc.usageLimit ?? 0
      }
      const totalUsagePercent = totalUsageLimit > 0 ? (totalUsageCurrent / totalUsageLimit * 100) : 0

      // 尝试图片渲染
      const html = buildHtml(instance.name, stats, accounts, totalUsageCurrent, totalUsageLimit, totalUsagePercent)

      try {
        const puppeteer = (await import('../../lib/puppeteer/puppeteer.js')).default
        const browser = await puppeteer.browserInit()
        const page = await browser.newPage()
        await page.setViewport({ width: 500, height: 800 })
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const body = await page.$('body')
        const box = await body.boundingBox()
        const img = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: box.width, height: box.height }
        })
        await page.close()
        await e.reply(segment.image(img))
      } catch (renderErr) {
        await e.reply(buildText(instance.name, stats, accounts, totalUsageCurrent, totalUsageLimit, totalUsagePercent))
      }
    } catch (err) {
      await e.reply(`❌ [${instance.name}] 查询失败: ${err.message}`)
    }
  }
}

/** 文本回退 */
function buildText(name, stats, accounts, usageCurrent, usageLimit, usagePercent) {
  const uptime = formatUptime(stats.uptime)
  const bar = makeTextBar(usagePercent)

  let msg = `🚀 ${name} 运行状态\n`
  msg += `━━━━━━━━━━━━━━━━━━\n`
  msg += `⏱️ 运行时间: ${uptime}\n`
  msg += `📊 总请求数: ${stats.totalRequests ?? 0}\n`
  msg += `✅ 成功请求: ${stats.successRequests ?? 0}\n`
  msg += `❌ 失败请求: ${stats.failedRequests ?? 0}\n`
  msg += `🔤 总Tokens: ${formatNumber(stats.totalTokens ?? 0)}\n`
  msg += `💰 总Credits: ${formatNumber(stats.totalCredits ?? 0)}\n`
  msg += `━━━━━━━━━━━━━━━━━━\n`
  msg += `📦 主配额: ${usageCurrent}/${usageLimit} (${usagePercent.toFixed(1)}%)\n`
  msg += `${bar}\n`
  msg += `━━━━━━━━━━━━━━━━━━\n`
  msg += `👥 账号列表 (${accounts.length}):\n`

  for (const acc of accounts) {
    const email = maskEmail(acc.email)
    const status = acc.enabled ? '🟢' : '🔴'
    const sub = acc.subscriptionTitle || acc.subscriptionType || '未知'
    const pct = acc.usagePercent != null ? (acc.usagePercent * 100).toFixed(1) : '0'
    msg += `\n${status} ${email} [${sub}]\n`
    msg += `   📈 用量: ${pct}% (${acc.usageCurrent ?? 0}/${acc.usageLimit ?? 0})\n`
    msg += `   🔢 请求: ${acc.requestCount ?? 0} | 🔤 ${formatNumber(acc.totalTokens ?? 0)}\n`
  }
  return msg.trim()
}

function makeTextBar(percent, len = 20) {
  const filled = Math.round(percent / 100 * len)
  return '▓'.repeat(filled) + '░'.repeat(len - filled)
}

/** 图片 HTML */
function buildHtml(name, stats, accounts, usageCurrent, usageLimit, usagePercent) {
  const uptime = formatUptime(stats.uptime)
  const progressColor = usagePercent > 80 ? '#ef4444' : usagePercent > 50 ? '#f59e0b' : '#10b981'

  let accountsHtml = ''
  for (const acc of accounts) {
    const email = maskEmail(acc.email)
    const status = acc.enabled ? '🟢' : '🔴'
    const sub = acc.subscriptionTitle || acc.subscriptionType || '未知'
    const pct = acc.usagePercent != null ? (acc.usagePercent * 100).toFixed(1) : '0'
    const accColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981'

    accountsHtml += `
      <div class="account-card">
        <div class="acc-header">
          <span class="acc-status">${status}</span>
          <span class="acc-email">${email}</span>
          <span class="acc-sub">${sub}</span>
        </div>
        <div class="acc-progress-wrap">
          <div class="acc-progress-bar" style="width:${Math.min(pct, 100)}%;background:${accColor}"></div>
        </div>
        <div class="acc-details">
          <span>📈 用量: ${pct}% (${acc.usageCurrent ?? 0}/${acc.usageLimit ?? 0})</span>
          <span>🔢 请求: ${acc.requestCount ?? 0}</span>
          <span>🔤 ${formatNumber(acc.totalTokens ?? 0)} tokens</span>
          ${acc.region ? `<span>🌍 ${acc.region}</span>` : ''}
        </div>
      </div>`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e0e0e0;
  padding: 20px;
  width: 500px;
}
.container {
  background: rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
}
.title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 20px;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.stat-item {
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.stat-value { font-size: 20px; font-weight: 700; color: #fff; }
.stat-label { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.quota-section {
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}
.quota-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
.quota-label { color: #9ca3af; }
.quota-value { color: #fff; font-weight: 600; }
.progress-wrap {
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  height: 20px;
  overflow: hidden;
  position: relative;
}
.progress-bar { height: 100%; border-radius: 8px; }
.progress-text {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px; font-weight: 600; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #a78bfa; }
.account-card {
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(255,255,255,0.06);
}
.acc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.acc-email { font-size: 14px; font-weight: 500; color: #e0e0e0; }
.acc-sub {
  margin-left: auto; font-size: 11px;
  background: rgba(167,139,250,0.2); color: #a78bfa;
  padding: 2px 8px; border-radius: 4px;
}
.acc-progress-wrap {
  background: rgba(255,255,255,0.1);
  border-radius: 4px; height: 6px;
  overflow: hidden; margin-bottom: 8px;
}
.acc-progress-bar { height: 100%; border-radius: 4px; }
.acc-details { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: #9ca3af; }
.footer { text-align: center; font-size: 11px; color: #6b7280; margin-top: 16px; }
</style>
</head>
<body>
<div class="container">
  <div class="title">🚀 ${name} 运行状态</div>
  <div class="stats-grid">
    <div class="stat-item"><div class="stat-value">${stats.totalRequests ?? 0}</div><div class="stat-label">📊 总请求</div></div>
    <div class="stat-item"><div class="stat-value" style="color:#10b981">${stats.successRequests ?? 0}</div><div class="stat-label">✅ 成功</div></div>
    <div class="stat-item"><div class="stat-value" style="color:#ef4444">${stats.failedRequests ?? 0}</div><div class="stat-label">❌ 失败</div></div>
    <div class="stat-item"><div class="stat-value">${uptime}</div><div class="stat-label">⏱️ 运行时间</div></div>
  </div>
  <div class="stats-grid">
    <div class="stat-item"><div class="stat-value">${formatNumber(stats.totalTokens ?? 0)}</div><div class="stat-label">🔤 总 Tokens</div></div>
    <div class="stat-item"><div class="stat-value">${formatNumber(stats.totalCredits ?? 0)}</div><div class="stat-label">💰 总 Credits</div></div>
  </div>
  <div class="quota-section">
    <div class="quota-header"><span class="quota-label">📦 主配额</span><span class="quota-value">${usageCurrent} / ${usageLimit}</span></div>
    <div class="progress-wrap">
      <div class="progress-bar" style="width:${Math.min(usagePercent, 100)}%;background:${progressColor}"></div>
      <div class="progress-text">${usagePercent.toFixed(1)}%</div>
    </div>
  </div>
  <div class="section-title">👥 账号列表 (${accounts.length})</div>
  ${accountsHtml}
  <div class="footer">${name} · 数据实时查询</div>
</div>
</body>
</html>`
}

function maskEmail(email) {
  if (!email) return '***'
  const [local, domain] = email.split('@')
  if (!domain) return email.slice(0, 3) + '***'
  return `${local.slice(0, 3)}***@${domain}`
}

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

function formatNumber(num) {
  if (typeof num !== 'number') num = Number(num) || 0
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toFixed(1)
}
