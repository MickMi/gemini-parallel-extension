let floatingBtn = null;
let currentSelectedText = ""; 
let pendingConfirmAction = null; 
let isHoveringTimeline = false;

document.addEventListener('mouseup', (event) => {
    if (event.target.closest('#gemini-parallel-btn') || event.target.closest('#gemini-parallel-sidebar')) return;
    const isInput = event.target.closest('rich-textarea') || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;
    const selectedText = window.getSelection().toString().trim();
    
    if (!isInput && selectedText.length > 2) {
        currentSelectedText = selectedText; 
        showFloatingButton(event.pageX, event.pageY); 
    } else {
        hideFloatingButton();
    }
});

document.addEventListener('mousedown', (event) => {
    if (floatingBtn && !floatingBtn.contains(event.target)) {
        hideFloatingButton();
    }
});

function showFloatingButton(x, y) {
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'gemini-parallel-btn';
        floatingBtn.textContent = '💡 平行对话';
        document.body.appendChild(floatingBtn);

        floatingBtn.addEventListener('click', () => {
            openSidebar(currentSelectedText); 
            hideFloatingButton();
        });
    }
    floatingBtn.style.left = `${x + 10}px`;
    floatingBtn.style.top = `${y + 10}px`;
    floatingBtn.style.display = 'block';
}

function hideFloatingButton() {
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
    }
}

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
    } catch (e) {
        alert("跨域限制或页面结构变化，提取失败，请手动复制。");
    }
}

/* ========================================================================= */
/* 【核心重构】：全局二次确认弹窗系统                                          */
/* ========================================================================= */

function initGlobalDialog() {
    // 确保全局只有一个弹窗实例
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
        if (pendingConfirmAction) { 
            pendingConfirmAction(); 
            pendingConfirmAction = null; 
        }
    });
}

function showConfirmDialog(actionType, customAction = null) {
    initGlobalDialog(); // 唤起前确保弹窗已经被注入到页面中
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
        // 【全新增】：时间轴节点的视觉删除确认
        title.textContent = '🗑️ 确认隐藏此对话？';
        desc.textContent = '此操作将在当前页面视觉上隐藏该轮问答。刷新网页后记录将从云端恢复。';
        okBtn.style.backgroundColor = '#d93025'; 
        okBtn.textContent = '确认隐藏';
        pendingConfirmAction = customAction; // 执行时间轴传过来的删除闭包
    }
    dialog.style.display = 'flex'; 
}

function openSidebar(textContext) {
    let sidebar = document.getElementById('gemini-parallel-sidebar');
    document.documentElement.style.setProperty('--parallel-sidebar-width', '400px');
    
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'gemini-parallel-sidebar';
        // 从 sidebar 的 HTML 中彻底剥离了 confirm-dialog
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
        document.body.appendChild(sidebar);

        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        document.getElementById('gemini-btn-forget').addEventListener('click', () => showConfirmDialog('forget'));
        document.getElementById('gemini-btn-merge').addEventListener('click', () => showConfirmDialog('merge'));
        
        initResizer(sidebar);
    }
    
    const iframe = document.getElementById('gemini-ghost-frame');
    iframe.src = getTargetUrl();
    iframe.onload = () => {
        if (iframe.src === 'about:blank') return;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        injectCSSIntoIframe(iframeDoc);
        injectTextAndSend(iframe, textContext);
    };

    setTimeout(() => {
        sidebar.classList.add('open');
        document.body.classList.add('parallel-open');
    }, 50);
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
    const iframe = document.getElementById('gemini-ghost-frame');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        iframe.classList.add('iframe-dragging');
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
            iframe.classList.remove('iframe-dragging');
            document.body.style.transition = 'width 0.3s ease';
        }
    });
}

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
        
        chatData.push({
            queryElement: q,
            responseElement: r,
            topOffset: cumulativeHeight
        });
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
                    // 【核心修改】：呼出全局确认弹窗，并将原本的删除逻辑作为回调函数传入
                    showConfirmDialog('delete_node', () => {
                        let qContainer = data.queryElement.closest('.user-message-container') || data.queryElement.parentElement.parentElement;
                        if (qContainer) qContainer.style.display = 'none';
                        
                        if (data.responseElement) {
                            let rContainer = data.responseElement.closest('.model-message-container') || data.responseElement.parentElement.parentElement;
                            if (rContainer) rContainer.style.display = 'none';
                        }
                        
                        // 确认删除后，解除交互锁并立即重绘
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