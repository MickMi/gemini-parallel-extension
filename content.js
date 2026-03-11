let floatingBtn = null;
let currentSelectedText = ""; 
// 【全新增】：用于记录当前用户准备执行的确认动作
let pendingConfirmAction = null; 

document.addEventListener('mouseup', (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
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
        if (iframe) {
            iframe.src = 'about:blank';
        }
    }
}

function mergeToMain() {
    const iframe = document.getElementById('gemini-ghost-frame');
    if (!iframe) return;

    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const responses = iframeDoc.querySelectorAll('message-content');
        let branchResult = "";
        
        if (responses.length > 0) {
            branchResult = responses[responses.length - 1].innerText.trim();
        } else {
            branchResult = "【未能自动提取到回答，请手动复制】";
        }

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
        console.error("💡 [Gemini 插件] 提取分支内容失败：", e);
        alert("跨域限制或页面结构变化，提取失败，请手动复制。");
    }
}

// 【全新增】：唤起二次确认弹窗的统一函数
function showConfirmDialog(actionType) {
    const dialog = document.getElementById('gemini-confirm-dialog');
    const title = document.getElementById('gemini-confirm-title');
    const desc = document.getElementById('gemini-confirm-desc');
    const okBtn = document.getElementById('gemini-confirm-ok');

    if (actionType === 'forget') {
        title.textContent = '🗑️ 确认遗忘分支？';
        desc.textContent = '当前分支对话将被永久清空。这不会对您的主干对话产生任何影响，相当于无事发生。';
        okBtn.style.backgroundColor = '#d93025'; // 红色，提示风险
        okBtn.textContent = '确认遗忘';
        pendingConfirmAction = () => { closeSidebar(); };
    } else if (actionType === 'merge') {
        title.textContent = '✨ 确认合并至主干？';
        desc.textContent = '我们将自动提取本分支中 AI 的最后一次回答，并作为上下文填入主页面的输入框中。';
        okBtn.style.backgroundColor = '#1a73e8'; // 蓝色，正常推进
        okBtn.textContent = '确认合并';
        pendingConfirmAction = () => { mergeToMain(); };
    }

    dialog.style.display = 'flex'; // 显示弹窗
}

function openSidebar(textContext) {
    let sidebar = document.getElementById('gemini-parallel-sidebar');
    document.documentElement.style.setProperty('--parallel-sidebar-width', '400px');
    
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'gemini-parallel-sidebar';
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
            <div id="gemini-confirm-dialog">
                <div class="gemini-confirm-box">
                    <div id="gemini-confirm-title">确认</div>
                    <div id="gemini-confirm-desc">描述</div>
                    <div class="gemini-confirm-btns">
                        <button id="gemini-confirm-cancel" class="gemini-confirm-btn">取消</button>
                        <button id="gemini-confirm-ok" class="gemini-confirm-btn">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(sidebar);

        document.getElementById('gemini-close-sidebar').addEventListener('click', closeSidebar);
        
        // 【修改】：点击遗忘或合并时，不再直接执行，而是呼出弹窗
        document.getElementById('gemini-btn-forget').addEventListener('click', () => showConfirmDialog('forget'));
        document.getElementById('gemini-btn-merge').addEventListener('click', () => showConfirmDialog('merge'));

        // 【全新增】：绑定弹窗内部按钮的事件
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

        initResizer(sidebar);

        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.onload = () => {
            if (iframe.src === 'about:blank') return; 
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            injectCSSIntoIframe(iframeDoc);
            injectTextAndSend(iframe, textContext);
        };
    } else {
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.src = getTargetUrl();
        iframe.onload = () => {
            if (iframe.src === 'about:blank') return;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            injectCSSIntoIframe(iframeDoc);
            injectTextAndSend(iframe, textContext);
        };
    }

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
        if (attempts > 20) {
            clearInterval(checkInterval);
            return;
        }

        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const editorDiv = iframeDoc.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
            
            if (editorDiv) {
                clearInterval(checkInterval);
                editorDiv.innerHTML = ''; 
                const paragraph = iframeDoc.createElement('p');
                paragraph.textContent = `基于以下上下文：\n${textContext}\n\n`;
                editorDiv.appendChild(paragraph);

                // 让输入框获取焦点，光标闪烁，等待用户操作
                editorDiv.focus();
                editorDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

                // 【核心修改】：删除了这里原本的 setTimeout 自动点击发送的逻辑！
                console.log("💡 [Gemini 插件] 文本已注入，等待用户补充并手动发送。");
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