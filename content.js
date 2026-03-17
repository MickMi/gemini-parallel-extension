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
                            rClone.querySelectorAll('*').forEach(el => {
                                const style = window.getComputedStyle(el);
                                if (style.overflow === 'auto' || style.overflow === 'hidden' || style.maxHeight !== 'none') {
                                    el.style.setProperty('overflow', 'visible', 'important');
                                    el.style.setProperty('max-height', 'none', 'important');
                                    el.style.setProperty('height', 'auto', 'important');
                                }
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