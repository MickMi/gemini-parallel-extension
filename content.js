let floatingBtn = null;

document.addEventListener('mouseup', (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
        showFloatingButton(event.pageX, event.pageY, selectedText);
    } else {
        hideFloatingButton();
    }
});

document.addEventListener('mousedown', (event) => {
    if (floatingBtn && !floatingBtn.contains(event.target)) {
        hideFloatingButton();
    }
});

function showFloatingButton(x, y, text) {
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'gemini-parallel-btn';
        floatingBtn.textContent = '💡 平行对话';
        document.body.appendChild(floatingBtn);

        floatingBtn.addEventListener('click', () => {
            openSidebar(text); 
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

// 获取带当前账号状态的 URL
function getTargetUrl() {
    const path = window.location.pathname;
    
    // 匹配当前 URL 中可能存在的账号路径前缀 (例如 "/u/1", "/u/2")
    const accountMatch = path.match(/^\/u\/\d+/);
    const accountPrefix = accountMatch ? accountMatch[0] : '';
    
    // 拼接出：当前域名 + 当前账号前缀 + /app (代表新建对话) + 原有的参数
    const targetUrl = window.location.origin + accountPrefix + '/app' + window.location.search;
    
    console.log("💡 [Gemini 插件] 注入的平行窗口 URL 为:", targetUrl);
    return targetUrl;
}

function openSidebar(textContext) {
    let sidebar = document.getElementById('gemini-parallel-sidebar');
    
    // 【核心修复2】：设置初始 CSS 变量宽度为 400px
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
        `;
        document.body.appendChild(sidebar);

        document.getElementById('gemini-close-sidebar').addEventListener('click', () => {
            sidebar.classList.remove('open');
            document.body.classList.remove('parallel-open');
            // 关闭时将变量设为 0，页面自动恢复
            document.documentElement.style.setProperty('--parallel-sidebar-width', '0px');
        });

        initResizer(sidebar);

        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.onload = () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            injectCSSIntoIframe(iframeDoc);
            injectTextAndSend(iframe, textContext);
        };
    } else {
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.src = getTargetUrl();
        iframe.onload = () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            injectCSSIntoIframe(iframeDoc);
            injectTextAndSend(iframe, textContext);
        };
    }

    // 稍微延迟触发动画
    setTimeout(() => {
        sidebar.classList.add('open');
        // 为 body 添加 class，激活 CSS 里的挤压规则
        document.body.classList.add('parallel-open');
    }, 50);
}

// 注入 iframe 内部样式 (保持不变)
function injectCSSIntoIframe(iframeDoc) {
    try {
        const style = iframeDoc.createElement('style');
        style.textContent = `
            header { display: none !important; }
            navigation-drawer, nav, [aria-label="Navigation drawer"] { display: none !important; }
            body, app-root, main { background: transparent !important; background-color: transparent !important; }
            .chat-history { padding-top: 10px !important; }
        `;
        iframeDoc.head.appendChild(style);
    } catch (e) {}
}

// 自动输入与发送逻辑 (保持不变)
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
                paragraph.textContent = `基于以下上下文继续回答：\n${textContext}\n\n`;
                editorDiv.appendChild(paragraph);

                editorDiv.focus();
                editorDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

                setTimeout(() => {
                    const sendBtn = iframeDoc.querySelector('button[aria-label="Send message"]');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                    }
                }, 800);
            }
        } catch (error) {}
    }, 500);
}

// 拖拽逻辑：现在只需要修改一处变量即可
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
            // 【核心修复3】：拖拽时实时更新 CSS 变量，侧边栏和主页面（包括顶栏）会同步响应
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