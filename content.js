let floatingBtn = null;

// 1. 监听划词事件 (和之前一样)
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

// 2. 显示按钮 (修改了点击后的行为)
function showFloatingButton(x, y, text) {
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'gemini-parallel-btn';
        floatingBtn.textContent = '💡 平行对话';
        document.body.appendChild(floatingBtn);

        // 【核心修改点】：点击按钮不再是 alert，而是打开侧边栏
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

// 3. 打开侧边栏并加载 iframe
function openSidebar(textContext) {
    let sidebar = document.getElementById('gemini-parallel-sidebar');
    
    // 如果侧边栏还不存在，就创建它
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'gemini-parallel-sidebar';
        sidebar.innerHTML = `
            <div id="gemini-sidebar-header">
                <span>平行对话分支 (New Chat)</span>
                <span id="gemini-close-sidebar">✖ 关闭</span>
            </div>
            <iframe id="gemini-ghost-frame" src="https://gemini.google.com/app"></iframe>
        `;
        document.body.appendChild(sidebar);

        // 绑定关闭按钮的点击事件
        document.getElementById('gemini-close-sidebar').addEventListener('click', () => {
            sidebar.classList.remove('open');
        });

        // 监听 iframe 加载完成
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.onload = () => {
            injectTextAndSend(iframe, textContext);
        };
    } else {
        // 如果侧边栏已经存在，为了开启一个干净的新对话，我们刷新一下 iframe
        const iframe = document.getElementById('gemini-ghost-frame');
        iframe.src = 'https://gemini.google.com/app';
        iframe.onload = () => {
            injectTextAndSend(iframe, textContext);
        };
    }

    // 用一点点延迟来触发 CSS 的滑出动画
    setTimeout(() => {
        sidebar.classList.add('open');
    }, 50);
}

// 4. 核心黑科技：向 iframe 内注入文字并模拟发送
function injectTextAndSend(iframe, textContext) {
    // 因为单页应用的输入框是动态渲染的，iframe onload 触发时，输入框可能还没画出来
    // 我们设置一个“定时器”，每 500 毫秒检查一次，最多检查 20 次 (10秒)
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (attempts > 20) {
            clearInterval(checkInterval);
            console.error("💡 [Gemini 插件] 寻找输入框超时，页面可能结构有变。");
            return;
        }

        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            // 使用你之前审查出来的真实的富文本 DOM 选择器
            const editorDiv = iframeDoc.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
            
            if (editorDiv) {
                // 找到了输入框！停止定时器
                clearInterval(checkInterval);
                console.log("💡 [Gemini 插件] 成功锁定输入框，开始注入。");

                // 1. 注入文本
                editorDiv.innerHTML = ''; 
                const paragraph = iframeDoc.createElement('p');
                paragraph.textContent = `基于以下上下文继续回答：\n${textContext}\n\n`;
                editorDiv.appendChild(paragraph);

                // 2. 唤醒底层的事件绑定
                editorDiv.focus();
                editorDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

                // 3. 稍微等待一下（让前端框架有时间把发送按钮设为可用），然后点击发送
                setTimeout(() => {
                    // 发送按钮的选择器
                    const sendBtn = iframeDoc.querySelector('button[aria-label="Send message"]');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        console.log("💡 [Gemini 插件] 发送成功！");
                    } else {
                        console.log("💡 [Gemini 插件] 未找到可用的发送按钮。");
                    }
                }, 800);
            }
        } catch (error) {
            // 如果遇到跨域报错（同源策略短暂阻塞），忽略并继续重试
        }
    }, 500);
}