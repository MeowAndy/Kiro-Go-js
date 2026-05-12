# Kiro-Go-js 🚀

Yunzai Bot 插件 —— 查询 [Kiro-Go](https://github.com/Quorinex/Kiro-Go) 管理面板的运行状态和账号信息。

## ✨ 功能

- 📊 查询 Kiro-Go 总请求数、成功数、失败数
- 🔤 查看总 Tokens 和 Credits 消耗
- 👥 列出所有账号（脱敏显示）及其用量

## 📦 安装

将 `kiro-go-status.js` 放入 Yunzai 的 `plugins/example/` 目录即可。

```bash
# 在 Yunzai 根目录执行
wget -O plugins/example/kiro-go-status.js https://raw.githubusercontent.com/MeowAndy/Kiro-Go-js/main/kiro-go-status.js
```

## ⚙️ 配置

编辑 `kiro-go-status.js` 顶部的配置项：

```javascript
const KIRO_BASE_URL = 'http://127.0.0.1:8080'      // Kiro-Go 地址
const KIRO_ADMIN_PASSWORD = 'your-admin-password'   // 管理面板密码
```

## 🎮 使用

| 命令 | 说明 |
|------|------|
| `#kiro状态` | 查询运行状态和账号列表 |
| `#kiro查询` | 同上 |

## 📸 效果示例

```
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
