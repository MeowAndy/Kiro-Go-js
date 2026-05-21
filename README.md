# Kiro-Go-js 🚀

Yunzai Bot 插件 —— 查询 [Kiro-Go](https://github.com/Quorinex/Kiro-Go) 管理面板的运行状态和账号信息。

## ✨ 功能

- 📊 查询 Kiro-Go 总请求数、成功数、失败数
- 🔤 查看总 Tokens 和 Credits 消耗
- 👥 列出所有账号及其用量
- 🧩 支持多个 Kiro-Go 实例：`#kiro状态1`、`#kiro状态2`

## 📦 安装

将 `kiro-go-status.js` 放入 Yunzai 的 `plugins/example/` 目录即可。

```bash
# 在 Yunzai 根目录执行
wget -O plugins/example/kiro-go-status.js https://raw.githubusercontent.com/MeowAndy/Kiro-Go-js/main/kiro-go-status.js
```

## ⚙️ 配置

编辑 `kiro-go-status.js` 顶部的配置项：

```javascript
const KIRO_INSTANCES = [
  {
    name: 'Kiro-1',
    url: 'http://127.0.0.1:8080',
    password: 'your-password-1'
  }
]
```

## 🎮 使用

| 命令 | 说明 |
|------|------|
| `#kiro状态` / `#kiro查询` | 查询第 1 个 Kiro-Go 实例 |
| `#kiro状态2` / `#kiro查询2` | 查询第 2 个 Kiro-Go 实例 |

## 📸 效果示例

```text
🚀 Kiro-Go 运行状态
━━━━━━━━━━━━━━━━━━
⏱️ 运行时间: 5时38分
📊 总请求数: 609
✅ 成功请求: 453
❌ 失败请求: 156
🔤 总Tokens: 30.3M
💰 总Credits: 281.9
👥 账号数量: 1
━━━━━━━━━━━━━━━━━━
📋 账号列表:

🟢 sca***@gmail.com
   📦 KIRO PRO | 📈 用量: 43.1%
   🔢 请求: 453 | 🔤 30.3M | 🌍 us-east-1
```

## 📝 说明

- 适用于 TRSS-Yunzai / Miao-Yunzai
- 需要 Kiro-Go v1.0.6+
- 认证方式：`X-Admin-Password` header

## 📄 License

MIT
