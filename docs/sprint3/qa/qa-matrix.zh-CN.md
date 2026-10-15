# Sprint 3 QA 任务与测试对照表

英文原文：[qa-matrix.md](qa-matrix.md)。

代码审查日期：**2026 年 10 月 16 日（Australia/Melbourne）**。产品基线：
`cdcc44e66d647a9c5993736b797312b495715a3f`（`dev`）。
**测试负责人：Wilson**（GitHub 账号为 `Zhouzhny`）。

本表将全部 **23 个 Sprint 3 QA 任务**对应到父级用户故事的验收标准、
已合并的实现和可运行的测试源文件。**在本表中列出测试，不代表新增了一项测试通过记录。**
实际执行日期、命令、结果和证据见[最初 QA 报告](test-results-20261016.md)及下方各轮后续报告；
[测试计划](test-plan.md)说明重跑时的测试范围和预期结果。

**10 月 16 日后续补测：**[测试补全报告](test-results-completion-20261016.md)
单独记录后续覆盖更新，保留最初报告。下文的测试来源已补充失败／重试、
跨页面刷新，以及此前缺少覆盖的页面边界。原有缺陷断言和验收限制继续保留；
新增测试源文件不代表产品缺陷已修复。

**10 月 16 日缺口补测：**[缺口补测报告](test-results-gap-followup-20261016.md)
记录了本轮**新增 6 项通过的刷新回归，以及 3 项新复现的刷新缺陷**。
共享完整回归为 **568 项通过**；刷新专项在 shared、iOS、Android 配置下均为
**15 项通过**，各自独立的缺陷套件均有 **3 项普通验收断言失败**。
这些属于组件执行，不能相加为三组独立用户流程。另 4 项浏览器验收断言的最终结果为
**4 项失败、0 项跳过、0 项不稳定通过（flaky）**，没有运行时错误。
下文列出已核实的失败边界；这一结果与此前浏览器回归运行分别记录。

**10 月 16 日原生设备补测：**[原生报告](test-results-native-20261016.md)
记录 D02/D03 在 iOS 和 Android 上通过，共 **4 个用例／平台执行组合**，
覆盖 #162/#165/#168/#171/#174 的本地诊断校验、返回／跳过、进程重启、
账户隔离、方向结果、搜索无结果及重新诊断。Android 通过 IntelliJ IDEA 操作，
iOS 使用 Xcode Device Hub。这些是同设备 Expo Go 的实际观察，不代表服务端诊断集成
或整项故事验收。[剩余原生用例报告](test-results-native-remaining-20261016.md)
已完成 D01、D04–D13 的执行记录，共 **22 个用例／平台组合：11 PASS、8 FAIL、3 BLOCKED**。
两轮录制执行合计 **26 个组合：15 PASS、8 FAIL、3 BLOCKED**，没有整项用例仍为 NOT RUN。
8 个失败组合是两端的 D01、D07、D09、D13；未执行或阻塞的子步骤仍在报告中保留。

**补测确认：**Wilson 于 10 月 16 日确认真实邮件送达、密码重置、支付平台流程、
离线恢复及 Android 相册权限拒绝五组流程为 PASS。该日期是确认日期；尚未提供
实际执行日期、构建版本、环境和支持截图／日志。这些确认统一记录于
[执行信息](test-results-native-remaining-20261016.md#execution-information)，
不加入已冻结的原生执行统计，也不能据此认定所有令牌、会话策略或支付平台子步骤
均已执行，或将已记录的失败视为已修复。

## Issue 状态与证据规则

[10 月 16 日 issue 快照](issue-snapshot-20261016.json)保留了本次审查使用的
父级用户故事和子任务全文。快照中，23 个 QA 任务和 23 个父级用户故事均处于开放状态；
23 个前端子任务已关闭，后端子任务中 3 个已关闭、20 个仍开放。
这些是任务管理状态，不是验收结果。
全部 23 个 QA 任务均分配给 Wilson。本次 QA 更新没有修改任何 issue 状态。
Issue 描述可能早于已合并代码；下文的实现范围以记录的提交为依据，不能从 issue 状态推断。

- **组件测试（Component）**：渲染 React Native 组件，同时模拟网络或原生依赖。
  iOS/Android Jest 平台配置的执行结果不能证明设备验收通过。
  `focus-refresh.test.tsx` 对同一已挂载页面调用受控的路由焦点回调；
  `adoptSession` 将模拟续期后的会话交给真实 AuthProvider，API 仍被模拟。
  这不是真实 HTTP refresh-token 交换，也不是设备上的焦点事件。
- **API 测试**：使用真实 FastAPI 应用和隔离的测试数据库。
  PostgreSQL 并发测试与使用临时 SQLite 的迁移、浏览器测试属于不同证据。
- **Web 流程测试（Web journey）**：运行构建后的 Web 应用和真实隔离 API；
  只有明确标注的失败场景会注入测试响应。
- **待集成（Pending integration）**：当前基线尚不能完成整个父级用户故事的验收。
  已实现部分的测试证据仍然有效。
- 已有的不阻断 CI 的缺陷失败，以及严格预期失败（XFAIL），均保留在记录中；
  两者都不能算作验收通过。CI 显示绿色不等于用户故事已获验收签字。

## 优先事项：诊断与服务发现 — US-09–13

新增浏览器文件 `sprint3-integration-acceptance.spec.ts` 将尚未连接的应用端边界写成
可执行验收断言。若应用没有发出保存请求就推进，等待确认与保存恢复用例会在
“未发出请求”断言失败；**503 注入、错误后保留答案及重试路径均未到达**，
不能称为已完成故障恢复验收。新浏览器恢复测试使用 API 已确认记录，不复制旧浏览器本地存储。

QA #162–174 中的九月描述属于历史记录。当前前端已能在本地保存尚未完成的答案、
显示缺失答案提醒，并将 `match=1` 传入 Explore，以便在本地对服务进行排序。
另一个独立变化是，已合并的后端现在提供私密的、受修订号控制的诊断进度 API。
前端仍使用 `useDiagnosis` 和设备/浏览器存储；`src/api/client.ts` 中尚无诊断 API
方法。这两套实现尚未构成一条经过服务端确认的完整应用流程。

当前实现参考：

- [诊断页面](../../../frontend/app/job-seeker/diagnosis.tsx)、
  [首页入口](../../../frontend/app/job-seeker/index.tsx)、
  [存储 Hook 与匹配结果](../../../frontend/src/diagnosis/view.tsx)、
  [Web 存储](../../../frontend/src/diagnosis/storage.web.ts)、
  [原生存储](../../../frontend/src/diagnosis/storage.ts)。
- [诊断 API](../../../backend/app/routers/diagnosis.py)、
  [版本化问卷](../../../backend/app/diagnosis.py)、
  [后端交接与剩余集成工作](../backend/us09-us11-diagnosis.md)。
- [方向/排序规则](../../../frontend/src/diagnosis/model.ts)、
  [Explore](../../../frontend/app/marketplace/index.tsx)。

### 本次更新新增的 QA 测试源文件

包括保留的 10 月 14 日诊断测试源文件，以及 10 月 16 日新增内容。
每一行都标明可运行的测试覆盖边界；这并不证明父级用户故事的全部验收标准已满足。

| 源文件 | 新增覆盖范围与边界 | 相关 QA |
| --- | --- | --- |
| [`screens/diagnosis.test.tsx`](../../../frontend/__tests__/screens/diagnosis.test.tsx) | 通过组件测试渲染页面，覆盖入口/角色/加载、必选选项、本地进度、返回/跳过、可选文本、完成/重新诊断、Explore 导航和职业顾问信息加载重试；路由、存储及网络均使用模拟实现。 | #162, #165, #168, #171, #174 |
| [`diagnosis/useDiagnosis.test.tsx`](../../../frontend/__tests__/diagnosis/useDiagnosis.test.tsx) | 账户切换、前一账户的读取结果延迟返回、登出后立即隐藏内容，以及无法读取的 JSON；存储使用模拟实现。 | #162, #168 |
| [`diagnosis/storage.web.test.ts`](../../../frontend/__tests__/diagnosis/storage.web.test.ts) | 通过受控的 Storage 对象覆盖按键写入、存储被阻止和配额相关行为。失败用例刻画的是当前错误被吞掉的行为，并不能证明数据已成功持久保存。 | #162, #165, #168 |
| [`test_diagnosis_qa_journeys.py`](../../../backend/tests/test_diagnosis_qa_journeys.py) | 使用真实 API 并读取数据库，覆盖登录/保存/登出/账户隔离/继续诊断流程；最终保存的确认响应丢失及过期请求重放；最终提交失败后以相同修订号重试。 | #162, #165, #168 |
| [`sprint3-diagnosis.spec.ts`](../../../frontend/e2e/sprint3-diagnosis.spec.ts) | 在真实运行的 Web 应用中覆盖本地诊断、必选选项/重新登录/继续诊断/账户隔离、结果→职业顾问→服务→通过模拟支付完成预约（stub booking），以及放弃/完成后的重新诊断。浏览器存储和 API 持久化仍是两条独立路径。 | #162, #165, #168, #171, #174 |
| [`sprint3-accessibility.spec.ts`](../../../frontend/e2e/sprint3-accessibility.spec.ts) | 不阻断 CI 的缺陷提示断言：Web 上视觉上已选中的单选按钮应通过 DOM ARIA 暴露其选中状态。React Native 组件测试中的选中状态断言无法证明这一 Web 属性。 | #165, #168 |
| [`test_sprint3_api_journeys_qa.py`](../../../backend/tests/test_sprint3_api_journeys_qa.py) | 修改答案后的诊断结果／筛选条件／服务目录联动、评价加权与事务恢复、审核申请重新提交／发布资格、可预约时间生命周期、管理员订单一致性，以及改期失败时的回滚。 | #165, #171, #174, #192, #195, #198, #210, #213, #216, #219, #222, #225；相邻范围 US-40/41 的回归测试 |
| [`test_sprint3_review_concurrency_qa.py`](../../../backend/tests/test_sprint3_review_concurrency_qa.py) | PostgreSQL 重复评价冲突与不同评价同时提交时的聚合；通过同步屏障协调真实事务。以范围严格限定的严格预期失败（XFAIL）保留已复现的竞态问题。 | #213, #216, #219 |
| [`test_sprint3_privacy_profile_qa.py`](../../../backend/tests/test_sprint3_privacy_profile_qa.py) | 所有可见性取值、查看者/所有者边界、账户隔离、无效请求载荷、个人资料会话切换，以及写入已发送至数据库（flush）后的回滚／重试。 | #183, #186, #189 |
| [`test_sprint3_privacy_contract_qa.py`](../../../backend/tests/test_sprint3_privacy_contract_qa.py) | 访客/其他求职者读取部分可见资料时，要求省略私密字段。字段值泄露仍由阻断性断言检查；空占位值则产生范围严格限定的严格预期失败（XFAIL）。 | #186 |
| [`admin-payments.test.tsx`](../../../frontend/__tests__/screens/admin-payments.test.tsx) | 列表/详情金额、参与者、导航、缺失/无预约状态、尚未完成的读取与重试；使用模拟 API 的已渲染组件测试。 | #210 |
| [`admin-overview-users.test.tsx`](../../../frontend/__tests__/screens/admin-overview-users.test.tsx) | 平台管理员界面框架、角色重定向、仪表盘、两类用户目录、角色深层链接，以及未完成/出错的读取；API 使用模拟实现。 | #210, #231；相邻范围的管理端 Bookings 视图 |
| [`admin-verifications.test.tsx`](../../../frontend/__tests__/screens/admin-verifications.test.tsx) | 队列筛选、证明材料链接调用、确认/取消、保留待处理状态、拒绝/重新作出决定，以及写入/读取恢复；API 和外部链接使用模拟实现。 | #195, #198, #222 |
| [`review-boundaries.test.tsx`](../../../frontend/__tests__/screens/review-boundaries.test.tsx) | 角色/状态资格、已存储的评价、校验、提交中/重复提交控制、请求被拒绝与草稿重试；使用真实客户端和受控 HTTP。 | #213 |
| [`defects/sprint3-admin-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-admin-acceptance.test.tsx) | 不阻断 CI 的缺陷提示断言：管理员读取预约失败时，不得据此认定平台没有数据。 | #210，相邻范围的 Bookings 视图 |
| [`defects/sprint3-privacy-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-privacy-acceptance.test.tsx) | 不阻断 CI 的 US-27 AC3 缺陷提示断言：隐私更新失败时应恢复后端最后一次确认的选项；组件测试中使用实际渲染的组件、真实客户端及受控 HTTP。Shared/iOS/Android 预设仍属于组件测试证据。 | #183 |
| [`sprint3-workflows.spec.ts`](../../../frontend/e2e/sprint3-workflows.spec.ts) 和 [`sprint3_fixtures.py`](../../../frontend/e2e/sprint3_fixtures.py) | 本次测试独占的 SQLite 测试数据，以及真实 Web/API 中的评价持久化、无效/他人评价请求被拒绝、管理员审核决定／付款信息读取恢复，以及买家/职业顾问的可预约时间。包含对前 200 行之外的旧订单详情进行的不阻断 CI 的缺陷提示探测。显式中止网络请求仅用于触发失败；成功响应仍为真实响应。 | #195, #198, #210, #213, #216, #219, #222；相邻范围 US-40/41 的回归测试 |
| [`test_sprint3_recovery_boundaries_qa.py`](../../../backend/tests/test_sprint3_recovery_boundaries_qa.py) | 支付意图元数据回退、忽略不相关的签名事件、支付失败事件顺序、webhook 事件处理记录与预约写入的事务回滚及同一事件重试、提供商异常后其他过期订单／付款任务继续处理，以及旧 Connect 事件重复投递。提供商调用使用可记录的测试桩；真实执行 HMAC 验签，不代表提供商投递或转账验收。 | 相邻范围的已实现支付／集成回归 |
| [`test_sprint3_completion_qa.py`](../../../backend/tests/test_sprint3_completion_qa.py) | 审核决定／申请提交、服务编辑／下架、职业顾问隐私／资料写入已发送至数据库后失败并重试；各读取入口保持不变且提交前不发送决定邮件；下架后即将到来／已完成／已结算预约、订单、收据和管理员历史记录保留；隐私切换、无效审核队列筛选和非职业顾问公开资料 ID。历史完成／结算状态和邮件仍使用明确标注的测试数据／模拟。 | #180, #183, #186, #192, #195, #198, #201, #204, #207, #210, #222, #231 |
| [`sprint3-completion.spec.ts`](../../../frontend/e2e/sprint3-completion.spec.ts) | 真实 Web/API 的 Pending／Verified／Rejected 状态在资料、My Services、审核页和管理员用户列表中同步；过期重新提交收到真实 409；隐私修改后重新加载公开资料；未评分服务／列表状态；搜索无结果后返回并重载诊断，保留原答案。所有成功 API 响应均为真实响应。 | #162, #171, #174, #183, #186, #192, #195, #198, #216, #219, #231 |
| [`job-seeker-home.test.tsx`](../../../frontend/__tests__/screens/job-seeker-home.test.tsx) | 访客／角色／加载入口、已跳过／未完成／已完成本地记录、结果／重新诊断／Explore 导航、目录重试及空目录时保留方向；使用真实 Hook／客户端及受控存储／HTTP。 | #162, #174 |
| [`professional-detail.test.tsx`](../../../frontend/__tests__/screens/professional-detail.test.tsx) | 两个资源的加载、返回的资料／评分及本职业顾问服务筛选、读取失败后重试、受限／部分字段缺失的资料、外部链接请求，以及未评分时不编造分数。不能证明明确的“未评分”资料页文案或操作系统跳转已验收。 | #186, #219 |
| [`focus-refresh.test.tsx`](../../../frontend/__tests__/screens/focus-refresh.test.tsx) | 原有同一挂载页面的状态／资料／付款测试，新增 6 项回归：工作区读取失败后下次焦点恢复；工作区全部依赖使用新采用的 token；Users 两种角色列表在会话更新后替换数据；任一目录读取失败后，重试均用新 token 重读两个列表。真实 AuthProvider、模拟 API／焦点，不代表 HTTP token 交换或设备焦点验收。 | #195, #198, #210, #231 |
| [`defects/sprint3-refresh-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-refresh-acceptance.test.tsx) | 3 项普通 advisory 断言：工作区刷新失败不得继续确认旧认证状态；仍挂载的 Users 获得焦点时应重新读取；会话更新后读取失败应隐藏旧目录及操作。先验证 API／错误已到达，或由独立焦点观察组件确认触发，再检查缺陷。 | #195, #198, #231 |
| [`sprint3-integration-acceptance.spec.ts`](../../../frontend/e2e/sprint3-integration-acceptance.spec.ts) | 4 项 `@defect` 浏览器断言：诊断推进等待服务器确认；保存被拒绝后保留答案并重试；新浏览器读取 API 已确认进度；真实零评价职业顾问显示明确的中性未评分文案。初始化和回读使用真实 API；只有应用发出诊断请求时，才可能执行响应延迟／503 拦截。 | #162, #165, #168, #219 |
| [`diagnosis/storage.native.test.ts`](../../../frontend/__tests__/diagnosis/storage.native.test.ts) | 原生存储封装准确传递按账户划分的键和序列化答案；读取不可用时不返回记录，写入失败测试刻画错误被吞掉的行为。模拟 SecureStore 不能证明数据持久化或设备重启行为。 | #162, #165, #168 |
| [`verify-email.test.tsx`](../../../frontend/__tests__/screens/verify-email.test.tsx) | 确认令牌成功后才采用会话、无效／缺失令牌及网络错误、重发校验／等待／重试、防账户枚举文案和邮箱验证前置提示；使用受控 HTTP。 | 相邻范围已实现的邮箱验证 UI；发布／预约前置条件 |
| [`receipt.test.tsx`](../../../frontend/__tests__/screens/receipt.test.tsx) | 已认证收据显示、准确分币金额、供应方／买方／税务字段、等待／错误／访客／缺失 ID 状态及返回行为；使用受控 HTTP。 | 相邻范围的收据 UI；API 补全测试也覆盖历史收据数据 |
| [`counsellor-payouts.test.tsx`](../../../frontend/__tests__/screens/counsellor-payouts.test.tsx) | 角色限制、初始／就绪／错误状态、轮询结果处理和卸载取消接线（helper 已模拟；次数／间隔由 [`payments/waitForPayouts.test.ts`](../../../frontend/__tests__/payments/waitForPayouts.test.ts) 单独验证）、开户链接请求与重试、ABN／GST 校验、税务设置保存等待／错误及导航。网络／浏览器受控；不声称已验证 Stripe 交易或法律／税务正确性。 | 相邻范围已实现的收款设置 UI，US-47 |
| [`notifications-panel.test.tsx`](../../../frontend/__tests__/screens/notifications-panel.test.tsx) | 访客／账户／等待／空状态、已读／未读行、单条／批量本地标记、导航、重新打开及退出登录；受控 HTTP 包含端点缺失时的降级行为。当前基线没有通知后端，因此不计入服务端持久化／投递验收。 | 仅覆盖相邻范围已实现的通知 UI |

以上是测试源文件映射。数量与执行结果应以注明日期的执行报告为准；
新增文件或记录场景并不等于执行了测试。

### 新增浏览器验收结果 — 10 月 16 日缺口补测

| 普通 `@defect` 断言 | 已确认的观察 | 仍未通过的边界 |
| --- | --- | --- |
| `S3-DIAGNOSIS-SERVER-ACK` — #165 | UI 已推进，但诊断保存请求为 0；真实 API 回读仍为 revision 0／step 1。 | 缺少服务端确认后推进的集成，没有实际等待或消费保存确认响应。 |
| `S3-DIAGNOSIS-SAVE-RECOVERY` — #165 | 拦截到的保存请求为 0，准备注入的 503 没有送达。 | 已复现应用未接 API；服务器拒绝后保留答案的错误 UI 和成功重试路径**未到达**。 |
| `S3-DIAGNOSIS-SERVER-RESUME` — #162/#168 | 真实服务器记录为 revision 1／step 2；空本地状态的新浏览器上下文却显示 step 1。 | 从服务器恢复已确认进度失败；不否定另行验证的同设备本地恢复。 |
| `S3-PROFILE-UNRATED` — #219 | 真实 API 为 0 条评价，并省略值为空的评分字段；客户端将其归一为 null。资料名称和无星号评分的前置断言通过，最后明确未评分文案断言失败。 | 公开职业顾问资料缺少明确的中性未评分文字；没有虚构评分属于另一项已通过前置条件。 |

请求、回读附件、截图、命令结果及报告健康检查见
[缺口补测报告](test-results-gap-followup-20261016.md)。

### US-09 — 进入、恢复与账户隔离

父级用户故事 [#81](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81)
· QA [#162](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/162)
· 负责人 Wilson。

| 父级用户故事验收标准 | 已实现的边界与预期结果 | 验收限制 |
| --- | --- | --- |
| AC1：从主流程开始或恢复 | 首页将新的求职者引导至诊断流程；未完成的本地记录提供 Continue（继续）操作；已完成的记录提供 View/Retake（查看／重新诊断）操作。API 的开始操作会恢复当前用户已有的记录，而不会将其重置。 | 应用入口由本地存储驱动，而不是由 API 记录驱动。 |
| AC2：恢复已持久化的未完成进度 | 前端在本地存储已回答的步骤及下一位置。API 保存的数据在新的已认证会话中仍然保留。 | 必须分别报告同一设备上的本地恢复和 API 持久化；跨设备的应用恢复仍待集成。 |
| AC3：必须登录；不得向访客提供私有数据 | 页面将访客重定向至登录页；所有诊断 API 路由均要求经过身份认证的求职者访问。 | 仅凭 UI 重定向不能证明 API 授权有效。 |
| AC4：其他账户不能请求该记录 | API 对其他账户记录的读取和写入，与未知 ID 一样返回 404；按用户划分的本地存储键将各自存储的记录隔离。 | 本地存储键的隔离不等于服务端授权。 |

现有 API 测试选择器：`test_start_is_safe_to_repeat_and_read_has_no_creation_side_effect`、
`test_each_successful_step_persists_before_advancing_and_resumes_in_new_session`、
`test_all_diagnosis_routes_require_a_job_seeker`，以及
`test_another_job_seeker_cannot_read_or_modify_a_foreign_diagnosis`，位于
[`test_diagnosis.py`](../../../backend/tests/test_diagnosis.py)。

### US-10 — 问题顺序、已保存答案与被拒绝的保存

父级用户故事 [#78](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78)
· QA [#165](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/165)
· 负责人 Wilson。

| 父级用户故事验收标准 | 已实现的边界与预期结果 | 验收限制 |
| --- | --- | --- |
| AC1：按顺序执行约定的六个步骤 | 五个输入问题（`now`、`goal`、`tried`、`stuck`、`barriers`），随后是作为第六步的结果页。API 公布五个输入步骤及结果边界。 | 此项测试覆盖当前带版本的问卷；并不表示认可尚未明确的产品负责人（PO）主题库／条件问题规则。 |
| AC2：存储答案，并在后端确认后前进 | API 使用 `expectedRevision` 验证每个按顺序提交的步骤，并以原子方式保存。 | 应用等待的是本地存储调用，而不是后端响应。应用在服务端确认后再前进的行为仍待实现。 |
| AC3：返回时显示已保存的回答 | 前端的返回操作／本地重新打开会保留已保存的选项；API 读取会返回已确认的答案及恢复位置。 | 前端尚未从服务端获取答案。 |
| AC4：提交失败时不得声称已保存 | API 的无效载荷、过期修订版本和提交失败测试要求数据保持不变，且不得返回保存成功的响应。 | 存储模块会吞掉本地写入错误；目前没有可供验收的服务端保存错误 UI。 |

测试来源：[`test_diagnosis.py`](../../../backend/tests/test_diagnosis.py)、
[`test_diagnosis_contract.py`](../../../backend/tests/test_diagnosis_contract.py)、
[`test_diagnosis_migration.py`](../../../backend/tests/test_diagnosis_migration.py)。
迁移测试在各自的临时 SQLite 引擎中验证数据库结构和数据得到保留，
并非共享生产环境中的迁移演练。

### US-11 — 验证与安全推进

父级用户故事 [#80](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80)
· QA [#168](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/168)
· 负责人 Wilson。

| 父级用户故事验收标准 | 已实现的边界与预期结果 | 验收限制 |
| --- | --- | --- |
| AC1：无效答案显示反馈，且不能前进 | 缺少必填单选答案时显示 `Choose an option to continue.`。可选的多选答案可以为空。API 会拒绝结构、选项或元数据无效的请求，且不修改数据。 | 不得自行添加多选必填规则；应用与 API 的失败处理尚未集成。 |
| AC2：重新打开时保留后端已确认的进度 | API 会话可以获取同一条已保存记录；本地页面恢复其自行持久化的草稿。 | 应用重新打开时恢复后端已确认进度的行为，以及跨设备行为，仍待实现。 |
| AC3：返回操作保留可编辑的已保存答案 | 本地返回操作会保留答案；编辑较早的 API 步骤会保留后续已保存的答案及恢复位置。 | 当前规则是线性的；尚未实现条件分支失效处理。 |
| AC4：拒绝未经授权的读取和更新 | API 的角色、身份认证、所有权及已撤销会话测试覆盖服务端边界。 | D02 已在两个平台的 Expo Go 中分别观察进程重启后的同设备诊断持久化和账户隔离；这不是存储安全审计，也不能证明服务端授权。 |

相关 API 测试选择器包括
`test_invalid_answers_return_field_errors_without_mutating_saved_progress`、
`test_editing_an_earlier_step_retains_later_answers_and_resume_position`、
`test_old_or_revoked_credentials_cannot_reopen_or_modify_private_progress`、
`test_simultaneous_start_requests_create_only_one_record`，以及
`test_simultaneous_saves_allow_only_one_revision_to_win`。
这两个诊断并发用例会在 SQLite 和 PostgreSQL 上执行。
SQLite 的结果不能证明 PostgreSQL 的事务行为；当前
报告单独记录了它们在 PostgreSQL 上的执行情况。

### US-12 — 方向规则与生成失败

父级用户故事 [#79](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79)
· QA [#171](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/171)
· 负责人 Wilson。

| 父级用户故事验收标准 | 已实现的边界与预期结果 | 验收限制 |
| --- | --- | --- |
| AC1：完成分流后，生成与回答关联的后端结果 | 已合并的 PR #236 新增 `/diagnoses/{id}/direction`，根据持久化的答案、修订版本、问卷及规则版本生成结果。测试覆盖较早答案的变更、一致的筛选条件，以及对过期保存请求的拒绝。 | 应用仍自行计算本地结果，尚未调用此端点。 |
| AC2：解释已确认的方向及后续步骤 | 方向 API 返回确定性的解释及后续步骤；`DirectionCard` 则独立呈现本地规则。 | 规则属于实现证据，并不表示未来的产品负责人（PO）主题库已获批准。应用显示内容未经服务端确认。 |
| AC3：后端拒绝未完成的分流 | 方向／筛选条件端点测试会拒绝未完成的记录，并执行所有权、身份认证和角色边界检查。 | 这不能证明前端已集成拒绝流程。 |
| AC4：生成失败时显示错误，且不得伪造匹配结果 | 后端故障注入验证不会伪造方向或筛选条件；新增的 API 流程测试验证恢复时不会破坏已保存的答案。组件测试覆盖目录加载错误及重试。 | 在完成 API 集成之前，应用没有服务端结果错误处理路径。 |

当前规则／排序测试：
[`frontend/__tests__/diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts)。
API 来源：`backend/tests/test_diagnosis_direction.py`、
`test_diagnosis_marketplace_criteria.py` 和 `test_sprint3_api_journeys_qa.py`。
剩余缺口是应用与 API 的集成，而不是端点缺失。

### US-13 — 从诊断前往 Explore 并返回

父级用户故事 [#76](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76)
· QA [#174](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/174)
· 负责人 Wilson。

| 父级用户故事验收标准 | 已实现的边界与预期结果 | 验收限制 |
| --- | --- | --- |
| AC1：应用或建议支持的筛选条件 | 结果页打开 `/marketplace?match=1`；Explore 在本地排序。新增的筛选条件 API 独立推导受支持的 `query` 参数，并报告不支持的信号；API 流程测试将这些参数提交至实际服务端点。 | 前端仍未向 Marketplace API 发送诊断筛选条件；通过服务端边界测试不能证明应用已完成此项集成。 |
| AC2：返回时无需重复诊断 | Explore 使用 `result=1` 链接至诊断；Web 补全测试在无结果搜索后返回、重载结果，并在重新诊断时复用原答案。 | 属于本地恢复，不是服务端确认／跨设备的结果恢复。 |
| AC3：空结果仍保留诊断 | Web 补全测试执行实际的无结果搜索及返回；首页组件测试另行覆盖空目录时保留结果／重新诊断操作。 | 带日期的执行记录见后续补测报告。这些本地流程不能证明前端已使用后端诊断筛选条件。 |
| AC4：不得声称已应用不支持的筛选条件 | 筛选条件 API 明确报告不支持的信号，且不会自行添加服务方式筛选条件。本地无匹配提示文本保留正常排序；模型测试将不匹配的服务标记为未匹配。 | 完整 UI 必须使用此契约，才能声称应用具备由服务端支持的筛选功能。 |

测试来源：[`diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts)、
[`marketplace.test.tsx`](../../../frontend/__tests__/screens/marketplace.test.tsx)，
以及 [`filters.test.ts`](../../../frontend/__tests__/marketplace/filters.test.ts)。


## 剩余 18 项 QA 任务

下列 AC 编号对应 issue 快照中的父级用户故事文本。所有行均处于
**QA 未完成／仅有部分证据的状态，直到当前执行结果及尚未满足的验收标准完成评审**。
路径均相对于仓库根目录。组件测试中模拟的 API 成功响应，绝不能证明对应端点实际存在或数据已经持久化。

| 用户故事／父级用户故事／QA | 待验证的父级用户故事验收标准 | 当前已合并的实现与测试来源 | 剩余验收边界 |
| --- | --- | --- | --- |
| US-05 [#8](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8) / [#180](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/180) | AC1–5：首次登录设置、步骤缺失时的限制／发布限制、真实的未完成／已完成状态、路由跳转前的加载。 | API：`backend/tests/test_onboarding.py`；组件测试：`frontend/__tests__/screens/counsellor-onboarding.test.tsx`、`counsellor-dashboard.test.tsx`、`login.test.tsx`；首次登录／资料／提交状态，以及加载／发布控制分别映射。 `test_sprint3_completion_qa.py` 另行检查职业顾问资料事务失败后，入门设置与审核输入保持不变，随后可重试。 | 现有仪表板行为刻画测试记录了入门设置检查失败后仍打开工作区的行为；这不能证明已实现检查失败时拒绝访问的限制。父级用户故事中的假设仍将待审核期间可否发布、或是否仅验证通过后才具备发布资格的问题留待协商。D01 在两端均为 FAIL：首次登录设置、加载、重启及重新登录检查已执行，但引导状态 GET 503 仍放行进入未完成设置的工作区。 |
| US-27 [#22](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22) / [#183](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/183) | AC1–5：三个可见性级别、保存／重新打开、拒绝写入时保留已存储值、身份验证／值／所有权保护。 | `/me/profile-visibility`；`backend/tests/test_profile_visibility.py`、新增的 `test_sprint3_privacy_profile_qa.py`：三个值、新登录会话、两种成员角色、账户隔离、格式错误／未知字段，以及写入已发送至数据库（flush）后的回滚／重试。组件测试 `frontend/__tests__/screens/privacy-reviews.test.tsx` 覆盖选项的加载／保存。 `test_sprint3_completion_qa.py` 增加职业顾问隐私回滚和公开读取入口的反复切换；`sprint3-completion.spec.ts` 通过真实 Web UI 修改设置并重载已打开的访客资料页。 | **S3-PRIVACY-ROLLBACK：**新增的 `defects/sprint3-privacy-acceptance.test.tsx` 检查 AC3：写入失败后恢复上次保存的选项；当前页面仍保留编辑后的选项。API 事务回滚属于另一条边界，不能解决此组件缺陷。D04 在两端均为 PASS，覆盖规定的隐私切换、写入失败／重试、重新打开确认及其他账户读取；未保存选项仍被保留的问题继续作为独立缺陷。约定的默认值／字段映射仍需单独验证；PR #237 尚未合并。将平台管理员排除在隐私规则之外是一项假设，成员角色用例并未证实这一点。 |
| US-28 [#23](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23) / [#186](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/186) | AC1–5：公开／部分公开／受限响应、所有者例外、变更可见且不泄露旧字段。 | `backend/app/routers/counsellor.py` 中的职业顾问资料过滤；`test_profile_visibility.py` 和 `test_sprint3_privacy_profile_qa.py` 覆盖访客及其他成员角色对公开／部分公开／受限资料的详情／列表读取、所有者通过 `/me` 进行完整读取，以及新会话中的设置。受限资料组件测试用例：`privacy-reviews.test.tsx`。 `test_sprint3_completion_qa.py` 在反复切换后对比公开详情／列表刷新结果及所有者完整读取；`sprint3-completion.spec.ts` 检查同一访客页面重载后的内容。`professional-detail.test.tsx` 覆盖受限／部分字段缺失时的渲染及读取恢复。 | **S3-BE-PRIVACY-FIELD-OMISSION：**`test_sprint3_privacy_contract_qa.py` 单独检查 AC2 中访客／其他求职者读取时应省略键的要求；当前响应仍保留值为空的私有字段键。隐去内容／刷新覆盖不能解决这一严格预期失败（XFAIL）。Web 测试覆盖显式重载，不代表未操作的页面会自动更新。D04 在两端均为 PASS，覆盖规定的职业顾问可见性切换及访客／其他账户重新读取；不能证明未操作页面自动更新。公开求职者资料访问及约定的字段映射仍需单独验证。 |
| US-29 [#82](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82) / [#189](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/189) | AC1–4：后端读取、确认保存成功、出错时保留编辑、仅允许对应角色且为资料所有者的用户写入。 | `/me/job-seeker-profile`；API 测试 `test_job_seeker_profile.py` 及 `test_sprint3_privacy_profile_qa.py` 覆盖退出登录／切换账户／重新登录后的已保存字段、受保护的邮箱／所有者字段、错误角色写入，以及事务回滚／重试。`frontend/__tests__/screens/job-seeker-profile.test.tsx` 在受控 HTTP 条件下测试真实客户端。 | 尽管 PR #237 尚未合并，当前 dev 已有直接的 API 恢复／隔离测试覆盖。D05 的录制结果为 iOS PASS、Android BLOCKED，后者仅因无法触发权限拒绝分支。两端均执行了资料保存／失败／重试、重启后文字恢复、账户隔离及合成图片选择／保存；iOS 另执行权限拒绝。Wilson 后续确认 Android 权限拒绝 PASS，见执行信息，但不改写原录制状态。已存储的数据 URI 不等于上传服务测试；约定的核心字段及完整图片生命周期仍需单独验证。 |
| US-31 [#25](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25) / [#192](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/192) | AC1–5：确认 LinkedIn 提交成功后进入待审核（Pending）状态、前端／服务器拒绝无效 URL、角色／身份验证保护、出错时不进入待审核状态。 | `/me/verification-submissions`；`backend/tests/test_admin.py`；新增的 `test_sprint3_api_journeys_qa.py` 串联提交、拒绝、更正后重新提交、批准，以及实际发布权限。组件测试：`frontend/__tests__/verification.test.ts`、`screens/counsellor-verification.test.tsx`。 `test_sprint3_completion_qa.py` 注入写入已发送至数据库后的申请提交事务失败，检查重试前仍保留原 URL／状态／队列。`sprint3-completion.spec.ts` 验证过期重新提交收到真实 409，且不会错误显示 Pending。 | URL 验证仅检查语法，不包含实时 LinkedIn 身份核验。API 流程测试覆盖已实现的重新提交策略；不代表 PO 已批准该策略。D06 在两端均为 PASS，覆盖原生 URL 校验、提交失败保留输入、重试至 Pending 及后续管理员决定。后端事务失败及真实 Web 409 处理仍为独立证据。Wilson 已确认真实邮件送达流程 PASS，但未提供特定验证邮件或真实 LinkedIn 身份核验的证据。 |
| US-32 [#26](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26) / [#195](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/195) | AC1–5：资料／服务中的待审核（Pending）／已验证（Verified）／已拒绝（Rejected）状态一致、出错后不臆测状态、仅允许对应角色读取。 | 状态／资料 API 及共用显示逻辑；`backend/tests/test_admin.py`、`test_counsellor_profile_details.py`、`test_sprint3_api_journeys_qa.py`；组件测试 `counsellor-verification.test.tsx`、`counsellor-profile.test.tsx`、`counsellor-dashboard.test.tsx`、新增的 `admin-verifications.test.tsx`；`e2e/sprint3-workflows.spec.ts` 串联管理员批准／拒绝，以及持久化后的重新加载。 `sprint3-completion.spec.ts` 将真实后端三种状态同步至资料、My Services、审核页和管理员用户列表。`focus-refresh.test.tsx` 保持资料页／工作区挂载并控制焦点切换，另检查资料刷新失败及恢复；API 补全测试对比回滚／重试后的所有状态读取入口。 | 三种成功的跨页面状态刷新现在有真实 Web/API 测试来源，并有保持挂载的组件焦点测试。资料刷新失败有明确的不可用／恢复断言。**S3-WORKSPACE-STALE-STATUS** 已复现失败路径：错误已显示，但旧 Verified 徽标仍保留。新增的后续焦点恢复和会话采用回归通过，不能抵消这一缺陷。D06 在两端均为 PASS，覆盖规定的成功状态切换及获得焦点／返回后的重新读取。该成功原生路径不等于重跑或修复同一挂载组件在刷新失败时的断言。 |
| US-33 [#27](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27) / [#198](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/198) | AC1–5：重新作出的决定已持久化、两个职业顾问视图均刷新、拒绝无效／错误角色的更新、失败时保留原状态。 | 管理员决定 API 接受 pending／verified／rejected；`backend/tests/test_admin.py` 覆盖恢复待审核及无效结果。新增的 `admin-verifications.test.tsx` 覆盖重新决定、确认、写入失败时保留原因／状态，以及重试；`sprint3-workflows.spec.ts` 使用真实批准、附带原因的重新调查，以及重新加载。 `test_sprint3_completion_qa.py` 在写入已发送至数据库后拒绝决定事务提交，检查全部读取入口不变，且成功前不发邮件。Web 补全测试检查三种 API 决定后的两个职业顾问视图；焦点组件测试覆盖同一已挂载视图的成功刷新。 | UI 提供改为已验证／已拒绝，以及“保留此结果”（Keep this outcome）选项；API 支持 pending 不代表 UI 提供恢复待审核操作。职业顾问跨页面刷新和后端事务回滚现在分别有测试来源。**S3-WORKSPACE-STALE-STATUS** 单独记录确认刷新失败后仍显示旧徽标的问题。下次焦点恢复及 AuthProvider 采用会话的回归通过，不能修复这一失败，也不代表真实 HTTP token 续期。D06 在两端均为 PASS，覆盖取消、原因校验、决定失败／重试、拒绝／批准及成功原生返回读取。它不修复独立的同一挂载页面刷新失败断言；尚未约定的重新调查规则仍需确认。 |
| US-36 [#31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31) / [#201](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/201) | AC1–5：确认编辑／移除成功、服务条目停用、保留历史预约／订单数据、所有者保护、失败时保留服务条目。 | API 编辑／软删除：`backend/tests/test_counsellor.py`、`test_sprint2_counsellor_acceptance.py`；组件测试 `counsellor-edit-service.test.tsx`、`counsellor-dashboard.test.tsx`；`backend/tests/test_sprint3_service_history_qa.py` 在编辑服务前创建一条通过模拟支付完成付款的真实预约记录。 `test_sprint3_completion_qa.py` 另行下架包含即将到来／已完成／已结算已付款预约的线上／线下服务，保留参与者详情／列表／收据、订单和管理员历史记录，同时阻止新购买；也检查编辑／下架的回滚和重试。 | **S3-BE-SERVICE-HISTORY：**原有编辑探测测试要求订单、详情及参与者列表视图保留原始标题／会面区域；当前读取使用编辑后的服务值。严格预期失败（XFAIL）继续表示 AC3 未解决。新增下架用例保留已有付款记录，但未编辑已预约标题／区域，因此不能修复该缺陷。已完成／已结算状态使用明确的测试数据，不代表支付提供商或调度器证据。D07 在两端均为 FAIL：原生模拟付款预约、服务编辑及下架均已执行，但已有预约和收据随之显示编辑后的标题。原金额／时间／标识保留，下架阻止新预约并保留旧记录；这些检查不修复历史标题缺陷。 |
| US-42 [#37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37) / [#204](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/204) | AC1–5：即将到来的预约详情／时区／简报、与历史预约分开、空状态、调用者隔离、网络错误与空结果区分。 | `/me/bookings`；`backend/tests/test_my_bookings.py`、`test_payments.py`；`frontend/__tests__/screens/counsellor-bookings.test.tsx`。新增的 API 评价流程测试也依据已存储评价，检查双方参与者的列表／详情响应。 API 补全测试另行检查服务下架后，即将到来及历史测试预约中双方参与者的列表／详情。 | API 提供每位参与者自己的列表，包括求职者，且没有选择其他职业顾问的功能。必须明确协调这一契约与父级用户故事中“错误角色”的表述；求职者访问自己的列表并不等同于访问其他职业顾问的列表。D08 在两端均为 PASS，规定的即将到来／历史／空列表、墨尔本时间、简述、参与者隔离及交付详情均与 API 回读核对。历史完成状态仍是明确测试数据；尚未证明其他时区或实体设备表现。 |
| US-43 [#38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38) / [#207](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/207) | AC1–4：在线链接在外部打开、线下地址、仅向参与者提供服务交付详情、缺少详情时的提示。 | 预约详情／地址 API；`backend/tests/test_booking_detail.py`、`test_my_bookings.py`；`frontend/__tests__/screens/booking-detail.test.tsx` 检查服务交付详情、缺失状态及打开外部链接的请求。 API 补全测试验证服务下架后保留线上交付信息或已记录的线下地址；收据组件覆盖单独记录。 | 组件测试中模拟了链接打开操作。D08 在两端均为 PASS，覆盖合成 example.com 链接在 Safari／Chrome 中的跳转及返回、准确线下地址和地址缺失反馈。这证明系统浏览器跳转，不代表真实会议平台会话；按服务／按预约的约定交付规则仍需确认。 |
| US-48 [#45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) / [#210](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/210) | AC1–5：平台管理员的订单／支付列表与详情、参与方／金额／进度、状态变更后刷新、角色限制、出错时不显示旧数据。 | 已合并的直接访问 `/admin/payments/{orderId}` API 位于 `test_admin.py`；新增的 `test_sprint3_api_journeys_qa.py` 对比改期／取消及回滚后的详情。新增组件测试 `admin-payments.test.tsx` 和 `admin-overview-users.test.tsx` 覆盖金额、参与方、导航、加载、重试及不完整读取。`sprint3-workflows.spec.ts` 使用真实详情及传输故障恢复。 `focus-refresh.test.tsx` 检查刷新失败后移除此前加载的付款行，再进行重试；API 补全测试对比服务下架和回滚后的管理员订单／预约历史。 | **S3-WEB-ADMIN-OLD-ORDER：**页面在列表的前 200 行中查找；该 Web 缺陷测试期望已有的较早订单即使不在该列表中，仍可通过其直接 ID 打开。`S3-ADMIN-BOOKINGS-EMPTY` 另行记录了相邻的管理员“预约”（Bookings）页面在请求失败后显示“暂无数据”的问题。D09 在两端均为 FAIL：管理员 Bookings 503 错报平台无预约；付款列表／详情、Payments 刷新失败／重试及变更后订单读取的规定检查已通过。Android 未保留 Bookings 出错前的成功 UI 检查点。Wilson 的支付平台流程确认与本地测试桩／测试数据结果分开，不修复上述两个缺陷。 |
| US-53 [#52](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52) / [#213](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/213) | AC1–5：已完成订单买家的评价表单、确认持久化成功、有效评分、拒绝未完成订单及非买家提交。 | 已合并的 `POST /bookings/{id}/review`；`backend/tests/test_reviews.py` 覆盖已完成／已结算订单的买家、角色／所有权、验证及重复提交。新增的 `test_sprint3_api_journeys_qa.py` 增加原子回滚／重试、元数据边界及 Unicode；`test_sprint3_review_concurrency_qa.py` 覆盖竞态。组件测试：`review-boundaries.test.tsx`；真实 Web 测试 `sprint3-workflows.spec.ts` 覆盖草稿重试、持久化，以及不符合资格／他人的预约。 | **S3-BE-REVIEW-DUPLICATE-RACE：**并发重复提交会存储一条评价，但返回 201/500，而非 201/409。严格预期失败（XFAIL）保留这一失败。已完成的会话是这些流程中显式设置的测试数据，并不能证明会话完成调度器或真实支付有效。D10 在两端均为 PASS，覆盖规定的本地评价校验、提交失败／重试、重复提交控制及公开评分持久化。原生双击结果不能证明多客户端并发安全，也不修复数据库竞态。 |
| US-54 [#53](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53) / [#216](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/216) | AC1–5：准确的服务汇总值／列表／评论、评价后更新、无评价状态、拒绝评价后汇总值不变。 | 已合并的服务详情评价列表及汇总值重新计算；`test_reviews.py` 及新增 API 流程测试覆盖公开读取、被拒绝／失败的写入、服务隔离、准确的多会话平均值及新打开的视图。`service-detail.test.tsx` 覆盖渲染；`sprint3-workflows.spec.ts` 提交真实评价并检查更新后的公开详情。 `sprint3-completion.spec.ts` 读取真实零评价服务，并检查市场列表及详情中的 New／空评价状态。 | **S3-BE-REVIEW-AGGREGATE-RACE：**同一服务的两条并发评价被接受后，其缓存计数／平均值可能仅反映一条评价。验证顺序操作一致性的测试不能解决这一严格预期失败（XFAIL）。D10 在两端均为 PASS：提交评价后服务／资料的原生值与 API 的 5.0／1 条评价一致，零评价服务保留未评分状态。这条顺序执行路径不修复竞态；评价者身份展示隐私规则及约定的显示精度仍需确认。 |
| US-55 [#54](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54) / [#219](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/219) | AC1–4：资料／服务列表评分一致、评价后重新计算、明确的未评分状态、两种设备的显示均等于 API 值。 | 已合并的后端根据全部已存储评价重新计算总体评分。新增的 `test_sprint3_api_journeys_qa.py` 检查两个服务的会话数量不相等时的计算、服务／列表／资料值相等，以及无关所有者的隔离；并发测试文件覆盖同一服务和跨服务写入。Web 评价流程重新加载专业资料，并与新获取的 API 评分核对。 `professional-detail.test.tsx` 检查评分为 null 时不编造分数；Web 补全测试检查列表中的 New、服务详情中的无评价状态，以及公开资料中不存在虚构评分。 | **S3-BE-REVIEW-AGGREGATE-RACE：**并发接受评价后，职业顾问汇总值可能过期，即使评价属于不同服务。测试锁定的是已实现的按评价计算简单平均值，并不代表 PO 已批准公式／舍入规则。列表／详情现在有专门的零评价测试来源，但公开职业顾问资料页仍缺少明确的“未评分”文字；**S3-PROFILE-UNRATED** 已在 API 零评价及页面前置条件通过后，明确复现该文案断言失败。不显示虚构徽标不等于完成此项验收。D10 在两端均为 PASS，覆盖规定的 5.0／1 条评价 API 与显示值核对，以及零评价服务状态。该测试数据中的职业顾问仍有 1 条评价，因此不覆盖零评价职业顾问文案缺陷，也不证明并发汇总正确。 |
| US-58 [#28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28) / [#222](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/222) | AC1–6：待审核队列／URL、确认批准／拒绝／原因、保留待审核状态、拒绝错误角色、失败时保留待审核状态。 | `test_admin.py` 中的管理员队列／直接详情／决定 API；新增 API 流程测试将更正后重新提交与发布资格串联。新增的 `admin-verifications.test.tsx` 覆盖筛选器、链接、确认／取消、保留待审核状态、拒绝原因、重新决定及失败。`sprint3-workflows.spec.ts` 覆盖真实确认／取消、批准／拒绝、重新加载，以及从待审核队列移除。 API 补全测试验证决定回滚／重试、事务被拒绝后不发邮件，以及无效队列筛选返回明确错误。 | LinkedIn 打开测试检查模拟的外部链接调用，不是操作系统行为或人工身份核验。邮件调用不能证明收件箱收到邮件。D06 在两端均为 PASS，覆盖保留 Pending、取消、拒绝校验、决定失败／重试、批准及持久状态重新读取。后端决定事务回滚仍属独立 API 边界。Wilson 的真实邮件确认未指明批准／拒绝邮件；身份核验及团队批准／拒绝规则仍需确认。 |
| US-69 [#40](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40) / [#225](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/225) | AC1–5：该预约对应职业顾问的可用时段、改期后仍为同一预约／订单、释放原时段、冲突／部分失败时安全处理、拒绝无效状态／非参与者操作。 | `backend/tests/test_reschedule.py` 包含 PostgreSQL 中相互竞争的改期。新增的 `test_sprint3_api_journeys_qa.py` 在预约／订单 SQL 更新之后、提交之前注入故障，重新读取预约／订单／管理员视图／日历，然后重试；其生命周期流程检查原时段／新时段的可用性，以及订单标识未变。组件测试 `frontend/__tests__/screens/reschedule.test.tsx` 覆盖表单。 | AC4 现已有直接的事务回滚测试来源。执行情况仍须查阅带日期的报告；SQLite 不能作为 PostgreSQL 并发行为的证据。D11 在两端均为 PASS，覆盖改期失败保留原预约、真实产品冲突、成功重试、预约／订单标识及金额不变、释放原时间、参与者结果一致及拒绝其他账户。失败后新选择的时段被清空。临近会话／费用限制及尚未约定的改期策略仍不在这些检查范围内。 |
| US-70 [#12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12) / [#228](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/228) | AC1–5：通用重置响应／邮件、防账户枚举、确认密码／哈希变更、拒绝过期／已使用／被篡改的令牌、等待中／网络失败 UI。 | `backend/tests/test_verification.py` 中的 API 令牌生命周期；`test_mail.py`、`test_mail_messages.py` 中的邮件测试；组件测试 `frontend/__tests__/screens/forgot.test.tsx`、`reset.test.tsx`；客户端响应封装测试覆盖等待中／错误状态及重置结果。 | API／组件邮件测试拦截外发邮件。冻结执行中两端 D12 均为 BLOCKED：已执行无效／已知／未知邮箱请求及 HTTP 503／重试；实际收件／链接及更改密码的令牌生命周期未执行，真正离线提交为 NOT RUN。Wilson 后续确认真实邮件、密码重置及离线恢复三组流程 PASS，见执行信息。尚未提供平台／构建、令牌边界或收到的链接详情，因此不能据此认定所有过期／复用／篡改令牌及会话策略子步骤均已执行。响应体不可区分并不等于经过测量的时序安全保证。令牌有效期／密码规则及重置后的会话失效要求，需要已记录的团队策略；QA 不会自行补造未规定的策略。 |
| US-71 [#77](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77) / [#231](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/231) | AC1–4：平台管理员可查看两种用户角色／状态、职业顾问验证状态一致、拒绝错误角色且不提供导航、出错时不显示旧列表。 | `backend/tests/test_admin.py` 覆盖管理员列表／角色保护；`screens/admin-overview-users.test.tsx` 覆盖平台管理员界面、重定向、两类目录／深链接、状态字段、验证导航及部分读取失败重试；`verification-admin-client.test.ts` 固定验证 URL／身份验证。`sprint3-completion.spec.ts` 在三种状态变更后重载真实管理员用户列表；API 补全检查事务回滚后读取不变。`focus-refresh.test.tsx` 新增两种角色的数据替换及使用新采用 token 重试。 | 新增 `focus-refresh.test.tsx` 覆盖 AuthProvider 采用会话后两个角色列表的数据替换，以及任一目录请求失败后用新 token 重试。独立缺陷源中的 **S3-ADMIN-USERS-FOCUS**、**S3-ADMIN-USERS-STALE-REFRESH** 分别复现模拟焦点不触发重读，以及会话更新后读取失败仍保留旧行／操作。这些是普通 advisory 失败；D06 在两端均为 PASS：原生管理员决定后返回 Users，Rejected／Verified 行已刷新，且记录了新的读取请求。该路径不修复独立的模拟焦点／会话更新失败断言；真实 HTTP token 续期及完整原生角色／错误矩阵仍需单独验证。 |

## 待集成事项与基线变化

- [PR #236](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/236)
  已合并并纳入本次基线。后端方向与筛选条件接口可以开展验收测试；
  前端尚未使用这些接口。
- [PR #237](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/237)
  增强资料与隐私保护，审查时仍处于开放状态。现有 `dev` 中已实现的资料与隐私功能
  仍可按当前实现范围进行测试。
- PR #239 已合并：真实评价和评分汇总已纳入基线，迁移
  `0010_reviews` 接在 `0009_diagnosis_progress` 之后。此前的迁移版本号冲突已解决。
  迁移测试针对当前合并后的迁移链执行。
- PR #238 增加了按 ID 直接查询管理员订单、审核申请详情的接口。
  当前 UI 详情页仍先获取列表，再查找目标 ID；仅增加后端直接查询接口，
  尚不能解决 UI 只能从前 200 条订单中查找的问题。
- PR #240 修正剩余可预约分钟数和下次可预约时间。已有验收断言已重新执行；
  修复后通过的断言，与其余仍失败但不阻断 CI 的断言分别记录。
- 原生观察分为 [D02/D03 报告](test-results-native-20261016.md)和
  [剩余用例报告](test-results-native-remaining-20261016.md)：合计 **26 个录制用例／平台组合，
  15 PASS／8 FAIL／3 BLOCKED**。两端 D01／D07／D09／D13 的失败仍未关闭。
  [五组补测确认](test-results-native-remaining-20261016.md#execution-information)
  依据 Wilson 的确认记为 PASS，实际执行详情仍未提供；不改写冻结的观察／统计，
  也不能证明每项收件／链接、令牌或支付平台边界均已验收。签名独立构建、部署环境、
  实体设备及未经批准的诊断规则仍在这些本地执行记录范围之外。
