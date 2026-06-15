# 怪兽派对 - 操作指南

## 项目简介

怪兽派对是一个基于 Electron 框架的桌面游戏应用。

## 环境要求

- Node.js 16+ 
- npm 或 pnpm 包管理器

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/zero0370/exe.git
cd exe
```

### 2. 安装依赖

```bash
npm install
```

### 3. 运行应用

```bash
npm start
```

或开发模式：

```bash
npm run dev
```

### 4. 构建安装包

```bash
npm run build
```

构建完成后，安装包将生成在 `dist-new` 目录下。

### 5. 一键推送代码

```bash
npm run push
```

或自定义提交信息：

```bash
git add .
git commit -m "你的提交信息"
git push origin main
```

## 项目结构

```
.
├── electron/              # Electron 主进程代码
│   ├── main/             # 主进程
│   └── preload/          # 预加载脚本
├── public/               # 前端静态资源
│   ├── assets/          # 游戏资源
│   ├── src/             # 源代码
│   └── utils/           # 工具函数
├── resources/            # 应用资源（图标等）
├── build/               # 构建脚本
└── package.json         # 项目配置
```

## 构建配置说明

- **应用名称**: 怪兽派对
- **应用 ID**: com.monster.party
- **图标**: resources/怪兽派对_icon.png
- **输出目录**: dist-new
- **安装方式**: NSIS 安装程序（支持自定义安装目录）

## 常见问题

### 构建失败

1. 确保已安装所有依赖：`npm install`
2. 清除缓存后重试：删除 `node_modules` 和 `package-lock.json`，然后重新安装

### 应用无法启动

1. 检查 Node.js 版本是否符合要求
2. 查看控制台输出获取详细错误信息

## 更新日志

- **v6.1.7** - 当前版本
