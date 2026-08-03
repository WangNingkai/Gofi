# 快速开始

## 环境要求

- Go 1.26.5
- Node.js 24.14.1 LTS
- pnpm 10.34.5
- GNU Make

仓库根目录的 `.go-version`、`.node-version` 和前端 `packageManager` 字段记录了当前工具版本。

## 安装依赖

在仓库根目录执行：

```bash
make install
```

该命令会按 `gofi-frontend/pnpm-lock.yaml` 安装前端依赖，并下载 `gofi-backend/go.sum` 锁定的 Go 模块。

## 启动开发环境

同时启动前后端：

```bash
make dev
```

也可以在两个终端分别执行：

```bash
make dev-backend
make dev-frontend
```

- 前端：http://localhost:3000
- 后端：http://localhost:8080

## 运行验证

```bash
make test
make check
```

`make check` 包含 Go 格式检查、`go vet`、race 测试、前端类型检查、前端测试和生产构建。

## 构建生产二进制

```bash
make build
make smoke
```

构建产物及 SHA-256 校验文件位于 `output/`。生产二进制已经嵌入前端资源。执行 `make package` 可以额外生成包含二进制、安装说明和校验文件的可部署 `tar.gz` 包。
后端使用纯 Go SQLite 驱动，构建不依赖 CGO 或本机 C 编译器。

## 构建 Docker 镜像

```bash
docker build --tag gofi:local .
docker run --rm -p 8080:8080 -v gofi-data:/app gofi:local
```

首次启动后访问 http://localhost:8080，自行设置管理员用户名和至少 10 位的密码。项目不提供默认管理员凭据。

`/app` 中包含数据库、文件、配置和自动生成的 JWT 签名密钥，必须整体持久化并备份。不要在容器重建时更换或丢失该数据卷。

## 清理生成物

```bash
make clean
```

升级现有实例前请先阅读[升级、备份与恢复](./upgrade.md)，公网部署同时核对[安全部署检查](./security.md)。
