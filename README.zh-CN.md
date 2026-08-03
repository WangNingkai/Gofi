# Gofi（重构中） &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> 重构进行中

[English](./README.md) | 简体中文

Gofi 是一款现代化、开源的 Web 文件索引与管理器，前后端全面重构，带来更强安全性、更佳体验和更易维护的架构。

## ✨ 重构分支亮点

- **现代化 UI/UX**：前端基于 React、Vite、Tailwind CSS、shadcn/ui 全新打造，界面统一、响应式、可访问性强。
- **设置页与文件列表重构**：设置页与文件列表页全面现代化，表单、工具栏、交互细节大幅优化。
- **工具栏与过滤**：文件列表工具栏支持图标化过滤、悬浮搜索、视图切换，风格统一。
- **国际化支持**：全局支持中英文切换，错误消息与界面均可本地化。
- **安全与鉴权**：使用 bcrypt、可撤销 JWT、集中路径隔离、访客权限和真实 HTTP 错误语义。
- **配置灵活可扩展**：所有核心配置均可通过环境变量设置，前后端模块化，易于二次开发。
- **性能优化**：减少冗余操作，优化数据库查询与日志，提升整体性能。
- **完整文件管理**：支持可恢复分片上传、新建目录、重命名、复制、移动和批量删除。
- **索引搜索**：基于 SQLite 的文件名、路径和小文本增量索引。

## 📦 项目结构

- `gofi-backend/` — Go 后端（API、鉴权、配置、国际化）
- `gofi-frontend/` — React 前端（UI、状态、路由、国际化）
- `preview/` — 截图与 Logo

## 🚀 快速开始

环境要求：Go 1.26.5、Node.js 24.14.1 LTS、pnpm 10.34.5、GNU Make 和 C 编译器。

### 安装依赖并启动

```bash
make install
make dev
```

### 检查与构建

```bash
make check
make build
make package
make smoke
```

访问：http://localhost:3000

正式 GitHub Release tag 必须使用 `vX.Y.Z`；Gofi 程序、部署包和 Docker 镜像使用去掉开头 `v` 的对应版本 `X.Y.Z`。

## 🛠️ 配置说明

后端通过环境变量配置，例如：
```bash
export GOFI_JWT_SECRET="至少三十二个字符的随机密钥"
export GOFI_JWT_EXPIRE_HOURS="168"
export GOFI_ALLOWED_ORIGINS="https://files.example.com"
export GOFI_ENABLE_DEBUG="false"
```

`GOFI_JWT_SECRET` 可以省略；应用会自动生成 `.gofi-jwt-secret`。该文件需要与数据库和存储目录一起持久化。首次初始化由用户自行设置管理员账号和至少 10 位的密码，不存在默认管理员凭据。

## 📄 文档

- [快速开始](./doc/quickstart.md)
- [配置说明](./doc/config.md)
- [常见问题](./doc/faq.md)
- [贡献指南](./doc/contributing.md)
- [升级、备份与恢复](./doc/upgrade.md)
- [安全部署检查](./doc/security.md)
- [构建与发布流程](./doc/release.md)

## 🖼️ 界面预览

![preview1](./preview/1.jpg)
![preview2](./preview/2.jpg)
![preview3](./preview/3.jpg)
![preview4](./preview/4.jpg)
![preview5](./preview/5.jpg)
![preview6](./preview/6.jpg)

## 📝 开源协议

[MIT](./LICENSE)
