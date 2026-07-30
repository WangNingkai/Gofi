# 配置说明

Gofi 通过环境变量读取运行配置，也会自动读取当前工作目录中的 `.env` 文件。显式环境变量优先于 `.env`。

## 环境变量

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `GOFI_JWT_SECRET` | 无 | 可选的 JWT 签名密钥，设置时至少 32 个字符；未设置时由应用生成并持久化 |
| `GOFI_JWT_SECRET_FILE` | `./.gofi-jwt-secret` | 自动生成的 JWT 密钥文件路径，文件权限会收紧为 `0600` |
| `GOFI_JWT_EXPIRE_HOURS` | `720` | Token 有效时间，单位为小时 |
| `GOFI_ENABLE_RATE_LIMIT` | `true` | 是否启用 API 按来源 IP 限流 |
| `GOFI_MAX_REQUESTS_PER_MINUTE` | `100` | 每个来源 IP 的 API 请求上限；登录接口另限制为每分钟 5 次 |
| `GOFI_ALLOWED_ORIGINS` | 开发模式允许本机 `3000`、`5173` 端口；生产模式为空 | 允许跨域的完整 Origin，多个值使用英文逗号分隔 |
| `GOFI_TRUSTED_PROXIES` | 空 | 可信反向代理地址或网段，多个值使用英文逗号分隔 |
| `GOFI_LOG_LEVEL` | `info` | 日志级别 |
| `GOFI_ENABLE_DEBUG` | `false` | 是否启用详细请求日志；即使启用也不会记录请求体、密码、Token 或 Cookie |

示例：

```bash
export GOFI_JWT_SECRET="请替换为至少三十二个字符的随机密钥"
export GOFI_JWT_EXPIRE_HOURS="168"
export GOFI_ALLOWED_ORIGINS="https://files.example.com"
export GOFI_TRUSTED_PROXIES="10.0.0.0/8"
```

没有显式设置 `GOFI_JWT_SECRET` 时，Gofi 会在首次启动时安全生成密钥。该密钥必须与数据库和文件数据一同持久化；密钥丢失后，已有登录会话将全部失效。

## 命令行参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-port`、`-p` | `8080` | HTTP 服务监听端口 |

示例：

```bash
./gofi-linux-amd64-production -port 9000
```

## 数据目录

Gofi 默认在当前工作目录中创建：

- `gofi.db`：SQLite 配置、用户和权限数据。
- `.gofi-jwt-secret`：自动生成的 JWT 签名密钥。
- `storage/`：默认文件存储目录。
- `log/`：日志目录。

生产部署应挂载并备份整个工作目录。不要只持久化 `storage/`，否则会丢失账号、配置、权限或签名密钥。

## 首次初始化与密码

首次访问需要自行设置管理员用户名和密码，密码至少 10 个字符。项目不再提供公开已知的默认管理员凭据。

新密码使用 bcrypt 保存。已有数据库中的 MD5 密码仍可登录，并会在成功验证后自动升级为 bcrypt。修改密码或退出登录会提升会话版本，使此前签发的 Token 失效。

## 反向代理

只有明确列入 `GOFI_TRUSTED_PROXIES` 的代理才会影响客户端 IP 判断。通过反向代理对外提供服务时，同时配置实际访问站点的 `GOFI_ALLOWED_ORIGINS`，并由代理转发标准的 `Origin`、`Referer` 和 `X-Forwarded-*` 请求头。
