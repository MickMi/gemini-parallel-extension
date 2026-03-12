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
            injectCSSIntoIframe(iframe.contentDocument || iframe.contentWindow.document);
            
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
            header { display: none !important; }
            navigation-drawer, nav, [aria-label="Navigation drawer"] { display: none !important; }
            body, app-root, main { background: transparent !important; background-color: transparent !important; }
            .chat-history { padding-top: 10px !important; padding-bottom: 80px !important; }
        `;
        iframeDoc.head.appendChild(style);
    } catch (e) {}
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
// 4. 时间轴心跳引擎 v2.1
// ==========================================
let timelineContainer = null;

function renderTimeline() {
    if (!document.getElementById('gemini-timeline-container')) {
        timelineContainer = document.createElement('div');
        timelineContainer.id = 'gemini-timeline-container';
        
        // 注入包含四个组件的 HTML
        timelineContainer.innerHTML = `
            <div id="gemini-timeline-top-btn" class="gemini-timeline-action-btn" title="回到首条对话">↑</div>
            <div id="gemini-timeline-track"></div>
            <div id="gemini-timeline-bottom-btn" class="gemini-timeline-action-btn" title="前往最新对话">↓</div>
            <div id="gemini-timeline-fab" title="主动开启平行推演"><span style="font-size: 16px;">💡</span> 平行窗口</div>
        `;
        
        timelineContainer.addEventListener('mouseenter', () => { isHoveringTimeline = true; });
        timelineContainer.addEventListener('mouseleave', () => { isHoveringTimeline = false; });
        document.body.appendChild(timelineContainer);

        // --- 绑定点击事件 ---
        // 1. 主动唤起按钮
        // 2. 修改点击事件传参：传一个空字符串 '' 过去
        document.getElementById('gemini-timeline-fab').addEventListener('click', () => {
            openSidebar('', 'chat'); // 【核心修改】：传空字符串，代表不需要任何上下文
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

    const queries = Array.from(document.querySelectorAll('.query-text'));
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
        const r = responses[i];
        const qHeight = q.offsetHeight || 50;
        const rHeight = r ? r.offsetHeight : 50;
        const blockHeight = qHeight + rHeight + 60; 
        
        chatData.push({ queryElement: q, responseElement: r, topOffset: cumulativeHeight });
        cumulativeHeight += blockHeight;
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
    
    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const hasMessages = doc.querySelector('user-query, .query-content, [data-test-id="user-query"]');
        if (!hasMessages) {
            closeSidebar();
            return; 
        }

        if (forgetBtn) forgetBtn.innerHTML = '⏳ 销毁中...';

        const style = doc.createElement('style');
        style.textContent = `navigation-drawer, .v-st-container, header, nav { display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }`;
        doc.head.appendChild(style);

        const humanClick = (el) => {
            if (!el) return;
            const opts = { view: iframe.contentWindow, bubbles: true, cancelable: true, buttons: 1 };
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        };

        const menuBtn = doc.querySelector('button[aria-label*="Menu" i], button[aria-label*="菜单" i]');
        if (menuBtn) humanClick(menuBtn);
        await new Promise(r => setTimeout(r, 600));

        const selectedConversation = doc.querySelector('a[data-test-id="conversation"].selected');
        let targetBtn = (selectedConversation && selectedConversation.nextElementSibling) 
            ? selectedConversation.nextElementSibling.querySelector('[data-test-id="actions-menu-button"]') 
            : null;

        if (targetBtn) {
            humanClick(targetBtn);
            await new Promise(r => setTimeout(r, 400));

            const deleteBtn = doc.querySelector('[data-test-id="delete-button"]') || 
                              Array.from(doc.querySelectorAll('[role="menuitem"]')).find(el => el.innerText.includes('Delete') || el.innerText.includes('删除'));
            
            if (deleteBtn) {
                humanClick(deleteBtn);
                await new Promise(r => setTimeout(r, 400));
                
                const confirmBtn = Array.from(doc.querySelectorAll('button')).find(b => 
                    (b.innerText.includes('Delete') || b.innerText.includes('删除')) && b.offsetWidth > 0
                );
                
                if (confirmBtn) {
                    humanClick(confirmBtn);
                    await new Promise(r => setTimeout(r, 500)); 
                }
            }
        }
    } catch (error) {
        console.warn("Delete flow interrupted:", error);
    } finally {
        if (forgetBtn) forgetBtn.innerHTML = '🗑️ 遗忘'; 
        closeSidebar(); 
    }
}