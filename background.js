chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchGoogleSearch") {
        // 拼接 Google 搜索的 URL (hl=zh-CN 强制返回中文结果)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(request.query)}&hl=zh-CN`;
        
        fetch(searchUrl)
            .then(response => response.text())
            .then(html => {
                sendResponse({ success: true, html: html });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            
        // 告诉 Chrome 我们会异步发送响应，请保持通道开启
        return true; 
    }
});