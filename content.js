// 监听网页上的鼠标抬起（mouseup）事件
document.addEventListener('mouseup', () => {
    // 获取当前网页中被选中的文本，并去掉两端的空格
    const selectedText = window.getSelection().toString().trim();

    // 如果选中的内容不是空的，我们就把它打印在浏览器的后台控制台里
    if (selectedText.length > 0) {
        console.log("💡 [Gemini 插件] 你选中的文本是：", selectedText);
    }
});