// ==========================================
// 全局变量区
// ==========================================
let floatingMenu = null;
let currentSelectedText = ""; 
let pendingConfirmAction = null; 
let isHoveringTimeline = false;
let titlePollInterval = null; 

// ==========================================
// 1. 划词双选菜单模块
// ==========================================
document.addEventListener('mouseup', (event) => {
    if (event.target.closest('#gemini-floating-menu') || event.target.closest('#gemini-parallel-sidebar')) return;
    const isInput = event.target.closest('rich-textarea') || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;
    const selectedText = window.getSelection().toString().trim();
    
    if (!isInput && selectedText.length > 2) {
        currentSelectedText = selectedText; 
        showFloatingMenu(event.pageX, event.pageY); 
    } else {
        hideFloatingMenu();
    }
});

document.addEventListener('mousedown', (event) => {
    if (floatingMenu && !floatingMenu.contains(event.target)) {
        hideFloatingMenu();
    }
});

function showFloatingMenu(x, y) {
    if (!floatingMenu) {
        floatingMenu = document.createElement('div');
        floatingMenu.id = 'gemini-floating-menu';
        floatingMenu.innerHTML = `
            <button class="gemini-menu-btn" id="btn-mode-chat">💡 平行对话</button>
            <button class="gemini-menu-btn" id="btn-mode-search">🔍 Google 搜索</button>
        `;
        document.body.appendChild(floatingMenu);

        document.getElementById('btn-mode-chat').addEventListener('click', () => {
            openSidebar(currentSelectedText, 'chat'); 
            hideFloatingMenu();
        });
        document.getElementById('btn-mode-search').addEventListener('click', () => {
            openSidebar(currentSelectedText, 'search'); 
            hideFloatingMenu();
        });
    }
    
    floatingMenu.style.visibility = 'hidden';
    floatingMenu.style.display = 'flex';
    
    const menuWidth = floatingMenu.offsetWidth || 240; 
    const menuHeight = floatingMenu.offsetHeight || 42;
    
    const isSidebarOpen = document.body.classList.contains('parallel-open');
    let sidebarWidth = 0;
    if (isSidebarOpen) {
        const rootStyle = getComputedStyle(document.documentElement);
        sidebarWidth = parseInt(rootStyle.getPropertyValue('--parallel-sidebar-width')) || 450;
    }
    
    const safeRightEdge = window.innerWidth - sidebarWidth - 20;
    let finalX = x + 10;
    let finalY = y + 10;
    
    if (finalX + menuWidth > safeRightEdge) finalX = x - menuWidth - 10;
    if (finalY + menuHeight > window.innerHeight - 20) finalY = y - menuHeight - 10;
    
    floatingMenu.style.left = `${finalX}px`;
    floatingMenu.style.top = `${finalY}px`;
    floatingMenu.style.visibility = 'visible';
}

function hideFloatingMenu() {
    if (floatingMenu) floatingMenu.style.display = 'none';
}

// ==========================================
// 2. 侧边栏与核心业务模块
// ==========================================
function getTargetUrl() {
    const path = window.location.pathname;
    const accountMatch = path.match(/^\/u\/\d+/);
    const accountPrefix = accountMatch ? accountMatch[0] : '';
    return window.location.origin + accountPrefix + '/app' + window.location.search;
}

const closeSidebar = () => {
    console.log("执行彻底清理...");
    const sidebar = document.getElementById('gemini-parallel-sidebar');
    
    if (sidebar) {
        sidebar.classList.remove('open');
        document.body.classList.remove('parallel-open');
        document.documentElement.style.setProperty('--parallel-sidebar-width', '0px');
        setTimeout(() => { if (sidebar.parentNode) sidebar.remove(); }, 300);
    }

    if (titlePollInterval) {
        clearInterval(titlePollInterval);
        titlePollInterval = null; 
    }

    // 【2026-06-04 Reviewer Critical #1 修复】：关掉侧栏时清理侧栏时间轴的 setInterval
    // 之前漏了：interval 闭包持有 iframeDoc 引用 → 阻止 GC 回收 iframe → 内存泄漏
    const iframe = document.getElementById('gemini-ghost-frame');
    if (iframe && iframe._sidebarTimelineInterval) {
        clearInterval(iframe._sidebarTimelineInterval);
        iframe._sidebarTimelineInterval = null;
    }
};

function renderMainFloatingTitle() {
    let floatingTitle = document.getElementById('gemini-main-floating-title');
    if (!floatingTitle) {
        floatingTitle = document.createElement('div');
        floatingTitle.id = 'gemini-main-floating-title';
        document.body.appendChild(floatingTitle);
    }
    
    const titleNode = document.querySelector('[data-test-id="conversation-title"]');
    const actualTitle = titleNode ? titleNode.innerText.trim() : '主干对话';

    floatingTitle.innerHTML = `
        <span class="gemini-float-title-icon">💬</span>
        <span class="gemini-float-title-text" title="${actualTitle}">${actualTitle}</span>
        <span class="gemini-float-title-action" title="更多功能">⋮</span>
    `;
}

function mergeToMain() {
    const iframe = document.getElementById('gemini-ghost-frame');
    if (!iframe) return;
    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const responses = iframeDoc.querySelectorAll('message-content');
        let branchResult = responses.length > 0 ? responses[responses.length - 1].innerText.trim() : "【未能自动提取到回答，请手动复制】";

        const mainEditorDiv = document.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
        if (mainEditorDiv) {
            const paragraph = document.createElement('p');
            paragraph.textContent = `\n【来自平行分支的结论】：\n${branchResult}\n\n`;
            mainEditorDiv.appendChild(paragraph);
            mainEditorDiv.focus();
            mainEditorDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        closeSidebar();
    } catch (e) { alert("提取失败，请手动复制。"); }
}

function openSidebar(textContext, mode) {
    let sidebar = document.getElementById('gemini-parallel-sidebar');
    document.documentElement.style.setProperty('--parallel-sidebar-width', '450px'); 
    
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'gemini-parallel-sidebar';
        document.body.appendChild(sidebar);
    }

    sidebar.innerHTML = '';
    renderMainFloatingTitle();

    if (mode === 'chat') {
        // 【核心修复】：防止模板变量被破坏，使用绝对安全的字符串拼接
        // 【全新功能】：按钮合并入标题区域，带有抗挤压保护
        sidebar.innerHTML = `
            <div id="gemini-sidebar-resizer"></div>
            <div id="gemini-sidebar-header">
                <div id="gemini-close-sidebar" class="gemini-action-glass-btn" title="关闭分支">✖</div>
                
                <div id="gemini-sidebar-floating-title" style="max-width: 90% !important;">
                    <span class="gemini-float-title-icon" style="flex-shrink: 0;">💡</span>
                    <span class="gemini-float-title-text" style="flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">平行推演分支</span>
                    
                    <div style="display: flex; align-items: center; gap: 4px; margin-left: auto; padding-left: 10px; border-left: 1px solid var(--gemini-border, rgba(0,0,0,0.1)); flex-shrink: 0;">
                        <button id="gemini-btn-forget" class="gemini-action-btn" style="white-space: nowrap; flex-shrink: 0; border: none; background: transparent; padding: 4px 8px; font-size: 12px; cursor: pointer; color: inherit;">🗑️ 遗忘</button>
                        <button id="gemini-btn-merge" class="gemini-action-btn primary" style="white-space: nowrap; flex-shrink: 0; border: none; background: transparent; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #0b57d0; font-weight: 600;">✨ 合并</button>
                    </div>
                    <span class="gemini-float-title-action" title="更多" style="flex-shrink: 0; margin-left: 4px;">⋮</span>
                </div>
            </div>
            <iframe id="gemini-ghost-frame" src="` + getTargetUrl() + `"></iframe>
        `;
        
        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        document.getElementById('gemini-btn-forget').addEventListener('click', () => showConfirmDialog('forget'));
        document.getElementById('gemini-btn-merge').addEventListener('click', () => showConfirmDialog('merge'));
        
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.onload = () => {
            if (iframe.src === 'about:blank') return;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            injectCSSIntoIframe(iframeDoc);

            // 【新增】在侧栏 iframe 内创建独立时间轴（每个会话/窗口独立）
            // 按用户决定：侧栏时间轴不嵌 FAB（侧栏标题栏的 🗑️ 遗忘继续用）
            renderSidebarTimelineInIframe(iframe);
            // 启动周期渲染（用 iframe 自身存 interval ID，避免多 iframe 累积）
            if (iframe._sidebarTimelineInterval) clearInterval(iframe._sidebarTimelineInterval);
            iframe._sidebarTimelineInterval = setInterval(() => {
                // 【2026-06-04 Reviewer Critical #2 修复】：setInterval 回调本身也包 try/catch
                // 防止 renderSidebarTimelineInIframe 抛错时整条 setInterval 链路崩
                try {
                    renderSidebarTimelineInIframe(iframe);
                } catch (e) {
                    // 任何意外错误，silently ignore（避免刷控制台）
                }
            }, 2000);

            // 【核心修改】：只有当 textContext 有真实内容时，才去向输入框注入并发送文字
            if (textContext && textContext.trim() !== '') {
                injectTextAndSend(iframe, textContext);
            }
            
            if (titlePollInterval) clearInterval(titlePollInterval);
            titlePollInterval = setInterval(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const titleNode = iframeDoc.querySelector('[data-test-id="conversation-title"]');
                    if (titleNode && titleNode.innerText.trim()) {
                        const newTitle = titleNode.innerText.trim();
                        const titleSpan = document.querySelector('#gemini-sidebar-floating-title .gemini-float-title-text');
                        if (titleSpan && titleSpan.innerText !== newTitle) {
                            titleSpan.innerText = newTitle;
                            titleSpan.title = newTitle; 
                        }
                    }
                } catch (e) {}
            }, 1000); 
        };
    } else if (mode === 'search') {
        sidebar.innerHTML = `
            <div id="gemini-sidebar-resizer"></div>
            <div id="gemini-sidebar-header">
                <div id="gemini-close-sidebar" class="gemini-action-glass-btn" title="关闭搜索">✖</div>
                <div id="gemini-sidebar-floating-title">
                    <span class="gemini-float-title-icon">🔍</span>
                    <input type="text" id="gemini-search-input" class="gemini-search-input" value="${textContext}" placeholder="输入新词并回车...">
                    <span class="gemini-float-title-action" title="更多">⋮</span>
                </div>
            </div>
            <div id="gemini-search-results-container"></div>
        `;
        
        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        
        const searchInput = document.getElementById('gemini-search-input');
        const container = document.getElementById('gemini-search-results-container');

        const performSearch = (queryKeyword) => {
            if (!queryKeyword.trim()) return; 
            container.innerHTML = `<div class="gemini-loading-text">正在从 Google 获取结果... 🕵️‍♂️</div>`;
            chrome.runtime.sendMessage({ action: "fetchGoogleSearch", query: queryKeyword }, (response) => {
                const currentContainer = document.getElementById('gemini-search-results-container');
                if (!currentContainer) return; 
                if (response && response.success) {
                    renderSearchResults(response.html, currentContainer);
                } else {
                    currentContainer.innerHTML = `<div class="gemini-loading-text" style="color: #d93025;">获取搜索结果失败，请检查网络或刷新重试。</div>`;
                }
            });
        };

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchInput.blur(); 
                performSearch(searchInput.value); 
            }
        });
        searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
        performSearch(textContext);
    }
    initResizer(sidebar);

    setTimeout(() => {
        sidebar.classList.add('open');
        document.body.classList.add('parallel-open');
    }, 50);
}

function renderSearchResults(htmlString, container) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const titleHeaders = doc.querySelectorAll('a h3');
    let resultsHtml = '';
    let count = 0;

    titleHeaders.forEach(h3 => {
        if (count >= 10) return; 
        const linkElement = h3.closest('a');
        if (!linkElement) return;

        let url = linkElement.getAttribute('href');
        if (!url || url.startsWith('/search?') || url.startsWith('javascript:')) return;

        if (url.startsWith('/url?q=')) {
            url = decodeURIComponent(url.split('/url?q=')[1].split('&')[0]);
        } else if (url.startsWith('/url?url=')) {
            url = decodeURIComponent(url.split('/url?url=')[1].split('&')[0]);
        }

        const title = h3.innerText.trim();
        if (!title) return;

        let snippet = "";
        const resultBlock = linkElement.closest('div') || linkElement.parentElement.parentElement;
        if (resultBlock) {
            const snippetDivs = resultBlock.querySelectorAll('div[style*="-webkit-line-clamp"], .VwiC3b, .aCOpRe');
            if (snippetDivs.length > 0) {
                snippet = snippetDivs[0].innerText.trim();
            } else {
                let rawText = resultBlock.innerText.replace(title, '');
                snippet = rawText.substring(0, 150).trim() + (rawText.length > 150 ? '...' : '');
            }
        }

        if (url.startsWith('http')) {
            try {
                const hostname = new URL(url).hostname;
                resultsHtml += `
                    <div class="gemini-search-card">
                        <a href="${url}" target="_blank" class="gemini-search-title">${title}</a>
                        <div class="gemini-search-url">${hostname}</div>
                        <div class="gemini-search-snippet">${snippet}</div>
                    </div>
                `;
                count++;
            } catch (e) {}
        }
    });

    if (resultsHtml === '') {
        container.innerHTML = `<div class="gemini-loading-text" style="color: #d93025; line-height: 1.6;"><p>未能解析到结果 😕</p></div>`;
    } else {
        container.innerHTML = resultsHtml;
    }
}

function injectCSSIntoIframe(iframeDoc) {
    try {
        const style = iframeDoc.createElement('style');
        style.textContent = `
            /* === 透明化主框架，让侧栏看起来像 overlay === */
            header { display: none !important; }
            navigation-drawer, nav, [aria-label="Navigation drawer"] { display: none !important; }
            body, app-root, main { background: transparent !important; background-color: transparent !important; }
            .chat-history { padding-top: 10px !important; padding-bottom: 80px !important; }

            /* === 侧栏时间轴（id 前缀 gemini-sidebar-timeline-*，与主屏 #gemini-timeline-* 隔离）===
               按用户决定：侧栏时间轴不嵌 FAB（避免太乱），侧栏标题栏的 🗑️ 遗忘按钮继续用 */
            #gemini-sidebar-timeline-container {
                position: fixed !important;
                right: 20px !important;
                /* 侧栏顶部有"平行推演分支"标题栏（约 60-80px），所以 top 给大些 */
                top: 90px !important;
                bottom: 100px !important;
                width: 30px !important;
                z-index: 9999 !important;
                pointer-events: auto !important;
            }
            #gemini-sidebar-timeline-track {
                position: absolute;
                left: 9px;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #dadce0;
            }
            .gemini-sidebar-node {
                position: absolute;
                left: 4px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #a8c7fa;
                border: 2px solid #ffffff;
                pointer-events: auto;
                transform: translateY(-50%);
                transition: all 0.2s ease;
            }
            .gemini-sidebar-node:hover {
                background: #0b57d0;
                transform: translateY(-50%) scale(1.3);
                z-index: 10;
            }
            .gemini-sidebar-timeline-action-btn {
                position: absolute;
                left: 10px;
                transform: translateX(-50%);
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: var(--gemini-island-bg, rgba(255,255,255,0.85));
                border: 1px solid var(--gemini-border, rgba(0,0,0,0.1));
                color: var(--gemini-text-sub, #5f6368);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0;
                pointer-events: none;
            }
            .gemini-sidebar-timeline-action-btn.show {
                opacity: 1;
                pointer-events: auto;
            }
            .gemini-sidebar-timeline-action-btn:hover {
                color: #0b57d0;
                border-color: #0b57d0;
                background: #e8f0fe;
                transform: translateX(-50%) scale(1.15);
            }
            #gemini-sidebar-timeline-top-btn { top: -36px; }
            #gemini-sidebar-timeline-bottom-btn { bottom: -36px; }
        `;
        iframeDoc.head.appendChild(style);
    } catch (e) {}
}

// ============================================================================
// 侧栏时间轴：在 iframe.contentDocument 内独立创建时间轴（无 FAB）
// 每个会话（窗口）独立 —— 主屏时间轴在主屏 doc 内、侧栏时间轴在侧栏 iframe doc 内
// 侧栏时间轴嵌在 iframe 内，fixed 在 iframe viewport 右侧
// 按用户决定：侧栏不嵌 FAB（避免视觉杂乱），仅 ↑↓ 跳转按钮 + 节点
// ============================================================================
function renderSidebarTimelineInIframe(iframe) {
    // 【2026-06-04 Reviewer Critical #2 修复】：包 try/catch，防止 iframeDoc 不可访问时抛错刷控制台
    // 侧栏关闭中途 / iframe 被 GC 后，iframeDoc.body 可能不可访问 → 不包会刷错
    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) return;

    // 1. 首次创建时间轴容器（只在不存在时创建）
    let container = iframeDoc.getElementById('gemini-sidebar-timeline-container');
    if (!container) {
        container = iframeDoc.createElement('div');
        container.id = 'gemini-sidebar-timeline-container';
        container.innerHTML = `
            <div id="gemini-sidebar-timeline-top-btn" class="gemini-sidebar-timeline-action-btn" title="回到首条对话">↑</div>
            <div id="gemini-sidebar-timeline-track"></div>
            <div id="gemini-sidebar-timeline-bottom-btn" class="gemini-sidebar-timeline-action-btn" title="前往最新对话">↓</div>
        `;
        iframeDoc.body.appendChild(container);

        // 绑定 ↑↓ 按钮
        const topBtn = iframeDoc.getElementById('gemini-sidebar-timeline-top-btn');
        const bottomBtn = iframeDoc.getElementById('gemini-sidebar-timeline-bottom-btn');

        if (topBtn) {
            topBtn.addEventListener('click', () => {
                const queries = iframeDoc.querySelectorAll('.query-text');
                if (queries.length > 0) queries[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
        if (bottomBtn) {
            bottomBtn.addEventListener('click', () => {
                const queries = iframeDoc.querySelectorAll('.query-text');
                if (queries.length > 0) queries[queries.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        // 防抖滚动检测（HEAD 模式：true 捕获模式，监听 iframe doc 滚动）
        const checkScroll = () => {
            if (!topBtn || !bottomBtn) return;
            const queries = iframeDoc.querySelectorAll('.query-text');
            if (queries.length === 0) {
                topBtn.classList.remove('show');
                bottomBtn.classList.remove('show');
                return;
            }
            const firstRect = queries[0].getBoundingClientRect();
            const lastRect = queries[queries.length - 1].getBoundingClientRect();
            const viewH = (iframeDoc.defaultView || iframe.contentWindow).innerHeight;
            if (firstRect.top < 0) topBtn.classList.add('show');
            else topBtn.classList.remove('show');
            if (lastRect.bottom > viewH) bottomBtn.classList.add('show');
            else bottomBtn.classList.remove('show');
        };
        iframeDoc.addEventListener('scroll', checkScroll, true);
        (iframeDoc.defaultView || iframe.contentWindow).addEventListener('resize', checkScroll);
        container.checkScroll = checkScroll;
    }

    // 2. 渲染节点（每次都跑）
    if (container.isHoveringSidebarTimeline) return;  // 简化：暂不锁 hover

    const queries = Array.from(iframeDoc.querySelectorAll('.query-text'));
    if (queries.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    // 清旧节点
    const oldNodes = container.querySelectorAll('.gemini-sidebar-node');
    oldNodes.forEach(n => n.remove());

    // 计算 cumulativeHeight（与主屏 renderTimeline 一致）
    let cumulativeHeight = 0;
    const chatData = [];
    const iframeResponses = Array.from(iframeDoc.querySelectorAll('message-content'));
    queries.forEach((q, i) => {
        const r = iframeResponses[i];
        const qHeight = q.offsetHeight || 50;
        const rHeight = r ? r.offsetHeight : 50;
        const blockHeight = qHeight + rHeight + 60;
        chatData.push({ queryElement: q, responseElement: r, topOffset: cumulativeHeight });
        cumulativeHeight += blockHeight;
    });

    const trackMaxHeight = Math.max(cumulativeHeight, 800);

    chatData.forEach((data, index) => {
        let topPercentage = (data.topOffset / trackMaxHeight) * 100;
        topPercentage = Math.min(topPercentage, 98);

        const node = iframeDoc.createElement('div');
        node.className = 'gemini-sidebar-node';
        node.style.top = `${topPercentage}%`;

        // 简单 tooltip：仅显示"对话 N"
        node.innerHTML = `<div class="gemini-sidebar-tooltip">对话 ${index + 1}</div>`;

        node.addEventListener('click', () => {
            data.queryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        container.appendChild(node);
    });

    // 校准一次 ↑↓ 按钮
    if (container.checkScroll) container.checkScroll();
    } catch (e) {
        // iframe 已被移除 / body 不可访问 / 任何其他异常 → silently ignore
        // 关键是不要把错误抛到 setInterval 回调里（会刷控制台）
    }
}

function injectTextAndSend(iframe, text) {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const promptArea = iframeDoc.querySelector('.ql-editor') || iframeDoc.querySelector('[contenteditable="true"]');

    if (promptArea) {
        promptArea.focus();
        promptArea.innerHTML = '';

        const firstLine = iframeDoc.createElement('p');
        const boldGuide = iframeDoc.createElement('strong');
        boldGuide.textContent = "请基于当前上下文：";
        const quoteText = iframeDoc.createTextNode(`“${text}”`);
        firstLine.appendChild(boldGuide);
        firstLine.appendChild(quoteText);

        const secondLine = iframeDoc.createElement('p');
        const br = iframeDoc.createElement('br');
        secondLine.appendChild(br);

        promptArea.appendChild(firstLine);
        promptArea.appendChild(secondLine);

        const selection = iframe.contentWindow.getSelection();
        const range = iframeDoc.createRange();
        range.setStart(secondLine, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        promptArea.dispatchEvent(new Event('input', { bubbles: true }));
        promptArea.dispatchEvent(new Event('compositionend', { bubbles: true }));
    } else {
        setTimeout(() => injectTextAndSend(iframe, text), 500);
    }
}

function initResizer(sidebar) {
    const resizer = document.getElementById('gemini-sidebar-resizer');
    const iframe = document.getElementById('gemini-ghost-frame'); 
    let isResizing = false;
    
    if (!resizer) return;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        if (iframe) iframe.classList.add('iframe-dragging');
        document.body.classList.add('parallel-dragging'); 
        document.body.style.transition = 'none';
        e.preventDefault(); 
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 300 && newWidth < 800) {
            document.documentElement.style.setProperty('--parallel-sidebar-width', `${newWidth}px`);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            if (iframe) iframe.classList.remove('iframe-dragging');
            document.body.classList.remove('parallel-dragging'); 
            document.body.style.transition = 'width 0.3s ease';
        }
    });
}

// ==========================================
// 3. 全局确认弹窗系统
// ==========================================
function initGlobalDialog() {
    if (document.getElementById('gemini-confirm-dialog')) return;
    const dialog = document.createElement('div');
    dialog.id = 'gemini-confirm-dialog';
    dialog.innerHTML = `
        <div class="gemini-confirm-box">
            <div id="gemini-confirm-title">确认</div>
            <div id="gemini-confirm-desc">描述</div>
            <div class="gemini-confirm-btns">
                <button id="gemini-confirm-cancel" class="gemini-confirm-btn">取消</button>
                <button id="gemini-confirm-ok" class="gemini-confirm-btn">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('gemini-confirm-cancel').addEventListener('click', () => {
        document.getElementById('gemini-confirm-dialog').style.display = 'none';
        pendingConfirmAction = null;
    });
    
    document.getElementById('gemini-confirm-ok').addEventListener('click', () => {
        document.getElementById('gemini-confirm-dialog').style.display = 'none';
        if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null; }
    });
}

function showConfirmDialog(actionType, customAction = null) {
    initGlobalDialog(); 
    const dialog = document.getElementById('gemini-confirm-dialog');
    const title = document.getElementById('gemini-confirm-title');
    const desc = document.getElementById('gemini-confirm-desc');
    const okBtn = document.getElementById('gemini-confirm-ok');

    if (actionType === 'forget') {
        title.textContent = '🗑️ 确认遗忘分支？';
        desc.textContent = '当前分支对话将被永久清空。相当于无事发生。';
        okBtn.style.backgroundColor = '#d93025'; 
        okBtn.textContent = '确认遗忘';
        pendingConfirmAction = () => { executeForgetBranch(); }; 
    } else if (actionType === 'forget_main') {
        title.textContent = '🗑️ 确认销毁当前会话？';
        desc.textContent = '主屏幕当前会话将被永久从云端删除，此操作不可恢复。';
        okBtn.style.backgroundColor = '#d93025';
        okBtn.textContent = '永久销毁';
        pendingConfirmAction = () => { destroyMainConversation(); };
    } else if (actionType === 'merge') {
        title.textContent = '✨ 确认合并至主干？';
        desc.textContent = '提取本分支中 AI 的最后一次回答填入主页面。';
        okBtn.style.backgroundColor = '#1a73e8'; 
        okBtn.textContent = '确认合并';
        pendingConfirmAction = () => { mergeToMain(); };
    } else if (actionType === 'delete_node') {
        title.textContent = '🗑️ 确认隐藏此对话？';
        desc.textContent = '仅在当前页面隐藏该轮问答。';
        okBtn.style.backgroundColor = '#d93025'; 
        okBtn.textContent = '确认隐藏';
        pendingConfirmAction = customAction; 
    }
    dialog.style.display = 'flex'; 
}

// ==========================================
// 3.5 Gemini 对话导出系统
// ==========================================
function getVisibleConversationQueries() {
    const isVisibleConversationNode = (node) => {
        if (!node) return false;
        const container = node.closest('.user-message-container, .model-message-container, [data-message-author-role], message, .conversation-turn') || node;
        const style = window.getComputedStyle(container);
        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && container.getClientRects().length > 0;
    };
    return Array.from(document.querySelectorAll('.query-text')).filter(isVisibleConversationNode);
}

function cleanExportText(text) {
    return (text || '')
        .replace(/You said/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function findResponseForQuery(queryElement, allResponses, nextQueryElement = null) {
    return allResponses.find(responseElement => {
        const isAfterQuery = Boolean(queryElement.compareDocumentPosition(responseElement) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!isAfterQuery) return false;
        if (!nextQueryElement) return true;
        return Boolean(responseElement.compareDocumentPosition(nextQueryElement) & Node.DOCUMENT_POSITION_FOLLOWING);
    }) || null;
}

function collectGeminiConversation() {
    const queries = getVisibleConversationQueries();
    const responses = Array.from(document.querySelectorAll('message-content'));
    return queries.map((queryElement, index) => {
        const responseElement = findResponseForQuery(queryElement, responses, queries[index + 1]);
        return {
            index: index + 1,
            question: cleanExportText(queryElement.innerText || queryElement.textContent),
            answer: responseElement
                ? cleanExportText(responseElement.innerText || responseElement.textContent)
                : '',
        };
    }).filter(item => item.question || item.answer);
}

function getConversationTitleForExport() {
    const titleNode = document.querySelector('[data-test-id="conversation-title"], [data-testid="conversation-title"]');
    return cleanExportText(titleNode ? titleNode.innerText : '') || 'Gemini 对话导出';
}

function summarizeQuestions(conversation) {
    return conversation
        .map(item => item.question)
        .filter(Boolean)
        .slice(0, 12)
        .map((question, index) => `${index + 1}. ${question.length > 120 ? question.slice(0, 120) + '...' : question}`)
        .join('\n');
}

function buildFullMarkdownExport(conversation) {
    const title = getConversationTitleForExport();
    const exportedAt = new Date().toLocaleString();
    const parts = [
        `# ${title}`,
        '',
        `> 导出时间：${exportedAt}`,
        `> 来源：${location.href}`,
        '',
    ];
    conversation.forEach(item => {
        parts.push(`## 第 ${item.index} 轮`, '');
        parts.push('### 用户提问', '', item.question || '[空]', '');
        parts.push('### Gemini 回答', '', item.answer || '[未找到回答]', '');
    });
    return parts.join('\n');
}

function buildProjectContextExport(conversation) {
    const title = getConversationTitleForExport();
    const exportedAt = new Date().toLocaleString();
    const questions = summarizeQuestions(conversation);
    const parts = [
        `# 项目上下文：${title}`,
        '',
        `> 从 Gemini 对话导出，导出时间：${exportedAt}`,
        `> 原始链接：${location.href}`,
        '',
        '## 项目背景',
        '',
        '以下内容来自一段 Gemini 对话，可作为后续项目启动、需求梳理或交接的上下文。',
        '',
        '## 已讨论的问题',
        '',
        questions || '- 暂无可识别的用户提问',
        '',
        '## 可直接交给新会话的启动提示',
        '',
        '请基于下面的原始对话记录，整理项目目标、关键约束、已达成决策、待确认问题和下一步执行计划。保留用户真实意图，避免引入对话中没有出现的新需求。',
        '',
        '## 原始对话记录',
        '',
    ];
    conversation.forEach(item => {
        parts.push(`### 第 ${item.index} 轮：用户`, '', item.question || '[空]', '');
        parts.push(`### 第 ${item.index} 轮：Gemini`, '', item.answer || '[未找到回答]', '');
    });
    return parts.join('\n');
}

function downloadTextFile(filename, content, mimeType = 'text/markdown;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportGeminiConversation(mode) {
    const conversation = collectGeminiConversation();
    if (conversation.length === 0) {
        alert('当前页面没有可导出的 Gemini 对话。');
        return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    if (mode === 'json') {
        const payload = {
            title: getConversationTitleForExport(),
            source: location.href,
            exportedAt: new Date().toISOString(),
            conversation,
        };
        downloadTextFile(`gemini-conversation-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
        return;
    }
    if (mode === 'full') {
        downloadTextFile(`gemini-conversation-${stamp}.md`, buildFullMarkdownExport(conversation));
        return;
    }
    downloadTextFile(`gemini-project-context-${stamp}.md`, buildProjectContextExport(conversation));
}

function toggleExportMenu(forceOpen = null) {
    const menu = document.getElementById('gemini-timeline-export-menu');
    if (!menu) return;
    const shouldOpen = forceOpen === null ? !menu.classList.contains('show') : forceOpen;
    menu.classList.toggle('show', shouldOpen);
}

// ==========================================
// 4. 时间轴心跳引擎 v2.1
// ==========================================
let timelineContainer = null;

function renderTimeline() {
    if (!document.getElementById('gemini-timeline-container')) {
        timelineContainer = document.createElement('div');
        timelineContainer.id = 'gemini-timeline-container';
        
        // 注入包含五个组件的 HTML（2 个 FAB 都嵌在时间轴内，紧贴时间轴）
        timelineContainer.innerHTML = `
            <div id="gemini-timeline-top-btn" class="gemini-timeline-action-btn" title="回到首条对话">↑</div>
            <div id="gemini-timeline-track"></div>
            <div id="gemini-timeline-bottom-btn" class="gemini-timeline-action-btn" title="前往最新对话">↓</div>
            <div id="gemini-timeline-destroy-fab" title="销毁当前窗口会话（永久删除云端记录）"><span style="font-size: 16px;">🗑️</span> 销毁窗口</div>
            <div id="gemini-timeline-export-fab" title="导出当前 Gemini 对话"><span style="font-size: 16px;">📦</span> 导出对话</div>
            <div id="gemini-timeline-export-menu">
                <button class="gemini-export-option" data-export-mode="context">项目上下文</button>
                <button class="gemini-export-option" data-export-mode="full">完整 Markdown</button>
                <button class="gemini-export-option" data-export-mode="json">JSON 数据</button>
            </div>
            <div id="gemini-timeline-fab" title="主动开启平行搜索"><span style="font-size: 16px;">🔍</span> 平行搜索</div>
        `;
        
        timelineContainer.addEventListener('mouseenter', () => { isHoveringTimeline = true; });
        timelineContainer.addEventListener('mouseleave', () => { isHoveringTimeline = false; });
        document.body.appendChild(timelineContainer);

        // --- 绑定点击事件 ---
        // 1. 主动唤起搜索：传空字符串，打开搜索侧栏后由用户输入关键词
        document.getElementById('gemini-timeline-fab').addEventListener('click', () => {
            openSidebar('', 'search');
        });

        document.getElementById('gemini-timeline-export-fab').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExportMenu();
        });

        document.querySelectorAll('#gemini-timeline-export-menu .gemini-export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleExportMenu(false);
                exportGeminiConversation(option.getAttribute('data-export-mode'));
            });
        });

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#gemini-timeline-export-fab') && !e.target.closest('#gemini-timeline-export-menu')) {
                toggleExportMenu(false);
            }
        });

        // 1.5 销毁主屏幕当前会话：弹出确认框，确认后物理删除
        document.getElementById('gemini-timeline-destroy-fab').addEventListener('click', () => {
            showConfirmDialog('forget_main');
        });

        // 2. 回到顶部
        document.getElementById('gemini-timeline-top-btn').addEventListener('click', () => {
            const queries = document.querySelectorAll('.query-text');
            if (queries.length > 0) queries[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // 3. 前往底部
        document.getElementById('gemini-timeline-bottom-btn').addEventListener('click', () => {
            const queries = document.querySelectorAll('.query-text');
            if (queries.length > 0) queries[queries.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // --- 核心防抖滚动检测引擎：判断是否需要显示上下箭头 ---
        const checkScroll = () => {
            const topBtn = document.getElementById('gemini-timeline-top-btn');
            const bottomBtn = document.getElementById('gemini-timeline-bottom-btn');
            if (!topBtn || !bottomBtn) return;

            const queries = document.querySelectorAll('.query-text');
            if (queries.length === 0) {
                topBtn.classList.remove('show');
                bottomBtn.classList.remove('show');
                return;
            }

            const firstRect = queries[0].getBoundingClientRect();
            const lastRect = queries[queries.length - 1].getBoundingClientRect();

            // 如果第一条对话已经被卷到屏幕上方不可见处
            if (firstRect.top < 0) topBtn.classList.add('show');
            else topBtn.classList.remove('show');

            // 如果最后一条对话还隐藏在屏幕下方未滚动到
            if (lastRect.bottom > window.innerHeight) bottomBtn.classList.add('show');
            else bottomBtn.classList.remove('show');
        };

        // 监听浏览器全局滚动事件 (使用 true 捕获模式，无视嵌套结构)
        document.addEventListener('scroll', checkScroll, true);
        window.addEventListener('resize', checkScroll);
        
        // 将检测函数挂载到容器上，方便每次刷新时间轴时主动校准一次
        timelineContainer.checkScroll = checkScroll;
    } else {
        timelineContainer = document.getElementById('gemini-timeline-container');
    }

    // 在这之后是你原本抓取 queries 渲染 node 的代码...

    if (isHoveringTimeline) return;

    const queries = getVisibleConversationQueries();
    const responses = Array.from(document.querySelectorAll('message-content'));

    if (queries.length === 0) {
        timelineContainer.style.display = 'none';
        return;
    }
    timelineContainer.style.display = 'block';

    const oldNodes = timelineContainer.querySelectorAll('.gemini-node');
    oldNodes.forEach(n => n.remove());

    let cumulativeHeight = 0;
    const chatData = [];

    queries.forEach((q, i) => {
        const r = findResponseForQuery(q, responses, queries[i + 1]);
        const qHeight = q.offsetHeight || 50;
        const rHeight = r ? r.offsetHeight : 50;
        const blockHeight = qHeight + rHeight + 60; 
        
        chatData.push({ queryElement: q, responseElement: r, topOffset: cumulativeHeight });
        cumulativeHeight += blockHeight;

        // ==================================================================
        // 【完全体】：带选项、自动展开、防阻塞与专属水印的长图引擎
        // ==================================================================
        if (r) {
            const targetParent = r.parentElement;
            
            if (targetParent && !targetParent.querySelector('.gemini-screenshot-wrapper')) {
                const btnWrapper = document.createElement('div');
                btnWrapper.className = 'gemini-screenshot-wrapper html2canvas-ignore'; 
                btnWrapper.style.cssText = 'display: flex !important; justify-content: flex-end; margin-top: 10px; width: 100%;';
                
                // 【UI 升级】：注入包含下拉菜单的 DOM 结构
                btnWrapper.innerHTML = `
                    <div class="gemini-screenshot-dropdown">
                        <button class="gemini-screenshot-btn" title="保存完整高清长图">📸 存为长图</button>
                        <div class="gemini-screenshot-menu">
                            <div class="gemini-screenshot-option" data-mode="answer">✨ 仅保存此回答</div>
                            <div class="gemini-screenshot-option" data-mode="both">💬 包含完整问答</div>
                        </div>
                    </div>
                `;
                
                if (r.nextSibling) targetParent.insertBefore(btnWrapper, r.nextSibling);
                else targetParent.appendChild(btnWrapper);
                
                const dropdown = btnWrapper.querySelector('.gemini-screenshot-dropdown');
                const mainBtn = btnWrapper.querySelector('.gemini-screenshot-btn');
                const options = btnWrapper.querySelectorAll('.gemini-screenshot-option');
                
                // 遍历绑定两个菜单项的点击事件
                options.forEach(opt => {
                    opt.addEventListener('click', async (e) => {
                        e.stopPropagation(); // 阻止事件冒泡
                        if (mainBtn.innerText.includes('正在')) return; 

                        const includeQuery = opt.getAttribute('data-mode') === 'both';
                        
                        // 1. 状态变更：锁死 UI，防止重复点击
                        const originalText = mainBtn.innerHTML;
                        mainBtn.innerHTML = '⏳ 生成中...';
                        mainBtn.style.opacity = '0.7';
                        dropdown.style.pointerEvents = 'none'; 
                        btnWrapper.querySelector('.gemini-screenshot-menu').style.display = 'none'; // 强制隐藏菜单
                        
                        await new Promise(resolve => setTimeout(resolve, 50));
                        
                        // 记录被我们临时隐身的元素，稍后恢复
                        let ignoredElements = [];
                        
                        try {
                            const qBlock = q.closest('user-message, user-query, [data-test-id="user-message"], .user-message-container') || q.parentElement.parentElement;
                            const rBlock = r.closest('model-message, [data-test-id="model-message"], .model-message-container') || targetParent;
                            
                            const isDark = document.body.classList.contains('dark-theme') || getComputedStyle(document.body).backgroundColor === 'rgb(19, 19, 20)';
                            const bgColor = isDark ? '#131314' : '#ffffff';
                            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

                            // ==========================================
                            // 【核心修复 1】：创建“绝对隐身”的外壳，彻底断绝鬼影
                            // ==========================================
                            const ghostWrapper = document.createElement('div');
                            ghostWrapper.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; overflow: hidden; z-index: -9999; pointer-events: none;';

                            const virtualBoard = document.createElement('div');
                            const rWidth = rBlock.offsetWidth || Math.min(window.innerWidth * 0.8, 800); 
                            
                            virtualBoard.style.cssText = `
                                width: ${rWidth}px;
                                background-color: ${bgColor};
                                padding: 40px;
                                box-sizing: border-box;
                            `;

                            // ==========================================
                            // 【核心修复 2】：时间冻结，瞬间掐断所有复播动画
                            // ==========================================
                            const noAnimationStyle = document.createElement('style');
                            noAnimationStyle.textContent = '* { animation: none !important; transition: none !important; }';
                            virtualBoard.appendChild(noAnimationStyle);

                            // ==========================================
                            // 区域 1：「问题区」
                            // ==========================================
                            if (includeQuery && q) {
                                const qBgColor = isDark ? '#2a2a2a' : '#f0f4f9';
                                const textColor = isDark ? '#e3e3e3' : '#1f1f1f';

                                const qCloneForText = q.cloneNode(true);
                                qCloneForText.querySelectorAll('button, mat-icon, [role="button"], svg').forEach(el => el.remove());
                                let fullText = qCloneForText.textContent.replace(/You said/gi, '').trim();

                                const qArea = document.createElement('div');
                                qArea.style.cssText = `
                                    background-color: ${qBgColor};
                                    color: ${textColor};
                                    padding: 24px;
                                    border-radius: 16px;
                                    margin-bottom: 32px;
                                    font-size: 16px;
                                    line-height: 1.6;
                                    white-space: pre-wrap; 
                                    word-break: break-word;
                                    border: 1px solid ${borderColor};
                                `;
                                qArea.innerHTML = `<div style="font-size: 13px; font-weight: bold; margin-bottom: 12px; color: ${isDark?'#9aa0a6':'#5f6368'};">🙋‍♂️ 我的提问</div>${fullText}`;
                                virtualBoard.appendChild(qArea);
                            }

                            // ==========================================
                            // 区域 2：「回答区」
                            // ==========================================
                            const rAreaWrapper = document.createElement('div');
                            rAreaWrapper.style.width = '100%';
                            rAreaWrapper.innerHTML = `<div style="font-size: 13px; font-weight: bold; margin-bottom: 16px; color: ${isDark?'#9aa0a6':'#5f6368'};">✨ Gemini 的推演回答</div>`;

                            const rClone = rBlock.cloneNode(true);
                            rClone.style.width = '100%';
                            rClone.style.maxWidth = '100%';
                            
                            // 【核心增强】：暴力解除长代码块的滚动条，让其在长图中完全铺开展开
                            rClone.style.setProperty('max-height', 'none', 'important');
                            rClone.style.setProperty('overflow', 'visible', 'important');
                            // ==========================================
                            // 【终极排版修复】：解除高度限制，并强制所有长文本安全换行
                            // ==========================================
                            rClone.querySelectorAll('*').forEach(el => {
                                // 1. 解除原生高度限制，让内容完全铺开
                                el.style.setProperty('max-height', 'none', 'important');
                                el.style.setProperty('height', 'auto', 'important');
                                
                                // 2. 核心修复：对付超长链接和代码块的“越狱”行为
                                // 强制允许在单词内断行（专治超长 URL 和无空格英文字符串）
                                el.style.setProperty('word-break', 'break-word', 'important');
                                el.style.setProperty('overflow-wrap', 'anywhere', 'important');
                                // 将强制不换行的 pre 改为保留空格但允许换行的 pre-wrap
                                el.style.setProperty('white-space', 'pre-wrap', 'important');
                                // 限制最大宽度不允许撑破父级容器
                                el.style.setProperty('max-width', '100%', 'important');
                                
                                // 3. 防止左右溢出导致截图产生大片空白
                                el.style.setProperty('overflow-x', 'hidden', 'important');
                                el.style.setProperty('overflow-y', 'visible', 'important');
                            });
                            
                            rClone.querySelectorAll('.gemini-screenshot-wrapper, user-feedback, [data-test-id="bottom-actions"]').forEach(el => el.remove());
                            rAreaWrapper.appendChild(rClone);
                            virtualBoard.appendChild(rAreaWrapper);

                            // ==========================================
                            // 区域 3：专属底部水印
                            // ==========================================
                            const watermark = document.createElement('div');
                            watermark.style.cssText = `
                                text-align: center;
                                padding-top: 32px;
                                margin-top: 32px;
                                border-top: 1px dashed ${borderColor};
                                color: #9aa0a6;
                                font-size: 13px;
                                font-weight: 500;
                                opacity: 0.8;
                                letter-spacing: 0.5px;
                            `;
                            watermark.innerText = '✨ Generated by Gemini Parallel Plugin';
                            virtualBoard.appendChild(watermark);

                            // 挂载到独立外壳，外壳再挂载到 body，完全脱离原始排版流
                            ghostWrapper.appendChild(virtualBoard);
                            document.body.appendChild(ghostWrapper);

                            // 留出 150ms 让浏览器后台绘制
                            await new Promise(res => setTimeout(res, 150));

                            // 调用引擎对已经画好的虚拟画板进行拍照
                            const canvasUrl = await window.htmlToImage.toPng(virtualBoard, {
                                pixelRatio: 2, 
                                backgroundColor: bgColor,
                                fontEmbedCSS: '', 
                                style: { transform: 'none' }
                            });
                            
                            const link = document.createElement('a');
                            link.download = `Gemini_推演长图_${new Date().getTime()}.png`;
                            link.href = canvasUrl;
                            link.click();

                            // 阅后即焚
                            ghostWrapper.remove();
                            
                        } catch (error) {
                            console.error("截图引擎报错:", error);
                            alert("长图生成失败！请确认环境或查看 F12 日志。");
                        } finally {
                            mainBtn.innerHTML = originalText;
                            mainBtn.style.opacity = '1';
                            dropdown.style.pointerEvents = 'auto';
                            btnWrapper.querySelector('.gemini-screenshot-menu').style.display = ''; 
                        }
                    });
                });
            }
        }
    });

    const trackMaxHeight = Math.max(cumulativeHeight, 800);
    const isOnlyOne = queries.length <= 1;

    chatData.forEach((data, index) => {
        let topPercentage = (data.topOffset / trackMaxHeight) * 100;
        topPercentage = Math.min(topPercentage, 98);

        const node = document.createElement('div');
        node.className = 'gemini-node';
        node.style.top = `${topPercentage}%`;

        let timeLabel = `对话 ${index + 1}`;
        let qText = data.queryElement.innerText.replace('You said', '').trim() || "【图片/文件内容】";
        qText = qText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let msgBlock = data.queryElement.closest('[data-message-author-role]') || data.queryElement.parentElement.parentElement;
        if (msgBlock) {
            const meta = msgBlock.innerText.substring(0, 100);
            const timeMatch = meta.match(/((上午|下午)?\s*\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)|(\d{1,2}月\d{1,2}日)|(昨天|前天|\d+\s*(分钟|小时)前)/i);
            if (timeMatch) timeLabel = timeMatch[0].trim();
        }

        node.innerHTML = `
            <div class="gemini-tooltip">
                <div class="gemini-tooltip-header">
                    <span class="gemini-tooltip-time">🕒 ${timeLabel}</span>
                    ${!isOnlyOne ? `<span class="gemini-tooltip-delete">🗑️ 删除</span>` : ''}
                </div>
                <div class="gemini-tooltip-text">${qText}</div>
            </div>
        `;

        node.addEventListener('click', (e) => {
            if (e.target.closest('.gemini-tooltip-delete')) return;
            data.queryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        if (!isOnlyOne) {
            const delBtn = node.querySelector('.gemini-tooltip-delete');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showConfirmDialog('delete_node', () => {
                        let qContainer = data.queryElement.closest('.user-message-container') || data.queryElement.parentElement.parentElement;
                        if (qContainer) qContainer.style.display = 'none';
                        
                        if (data.responseElement) {
                            let rContainer = data.responseElement.closest('.model-message-container') || data.responseElement.parentElement.parentElement;
                            if (rContainer) rContainer.style.display = 'none';
                        }
                        isHoveringTimeline = false; 
                        renderTimeline(); 
                    });
                });
            }
        }
        timelineContainer.appendChild(node);
    });
    // 每次时间轴节点重绘完毕后，主动执行一次位置校准
    if (timelineContainer.checkScroll) timelineContainer.checkScroll();
}

setInterval(renderTimeline, 2000);

// ==========================================
// 5. 高级物理销毁引擎
// ==========================================
async function executeForgetBranch() {
    const iframe = document.getElementById('gemini-ghost-frame');
    if (!iframe) {
        closeSidebar();
        return;
    }

    const forgetBtn = document.getElementById('gemini-btn-forget');
    // 本地 debug log
    const log = (...args) => console.log('[Gemini-Forget]', ...args);
    // 按钮状态机：用户能看到销毁进展 & 出错时知道具体卡点
    const setBtnState = (state, tip) => {
        if (!forgetBtn) return;
        const map = {
            idle:    { html: '🗑️ 遗忘', color: '',         title: '点击销毁当前分支' },
            working: { html: '⏳ 销毁中...', color: '',      title: '正在清理云端历史...' },
            done:    { html: '✅ 已销毁', color: '#0b8043',  title: '分支已物理抹除' },
            error:   { html: '❌ 失败',  color: '#d93025',   title: tip || '请查看控制台日志' },
        };
        const s = map[state] || map.idle;
        forgetBtn.innerHTML = s.html;
        forgetBtn.style.color = s.color;
        forgetBtn.title = s.title;
    };

    // 轮询等待：替代固定 setTimeout，元素晚到也能等到
    const waitFor = async (selectorFn, timeout = 3000, interval = 80) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const el = selectorFn();
                if (el) return el;
            } catch (_) { /* doc 切上下文时可能抛错，吞掉继续等 */ }
            await new Promise(r => setTimeout(r, interval));
        }
        return null;
    };

    // 模拟真人点击：mousedown + mouseup + click + pointerup，避开 Material 组件的 pointerdown 守卫
    const humanClick = (el) => {
        if (!el) return false;
        try {
            const opts = { view: iframe.contentWindow, bubbles: true, cancelable: true, buttons: 1 };
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' }));
            return true;
        } catch (_) { return false; }
    };

    // 文本归一 + Delete 识别
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const isDeleteText = (txt) => {
        const t = norm(txt).toLowerCase();
        if (!t || t.length > 30) return false;
        return t === 'delete' || t === '删除' || t === 'remove' || t.includes('delete conversation') || t.includes('删除对话');
    };

    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const hasMessages = doc.querySelector('user-query, .query-content, [data-test-id="user-query"], message-content, [data-test-id="model-response"]');
        if (!hasMessages) {
            closeSidebar();
            return;
        }
        setBtnState('working');

        // 强制显示侧边导航（iframe 场景下确保菜单能展开）
        const oldStyle = doc.getElementById('gemini-forget-rescue-style');
        if (oldStyle) oldStyle.remove();
        const style = doc.createElement('style');
        style.id = 'gemini-forget-rescue-style';
        style.textContent = `
            navigation-drawer, .v-st-container, header, nav {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
        `;
        doc.head && doc.head.appendChild(style);

        // 1. 打开侧边导航
        const findMenuBtn = () => doc.querySelector(
            'button[aria-label*="Menu" i], button[aria-label*="菜单" i]'
        );
        const menuBtn = await waitFor(findMenuBtn, 1500);
        if (menuBtn) {
            humanClick(menuBtn);
            await new Promise(r => setTimeout(r, 500));
        }

        // 2. 找到当前会话（data-testid 和 data-test-id 双写支持）
        const findSelectedConversation = () => {
            const candidates = [
                'a[data-test-id="conversation"].selected',
                'a[data-testid="conversation"].selected',
                'a[data-test-id="conversation"][aria-current="page"]',
                'a[data-testid="conversation"][aria-current="page"]',
                'a[data-test-id="conversation"][aria-selected="true"]',
                'a[data-testid="conversation"][aria-selected="true"]',
                'a[data-test-id="conversation"].active',
                'a[data-testid="conversation"].active',
                'a[data-test-id="conversation"]',
                'a[data-testid="conversation"]',
            ];
            for (const sel of candidates) {
                try {
                    const el = doc.querySelector(sel);
                    if (el) return el;
                } catch (_) {}
            }
            return null;
        };
        const selectedConversation = await waitFor(findSelectedConversation, 3000);
        if (!selectedConversation) {
            // 找不到时 dump DOM 线索
            console.warn('[Gemini-Forget] 未找到会话，DOM dump:',
                Array.from(doc.querySelectorAll('a[href*="/app/"]')).slice(0, 3).map(el => ({
                    tag: el.tagName, testid: el.getAttribute('data-testid'),
                    'test-id': el.getAttribute('data-test-id'),
                    class: (el.className || '').toString().slice(0, 60),
                }))
            );
            throw new Error('找不到当前会话');
        }

        // 3. 找"⋮"操作按钮：兄弟、祖先容器兜底
        const findActionsMenu = () => {
            let btn = selectedConversation.parentElement?.querySelector('[data-test-id="actions-menu-button"], [data-testid="actions-menu-button"]');
            if (btn) return btn;
            const container = selectedConversation.closest('li, [data-test-id="conversation-list-item"], [data-testid="conversation-list-item"]')
                || selectedConversation.parentElement;
            if (container) {
                btn = container.querySelector('[data-test-id="actions-menu-button"], [data-testid="actions-menu-button"]');
                if (btn) return btn;
            }
            return doc.querySelector('[data-test-id="actions-menu-button"], [data-testid="actions-menu-button"]');
        };
        const targetBtn = await waitFor(findActionsMenu, 2500);
        if (!targetBtn) throw new Error('找不到操作菜单按钮');
        humanClick(targetBtn);

        // 4. 启动 confirm 弹窗 Observer + CSS 隐藏（边听边点 + 不让弹窗绘制到屏幕）
        // 这是"闪烁消失"的关键：双层保险
        log('Step 4: 启动 confirm 弹窗 Observer + 隐藏 CSS');
        let confirmClicked = false;
        let confirmObserver = null;

        // 注入隐藏 CSS —— 排除 #gemini-confirm-dialog（扩展自己的弹窗不能误伤）
        const oldHideStyle = doc.getElementById('gemini-forget-hide-dialogs');
        if (oldHideStyle) oldHideStyle.remove();
        const hideStyle = doc.createElement('style');
        hideStyle.id = 'gemini-forget-hide-dialogs';
        hideStyle.textContent = `
            [role="dialog"]:not(#gemini-confirm-dialog),
            [role="alertdialog"]:not(#gemini-confirm-dialog),
            [aria-modal="true"]:not(#gemini-confirm-dialog),
            dialog[open],
            dialog:not(#gemini-confirm-dialog),
            mat-dialog-container, md-dialog,
            .mat-mdc-dialog-container,
            .cdk-overlay-pane,
            .cdk-overlay-container > * {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        (doc.head || doc.documentElement).appendChild(hideStyle);

        const dialogSelectors = [
            '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
            'dialog[open]', 'dialog',
            'mat-dialog-container', 'md-dialog', '.mat-mdc-dialog-container',
            '.cdk-overlay-pane', '.cdk-overlay-container > *',
        ];
        const tryClickConfirm = () => {
            if (confirmClicked) return false;
            let dialog = null;
            for (const sel of dialogSelectors) {
                try {
                    const el = doc.querySelector(sel);
                    if (el && el.id !== 'gemini-confirm-dialog') { dialog = el; break; }
                } catch (_) {}
            }
            if (!dialog) return false;
            const cands = dialog.querySelectorAll(
                'button, [role="button"], a, md-text-button, mat-mdc-button, [mat-button], [mat-button-base]'
            );
            for (const el of cands) {
                const txt = (el.innerText || el.textContent || '').trim();
                const aria = (el.getAttribute('aria-label') || '').trim();
                if (isDeleteText(txt) || isDeleteText(aria)) {
                    // 【关键 bug 修复】：不再检查 offsetWidth/visible —— CSS display:none 会让
                    // 按钮 offsetWidth=0，但这正是我们想要的状态（弹窗已藏，按钮被点掉 = 无感）
                    confirmClicked = true;
                    if (confirmObserver) { confirmObserver.disconnect(); confirmObserver = null; }
                    log('  ✓ Observer 命中 confirm Delete 按钮：', { tag: el.tagName, txt: txt.slice(0, 30) });
                    humanClick(el);
                    return true;
                }
            }
            return false;
        };
        confirmObserver = new MutationObserver(tryClickConfirm);
        confirmObserver.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
        log('  Observer 已挂载，监听 confirm 弹窗出现');

        // 5. 找 Delete 项并点击
        log('Step 5: 查找 ⋮ 菜单里的 Delete 项');
        const findDeleteBtn = () => {
            let btn = doc.querySelector('[data-test-id="delete-button"], [data-testid="delete-button"]');
            if (btn) return btn;
            const items = doc.querySelectorAll('[role="menuitem"], button, a, [role="button"]');
            btn = Array.from(items).find(el => isDeleteText(el.innerText || el.textContent));
            return btn || null;
        };
        const deleteBtn = await waitFor(findDeleteBtn, 2500);
        if (!deleteBtn) {
            if (confirmObserver) { confirmObserver.disconnect(); confirmObserver = null; }
            throw new Error('找不到 Delete 菜单项');
        }
        log('  ✓ 找到 Delete 菜单项，准备点击');
        humanClick(deleteBtn);

        // 6. 等 Observer 命中 confirm 弹窗（最多 4 秒）
        log('Step 6: 等待 Observer 命中 confirm 弹窗...');
        const observerStart = Date.now();
        while (!confirmClicked && Date.now() - observerStart < 4000) {
            await new Promise(r => setTimeout(r, 40));
        }
        if (confirmObserver) { confirmObserver.disconnect(); confirmObserver = null; }
        if (!confirmClicked) {
            throw new Error('Observer 在 4 秒内未命中 confirm 弹窗（可能新版 DOM 改了）');
        }
        log('Step 7: 销毁已点击，等待云端响应...');

        setBtnState('done');
        // 1.5 秒后清理隐藏 CSS（确保删除操作完成 + 弹窗自然关闭后再放开）
        setTimeout(() => {
            const el = doc.getElementById('gemini-forget-hide-dialogs');
            if (el) el.remove();
        }, 1500);
    } catch (error) {
        console.warn('[Gemini-Forget] 销毁流程失败:', error);
        setBtnState('error', error.message);
        setTimeout(() => setBtnState('idle'), 3000);
    } finally {
        setTimeout(closeSidebar, 700);
    }
}

// ==========================================
// 主屏幕销毁入口（嵌在主屏时间轴的 destroy-fab 点击触发）
// 调用 performDestroyOnDocument 对主屏 doc 走"打开菜单 → Delete → confirm"流程
// 销毁成功后 Gemini 自身会在 SPA 内路由到首页（让 Angular Router 处理，保留侧栏）
// ==========================================
async function performDestroyOnDocument(targetDoc, targetWindow, options = {}) {
    const {
        injectNavStyle = true,
        logPrefix = '[Gemini-Destroy]',
    } = options;
    const log = (...args) => console.log(logPrefix, ...args);

    const waitFor = async (selectorFn, timeout = 3000, interval = 80) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const el = selectorFn();
                if (el) return el;
            } catch (_) {}
            await new Promise(r => setTimeout(r, interval));
        }
        return null;
    };

    const humanClick = (el) => {
        if (!el) return false;
        try {
            if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'center', inline: 'center' });
            }
        } catch (_) {}
        try {
            const mouseOpts = { view: targetWindow, bubbles: true, cancelable: true, buttons: 1 };
            el.dispatchEvent(new MouseEvent('pointerdown', mouseOpts));
            el.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
            el.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
            el.dispatchEvent(new MouseEvent('click', mouseOpts));
            if (typeof PointerEvent !== 'undefined') {
                el.dispatchEvent(new PointerEvent('pointerup', { ...mouseOpts, pointerType: 'mouse' }));
            }
            return true;
        } catch (_) {
            try {
                el.click();
                return true;
            } catch (_) {
                return false;
            }
        }
    };

    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const isDeleteText = (txt) => {
        const t = norm(txt).toLowerCase();
        if (!t || t.length > 40) return false;
        return t === 'delete'
            || t === '删除'
            || t === 'remove'
            || t === '永久删除'
            || t.includes('delete conversation')
            || t.includes('删除对话');
    };

    const hasMessages = targetDoc.querySelector(
        'user-query, .query-text, .query-content, [data-test-id="user-query"], [data-testid="user-query"], message-content, [data-test-id="model-response"], [data-testid="model-response"]'
    );
    if (!hasMessages) return { success: false, reason: '当前窗口没有可销毁的会话内容' };

    let rescueStyle = null;
    let hideStyle = null;
    let confirmObserver = null;

    try {
        if (injectNavStyle) {
            rescueStyle = targetDoc.getElementById('gemini-destroy-rescue-style');
            if (rescueStyle) rescueStyle.remove();
            rescueStyle = targetDoc.createElement('style');
            rescueStyle.id = 'gemini-destroy-rescue-style';
            rescueStyle.textContent = `
                navigation-drawer, .v-st-container, header, nav {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
            `;
            (targetDoc.head || targetDoc.documentElement).appendChild(rescueStyle);
        }

        const menuBtn = await waitFor(() => targetDoc.querySelector(
            'button[aria-label*="Menu" i], button[aria-label*="菜单" i]'
        ), 1500);
        if (menuBtn) {
            humanClick(menuBtn);
            await new Promise(r => setTimeout(r, 500));
        }

        const currentPath = targetWindow.location?.pathname || '';
        const currentConversationId = (currentPath.match(/\/app\/([^/?#]+)/i) || [])[1] || '';
        const findSelectedConversation = () => {
            const candidates = [
                currentConversationId ? `a[href*="/app/${currentConversationId}"]` : '',
                'a[data-test-id="conversation"].selected',
                'a[data-testid="conversation"].selected',
                'a[data-test-id="conversation"][aria-current="page"]',
                'a[data-testid="conversation"][aria-current="page"]',
                'a[data-test-id="conversation"][aria-selected="true"]',
                'a[data-testid="conversation"][aria-selected="true"]',
                'a[data-test-id="conversation"].active',
                'a[data-testid="conversation"].active',
                'a[data-test-id="conversation"]',
                'a[data-testid="conversation"]',
            ].filter(Boolean);
            for (const sel of candidates) {
                const el = targetDoc.querySelector(sel);
                if (el) return el;
            }
            return null;
        };

        const selectedConversation = await waitFor(findSelectedConversation, 3500);
        if (!selectedConversation) {
            console.warn(`${logPrefix} 未找到会话，DOM dump:`,
                Array.from(targetDoc.querySelectorAll('a[href*="/app/"]')).slice(0, 5).map(el => ({
                    tag: el.tagName,
                    href: el.getAttribute('href'),
                    testid: el.getAttribute('data-testid'),
                    'test-id': el.getAttribute('data-test-id'),
                    class: (el.className || '').toString().slice(0, 80),
                }))
            );
            return { success: false, reason: '找不到当前会话' };
        }

        const conversationShell = selectedConversation.closest('li, [data-test-id="conversation-list-item"], [data-testid="conversation-list-item"]')
            || selectedConversation.parentElement
            || selectedConversation;
        try {
            conversationShell.dispatchEvent(new MouseEvent('mouseenter', { view: targetWindow, bubbles: true }));
            selectedConversation.dispatchEvent(new MouseEvent('mouseenter', { view: targetWindow, bubbles: true }));
        } catch (_) {}

        const findActionsMenu = () => {
            const selectors = '[data-test-id="actions-menu-button"], [data-testid="actions-menu-button"], button[aria-label*="More" i], button[aria-label*="更多" i], button[aria-label*="Options" i]';
            let btn = conversationShell.querySelector?.(selectors);
            if (btn) return btn;
            btn = selectedConversation.parentElement?.querySelector?.(selectors);
            if (btn) return btn;
            return targetDoc.querySelector(selectors);
        };
        const targetBtn = await waitFor(findActionsMenu, 3000);
        if (!targetBtn) return { success: false, reason: '找不到操作菜单按钮' };
        humanClick(targetBtn);

        let confirmClicked = false;
        const dialogSelectors = [
            '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
            'dialog[open]', 'dialog',
            'mat-dialog-container', 'md-dialog', '.mat-mdc-dialog-container',
            '.cdk-overlay-pane', '.cdk-overlay-container > *',
        ];
        const tryClickConfirm = () => {
            if (confirmClicked) return false;
            let dialog = null;
            for (const sel of dialogSelectors) {
                const el = targetDoc.querySelector(sel);
                if (el && el.id !== 'gemini-confirm-dialog') {
                    dialog = el;
                    break;
                }
            }
            if (!dialog) return false;
            const cands = dialog.querySelectorAll('button, [role="button"], a, md-text-button, mat-mdc-button, [mat-button], [mat-button-base]');
            for (const el of cands) {
                const txt = (el.innerText || el.textContent || '').trim();
                const aria = (el.getAttribute('aria-label') || '').trim();
                if (isDeleteText(txt) || isDeleteText(aria)) {
                    confirmClicked = true;
                    if (confirmObserver) {
                        confirmObserver.disconnect();
                        confirmObserver = null;
                    }
                    log('确认删除按钮已命中');
                    humanClick(el);
                    return true;
                }
            }
            return false;
        };

        hideStyle = targetDoc.getElementById('gemini-destroy-hide-dialogs');
        if (hideStyle) hideStyle.remove();
        hideStyle = targetDoc.createElement('style');
        hideStyle.id = 'gemini-destroy-hide-dialogs';
        hideStyle.textContent = `
            [role="dialog"]:not(#gemini-confirm-dialog),
            [role="alertdialog"]:not(#gemini-confirm-dialog),
            [aria-modal="true"]:not(#gemini-confirm-dialog),
            dialog[open],
            dialog:not(#gemini-confirm-dialog),
            mat-dialog-container, md-dialog,
            .mat-mdc-dialog-container,
            .cdk-overlay-pane,
            .cdk-overlay-container > * {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        (targetDoc.head || targetDoc.documentElement).appendChild(hideStyle);
        confirmObserver = new MutationObserver(tryClickConfirm);
        confirmObserver.observe(targetDoc.body || targetDoc.documentElement, { childList: true, subtree: true });

        const findDeleteBtn = () => {
            let btn = targetDoc.querySelector('[data-test-id="delete-button"], [data-testid="delete-button"]');
            if (btn) return btn;
            const items = targetDoc.querySelectorAll('[role="menuitem"], button, a, [role="button"]');
            return Array.from(items).find(el => isDeleteText(el.innerText || el.textContent || el.getAttribute('aria-label'))) || null;
        };
        const deleteBtn = await waitFor(findDeleteBtn, 3000);
        if (!deleteBtn) return { success: false, reason: '找不到 Delete 菜单项' };
        humanClick(deleteBtn);

        const observerStart = Date.now();
        while (!confirmClicked && Date.now() - observerStart < 4500) {
            tryClickConfirm();
            await new Promise(r => setTimeout(r, 40));
        }
        if (!confirmClicked) return { success: false, reason: '未能确认删除弹窗' };

        return { success: true };
    } catch (error) {
        return { success: false, reason: error.message || String(error) };
    } finally {
        if (confirmObserver) confirmObserver.disconnect();
        setTimeout(() => {
            const hidden = targetDoc.getElementById('gemini-destroy-hide-dialogs');
            if (hidden) hidden.remove();
            const rescue = targetDoc.getElementById('gemini-destroy-rescue-style');
            if (rescue) rescue.remove();
        }, 1500);
    }
}

function clearMainConversationContent() {
    const selectors = [
        'user-query',
        '.query-text',
        '.query-content',
        '[data-test-id="user-query"]',
        '[data-testid="user-query"]',
        'message-content',
        '[data-test-id="model-response"]',
        '[data-testid="model-response"]',
    ];
    const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
    nodes.forEach(node => {
        const container = node.closest('.user-message-container, .model-message-container, [data-message-author-role], message, .conversation-turn')
            || node.parentElement;
        if (container) container.style.display = 'none';
    });
}

async function destroyMainConversation() {
    const fab = document.getElementById('gemini-timeline-destroy-fab');
    const originalHtml = fab ? fab.innerHTML : '';

    try {
        // 1) 检查主屏是否有对话可销毁
        const hasMessages = document.querySelector('user-query, .query-content, [data-test-id="user-query"]');
        if (!hasMessages) {
            console.log('[Gemini Plugin] No active conversation to destroy.');
            return;
        }

        // 2) 状态机：销毁中（按钮文字 + 禁用）
        if (fab) {
            fab.innerHTML = '<span style="font-size: 16px;">⏳</span> 销毁中...';
            fab.style.pointerEvents = 'none';
        }

        // 3) 走与侧栏分支相同的销毁引擎（通用内核，传入主屏 doc + window）
        // 主屏是真实 window，injectNavStyle: false —— 主屏不需要强制展开侧边栏
        const result = await performDestroyOnDocument(document, window, {
            injectNavStyle: true,
            logPrefix: '[Gemini-Main-Destroy]',
        });

        if (result.success) {
            // 4) 销毁成功后第一件事：强制刷新时间轴，把已销毁的节点清掉
            clearMainConversationContent();
            renderTimeline();
            console.log('[Gemini Plugin] ✓ 时间轴已刷新，清除已销毁节点');

            // 5) 兜底策略：1.5 秒后若 URL 仍卡在已删除的会话路径，
            //    用 SPA 友好的 pushState + popstate 触发 Angular Router 刷新
            //    （不刷整页，所以侧栏 iframe 不会丢）
            await new Promise(r => setTimeout(r, 1500));
            if (/\/app\/[a-z0-9-]+/i.test(location.pathname)) {
                try {
                    const targetUrl = new URL('/app', location.origin);
                    history.pushState({}, '', targetUrl.toString());
                    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                } catch (e) {
                    console.warn('[Gemini Plugin] SPA route fallback failed:', e);
                }
            }
            // SPA 路由完成后再次刷新时间轴（处理 Angular Router 路由后的 DOM 更新）
            setTimeout(renderTimeline, 500);
        } else {
            console.warn('[Gemini Plugin] Destroy failed, reason:', result.reason);
        }
    } catch (error) {
        console.warn('[Gemini Plugin] Main conversation destroy interrupted:', error);
    } finally {
        if (fab) {
            fab.innerHTML = originalHtml;
            fab.style.pointerEvents = '';
        }
    }
}
