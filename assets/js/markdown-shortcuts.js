// Markdown 編輯器快捷鍵功能
// 為所有 Markdown textarea 添加 Ctrl+B（粗體）和 Ctrl+I（斜體）快捷鍵

(function() {
    'use strict';

    /**
     * 檢查是否是 Markdown textarea
     */
    function isMarkdownTextarea(textarea) {
        return textarea.tagName === 'TEXTAREA' && (
            textarea.classList.contains('markdown-content') ||
            textarea.classList.contains('markdown-input') ||
            textarea.getAttribute('data-field') === 'notes' ||
            textarea.id === 'noteContentInput' ||
            textarea.id === 'cardNotes' ||
            textarea.id === 'noteContent' ||
            textarea.id === 'live-note-content'
        );
    }

    /**
     * 處理 Ctrl+B 快捷鍵：粗體（**文字**）
     */
    function handleBoldShortcut(e) {
        const isCtrlB = (e.ctrlKey || e.metaKey) && e.key === 'b';
        if (!isCtrlB) return;
        
        const textarea = e.target;
        if (!isMarkdownTextarea(textarea)) return;
        
        e.preventDefault();
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        
        if (start === end) return; // 沒有選中文字，不做任何操作
        
        let newText;
        let newCursorPos;
        
        // 檢查是否已經被 ** 包圍（粗體）
        const isBold = selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4;
        
        if (isBold) {
            // 移除前後的 **
            newText = selectedText.substring(2, selectedText.length - 2);
            newCursorPos = start + newText.length;
        } else {
            // 在前後加上 **
            newText = '**' + selectedText + '**';
            newCursorPos = start + newText.length;
        }
        
        // 替換選中的文字
        const beforeText = text.substring(0, start);
        const afterText = text.substring(end);
        textarea.value = beforeText + newText + afterText;
        
        // 設置新的游標位置
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // 觸發 input 事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    /**
     * 處理 Ctrl+I 快捷鍵：斜體（*文字*）
     */
    function handleItalicShortcut(e) {
        const isCtrlI = (e.ctrlKey || e.metaKey) && e.key === 'i';
        if (!isCtrlI) return;
        
        const textarea = e.target;
        if (!isMarkdownTextarea(textarea)) return;
        
        e.preventDefault();
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        
        if (start === end) return; // 沒有選中文字，不做任何操作
        
        let newText;
        let newCursorPos;
        
        // 檢查是否已經被 * 包圍（斜體）
        // 注意：需要排除 ** 的情況（粗體）
        const isItalic = selectedText.startsWith('*') && 
                        selectedText.endsWith('*') && 
                        selectedText.length >= 2 &&
                        !(selectedText.startsWith('**') && selectedText.endsWith('**'));
        
        if (isItalic) {
            // 移除前後的 *
            newText = selectedText.substring(1, selectedText.length - 1);
            newCursorPos = start + newText.length;
        } else {
            // 在前後加上 *
            newText = '*' + selectedText + '*';
            newCursorPos = start + newText.length;
        }
        
        // 替換選中的文字
        const beforeText = text.substring(0, start);
        const afterText = text.substring(end);
        textarea.value = beforeText + newText + afterText;
        
        // 設置新的游標位置
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // 觸發 input 事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    /**
     * 為所有 Markdown textarea 添加快捷鍵監聽
     */
    function initMarkdownShortcuts() {
        // 監聽 Ctrl+B（粗體）和 Ctrl+I（斜體）
        document.addEventListener('keydown', (e) => {
            handleBoldShortcut(e);
            handleItalicShortcut(e);
        });
        
        // 使用 MutationObserver 監聽動態添加的 textarea
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // 事件監聽器已經通過 document 委派處理，不需要額外添加
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 在 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMarkdownShortcuts);
    } else {
        initMarkdownShortcuts();
    }
})();
