// ==========================================
// 全局变量区
// ==========================================
let floatingMenu = null;
let currentSelectedText = ""; 
let pendingConfirmAction = null; 
let isHoveringTimeline = false;

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

        // 绑定两个不同的核心入口
        document.getElementById('btn-mode-chat').addEventListener('click', () => {
            openSidebar(currentSelectedText, 'chat'); 
            hideFloatingMenu();
        });
        document.getElementById('btn-mode-search').addEventListener('click', () => {
            openSidebar(currentSelectedText, 'search'); 
            hideFloatingMenu();
        });
    }
    floatingMenu.style.left = `${x + 10}px`;
    floatingMenu.style.top = `${y + 10}px`;
    floatingMenu.style.display = 'flex';
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

function closeSidebar() {
    const sidebar = document.getElementById('gemini-parallel-sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
        document.body.classList.remove('parallel-open');
        document.documentElement.style.setProperty('--parallel-sidebar-width', '0px');
        const iframe = document.getElementById('gemini-ghost-frame');
        if (iframe) iframe.src = 'about:blank';
    }
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

    // 【防串台核心】：每次打开前，无情清空侧边栏里的所有旧代码
    sidebar.innerHTML = '';

    if (mode === 'chat') {
        sidebar.innerHTML = `
            <div id="gemini-sidebar-resizer"></div>
            <div id="gemini-sidebar-header">
                <span id="gemini-close-sidebar" title="关闭平行分支">✖</span>
            </div>
            <iframe id="gemini-ghost-frame" src="${getTargetUrl()}"></iframe>
            <div id="gemini-sidebar-actions">
                <button id="gemini-btn-forget" class="gemini-action-btn">🗑️ 遗忘分支</button>
                <button id="gemini-btn-merge" class="gemini-action-btn primary">✨ 合并至主干</button>
            </div>
        `;
        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        document.getElementById('gemini-btn-forget').addEventListener('click', () => showConfirmDialog('forget'));
        document.getElementById('gemini-btn-merge').addEventListener('click', () => showConfirmDialog('merge'));
        
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.onload = () => {
            if (iframe.src === 'about:blank') return;
            injectCSSIntoIframe(iframe.contentDocument || iframe.contentWindow.document);
            injectTextAndSend(iframe, textContext);
        };
    } else if (mode === 'search') {
        sidebar.innerHTML = `
            <div id="gemini-sidebar-resizer"></div>
            <div id="gemini-sidebar-header" style="justify-content: space-between; padding-left: 48px; border-bottom: 1px solid #e0e0e0; background: #f8f9fa;">
                <span id="gemini-close-sidebar" title="关闭搜索">✖</span>
                <span style="font-size: 14px; font-weight: 500; color: #202124;">🔍 搜索：${textContext.substring(0, 15)}${textContext.length > 15 ? '...' : ''}</span>
                <span style="width: 20px;"></span> 
            </div>
            <div id="gemini-search-results-container">
                <div class="gemini-loading-text">正在从 Google 获取结果... 🕵️‍♂️</div>
            </div>
        `;
        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        
        chrome.runtime.sendMessage({ action: "fetchGoogleSearch", query: textContext }, (response) => {
            const container = document.getElementById('gemini-search-results-container');
            if (!container) return; 
            if (response && response.success) {
                renderSearchResults(response.html, container);
            } else {
                container.innerHTML = `<div class="gemini-loading-text" style="color: #d93025;">获取搜索结果失败，请检查网络或刷新重试。</div>`;
            }
        });
    }

    // 重新绑定拖拽，修复搜索模式下无 iframe 导致的报错
    initResizer(sidebar);

    setTimeout(() => {
        sidebar.classList.add('open');
        document.body.classList.add('parallel-open');
    }, 50);
}

// Google 搜索 DOM 清洗模块
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
        container.innerHTML = `<div class="gemini-loading-text" style="color: #d93025; line-height: 1.6;">
            <p>未能解析到结果 😕</p><p style="font-size: 12px;">这可能是因为被 Google 安全机制拦截，或页面结构发生了巨大变化。</p>
        </div>`;
    } else {
        container.innerHTML = resultsHtml;
    }
}

// iframe 与拖拽辅助模块
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

function injectTextAndSend(iframe, textContext) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (attempts > 20) { clearInterval(checkInterval); return; }
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const editorDiv = iframeDoc.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
            if (editorDiv) {
                clearInterval(checkInterval);
                editorDiv.innerHTML = ''; 
                const paragraph = iframeDoc.createElement('p');
                paragraph.textContent = `基于以下上下文：\n${textContext}\n\n`;
                editorDiv.appendChild(paragraph);
                editorDiv.focus();
                editorDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            }
        } catch (error) {}
    }, 500);
}

function initResizer(sidebar) {
    const resizer = document.getElementById('gemini-sidebar-resizer');
    const iframe = document.getElementById('gemini-ghost-frame'); // 搜索模式下为 null，不再报错
    let isResizing = false;
    
    if (!resizer) return;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        if (iframe) iframe.classList.add('iframe-dragging');
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
        desc.textContent = '当前分支对话将被永久清空。这不会对您的主干对话产生任何影响，相当于无事发生。';
        okBtn.style.backgroundColor = '#d93025'; 
        okBtn.textContent = '确认遗忘';
        pendingConfirmAction = () => { closeSidebar(); };
    } else if (actionType === 'merge') {
        title.textContent = '✨ 确认合并至主干？';
        desc.textContent = '我们将自动提取本分支中 AI 的最后一次回答，并作为上下文填入主页面的输入框中。';
        okBtn.style.backgroundColor = '#1a73e8'; 
        okBtn.textContent = '确认合并';
        pendingConfirmAction = () => { mergeToMain(); };
    } else if (actionType === 'delete_node') {
        title.textContent = '🗑️ 确认隐藏此对话？';
        desc.textContent = '此操作将在当前页面视觉上隐藏该轮问答。刷新网页后记录将从云端恢复。';
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
        timelineContainer.innerHTML = `<div id="gemini-timeline-track"></div>`;
        
        timelineContainer.addEventListener('mouseenter', () => { isHoveringTimeline = true; });
        timelineContainer.addEventListener('mouseleave', () => { isHoveringTimeline = false; });
        document.body.appendChild(timelineContainer);
    } else {
        timelineContainer = document.getElementById('gemini-timeline-container');
    }

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
}

setInterval(renderTimeline, 2000);