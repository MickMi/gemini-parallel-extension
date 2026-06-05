# STATE.md — 项目状态机

> 单一事实来源，跟踪当前任务在各 Agent 间的流转状态。
> 由 Orchestrator 维护，**每次跨阶段都要更新**。

---

## 当前任务

**任务名**：Gemini Parallel Extension 销毁功能修复 + 主屏时间轴 destroy-fab + 侧栏时间轴

**任务类型**：Bug 修复 + 增强（dev 阶段为主）

**触发场景**：Gemini 改版后前端布局变了，导致"销毁规划"功能失效；用户希望主屏时间轴嵌 🗑️ 销毁 FAB；用户希望副屏（侧栏 iframe）也独立时间轴

---

## 阶段流转

| 阶段 | 状态 | 产出物 | 负责 Agent | 备注 |
|------|------|--------|------------|------|
| **PM（需求审查）** | ✅ 完成 | `docs/PRD-destroy-and-timeline.md` 已锁定 | PM Agent | soft 模式，复盘 + 确认清单一次到位 |
| **Designer** | ⏭ 跳过 | HTML mockup | Designer Agent | soft 模式 + 用户选择跳过 |
| **Dev** | ✅ 完成 | 代码改动 | Dev Agent | dev.scope=fullstack；侧栏时间轴 + destroy-fab + 闪烁消失全部完成 |
| **QA** | ⏸ 待 Reviewer 通过 | critical_path checklist | QA Agent | testing.mode=critical_path；建议先合并后补 |
| **Reviewer** | ✅ 完成（2 轮） | `docs/reviews/2026-06-04-destroy-and-timeline.md` | Reviewer Agent | 第一轮漏 FAB/↓ 冲突，用户截图补；第二轮 + A 方案 + Critical #1+#2 全部修复 |
| **合并发布** | ✅ Done | commit 提交信息 | Orchestrator | 用户回复"合并发布"触发；Brain / MEMORY 阶段并行 |
| **Post-Merge Hotfix #1：ADR-2 重构** | ✅ 完成 | styles.css + architecture.md | Dev + Orchestrator | 用户反馈 destroy-fab / fab 仍和 ↑↓ 按钮视觉重叠（30px 容器 + 100px 胶囊 + 嵌容器内 = 横跨 100px 必覆盖）；改为 position: fixed 独立浮窗，right: 30px 视觉对齐时间轴；架构妥协（违反原 ADR-2），新 ADR-2 已记录 |

---

## 关键决策（待 PM 阶段锁）

1. **FAB 归属**：主屏时间轴嵌 2 个 FAB（💡 平行窗口 + 🗑️ 销毁会话），destroy-fab `bottom: -16px`，parallel-fab `bottom: -60px`
2. **时间轴独立**：每个会话/窗口独立时间轴 —— 主屏 doc 一个，侧栏 iframe doc 一个（互不混合节点）
3. **侧栏时间轴无 FAB**：避免视觉杂乱，侧栏标题栏的 🗑️ 遗忘按钮继续用
4. **executeForgetBranch 升级**：CSS 隐藏 + Observer 边听边点 + 可见性检查 bug 修复（闪烁消失）

---

## 历史

- 2026-06-02：用户从 GitHub clone 初始版（version 1.0），本地加 performDestroyOnDocument / destroyMainConversation / destroy-fab（未 commit）
- 2026-06-02：session 开始，handle "销毁规划"功能修复
- 2026-06-03：FAB 布局来回争议（嵌回时间轴、锁屏右下角、独立浮窗、跟随主屏幕……），最终 git restore 到 HEAD + 只加 destroy-fab
- 2026-06-04：脚手架 setup（Phase 1-5 成功，Phase 6 Brain 跳过）
- 2026-06-04：加侧栏时间轴（独立于主屏时间轴，无 FAB）
- 2026-06-04：**进入 harness 流程回溯**（用户在引入 harness 后质疑 AI 是否按流程走）
- 2026-06-04：PM 阶段：PRD-destroy-and-timeline.md 锁定（soft 模式，复盘式确认清单）
- 2026-06-04：Designer 阶段：跳过（用户选择）
- 2026-06-04：Reviewer 阶段：2 轮审查（第一轮漏 FAB/↓ 冲突，用户截图补；第二轮 A 方案 + Critical #1+#2 修复）
- 2026-06-04：**合并发布**：所有 Must Fix 清零；建议提交信息见 STATE.md 底部
- 2026-06-04：Brain/MEMORY 阶段：进行中（fallback Brain 写入 MEMORY.md）

---
