# 如何通过 PR 提交这份 QA 改动

测试完成时，QA 改动保留在本地 `sprint2-qa`，尚未提交。用户随后已授权 commit 并 push 同名分支；目标 PR 分支是 `dev`，PR 创建仍是后续步骤。业务源码保持不变；当前失败是可复现的产品缺陷，详见 [测试结果](test-results.md)。

## 1. 先检查本地内容

在仓库根目录执行：

```sh
git branch --show-current
git status --short
git diff --check
git diff --stat
git diff -- frontend/app frontend/src backend/app
```

分支应为 `sprint2-qa`；最后一条应没有业务源码差异。`git diff` 不显示未跟踪文件的正文，也要查看 `docs/sprint2/qa/`、新增测试和脚本。

提交前重新 `git fetch origin`，用 `git rev-list --left-right --count HEAD...origin/dev` 核对基线。本次验证时是 `0 0`。若 `dev` 又有新提交，先保存/提交本地 QA，再合入最新 `origin/dev` 并按新代码重新验证和更新证据；不要把旧基线测试称为新代码测试。

## 2. 暂存和 commit（首次提交步骤）

以下保留首次提交命令供核对。若分支已经 push，直接进入第 3 节创建 PR；不要重复提交相同内容：

```sh
git add -- .github/workflows/app-ci.yml .gitignore .gitattributes README.md \
  backend/tests frontend/__tests__ frontend/e2e \
  frontend/jest.config.js frontend/jest.config.defects.js \
  frontend/jest.config.planned.js frontend/playwright.config.ts \
  frontend/package.json frontend/package-lock.json \
  scripts/run_sprint2_qa.py scripts/package_sprint2_qa.py scripts/tests \
  docs/sprint2/qa
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git commit -m "test(qa): cover implemented Sprint 2 web and API workflows"
```

暂存列表仅覆盖本次 QA 文件。最终检查不要包含本机 `.env`、数据库、依赖、构建输出或仓库外历史备份。归档包保存在仓库外，无需放入 Git。

如果第一步发现 `dev` 有更新，commit 后运行 `git merge origin/dev`，解决冲突、重新运行并更新报告后再提交证据更新；不要强制覆盖远程历史。

## 3. Push 分支并创建 Draft PR

```sh
git push -u origin sprint2-qa
```

打开 GitHub 的 **Pull requests → New pull request**：

- **base：`dev`**
- **compare：`sprint2-qa`**
- 标题：`test(qa): cover implemented Sprint 2 web and API workflows`
- 描述：复制 [pr-description.md](pr-description.md) 的正文。
- 选择 **Create draft pull request**，先让团队审查 QA 范围、已知缺陷和 CI 证据。

GitHub 的 base/compare 和 Draft 流程见 [官方创建 PR 文档](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request)。分支 push 后可使用 [dev 与 sprint2-qa 的比较页面](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/compare/dev...sprint2-qa)。

也可用 CLI；本机 `gh` 当前未登录，使用前先 `gh auth login`：

```sh
gh pr create --base dev --head sprint2-qa --draft \
  --title "test(qa): cover implemented Sprint 2 web and API workflows" \
  --body-file docs/sprint2/qa/pr-description.md
```

## 4. 审查与合并

CI 会上传覆盖率、Jest/JUnit 和浏览器证据。已知前端/浏览器缺陷使用真实失败断言，相关 CI job 目前预计会红；不能把它描述为全部通过，也不要为合并移除断言。后端 strict xfail 同样是未修复缺陷。

由团队审查 QA 改动，并安排产品缺陷处理。产品修复后复跑对应用例、调整已解决的 xfail 标记、更新证据，再按仓库要求请求正式 review/合并。未完整验收的 QA 使用 `Refs` 关联，避免 `Closes` 自动关闭整项。

分支 push 后，团队即可在 `sprint2-qa` 查看这份证据；PR 用于集中审查，合并到 `dev` 后进入团队集成分支。测试报告中的“未提交”描述保留的是执行测试时的状态，实际发布以远程分支为准。
