# 项目记忆与经验库 (Memory & Learnings)

## 🏗️ 架构决策记录 (ADR)
*在这里记录我们在对话中决定引入的新库、核心数据结构变更或重大架构妥协。*

- **ADR-2 重构 (2026-06-05)**：destroy-fab / 💡 fab 改为 `position: fixed` 独立浮窗，`right: 30px` 视觉对齐时间轴。**不**再嵌在 `#gemini-timeline-container` 内。详见 `docs/architecture.md` ADR 表格
  - **旧决策 (2026-06-04)**：嵌在容器内，FAB 视觉属于时间轴组
  - **新决策 (2026-06-05)**：fixed 独立，right 偏移对齐（视觉一致，DOM/CSS 解耦）
  - **变更原因**：30px 容器 + 100px 胶囊 + 嵌容器内 = 横跨容器 + 容器外 70px，100% 横向覆盖节点和 ↑↓ 按钮 + box-shadow 模糊 → 视觉必重叠。fixed 是唯一干净方案
  - **代价**：FAB 不再是时间轴的"子元素"（z-index 需要独立管理）—— 已用 `z-index: 2147483647` 兜底

## ⚠️ 已知天坑与环境限制 (Gotchas)
- **【2026-06-05 几何踩坑】30px 时间轴容器 + 100px 胶囊 FAB = 必横向冲突**：destroy-fab / fab 不能嵌在 30px 宽时间轴容器内（即使 `bottom: -36px` 探出容器外），100px 胶囊 + 30px 容器 = 横跨容器 + 容器外 70px，必然 100% 覆盖节点和 ↑↓ 按钮。**唯一干净方案**：`position: fixed` 独立浮窗，`right: 30px` 视觉对齐时间轴
- **【2026-06-05 几何细节】节点 top: 0% + translateY(-50%) = 节点中心在容器顶部**：导致节点 12px 圆点的 6px 顶部在容器顶部**外** 6px，和 ↑ 按钮（top: -36px → 底 容器外 -8px）**仅差 2px**——视觉几乎相切。**修复方向**：↑ 按钮 `top: -36px` 不动，但节点首尾留 2-4% 边界（top: 1-2% / top: 96-98%）
- **【2026-06-05 阴影模糊扩大视觉重叠】box-shadow: 0 4px 16px rgba(0,0,0,0.1)**：即使胶囊纵向 8px 间距，横向 100% 覆盖 + 阴影模糊扩散 10-20px = **视觉**几乎重叠。fixed 定位后阴影仍存在，但胶囊主体不再覆盖节点/按钮，**视觉**清晰
- **【2026-06-05 扩展无热重载】Chrome 扩展必须手动 `chrome://extensions/` 点"重新加载"**——CSS / JS 改动后用户必须**手动 reload**，否则页面用的是缓存版本
- **【2026-06-04 bash 严格模式】`set -u` 模式下未定义变量会报错**——`brain-resolve.sh` line 18 用 `$X` 引用未定义变量会 crash，需改 `${X:-}`。fallback：跳过 Brain 阶段，**手动**写 MEMORY.md（已采用）
- **【2026-06-04 选择器兼容】Gemini 改版后选择器双写**：`data-testid`（新，无连字符）和 `data-test-id`（旧，有连字符）都需支持——代码里用 `try { getByTestId } catch { getByTestIdWithDash }` 双 fallback

## 💡 设计原则备忘
*从历史讨论中提炼的核心设计原则。*
