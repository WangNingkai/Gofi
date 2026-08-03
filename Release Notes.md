# Release notes

正式发布只由 GitHub Release 的 `published` 事件触发，commit message 和单独的 tag push 都不会发布版本。

## 版本规则

- GitHub Release tag 必须使用小写 `vX.Y.Z` 或 `vX.Y.Z-suffix`。
- Gofi 程序版本不包含 tag 开头的 `v`。
- 例如 Release tag `v1.2.3` 对应程序版本、部署包版本和 Docker tag `1.2.3`。

## 发布步骤

1. 推送已通过检查的提交，下载并验收 CI 生成的测试部署包。
2. 在 GitHub Releases 页面创建 Release，选择目标提交并填写符合规则的 tag。
3. 发布 Release，等待 `Publish GitHub Release` workflow 完成。
4. 核对 Release 附件、SHA-256、Docker manifest 与程序显示版本。

完整流程与检查项见 `doc/release.md` 和 `doc/release-checklist.md`。
