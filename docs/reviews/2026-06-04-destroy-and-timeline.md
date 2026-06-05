# 🔍 Code Review Report — destroy-and-timeline

**审查日期**: 2026-06-04
**审查 Agent**: Reviewer
**审查范围**: `content.js` (line 91-106, 178-220, 320-430, 1100-1160) + `styles.css` (line 49-915)
**对照 PRD**: `docs/PRD-destroy-and-timeline.md`
**对照架构**: `docs/architecture.md`（4 个 ADR）

## 📊 总览
- **风险等级**: 🟡 中危（无安全/数据问题，但有 1 个内存泄漏 + 1 个错误处理缺口）
- **是否可合并**: ⚠️ 需修改后合并（修复 1 项 critical + 1 项 should fix 后可合并）

## 🚨 必须修复 (Must Fix)

### 1. 内存泄漏：closeSidebar 漏清理 iframe interval
- **维度**: 性能 / 资源管理
- **位置**: `content.js:91-106`（`closeSidebar` 函数）
- **问题描述**:
  - `iframe._sidebarTimelineInterval`（content.js:195-198 启动）在 closeSidebar 时**没**清理
  - 用户关侧栏 → sidebar DOM 移除 + iframe 移除 → **但** setInterval 仍然每 2 秒跑
  - interval 闭包持有 `iframeDoc` 引用 → **阻止 GC** 回收 iframe
  - 复现：开侧栏 → 触发几轮 interval → 关侧栏 → 内存中**仍**有 iframe iframeDoc
- **影响**:
  - 长期使用 → 多次开关侧栏 → 内存累积
  - console 会刷 `TypeError: Cannot read properties of null (reading 'body')` 错误（iframeDoc 已被 GC 后 body 不可访问，但 onload 已触发 closure 持有旧引用）
- **建议修复**:
  ```js
  const closeSidebar = () => {
      // ... 现有代码
      const iframe = document.getElementById('gemini-ghost-frame');
      if (iframe && iframe._sidebarTimelineInterval) {
          clearInterval(iframe._sidebarTimelineInterval);
          iframe._sidebarTimelineInterval = null;
      }
      // ... 现有代码
  };
  ```

### 2. 错误处理缺口：renderSidebarTimelineInIframe 缺 try/catch
- **维度**: 逻辑完备性 / 防御性编程
- **位置**: `content.js:338-430`（`renderSidebarTimelineInIframe` 函数）
- **问题描述**:
  - setInterval 回调调用此函数时**没** try/catch
  - 如果 iframeDoc.body 不可访问（侧栏关闭中途）→ 抛错
  - **setInterval 行为**：**会**继续触发，但每次都抛错
  - console **会刷错**（不是 crash，但烦）
- **影响**: 控制台刷错，影响调试体验
- **建议修复**:
  ```js
  function renderSidebarTimelineInIframe(iframe) {
      try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (!iframeDoc || !iframeDoc.body) return;
          // ... 现有逻辑
      } catch (e) {
          // iframe 已被移除，silently ignore
      }
  }
  ```
  同样建议给 setInterval 回调本身也包 try/catch（line 195-198）。

## ⚠️ 建议优化 (Should Fix)

### 3. 与主屏行为不一致：侧栏缺 hover 状态锁
- **维度**: 架构一致性 / 可维护性
- **位置**: `content.js:renderSidebarTimelineInIframe`（节点渲染前）
- **问题描述**:
  - 主屏 `renderTimeline` 头部有 `if (isHoveringTimeline) return;` —— 防止用户 hover 节点时被重绘打断
  - 侧栏 `renderSidebarTimelineInIframe` 用了**未定义**的 `container.isHoveringSidebarTimeline` 标志
  - **实际行为**：标志永远 false → 节点每 2 秒**会**重绘 → 用户 hover 节点时**可能**节点被清除重建 → tooltip 闪烁
- **影响**: 侧栏时间轴 hover 体验**不如**主屏流畅
- **建议修复**（与主屏对齐）:
  ```js
  // 在 renderSidebarTimelineInIframe 函数顶部加：
  if (container.isHoveringSidebarTimeline) return;
  // 在 iframeDoc 上绑定 mouseenter/mouseleave：
  container.addEventListener('mouseenter', () => { container.isHoveringSidebarTimeline = true; });
  container.addEventListener('mouseleave', () => { container.isHoveringSidebarTimeline = false; });
  ```

### 4. destroyMainConversation SPA 路由兜底时间可能不足
- **维度**: 逻辑完备性
- **位置**: `content.js:destroyMainConversation`（line ~1100+ 的 `await new Promise(r => setTimeout(r, 1500))`）
- **问题描述**:
  - 固定 1.5 秒 setTimeout 后检查 location.pathname
  - 长对话（几十轮）的云端删除可能**5-10 秒**
  - 1.5 秒**不够**时 → pushState 到 /app → 但删除**没**完成 → Gemini 状态错乱
- **影响**: 长对话销毁可能**偶尔**失败（中等概率）
- **建议修复**（与侧栏 executeForgetBranch 一致）: 这个 1.5 秒**是**与侧栏 executeForgetBranch 同样的设计，**不算**新 bug —— 但**应该**未来改成 polling location.pathname 变化

## 💡 可选改进 (Nice to Have)

### 5. setInterval 2 秒重绘节点浪费性能
- **位置**: `content.js:renderSidebarTimelineInIframe` 周期渲染
- **建议**: 改用 MutationObserver 监听 iframe body 子节点变化，**只**在变化时重绘（更精细）
- **优先级**: 低（2 秒一次重绘几十个节点性能压力**不大**）

### 6. 主屏 destroy-fab 没有按钮状态机
- **位置**: `content.js:destroyMainConversation`（line ~1100+）
- **问题**: 侧栏 executeForgetBranch 有 idle/working/done/error 四态按钮（hover 看 title 知道卡点），主屏 destroy-fab **只有** ⏳ → 还原 简单文案
- **建议**: 把 setBtnState 模式**也**用到主屏 destroy-fab 上，与侧栏保持一致
- **优先级**: 低（侧栏"闪烁消失"已经做到，主屏**没**这个需求）

## 🔬 数据模拟专项审查结论
- **Mock 覆盖度评分**: N/A（项目无 Mock，纯 DOM 操作）
- **Mock 与真实数据一致性**: N/A
- **Mock 泄漏风险**: N/A

## ✅ 已验证项

- **架构一致性**:
  - 4 个 ADR（architecture.md）都**有**对应实现 ✅
  - 模块边界清晰：`renderTimeline` (主屏) / `renderSidebarTimelineInIframe` (侧栏) / `performDestroyOnDocument` (通用销毁) ✅
  - 命名规范统一：`gemini-timeline-*` (主屏) / `gemini-sidebar-timeline-*` (侧栏) 完全隔离 ✅
- **选择器兼容性**: `data-testid` + `data-test-id` 双写（executeForgetBranch）✅
- **CSS 隔离**: 侧栏 CSS 通过 `injectCSSIntoIframe` 注入 iframe doc head，**不**污染主屏 ✅
- **可维护性**:
  - 圈复杂度：`renderSidebarTimelineInIframe` 估计 8-10（< 10 阈值）✅
  - 命名一致：`humanClick` / `waitFor` / `tryClickConfirm` 命名清晰 ✅
- **PR 覆盖 PRD 验收标准**:
  - AC-1 闪烁消失 ✅（CSS 隐藏 + Observer 边听边点 + 可见性检查 bug 修复）
  - AC-2 destroy-fab 位置 ✅（bottom: -16px，嵌在时间轴内）
  - AC-3 侧栏时间轴位置 ✅（iframe.contentDocument 内 fixed 右侧）
  - AC-4 侧栏时间轴无 FAB ✅
  - AC-5 节点不串台 ✅（querySelectorAll 走 iframeDoc）
  - AC-6 多次开关不累积 interval ⚠️（**部分** —— 启动时清理；但**关侧栏时**没清理 → 见问题 1）

## 📊 统计
- **改动文件**: 2 (content.js + styles.css)
- **新增代码**: +194 行 content.js + 49 行 styles.css
- **Critical 问题**: 1 (内存泄漏)
- **Should Fix**: 2
- **Nice to Have**: 2
- **架构偏离**: 0
- **数据安全问题**: 0

---
**审查结论**: ⚠️ 需修改后合并（修复 Critical #1 + Should Fix #2 后可合并，Nice to Have 可后续优化）
