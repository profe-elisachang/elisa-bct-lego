// BCT Toggle System
// 負責翻譯和拼音顯示/隱藏的切換邏輯

class ToggleSystem {
    constructor() {
        this.state = {
            pinyin: true,
            english: true,
            spanish: true
        };
        this.storageKey = 'bct-toggle-state';
        this.loadState();
    }

    // 從 localStorage 載入狀態
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.state = { ...this.state, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load toggle state:', e);
        }
    }

    // 儲存狀態到 localStorage
    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            console.warn('Failed to save toggle state:', e);
        }
    }

    init() {
        this.setupToggles();
        this.updateTranslations();
    }

    // 設置切換按鈕
    setupToggles() {
        const togglePinyin = document.getElementById('toggle-pinyin');
        const toggleEN = document.getElementById('toggle-en');
        const toggleES = document.getElementById('toggle-es');

        // 初始化按鈕狀態
        if (togglePinyin) {
            togglePinyin.classList.toggle('active', this.state.pinyin);
            togglePinyin.addEventListener('click', () => {
                this.state.pinyin = !this.state.pinyin;
                togglePinyin.classList.toggle('active');
                this.updateTranslations();
                this.saveState();
            });
        }

        if (toggleEN) {
            toggleEN.classList.toggle('active', this.state.english);
            toggleEN.addEventListener('click', () => {
                this.state.english = !this.state.english;
                toggleEN.classList.toggle('active');
                this.updateTranslations();
                this.saveState();
            });
        }

        if (toggleES) {
            toggleES.classList.toggle('active', this.state.spanish);
            toggleES.addEventListener('click', () => {
                this.state.spanish = !this.state.spanish;
                toggleES.classList.toggle('active');
                this.updateTranslations();
                this.saveState();
            });
        }
    }

    // 更新所有翻譯的顯示狀態
    updateTranslations() {
        const allPinyin = document.querySelectorAll('.line-pinyin');
        const allEN = document.querySelectorAll('.line-en');
        const allES = document.querySelectorAll('.line-es');

        allPinyin.forEach(el => {
            el.style.display = this.state.pinyin ? '' : 'none';
        });

        allEN.forEach(el => {
            el.style.display = this.state.english ? '' : 'none';
        });

        allES.forEach(el => {
            el.style.display = this.state.spanish ? '' : 'none';
        });
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    window.toggleSystem = new ToggleSystem();
    window.toggleSystem.init();
});
