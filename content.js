// 记录我们的悬浮按钮，避免每次划词都重复创建
let floatingBtn = null;

// 1. 监听网页上的鼠标抬起（mouseup）事件
document.addEventListener('mouseup', (event) => {
    const selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
        // 如果有选中文本，就在鼠标当前的位置显示按钮
        showFloatingButton(event.pageX, event.pageY, selectedText);
    } else {
        // 如果没有选中文本（比如只是随便点了一下），就隐藏按钮
        hideFloatingButton();
    }
});

// 2. 监听鼠标按下事件（实现点击空白处隐藏按钮的体验）
document.addEventListener('mousedown', (event) => {
    // 如果按钮存在，且鼠标点击的地方不是按钮本身，就隐藏它
    if (floatingBtn && !floatingBtn.contains(event.target)) {
        hideFloatingButton();
    }
});

// 3. 显示悬浮按钮的核心功能
function showFloatingButton(x, y, text) {
    // 如果按钮还不存在，就用代码在网页里“画”一个出来
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'gemini-parallel-btn';
        floatingBtn.textContent = '💡 平行对话';
        document.body.appendChild(floatingBtn);

        // 给这个按钮绑定点击事件
        floatingBtn.addEventListener('click', () => {
            // 目前先弹出一个系统提示框，证明按钮生效了
            alert("成功触发！准备带入的上下文是：\n" + text.substring(0, 20) + "...");
            hideFloatingButton(); // 点击后隐藏自己
        });
    }

    // 设置按钮的位置：在鼠标的 x, y 坐标基础上，往右下角稍微偏移一点，防遮挡
    floatingBtn.style.left = `${x + 10}px`;
    floatingBtn.style.top = `${y + 10}px`;
    floatingBtn.style.display = 'block'; // 显示按钮
}

// 4. 隐藏按钮的功能
function hideFloatingButton() {
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
    }
}