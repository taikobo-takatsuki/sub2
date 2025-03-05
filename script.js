const DEBUG = true;

// DOM要素
const inputText = document.getElementById('input-text');
const outputText = document.querySelector('.output-text');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status-text');
const copyButton = document.querySelector('.copy-btn');

// グローバル変数
let kuroshiro;
let analyzer;
let isInitialized = false;
let apiKey;
let isProcessing = false;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMが読み込まれました。初期化を開始します。');
    updateStatus('ライブラリを読み込み中...', true);
    
    try {
        // APIキーを読み込む
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.GOOGLE_TRANSLATE_API_KEY) {
            apiKey = window.CONFIG.GOOGLE_TRANSLATE_API_KEY;
            console.log('APIキー読み込み成功: APIキーあり');
        } else {
            console.error('APIキーが見つかりません。window.CONFIGオブジェクトが正しく設定されているか確認してください。');
            console.log('window.CONFIG:', window.CONFIG);
            updateStatus('APIキーが見つかりません。', false);
            return;
        }
        
        // ライブラリが読み込まれているか確認
        console.log('Kuroshiroライブラリの状態を確認:', {
            'Kuroshiroが存在': typeof Kuroshiro !== 'undefined',
            'KuromojiAnalyzerが存在': typeof KuromojiAnalyzer !== 'undefined'
        });
        
        // Kuroshiroを初期化
        await initializeKuroshiro();
        
        // イベントリスナーの設定
        setupEventListeners();
        
    } catch (error) {
        console.error('初期化エラー:', error);
        updateStatus('初期化に失敗しました。ページを再読み込みしてください。', false);
    }
});

// Kuroshiro初期化
async function initializeKuroshiro() {
    // ライブラリのロードを確認
    if (typeof Kuroshiro === 'undefined' || typeof KuromojiAnalyzer === 'undefined') {
        console.error('Kuroshiroまたは関連ライブラリが読み込まれていません。');
        console.log('グローバルオブジェクト:', {
            'window.Kuroshiro': typeof window.Kuroshiro,
            'window.KuromojiAnalyzer': typeof window.KuromojiAnalyzer
        });
        updateStatus('必要なライブラリの読み込みに失敗しました。', false);
        return false;
    }
    
    try {
        kuroshiro = new Kuroshiro();
        analyzer = new KuromojiAnalyzer({
            dictPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict'
        });
        
        await kuroshiro.init(analyzer);
        if (DEBUG) console.log('Kuroshiroの初期化が完了しました');
        
        isInitialized = true;
        updateStatus('準備完了！テキストを入力してください', false);
        return true;
    } catch (error) {
        console.error('Kuroshiroの初期化に失敗しました:', error);
        updateStatus('日本語変換ライブラリの初期化に失敗しました。', false);
        return false;
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // テキスト入力の監視（遅延処理）
    let typingTimer;
    const doneTypingInterval = 500; // 0.5秒
    
    inputText.addEventListener('input', () => {
        clearTimeout(typingTimer);
        if (inputText.value) {
            updateStatus('変換準備中...', true);
            typingTimer = setTimeout(processInput, doneTypingInterval);
        } else {
            outputText.textContent = '';
            updateStatus('準備完了！テキストを入力してください', false);
        }
    });
    
    // コピーボタン
    copyButton.addEventListener('click', copyToClipboard);
}

// 入力処理
async function processInput() {
    const text = inputText.value.trim();
    if (!text || isProcessing) return;
    
    isProcessing = true;
    updateStatus('言語を検出中...', true);
    
    try {
        // 言語検出
        const detectedLanguage = await detectLanguage(text);
        if (DEBUG) console.log('検出された言語:', detectedLanguage);
        
        if (!detectedLanguage) {
            updateStatus('言語の検出に失敗しました。', false);
            isProcessing = false;
            return;
        }
        
        // 日本語かどうかをチェック
        if (detectedLanguage === 'ja') {
            // 日本語の場合はカタカナに変換
            await processJapanese(text);
        } else {
            // 日本語以外の場合は翻訳してからカタカナに変換
            await processNonJapanese(text, detectedLanguage);
        }
        
    } catch (error) {
        console.error('処理エラー:', error);
        updateStatus('エラーが発生しました。', false);
    } finally {
        isProcessing = false;
    }
}

// 日本語処理
async function processJapanese(text) {
    updateStatus('カタカナに変換中...', true);
    
    try {
        const katakana = await kuroshiro.convert(text, {
            to: 'katakana',
            mode: 'normal'
        });
        
        outputText.textContent = katakana;
        updateStatus('カタカナへの変換が完了しました', false);
    } catch (error) {
        console.error('日本語変換エラー:', error);
        updateStatus('カタカナへの変換に失敗しました。', false);
    }
}

// 日本語以外の処理
async function processNonJapanese(text, sourceLang) {
    updateStatus('日本語に翻訳中...', true);
    
    try {
        // Google翻訳APIで翻訳
        const translatedText = await translateText(text, sourceLang, 'ja');
        if (!translatedText) {
            updateStatus('翻訳に失敗しました。', false);
            return;
        }
        
        // 翻訳されたテキストをカタカナに変換
        updateStatus('カタカナに変換中...', true);
        const katakana = await kuroshiro.convert(translatedText, {
            to: 'katakana',
            mode: 'normal'
        });
        
        outputText.textContent = katakana;
        updateStatus('変換が完了しました', false);
    } catch (error) {
        console.error('非日本語処理エラー:', error);
        updateStatus('処理に失敗しました。', false);
    }
}

// 言語検出
async function detectLanguage(text) {
    const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('言語検出APIエラー:', errorData);
            throw new Error('言語検出に失敗しました');
        }
        
        const data = await response.json();
        if (data && data.data && data.data.detections && data.data.detections.length > 0) {
            return data.data.detections[0][0].language;
        }
        
        return null;
    } catch (error) {
        console.error('言語検出エラー:', error);
        return null;
    }
}

// テキスト翻訳
async function translateText(text, sourceLang, targetLang) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                source: sourceLang,
                target: targetLang,
                format: 'text'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('翻訳APIエラー:', errorData);
            throw new Error('翻訳に失敗しました');
        }
        
        const data = await response.json();
        if (data && data.data && data.data.translations && data.data.translations.length > 0) {
            return data.data.translations[0].translatedText;
        }
        
        return null;
    } catch (error) {
        console.error('翻訳エラー:', error);
        return null;
    }
}

// ステータス表示の更新
function updateStatus(message, isLoading) {
    statusText.textContent = message;
    
    if (isLoading) {
        statusIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>' + statusIndicator.innerHTML;
        statusIndicator.classList.remove('hidden');
    } else {
        const spinner = statusIndicator.querySelector('.fa-spin');
        if (spinner) spinner.remove();
        
        if (message) {
            statusIndicator.classList.remove('hidden');
        } else {
            statusIndicator.classList.add('hidden');
        }
    }
}

// クリップボードにコピー
function copyToClipboard() {
    if (!outputText.textContent) return;
    
    navigator.clipboard.writeText(outputText.textContent)
        .then(() => {
            const originalIcon = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyButton.innerHTML = originalIcon;
            }, 2000);
        })
        .catch(err => {
            console.error('クリップボードへのコピーに失敗しました:', err);
        });
}
