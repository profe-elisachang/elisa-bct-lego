// Markdown Renderer - 共享模塊
// 從 lesson-template-b 提取的 Markdown 渲染邏輯

function renderMarkdown(text) {
    if (!text || typeof marked === 'undefined') {
        return text || '';
    }
    
    let html = marked.parse(text);
    
    // 處理圖片分類：根據 Alt 文字自動分配 CSS Class
    html = html.replace(
        /<img src="([^"]+)" alt="([^"]+)"/g,
        (match, src, alt) => {
            if (alt === 'comp') {
                return `<img src="${src}" class="img-comp" alt="comp" loading="lazy" style="height: 1.6em; width: auto; vertical-align: middle; margin: 0 2px;">`;
            } else if (alt === 'origin') {
                return `<img src="${src}" class="img-origin" alt="origin" loading="lazy" style="width: 55%; min-width: 180px; margin: 15px auto; display: block; border: 1px solid #eee; padding: 8px; background: #fff; border-radius: 6px;">`;
            } else if (alt === 'story') {
                return `<img src="${src}" class="img-story" alt="story" loading="lazy" style="width: 90%; margin: 20px auto; display: block; border-radius: 10px;">`;
            }
            // 其他圖片：自適應
            return `<img src="${src}" alt="${alt}" loading="lazy" style="max-width: 100%; height: auto; display: block;">`;
        }
    );
    
    return html;
}

