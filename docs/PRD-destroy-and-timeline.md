# PRD: Destroy Engine Fix + Time-axis FAB + Sidebar Timeline

## 📌 需求摘要
- **一句话**: 修复 Gemini 改版后"销毁规划"功能失效 + 主屏时间轴嵌 destroy-fab + 副屏（侧栏 iframe）独立时间轴
- **需求类型**: Bug 修复 + 增强
- **优先级**: P0
- **创建日期**: 2026-06-04
- **PRD 状态**: Locked（用户已确认）

## 🎯 目标与边界

### 核心目标
1. **销毁无感化**: 侧栏分支销毁时，用户视觉上**只看到**插件 confirm → 状态文字 → 关闭侧栏；**不**看到 Gemini confirm 弹窗闪烁、⋮ 菜单弹起
2. **主屏 FAB 归属明确**: destroy-fab 嵌在主屏时间轴内（`bottom: -16px`），和 💡 平行窗口（`bottom: -60px`）一起**视觉上属于时间轴**
3. **每个会话/窗口独立时间轴**: 主屏 doc 一个、侧栏 iframe doc 一个；**不**共享、不混节点

### 核心场景
- **场景 1**: 用户在侧栏分支对话 → 点标题栏 🗑️ 遗忘 → 插件 confirm 弹窗 → 点确认 → ✅ 已销毁 → 侧栏关闭（全程无 Gemini confirm 弹窗闪烁）
- **场景 2**: 用户在主屏长对话 → 点时间轴底部 🗑️ 销毁 → 插件 confirm 弹窗 → 点"永久销毁" → ✅ 销毁 → SPA 路由回首页
- **场景 3**: 用户开启侧栏分支 → 侧栏 iframe 内出现独立时间轴（节点 + ↑↓ 按钮，**无 FAB**）→ 节点 click 滚动到侧栏对话 → ↑↓ 跳到侧栏首/末

### 明确排除
- ❌ 侧栏时间轴**不**带 FAB（避免视觉杂乱，侧栏标题栏的 🗑️ 遗忘继续用）
- ❌ 时间轴**不**做"跟随主屏幕滚动"（用户已确认这是错方向）
- ❌ Brain 跨对话记忆（Phase 6 跳过，fallback 到 MEMORY.md）
- ❌ 不**改** styles.css 的 timelineContainer 容器（保持 HEAD `bottom: 120px`）

### 验收标准
| 编号 | 验收项 | 量化指标 |
|------|--------|----------|
| AC-1 | 侧栏销毁闪烁 | 用户从"点遗忘"到"侧栏关闭"全程**视觉上看不到** Gemini confirm 弹窗 |
| AC-2 | 主屏 destroy-fab 位置 | 嵌在时间轴底部，紧贴 💡 FAB 之上 |
| AC-3 | 侧栏时间轴位置 | 嵌在 iframe.contentDocument 内，fixed 在 iframe viewport 右侧 |
| AC-4 | 侧栏时间轴无 FAB | DOM 内**不**存在 destroy-fab / parallel-fab |
| AC-5 | 节点不串台 | 主屏节点**只**显示主屏对话；侧栏节点**只**显示侧栏对话 |
| AC-6 | 多次开关侧栏不累积 interval | 用 `iframe._sidebarTimelineInterval` 防止内存泄漏 |

## 👤 用户旅程

### Journey 1: 侧栏分支销毁
1. 用户在主屏页面划选文字
2. 划词菜单弹出 → 用户点 💡 "平行对话"
3. 侧栏从右侧滑出（带"平行推演分支"标题栏 + 注入的文字 + iframe 加载中）
4. iframe 加载完成 → **侧栏时间轴**出现（节点 + ↑↓）—— **不**带 FAB
5. 用户在侧栏里继续对话（生成 AI 回答）
6. 用户看完要点 → 点头部 🗑️ 遗忘
7. 插件 confirm 弹窗 → 用户点确认
8. 视觉上：**无**任何 Gemini UI 闪烁；按钮变 ⏳ → ✅ → 侧栏关闭
9. 主屏刷新，左侧历史记录**无**该分支残留

### Journey 2: 主屏销毁
1. 用户在主屏长对话
2. 看到时间轴上的 🗑️ 销毁按钮
3. 点击 → 插件 confirm → 点"永久销毁"
4. ⏳ → ✅ → 主屏 SPA 路由回首页
5. 时间轴节点立即消失（renderTimeline 主动调用）

### Journey 3: 侧栏时间轴
1. 侧栏 iframe 加载完成 → 时间轴出现
2. 节点位置反映**侧栏**对话在 iframe 内的位置（**不**和主屏混合）
3. 点击节点 → 侧栏滚动到对应 query
4. ↑↓ 按钮 → 跳到侧栏首/末

## ⚙️ 技术约束
- **技术栈**: 纯 JavaScript（Chrome 扩展 Manifest V3，无构建系统）
- **CSS 隔离**: 侧栏用 `gemini-sidebar-timeline-*` id 前缀，**不**和主屏 `#gemini-timeline-*` 冲突
- **iframe 跨域**: 依赖 `rules.json` 的 `declarativeNetRequest` 移除 X-Frame-Options / CSP
- **选择器兼容**: Gemini 改版后**两种**写法都支持 —— `data-testid`（新版，无连字符）和 `data-test-id`（旧版，有连字符）
- **数据变更**: 无（仅 DOM 操作）
- **兼容性**: 保留 HEAD 既有功能（节点 hover、点击滚动、tooltip 删除、checkScroll）
- **性能要求**: setInterval 2 秒一次（主屏 + 侧栏各一个）

## ⚠️ 风险与依赖
| 风险 | 影响 | 缓解 |
|------|------|------|
| Gemini 改版后选择器再变 | 功能失效 | 双写 `data-testid` + `data-test-id`；找不到时 dump DOM 线索 |
| 侧栏多次开关导致 interval 累积 | 内存泄漏 + 性能下降 | 用 `iframe._sidebarTimelineInterval` 存 ID，每次 clearInterval |
| `body.parallel-open` 时 destroy-fab 应退场（避免在分支里误点主屏销毁） | 误操作 | CSS `opacity: 0 + pointer-events: none` |
| `set -u` 模式下未定义变量会 crash | 脚手架 bug | 跳过 Brain 阶段（已修复在 harness 上游） |

## 📋 任务拆解

| # | 任务 | 复杂度 | 优先级 | 归属 Agent | 状态 |
|---|------|--------|--------|------------|------|
| 1 | executeForgetBranch 升级（闪烁消失） | 高 | P0 | Dev | ✅ 已完成 |
| 2 | destroy-fab 嵌回时间轴 | 中 | P0 | Dev | ✅ 已完成 |
| 3 | 侧栏时间轴独立 iframe | 高 | P1 | Dev | ✅ 已完成 |
| 4 | harness 脚手架 setup | 中 | P2 | Orchestrator | ✅ Phase 1-5 完成（Phase 6 跳过）|
| 5 | Reviewer 自检已写代码 | 中 | P1 | Reviewer | ⏸ 待做 |
| 6 | QA 写 critical_path checklist | 低 | P1 | QA | ⏸ 待做 |
| 7 | Brain / MEMORY 写踩坑 | 中 | P1 | Orchestrator | ⏸ 待做 |

## 📜 决策记录（ADR 摘要）

### ADR-1: executeForgetBranch 闪烁消失策略
- **决策**: 用 CSS 隐藏 + MutationObserver 边听边点，**不**用 waitFor 等待弹窗
- **理由**: CSS 是同步应用，弹窗节点插入 DOM 的同一帧就 `display: none`，**视觉上完全无感**
- **替代方案**: waitFor → 用户能看到弹窗闪烁 ~50ms

### ADR-2: destroy-fab 位置（嵌在时间轴内，不独立）
- **决策**: 嵌在主屏时间轴底部 `bottom: -16px`，紧贴 💡 平行窗口（`bottom: -60px`）
- **理由**: FAB 视觉上属于时间轴，**不**独立浮窗在屏幕右下角
- **替代方案**: 独立 fixed 容器在右下角 —— 破坏视觉归属

### ADR-3: 每个会话/窗口独立时间轴
- **决策**: 主屏 doc 一个、侧栏 iframe doc 一个（互不共享）
- **理由**: 时间轴是会话的视觉表达，**应该**跟随会话所在的窗口
- **替代方案**: 全局 1 个时间轴 —— 节点混在一起，归属不清

### ADR-4: 侧栏时间轴不带 FAB
- **决策**: 侧栏时间轴只有节点 + ↑↓ 按钮
- **理由**: 避免视觉杂乱；侧栏标题栏的 🗑️ 遗忘继续负责销毁分支
- **替代方案**: 侧栏时间轴也带 destroy-fab —— 重复入口

## 🔗 关联文件
- `content.js`: 1160 → 1354 行（含 +194 行侧栏时间轴）
- `styles.css`: 866 → 915 行（+49 行 CSS bundle）
- `manifest.json`: 无变化
- `rules.json`: 无变化
