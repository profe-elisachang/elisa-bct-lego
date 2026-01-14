// ================================================
// BCT Project - Audio System (Web Speech API)
// ================================================

class AudioController {
    constructor() {
        this.speechSynth = window.speechSynthesis;
        this.voices = [];
        this.init();
    }

    // 初始化語音系統
    init() {
        this.loadVoices();

        // 當語音列表載入完成時更新
        if (this.speechSynth.onvoiceschanged !== undefined) {
            this.speechSynth.onvoiceschanged = () => {
                this.loadVoices();
            };
        }
    }

    // 載入可用語音
    loadVoices() {
        this.voices = this.speechSynth.getVoices();
        console.log('Available voices:', this.voices.length);
    }

    // 獲取中文語音
    getChineseVoice() {
        const chineseVoices = this.voices.filter(voice =>
            voice.lang.includes('zh') || voice.lang.includes('CN')
        );

        if (chineseVoices.length > 0) {
            return chineseVoices[0];
        }
        return this.voices[0]; // 備用：返回第一個可用語音
    }

    // 核心發音函數（讀取漢字）
    speak(text, lang = 'zh-CN', rate = 0.9) {
        console.log('🔊 speak() called with text:', text);

        // 確保語音列表已載入
        if (this.voices.length === 0) {
            this.voices = this.speechSynth.getVoices();
            console.log('Reloaded voices:', this.voices.length);
        }

        // 獲取中文語音
        const chineseVoice = this.getChineseVoice();
        console.log('Selected voice:', chineseVoice?.name, chineseVoice?.lang);

        // Chrome bug fix: resume if paused
        if (this.speechSynth.paused) {
            console.log('⚠️ speechSynth was paused, resuming...');
            this.speechSynth.resume();
        }

        // 停止當前播放
        if (this.speechSynth.speaking) {
            console.log('⚠️ Canceling current speech');
            this.speechSynth.cancel();
        }

        // 建立語音實例
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate; // 語速：0.9 稍慢，適合學習

        // 設置中文語音
        if (chineseVoice) {
            utterance.voice = chineseVoice;
        }

        // 加入事件監聽
        utterance.onstart = () => console.log('✅ Speech started');
        utterance.onend = () => console.log('✅ Speech ended');
        utterance.onerror = (e) => console.error('❌ Speech error:', e);

        // 播放
        console.log('Calling speechSynth.speak()...');
        this.speechSynth.speak(utterance);
    }

    // 停止播放
    stop() {
        if (this.speechSynth.speaking) {
            this.speechSynth.cancel();
        }
    }
}

// 全域實例
const audioController = new AudioController();
