# 贡献指南

欢迎参与 Gofi 的开发与改进。

## 开始之前

1. 阅读[功能现状矩阵](./feature-matrix.md)、[目标架构](./architecture.md)和[重构路线图](./roadmap.md)。
2. 确认改动属于当前活动里程碑，或先说明为什么需要调整优先级。
3. 不要在一个 Pull Request 中混入无关重构。

## 开发流程

```bash
make install
make dev
```

提交前必须执行：

```bash
make check
make package
make smoke
```

如果改动涉及 Dockerfile，还需要在 Docker daemon 可用的环境中执行：

```bash
docker build --tag gofi:local .
```

## Bug 报告

仓库使用 GitHub Issue 表单收集 Bug 和功能建议。提交前请先搜索现有 Issue，避免重复报告。

一个可执行的 Bug 报告应包含：

- 当前版本或提交。
- 操作系统和部署方式。
- 最小复现步骤。
- 预期行为和实际行为。
- 已去除 Token、密码、本地私有路径后的日志。

安全漏洞不要作为公开 Issue 提交。若仓库 Security 页面提供私密漏洞报告入口，请使用该入口；否则先联系维护者，不要公开利用细节。未经核实的调查结论不应提交为公共文档。

## Pull Request 要求

- 描述问题，而不只是描述修改内容。
- 为行为变化增加或更新测试。
- 明确列出手工验证步骤。
- 更新受影响的用户文档、功能矩阵或里程碑记录。
- 不提交 `node_modules`、构建产物、数据库、日志或 `.gofi-work/`。

所有新增的维护记录默认使用中文，现有面向国际用户的英文入口保持与中文说明的命令一致。

## 持续集成产物

每次 push 和 Pull Request 都会执行完整检查，并在成功后构建 linux/amd64 与 linux/arm64 测试部署包。可在对应 Actions 运行的 Artifacts 区域下载，测试包保留 14 天。

推送 Git tag 只会得到测试部署包，不代表正式发布。正式发布必须在 GitHub Releases 页面创建并发布 Release，具体流程见[构建与发布流程](./release.md)。

正式 Release tag 必须使用小写 `vX.Y.Z` 格式；Gofi 程序本身、部署包和 Docker 镜像使用不带 `v` 的 `X.Y.Z` 版本。
