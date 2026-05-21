# Kiro-Go-js 🚀

Yunzai Bot 插件集合，用来查询 Kiro-Go / CPA Usage Keeper 的账号、用量与额度状态。

## ✨ 功能

### `kiro-go-status.js`

- 📊 查询 Kiro-Go 总请求数、成功数、失败数
- 🔤 查看总 Tokens 和 Credits 消耗
- 👥 列出所有账号及其用量
- 🧩 支持多个 Kiro-Go 实例：`#kiro状态1`、`#kiro状态2`

### `cpa-codex-status.js`

- 📋 查询 [CPA Usage Keeper](https://github.com/Willxup/cpa-usage-keeper) 里的 Codex 凭证
- 🎨 布局参考 CPA Usage Keeper 的「凭证 / Auth Files」区块
- 📈 展示每个 Codex 号：请求总量、成功率、Token 总量、缓存率
- 🟢 展示 Codex `5h` 与 `Weekly` 剩余额度进度条、刷新时间
- 🧩 支持多个 Keeper 实例：`#codex状态1`、`#codex状态2`
- 🖼️ 优先渲染成图片，失败时自动降级为文本

## 📦 安装

将 JS 文件放入 Yunzai 的 `plugins/example/` 目录即可。

```bash
# Kiro-Go 查询
wget -O plugins/example/kiro-go-status.js https://raw.githubusercontent.com/MeowAndy/Kiro-Go-js/main/kiro-go-status.js

# CPA Codex 凭证查询
wget -O plugins/example/cpa-codex-status.js https://raw.githubusercontent.com/MeowAndy/Kiro-Go-js/main/cpa-codex-status.js
```

## ⚙️ 配置

### Kiro-Go

编辑 `kiro-go-status.js` 顶部：

```javascript
const KIRO_INSTANCES = [
  {
    name: 'Kiro-1',
    url: 'http://127.0.0.1:8080',
    password: 'your-password-1'
  }
]
```

### CPA Codex

编辑 `cpa-codex-status.js` 顶部：

```javascript
const CPA_KEEPER_INSTANCES = [
  {
    name: 'CPA-Codex',
    url: 'http://127.0.0.1:8091',
    password: 'your-cpa-usage-keeper-password',
    pageSize: 30,
    activeOnly: true
  }
]
```

> 注意：不要把真实密码提交到公开仓库。部署到服务器后，在服务器本地修改密码即可。

## 🎮 使用

| 命令 | 说明 |
|------|------|
| `#kiro状态` / `#kiro查询` | 查询第 1 个 Kiro-Go 实例 |
| `#kiro状态2` / `#kiro查询2` | 查询第 2 个 Kiro-Go 实例 |
| `#codex状态` / `#codex查询` | 查询第 1 个 CPA Usage Keeper 的 Codex 凭证 |
| `#codex状态2` / `#codex查询2` | 查询第 2 个 CPA Usage Keeper 的 Codex 凭证 |

## 📸 文本回退示例

```text
📊 CPA-Codex Codex 凭证
━━━━━━━━━━━━━━━━━━
账号：13｜请求：922｜成功率：96.53%｜Tokens：78.14M｜缓存率：85.62%

🟢 hajimi7@teamplusdev.site [oauth/plus]
请求 922（890/32）｜成功率 96.53%｜Tokens 78.14M｜缓存 85.62%
5h 剩余 99%，4h47m (05/22 03:07)｜Weekly 剩余 100%，6d1h21m (05/27 22:41)
```

## 📝 说明

- 适用于 TRSS-Yunzai / Miao-Yunzai
- `kiro-go-status.js` 需要 Kiro-Go 管理接口
- `cpa-codex-status.js` 需要 CPA Usage Keeper，并建议 CPA 开启：`usage-statistics-enabled: true`
- `cpa-codex-status.js` 读取 Keeper 的：
  - `/api/v1/auth/login`
  - `/api/v1/usage/identities/page`
  - `/api/v1/quota/cache`

## 📄 License

MIT
