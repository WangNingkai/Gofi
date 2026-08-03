# 构建与发布流程

Gofi 明确区分“Git Release tag”和“程序版本”。Release tag 必须以小写 `v` 开头；程序界面、API、部署包和 Docker 镜像使用去掉 `v` 后的版本号。Git tag 只是代码引用，不能单独代表一个已发布版本。

| 用途 | 示例 |
| --- | --- |
| GitHub Release tag | `v1.2.3` |
| Gofi 程序版本 | `1.2.3` |
| 部署包 | `gofi-1.2.3-linux-amd64.tar.gz` |
| Docker 镜像 | `owner/gofi:1.2.3` |

## 每次推送：测试构建

`.github/workflows/ci.yml` 在每次 push、Pull Request 和手动运行时执行：

1. 运行 Go vet、race 测试、前端 lint、类型检查、测试和生产构建。
2. 在原生 `linux/amd64` 与 `linux/arm64` Runner 上构建生产二进制。
3. 对二进制执行初始化、登录、上传、列表刷新、预览、删除和缓存冒烟检查。
4. 生成可直接部署的 `tar.gz` 测试包及外部 SHA-256 文件。
5. 在 Actions 运行的 Artifacts 区域保留测试包 14 天。

测试版本号为 `test-<12 位提交 SHA>`。快速连续 push 不会取消较早提交的构建，因此每个成功提交都有独立测试包。推送 tag 也只执行这条测试流程。

测试包包含：

- `gofi`：已经嵌入前端资源的单文件可执行程序。
- `INSTALL.txt`：最小部署步骤。
- `SHA256SUMS`：包内二进制校验值。
- `LICENSE`、`README.md`、`README.zh-CN.md`。

下载路径：GitHub 仓库 → Actions → `CI and test packages` → 对应运行 → Artifacts。GitHub 要求下载者登录并拥有仓库读取权限。

## 本地生成同类部署包

```bash
make package
make smoke
```

压缩包及其 SHA-256 文件生成在 `output/`。

## 正式发布：只能发布 GitHub Release

`.github/workflows/release.yml` 只监听：

```yaml
on:
  release:
    types: [published]
```

正式流程不会监听 tag push，也不会替用户创建 GitHub Release。维护者必须在 GitHub Releases 页面选择已验收提交、填写以小写 `v` 开头的 `vX.Y.Z` 或 `vX.Y.Z-suffix` 标签和发布说明，然后点击发布。流水线校验 tag 后会剥离开头的 `v`，将剩余部分作为 Gofi 程序版本。

GitHub Release 发布后，流水线会：

1. 检出 Release 对应的准确 tag 并再次执行完整检查。
2. 构建、冒烟验证双架构正式部署包。
3. 使用不带 `v` 的程序版本构建并推送双架构 Docker 镜像与 manifest。
4. 仅在非预发布 Release 中更新 Docker `latest`。
5. 确认 GitHub Release 已存在，再把部署包和校验文件附加到该 Release。

正式流水线不会调用创建 Release 的 API。单独推送 `v*` tag 只会产生测试 artifact，不会生成正式附件、正式 Docker manifest 或 `latest`。例如发布 `v1.2.3` 后，Gofi 显示 `1.2.3`，正式包名和 Docker tag 也都使用 `1.2.3`。
