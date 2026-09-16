# 更新现有 QA PR #155

本地分支为 `sprint2-qa`，目标分支为 `dev`，已有 [PR #155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155)。新的同分支提交会进入该 PR。9 月 16 日用户已要求准备并推送 QA 增量；本文保留可重复的提交步骤，实际 Git/CI 状态以对应提交和检查记录为准。

## 1. 审查差异与增量证据

从仓库根目录运行：

```sh
git branch --show-current
git status --short
git diff --check
git diff --stat
git diff -- frontend/app frontend/src backend/app
python3 -B scripts/check_sprint2_qa_traceability.py --verify-local-artifacts
```

最后一个脚本只核对记录和原始结果摘要的校验和，不重复业务测试。新 checkout 没有本地 ignored artifacts 时省略该参数，但不能声称原始证据已核验。业务源码差异应为空；另检查未跟踪文件，因为普通 `git diff` 不展示其内容。

[先前增量验证](reconciliation-results-20260916.md)、[推送准备校验](push-validation-20260916.json)与[历史自动结果](test-results-multiplatform.md)分别保留时间和作用域。修改 QA 工具后运行相应工具测试；文档整理和证据发布不重复全套 Jest/pytest/浏览器/模拟器。

决定发布时才 `git fetch origin`，检查实际远程分支与 PR 状态。不要沿用旧的 ahead/behind 数字，也不要认为本地 QA HEAD 等于最新 `origin/dev`。若业务代码基线改变，先安全整合，再依据影响范围选择测试；旧结果不能改名成新基线结果。

## 2. 精确暂存、提交

不要 `git add .`。现有未跟踪 `.idea/` 是 IDEA 本机设置，应保留在本地、排除出 QA 提交；不要删除它，也不要包含 `.env`、数据库、依赖、构建产物或含 token 的日志。

以下是 QA 候选路径；执行前核对所有文件，命令示例本身不是执行证明：

```sh
git add -- .github/workflows/app-ci.yml README.md \
  docs/sprint2/qa frontend/__tests__ frontend/e2e \
  frontend/package.json frontend/jest.config.js \
  frontend/jest.config.native.js frontend/jest.config.ios.js \
  frontend/jest.config.android.js frontend/jest.config.ios-defects.js \
  frontend/jest.config.android-defects.js \
  scripts/run_sprint2_qa.py scripts/package_sprint2_qa.py \
  scripts/check_sprint2_qa_traceability.py scripts/tests
git diff --cached --check
git diff --cached --name-only
git diff --cached --stat
git diff --cached
git commit -m "test(qa): reconcile Sprint 2 multi-platform evidence and issue scope"
```

若已有与本轮无关的 staged 改动，先让其保持独立，不要把它一起提交。精确核对新增文件；上述目录可能包含其他人的改动，不能仅凭路径认定都属于本轮。

## 3. 更新同一个 PR

审核完成后：

```sh
git push origin sprint2-qa
```

新提交会进入同源分支的 PR #155，不需要 `gh pr create`。只有经检查确定不存在可复用 PR，才另行决定创建。用 [pr-description.md](pr-description.md) 更新 PR 描述，使其与实际提交范围一致；这份文件本身不会发布评论或修改 GitHub。

确认 base 为 `dev`。保留待审查定位，使用 `Refs`，不要把本轮覆盖自动换成 `Closes`。推送不等于合并，也不修改 Issue 完成状态。

## 4. 验收与证据发布边界

既有缺陷仍可能使 CI 失败；这不等于 QA 没有提供证据，也不能通过删断言、跳过或反转期望来变绿。三端组件通过不等于完整三端实测；[剩余原生场景](native-acceptance-delta.md)均保留 NOT RUN。

完整原始工作目录仍位于 ignored artifacts。本次将经检查的 [16 September 结果](evidence/20260916-multiplatform/README.md) 复制到独立 evidence 目录，提交文件及 manifest 后随分支共享；省略项在 manifest 中说明。历史 `evidence/latest/` 保持不变。新 CI 会生成独立结果，不改写本地执行证据。

可选打包脚本会拒绝混有 `.idea/` 的工作树，这是其安全边界。不要为打包删除用户配置；如需打包，应使用明确审核过的独立 QA-only checkout。通过精确暂存可以正常提交 QA 文件并保留本地 IDE 配置。
