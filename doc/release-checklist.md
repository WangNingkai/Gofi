# 发布检查清单

本清单只适用于正式版本。单独创建或推送 Git tag 不构成发布，也不会启动正式发布流水线。

## 发布前

- [ ] 目标提交的 `CI and test packages` workflow 已通过。
- [ ] linux/amd64 与 linux/arm64 测试部署包可以从该次 Actions 运行下载。
- [ ] 至少一个测试部署包已经在干净目录完成启动和核心功能验收。
- [ ] 数据库旧版本升级、bcrypt 迁移、JWT 密钥持久化和会话撤销测试通过。
- [ ] 路径、权限、上传和索引边界测试通过。
- [ ] README、配置、FAQ、升级与回滚文档和实际行为一致。
- [ ] 发布说明列出数据迁移、已知限制和回滚方式。
- [ ] Docker Hub 的 `DOCKER_USERNAME`、`DOCKER_ACCESS_TOKEN` secrets 可用。

## 创建正式发布

- [ ] 在 GitHub Releases 页面创建 Release，而不是只推送 tag。
- [ ] Release tag 使用 `vX.Y.Z` 或 `vX.Y.Z-suffix` 格式，并指向已验收提交。
- [ ] 预发布版本已勾选 Pre-release；只有稳定 Release 可以更新 Docker `latest`。
- [ ] 发布 Release，触发 `Publish GitHub Release` workflow。

## 发布后

- [ ] Release workflow 的完整检查通过。
- [ ] Release 附件包含 linux/amd64、linux/arm64 的 `tar.gz` 和外部 SHA-256 文件。
- [ ] 下载并验证附件中的 `SHA256SUMS`、`INSTALL.txt` 与 `gofi` 可执行文件。
- [ ] 版本对应的双架构 Docker manifest 可拉取并通过健康检查。
- [ ] 稳定版的 `latest` 已更新；预发布没有覆盖 `latest`。
- [ ] GitHub Release 页面、附件和容器镜像版本保持一致。

任何正式 job 失败都表示该 Release 未通过交付验收，应修复后重新发布或撤销该 Release，不能用已有 tag 冒充成功发布。
