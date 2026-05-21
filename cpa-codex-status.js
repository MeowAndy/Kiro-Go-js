/**
 * CPA Codex 凭证查询插件 v1.0.0
 * 适用于 TRSS-Yunzai / Miao-Yunzai
 *
 * 命令：
 *   #codex状态 / #codex查询      查询第 1 个 CPA Usage Keeper 实例
 *   #codex状态2 / #codex查询2    查询第 2 个实例
 *
 * 数据来源：CPA Usage Keeper
 * 项目：https://github.com/Willxup/cpa-usage-keeper
 *
 * 说明：
 * - 展示布局参考 CPA Usage Keeper 的「凭证 / Auth Files」区块。
 * - 不要把真实密码提交到公开仓库；部署时请在服务器本地修改配置。
 */

// ============ 配置项（部署时改这里） ============
const CPA_KEEPER_INSTANCES = [
  {
    name: 'CPA-Codex',
    // CPA Usage Keeper 地址，例如：http://216.22.13.155:8091
    url: 'http://127.0.0.1:8091',
    // Keeper 登录密码；如果 Keeper 未开启 AUTH_ENABLED，可留空
    password: 'your-cpa-usage-keeper-password',
    // 每次最多展示多少个 Codex 凭证
    pageSize: 30,
    // 是否只显示启用/活跃凭证
    activeOnly: true
  }
]
// ==============================================

export class CpaCodexStatus extends plugin {
  constructor() {
    super({
      name: 'CPA-Codex凭证查询',
      dsc: '查询 CPA Usage Keeper 中 Codex 账号请求量、Token、成功率、缓存率与 5h/Weekly 剩余额度',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: /^#?codex(状态|查询)(\d*)$/i,
          fnc: 'queryCodexStatus'
        }
      ]
    })
  }

  async queryCodexStatus(e) {
    const match = e.msg.match(/^#?codex(?:状态|查询)(\d*)$/i)
    const idx = match?.[1] ? Number.parseInt(match[1], 10) - 1 : 0

    if (!Number.isInteger(idx) || idx < 0 || idx >= CPA_KEEPER_INSTANCES.length) {
      await e.reply(`❌ 实例 #${idx + 1} 不存在，当前共 ${CPA_KEEPER_INSTANCES.length} 个实例`)
      return
    }

    const instance = normalizeInstance(CPA_KEEPER_INSTANCES[idx])
    if (!instance.url) {
      await e.reply('❌ CPA Usage Keeper 地址未配置')
      return
    }

    try {
      const client = new KeeperClient(instance.url, instance.password)
      await client.loginIfNeeded()

      const identities = await client.fetchCodexIdentities(instance.pageSize, instance.activeOnly)
      if (identities.length === 0) {
        await e.reply(`📭 [${instance.name}] 暂无 Codex 凭证数据\n请确认 CPA 已开启 usage-statistics-enabled，并且已有 Codex 请求进入。`)
        return
      }

      const quotaMap = await client.fetchQuotaCache(identities.map((item) => item.identity).filter(Boolean))
      const rows = buildRows(identities, quotaMap)
      const summary = buildSummary(rows)
      const html = buildHtml(instance.name, rows, summary)

      try {
        const img = await renderHtmlToImage(html, rows.length)
        await e.reply(segment.image(img))
      } catch (renderErr) {
        logger?.warn?.(`[CPA-Codex] 图片渲染失败，降级文本：${renderErr?.message || renderErr}`)
        await e.reply(buildText(instance.name, rows, summary))
      }
    } catch (err) {
      await e.reply(`❌ [${instance.name}] 查询失败：${err.message || err}`)
    }
  }
}

class KeeperClient {
  constructor(baseUrl, password = '') {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '')
    this.password = password || ''
    this.cookie = ''
  }

  async loginIfNeeded() {
    // 未配置密码时，直接尝试访问；适配 AUTH_ENABLED=false 的场景。
    if (!this.password) return

    const res = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: this.password })
    })

    if (!res.ok) {
      const text = await safeText(res)
      throw new Error(`登录 Keeper 失败 HTTP ${res.status}${text ? `：${text}` : ''}`)
    }

    const setCookie = getSetCookieHeader(res)
    if (setCookie) {
      this.cookie = setCookie
        .map((item) => String(item).split(';')[0])
        .filter(Boolean)
        .join('; ')
    }
  }

  async fetchJson(path, options = {}) {
    const headers = { ...(options.headers || {}) }
    if (this.cookie) headers.Cookie = this.cookie
    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers })
    if (!res.ok) {
      const text = await safeText(res)
      throw new Error(`${path} HTTP ${res.status}${text ? `：${text}` : ''}`)
    }
    return res.json()
  }

  async fetchCodexIdentities(pageSize = 30, activeOnly = true) {
    const params = new URLSearchParams()
    params.set('auth_type', '1')
    params.set('page', '1')
    params.set('page_size', String(pageSize))
    params.set('sort', 'priority')
    if (activeOnly) params.set('active_only', 'true')

    const data = await this.fetchJson(`/api/v1/usage/identities/page?${params.toString()}`)
    const identities = Array.isArray(data.identities) ? data.identities : []
    return identities.filter((item) => {
      const haystack = `${item.type || ''} ${item.provider || ''} ${item.auth_type_name || ''}`.toLowerCase()
      return haystack.includes('codex')
    })
  }

  async fetchQuotaCache(authIndexes) {
    if (!authIndexes.length) return new Map()
    const data = await this.fetchJson('/api/v1/quota/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_indexes: authIndexes })
    })
    const map = new Map()
    for (const item of data.items || []) {
      map.set(item.id, Array.isArray(item.quota) ? item.quota : [])
    }
    return map
  }
}

function buildRows(identities, quotaMap) {
  return identities.map((identity) => {
    const quota = quotaMap.get(identity.identity) || []
    const primaryQuota = pickQuota(quota, '5h')
    const weeklyQuota = pickQuota(quota, 'weekly')
    const successRate = rate(identity.success_count, identity.total_requests)
    const cacheRate = rate(identity.cached_tokens, identity.input_tokens)
    const totalTokens = number(identity.total_tokens)
    const plan = identity.plan_type || primaryQuota?.planType || weeklyQuota?.planType || 'unknown'

    return {
      identity,
      email: identity.displayName || identity.name || identity.identity || 'unknown',
      authType: identity.auth_type_name || 'oauth',
      type: identity.type || identity.provider || 'codex',
      plan,
      disabled: Boolean(identity.disabled || identity.is_deleted),
      totalRequests: number(identity.total_requests),
      successCount: number(identity.success_count),
      failureCount: number(identity.failure_count),
      successRate,
      inputTokens: number(identity.input_tokens),
      outputTokens: number(identity.output_tokens),
      cachedTokens: number(identity.cached_tokens),
      totalTokens,
      cacheRate,
      activeUntil: identity.active_until,
      lastUsedAt: identity.last_used_at,
      primaryQuota: toDisplayQuota(primaryQuota, '5h'),
      weeklyQuota: toDisplayQuota(weeklyQuota, 'Weekly')
    }
  })
}

function buildSummary(rows) {
  const totalRequests = rows.reduce((sum, row) => sum + row.totalRequests, 0)
  const successCount = rows.reduce((sum, row) => sum + row.successCount, 0)
  const failureCount = rows.reduce((sum, row) => sum + row.failureCount, 0)
  const totalTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0)
  const cachedTokens = rows.reduce((sum, row) => sum + row.cachedTokens, 0)
  const inputTokens = rows.reduce((sum, row) => sum + row.inputTokens, 0)
  return {
    count: rows.length,
    totalRequests,
    successCount,
    failureCount,
    totalTokens,
    successRate: rate(successCount, totalRequests),
    cacheRate: rate(cachedTokens, inputTokens)
  }
}

function pickQuota(quotaList, kind) {
  const lowerKind = kind.toLowerCase()
  return quotaList.find((quota) => {
    const label = `${quota.label || ''} ${quota.key || ''}`.toLowerCase()
    const seconds = quota.window?.seconds
    if (lowerKind === '5h') return seconds === 18000 || label.includes('5h') || label.includes('primary')
    if (lowerKind === 'weekly') return seconds === 604800 || label.includes('weekly') || label.includes('secondary')
    return label.includes(lowerKind)
  })
}

function toDisplayQuota(quota, fallbackLabel) {
  if (!quota) return null
  const usedPercent = clamp(number(quota.usedPercent), 0, 100)
  const remainingPercent = clamp(100 - usedPercent, 0, 100)
  return {
    label: quota.label || fallbackLabel,
    usedPercent,
    remainingPercent,
    resetAt: quota.resetAt || '',
    resetAfterSeconds: quota.resetAfterSeconds,
    allowed: quota.allowed !== false,
    limitReached: Boolean(quota.limitReached),
    status: quota.limitReached || remainingPercent <= 5 ? 'danger' : remainingPercent <= 20 ? 'warning' : 'good'
  }
}

async function renderHtmlToImage(html, rowCount) {
  const puppeteer = (await import('../../lib/puppeteer/puppeteer.js')).default
  const browser = await puppeteer.browserInit()
  const page = await browser.newPage()
  await page.setViewport({ width: 1180, height: Math.min(1800, 132 + rowCount * 88), deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const body = await page.$('body')
  const box = await body.boundingBox()
  const img = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) }
  })
  await page.close()
  return img
}

function buildText(name, rows, summary) {
  let msg = `📊 ${name} Codex 凭证\n`
  msg += `━━━━━━━━━━━━━━━━━━\n`
  msg += `账号：${summary.count}｜请求：${summary.totalRequests}｜成功率：${percent(summary.successRate)}｜Tokens：${formatNumber(summary.totalTokens)}｜缓存率：${percent(summary.cacheRate)}\n`
  for (const row of rows.slice(0, 20)) {
    msg += `\n${row.disabled ? '🔴' : '🟢'} ${row.email} [${row.authType}/${row.plan}]\n`
    msg += `请求 ${row.totalRequests}（${row.successCount}/${row.failureCount}）｜成功率 ${percent(row.successRate)}｜Tokens ${formatNumber(row.totalTokens)}｜缓存 ${percent(row.cacheRate)}\n`
    msg += `5h ${quotaText(row.primaryQuota)}｜Weekly ${quotaText(row.weeklyQuota)}\n`
  }
  return msg.trim()
}

function buildHtml(name, rows, summary) {
  const rowHtml = rows.map((row) => buildCredentialRow(row)).join('')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
*{box-sizing:border-box}body{margin:0;width:1180px;background:#f6f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}.page{padding:18px}.card{background:#fff;border:1px solid #e8ebf2;border-radius:18px;box-shadow:0 16px 38px rgba(28,37,54,.08);overflow:hidden}.header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eef1f6;background:linear-gradient(180deg,#fff,#fbfcff)}.title{display:flex;flex-direction:column;gap:5px}.eyebrow{font-size:12px;font-weight:700;color:#6d7b91;letter-spacing:.08em;text-transform:uppercase}.title h1{font-size:22px;line-height:1;margin:0;color:#111827}.summary{display:grid;grid-template-columns:repeat(5,max-content);gap:10px}.summary-pill,.metric{min-width:100px;padding:9px 12px;border:1px solid #e8ebf2;border-radius:12px;background:#fff;box-shadow:0 8px 18px rgba(20,30,48,.04)}.summary-pill .label,.metric .label{font-size:11px;color:#8a95a7;margin-bottom:4px}.summary-pill .value,.metric .value{font-size:15px;font-weight:800;color:#111827}.value.good{color:#159447}.value.warn{color:#d08700}.value.danger{color:#dc2626}.rows{display:flex;flex-direction:column}.row{display:grid;grid-template-columns:minmax(210px,270px) minmax(398px,max-content) minmax(420px,1fr) 28px;align-items:center;gap:16px;padding:16px 18px;border-bottom:1px solid #eef1f6;background:#fff}.row:last-child{border-bottom:none}.identity{min-width:0}.email{font-size:14px;font-weight:800;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;border:1px solid #e3e8f1;background:#f8fafc;color:#617084}.badge.blue{background:#eef4ff;color:#3b63c7;border-color:#dbe6ff}.badge.green{background:#ecfdf3;color:#16803d;border-color:#ccefd7}.badge.red{background:#fff1f2;color:#be123c;border-color:#ffd5dc}.metrics{display:grid;grid-template-columns:repeat(4,94px);gap:8px}.quota-side{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center}.quota{min-width:0}.quota-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px}.quota-label{font-weight:800;color:#374151}.quota-remain{font-weight:800;color:#111827}.track{height:8px;border-radius:999px;background:#e8edf4;overflow:hidden}.fill{height:100%;border-radius:999px;background:#16a34a}.fill.warning{background:#e0aa14}.fill.danger{background:#e5484d}.quota-meta{height:18px;margin-top:5px;text-align:center;font-size:11px;color:#7b8495;white-space:nowrap}.refresh{display:flex;align-items:center;justify-content:center;color:#a0a8b8;font-size:18px}.footer{padding:12px 22px;background:#fbfcff;color:#8a95a7;font-size:12px;text-align:right}.muted{color:#8a95a7}.empty{padding:34px;text-align:center;color:#8a95a7}.mono{font-variant-numeric:tabular-nums}
</style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="title"><span class="eyebrow">CPA Usage Keeper · Credentials</span><h1>${escapeHtml(name)} Codex 凭证</h1></div>
        <div class="summary">
          <div class="summary-pill"><div class="label">凭证数</div><div class="value mono">${summary.count}</div></div>
          <div class="summary-pill"><div class="label">请求总量</div><div class="value mono">${formatNumber(summary.totalRequests)}</div></div>
          <div class="summary-pill"><div class="label">成功率</div><div class="value good mono">${percent(summary.successRate)}</div></div>
          <div class="summary-pill"><div class="label">TOKEN 总量</div><div class="value mono">${formatNumber(summary.totalTokens)}</div></div>
          <div class="summary-pill"><div class="label">缓存率</div><div class="value good mono">${percent(summary.cacheRate)}</div></div>
        </div>
      </div>
      <div class="rows">${rowHtml || '<div class="empty">暂无 Codex 凭证</div>'}</div>
      <div class="footer">数据来自 CPA Usage Keeper · ${formatDateTime(new Date())}</div>
    </div>
  </div>
</body>
</html>`
}

function buildCredentialRow(row) {
  const successTone = toneByPercent(row.successRate, true)
  const cacheTone = toneByPercent(row.cacheRate, true)
  return `<div class="row">
    <div class="identity">
      <div class="email">${escapeHtml(row.email)}</div>
      <div class="badges">
        <span class="badge blue">${escapeHtml(row.type)}</span>
        <span class="badge ${planClass(row.plan)}">${escapeHtml(row.plan)}</span>
        ${row.disabled ? '<span class="badge red">disabled</span>' : ''}
        ${row.activeUntil ? `<span class="badge">${escapeHtml(daysLeft(row.activeUntil))}</span>` : ''}
      </div>
    </div>
    <div class="metrics">
      <div class="metric"><div class="label">请求总量</div><div class="value mono">${formatNumber(row.totalRequests)} <span class="muted">(${formatNumber(row.successCount)}/${formatNumber(row.failureCount)})</span></div></div>
      <div class="metric"><div class="label">成功率</div><div class="value ${successTone} mono">${percent(row.successRate)}</div></div>
      <div class="metric"><div class="label">TOKEN 总量</div><div class="value mono">${formatNumber(row.totalTokens)}</div></div>
      <div class="metric"><div class="label">缓存率</div><div class="value ${cacheTone} mono">${percent(row.cacheRate)}</div></div>
    </div>
    <div class="quota-side">
      ${buildQuotaBar(row.primaryQuota, '5h')}
      ${buildQuotaBar(row.weeklyQuota, 'Weekly')}
    </div>
    <div class="refresh">⟳</div>
  </div>`
}

function buildQuotaBar(quota, label) {
  if (!quota) {
    return `<div class="quota"><div class="quota-head"><span class="quota-label">${label}</span><span class="quota-remain muted">无缓存</span></div><div class="track"><div class="fill warning" style="width:0%"></div></div><div class="quota-meta">点击 Keeper 刷新限额后显示</div></div>`
  }
  const remain = Math.round(quota.remainingPercent)
  const meta = quota.resetAt ? formatResetLabel(quota.resetAt) : ''
  return `<div class="quota"><div class="quota-head"><span class="quota-label">${escapeHtml(quota.label || label)}</span><span class="quota-remain mono">剩余 ${remain}%</span></div><div class="track"><div class="fill ${quota.status}" style="width:${remain}%"></div></div><div class="quota-meta">${escapeHtml(meta)}</div></div>`
}

function quotaText(quota) {
  if (!quota) return '无缓存'
  return `剩余 ${Math.round(quota.remainingPercent)}%${quota.resetAt ? `，${formatResetLabel(quota.resetAt)}` : ''}`
}

function normalizeInstance(instance) {
  return {
    name: instance.name || 'CPA-Codex',
    url: String(instance.url || '').replace(/\/+$/, ''),
    password: instance.password || '',
    pageSize: Math.max(1, Math.min(100, Number(instance.pageSize) || 30)),
    activeOnly: instance.activeOnly !== false
  }
}

function getSetCookieHeader(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie()
  const raw = res.headers.get('set-cookie')
  return raw ? [raw] : []
}

async function safeText(res) {
  try {
    const text = await res.text()
    return text.slice(0, 200)
  } catch {
    return ''
  }
}

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function rate(numerator, denominator) {
  const n = number(numerator)
  const d = number(denominator)
  return d > 0 ? (n / d) * 100 : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function percent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(2)}%`
}

function toneByPercent(value, highIsGood = true) {
  if (value === null || value === undefined) return ''
  const v = Number(value)
  if (highIsGood) return v >= 90 ? 'good' : v >= 70 ? 'warn' : 'danger'
  return v >= 80 ? 'danger' : v >= 50 ? 'warn' : 'good'
}

function formatNumber(value) {
  const n = number(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return String(Math.round(n))
}

function formatResetLabel(value) {
  const date = new Date(value)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) return ''
  const remainingMinutes = Math.max(0, Math.ceil((ms - Date.now()) / 60_000))
  const days = Math.floor(remainingMinutes / 1440)
  const hours = Math.floor((remainingMinutes % 1440) / 60)
  const minutes = remainingMinutes % 60
  const duration = days > 0 ? `${days}d${hours}h${minutes}m` : `${hours}h${minutes}m`
  return `${duration} (${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())})`
}

function daysLeft(value) {
  const date = new Date(value)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) return ''
  const days = Math.ceil((ms - Date.now()) / 86400000)
  if (days < 0) return '已过期'
  return `${days}d`
}

function formatDateTime(value) {
  return `${pad2(value.getMonth() + 1)}/${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function planClass(plan) {
  const p = String(plan || '').toLowerCase()
  if (p.includes('plus') || p.includes('pro')) return 'green'
  return ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
