# 项目待办与状态流转

> 由 PM Agent 在 PRD 锁定后维护。每条标注归属 Agent。

## 🚧 当前进行中 (In Progress)
- [ ] **QA**: 写 critical_path 手动测试 checklist（覆盖 ≥ 50% 关键路径）— `@QA Agent` ⏭ 可后置（已合并发布）
- [ ] **Orchestrator**: 把踩坑 + 决策 写入 `MEMORY.md`（fallback Brain）— `@Orchestrator`

## 📋 待办清单 (Backlog)
- [ ] **PM**: Goal Discovery Protocol（arch. 的 🎯 业务目标是初版，待用户走 2-3 轮 Goal Discovery 精化）— `@PM Agent`
- [ ] **Dev**: 修复 `brain-resolve.sh` line 18 bash 严格模式 bug（`$X` → `${X:-}`）后启用 Brain — `@Dev Agent`
- [ ] **Dev**: 节点 tooltip 删除功能的 hover 行为完整测试 — `@Dev Agent`
- [ ] **Dev**: 侧栏时间轴位置 `top: 90px` 是否需要根据用户实际侧栏标题栏高度调整 — `@Dev Agent`

## ✅ 已完成 (Done)
- [x] 初始化 Vibe Coding 脚手架（Phase 1-5）— `@Orchestrator`
- [x] PRD 锁定（destroy-and-timeline 需求）— `@PM Agent`
- [x] executeForgetBranch 升级（闪烁消失：CSS 隐藏 + Observer 边听边点 + 可见性检查 bug 修复）— `@Dev Agent`
- [x] 主屏 destroy-fab 嵌回时间轴（嵌在 💡 FAB 之上，bottom: 8px 容器内）— `@Dev Agent`（**已重构**为 `position: fixed` 独立浮窗，right: 30px 视觉对齐，详见 ADR-2）
- [x] 侧栏时间轴独立 iframe（id 前缀 `gemini-sidebar-timeline-*`，无 FAB）— `@Dev Agent`
- [x] 文档：PRD-destroy-and-timeline.md + architecture.md（4 个 ADR）— `@PM Agent`
- [x] **Reviewer 自检通过**：FAB/↓ 冲突修复（A 方案：destroy-fab 移到容器内 +8、fab 移到 -32、↓ 不动）+ Critical #1（closeSidebar 清理 iframe interval 内存泄漏）+ Critical #2（renderSidebarTimelineInIframe + setInterval 回调 try/catch）— `@Reviewer Agent`
- [x] **harness 流程回溯通过**：PM → Designer(跳过) → Dev → Reviewer → 合并发布 — `@Orchestrator`

---
**关联文件**:
- [docs/PRD-destroy-and-timeline.md](docs/PRD-destroy-and-timeline.md) — 需求契约
- [docs/architecture.md](docs/architecture.md) — 架构 + ADR
- [STATE.md](STATE.md) — 当前状态流转
- [MEMORY.md](MEMORY.md) — 跨项目记忆（fallback Brain）
