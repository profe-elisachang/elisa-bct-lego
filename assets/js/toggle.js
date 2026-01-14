// BCT Toggle System
// 負責翻譯顯示/隱藏的切換邏輯

class ToggleSystem {
    constructor() {
        this.state = {
            english: true,
            spanish: true
        };
    }

    init() {
        this.setupGlobalToggles();
    }

    // 設置全局切換按鈕
    setupGlobalToggles() {
        const toggleEN = document.getElementById('toggle-en');
        const toggleES = document.getElementById('toggle-es');

        if (toggleEN) {
            toggleEN.addEventListener('click', () => {
                this.state.english = !this.state.english;
                toggleEN.classList.toggle('active');
                this.updateTranslations();
            });
        }

        if (toggleES) {
            toggleES.addEventListener('click', () => {
                this.state.spanish = !this.state.spanish;
                toggleES.classList.toggle('active');
                this.updateTranslations();
            });
        }
    }

    // 更新所有翻譯的顯示狀態
    updateTranslations() {
        const allEN = document.querySelectorAll('.line-en');
        const allES = document.querySelectorAll('.line-es');

        allEN.forEach(el => {
            el.style.display = this.state.english ? 'block' : 'none';
        });

        allES.forEach(el => {
            el.style.display = this.state.spanish ? 'block' : 'none';
        });
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    const toggleSystem = new ToggleSystem();
    toggleSystem.init();
});
