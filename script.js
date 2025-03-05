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
let useTranslationAPI = true; // 翻訳APIを使用するかどうか

// Kuroshiroが利用可能かどうかを確認
function isKuroshiroAvailable() {
    return typeof window.Kuroshiro !== 'undefined' && typeof window.KuromojiAnalyzer !== 'undefined';
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMが読み込まれました。初期化を開始します。');
    updateStatus('ライブラリを読み込み中...', true);
    
    // ライブラリの読み込みを待つ（最大10秒）
    let checkCount = 0;
    while (!isKuroshiroAvailable() && checkCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        checkCount++;
        console.log(`ライブラリの読み込み待機中... (${checkCount}/20)`);
    }
    
    try {
        // APIキーを読み込む
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.GOOGLE_TRANSLATE_API_KEY) {
            apiKey = window.CONFIG.GOOGLE_TRANSLATE_API_KEY;
            console.log('APIキー読み込み成功: APIキーあり');
        } else {
            console.warn('APIキーが見つかりません。翻訳機能は制限されます。');
            useTranslationAPI = false;
            updateStatus('APIキーがないため翻訳機能は制限されます。', true);
        }
        
        // ライブラリが読み込まれているか確認
        if (isKuroshiroAvailable()) {
            console.log('Kuroshiroライブラリの読み込み成功！');
            
            // Kuroshiroをグローバル変数に割り当て
            if (!kuroshiro) kuroshiro = new window.Kuroshiro();
            if (!analyzer) analyzer = new window.KuromojiAnalyzer();
            
            // Kuroshiroを初期化
            const success = await initializeKuroshiro();
            if (success) {
                // イベントリスナーの設定
                setupEventListeners();
            }
        } else {
            console.error('Kuroshiroライブラリの読み込みに失敗しました。');
            updateStatus('必要なライブラリの読み込みに失敗しました。ページを再読み込みしてください。', false);
        }
    } catch (error) {
        console.error('初期化エラー:', error);
        updateStatus('初期化に失敗しました。ページを再読み込みしてください。', false);
    }
});

// Kuroshiro初期化
async function initializeKuroshiro() {
    // ライブラリのロードを確認
    if (!isKuroshiroAvailable()) {
        console.error('Kuroshiroまたは関連ライブラリが読み込まれていません。');
        console.log('グローバルオブジェクト:', {
            'window.Kuroshiro': typeof window.Kuroshiro,
            'window.KuromojiAnalyzer': typeof window.KuromojiAnalyzer
        });
        updateStatus('必要なライブラリの読み込みに失敗しました。', false);
        return false;
    }
    
    // 初期化済みの場合はスキップ
    if (isInitialized && kuroshiro) {
        return true;
    }
    
    try {
        updateStatus('日本語解析エンジンを初期化中...', true);
        
        // Kuroshiroインスタンス作成
        if (!kuroshiro) kuroshiro = new window.Kuroshiro();
        
        // kuromojiインスタンス作成（辞書パスを指定）
        if (!analyzer) analyzer = new window.KuromojiAnalyzer();
        
        // kuroshiroの初期化
        await kuroshiro.init(analyzer);
        
        isInitialized = true;
        updateStatus('準備完了！', false);
        setTimeout(() => {
            statusIndicator.classList.add('hidden');
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('Kuroshiro初期化エラー:', error);
        updateStatus('日本語処理エンジンの初期化に失敗しました。', false);
        return false;
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // 入力テキストの処理
    let typingTimer;
    inputText.addEventListener('input', () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            processInput();
        }, 500);
    });
    
    // コピーボタン
    copyButton.addEventListener('click', copyToClipboard);
}

// 入力テキスト処理
async function processInput() {
    const text = inputText.value.trim();
    
    if (!text) {
        outputText.textContent = '';
        return;
    }
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        // 日本語かどうかを判定（簡易判定）
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
        
        if (hasJapanese) {
            // 日本語テキストの処理
            const result = await processJapanese(text);
            outputText.textContent = result;
        } else if (useTranslationAPI) {
            try {
                // 言語検出
                const sourceLang = await detectLanguage(text);
                if (sourceLang) {
                    // 非日本語テキストの処理
                    const result = await processNonJapanese(text, sourceLang);
                    outputText.textContent = result;
                } else {
                    outputText.textContent = '言語の検出に失敗しました。';
                }
            } catch (error) {
                console.error('API処理エラー:', error);
                outputText.textContent = '翻訳APIが利用できません。日本語テキストのみ処理可能です。';
                useTranslationAPI = false;
            }
        } else {
            outputText.textContent = '翻訳APIが利用できません。日本語テキストのみ処理可能です。';
        }
    } catch (error) {
        console.error('処理エラー:', error);
        outputText.textContent = 'テキスト処理中にエラーが発生しました。';
    } finally {
        isProcessing = false;
    }
}

// 日本語テキスト処理
async function processJapanese(text) {
    if (!isInitialized) {
        const success = await initializeKuroshiro();
        if (!success) {
            return 'Kuroshiroの初期化に失敗しました。';
        }
    }
    
    try {
        // 日本語をカタカナに変換
        const result = await kuroshiro.convert(text, { to: 'katakana', mode: 'normal' });
        return result;
    } catch (error) {
        console.error('日本語処理エラー:', error);
        return 'カタカナ変換に失敗しました。';
    }
}

// 非日本語テキスト処理
async function processNonJapanese(text, sourceLang) {
    try {
        if (!useTranslationAPI || !apiKey) {
            return '翻訳API機能が利用できません。';
        }
        
        // 日本語に翻訳
        const translated = await translateText(text, sourceLang, 'ja');
        
        // カタカナに変換
        const result = await processJapanese(translated);
        return result;
    } catch (error) {
        console.error('非日本語処理エラー:', error);
        useTranslationAPI = false;
        return '翻訳に失敗しました。日本語テキストのみ処理可能です。';
    }
}

// 言語検出
async function detectLanguage(text) {
    if (!useTranslationAPI || !apiKey) {
        return null;
    }
    
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
            console.log('翻訳APIが利用できません。ステータスコード:', response.status);
            useTranslationAPI = false;
            return null;
        }
        
        const data = await response.json();
        if (data && data.data && data.data.detections && data.data.detections.length > 0) {
            return data.data.detections[0][0].language;
        }
        
        return null;
    } catch (error) {
        console.error('言語検出エラー:', error);
        useTranslationAPI = false;
        return null;
    }
}

// テキスト翻訳
async function translateText(text, sourceLang, targetLang) {
    if (!useTranslationAPI || !apiKey) {
        throw new Error('翻訳APIが利用できません。');
    }
    
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
            console.log('翻訳APIが利用できません。ステータスコード:', response.status);
            useTranslationAPI = false;
            throw new Error('翻訳APIが利用できません。');
        }
        
        const data = await response.json();
        if (data && data.data && data.data.translations && data.data.translations.length > 0) {
            return data.data.translations[0].translatedText;
        }
        
        throw new Error('翻訳結果が取得できませんでした。');
    } catch (error) {
        console.error('翻訳エラー:', error);
        useTranslationAPI = false;
        throw error;
    }
}

// ステータス表示の更新
function updateStatus(message, isLoading) {
    statusText.textContent = message;
    
    if (isLoading) {
        statusIndicator.classList.remove('hidden');
        statusText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    } else {
        statusText.innerHTML = message;
    }
}

// クリップボードにコピー
function copyToClipboard() {
    const text = outputText.textContent;
    if (!text) return;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                copyButton.innerHTML = originalText;
            }, 1500);
        })
        .catch(err => {
            console.error('コピーに失敗しました:', err);
        });
}

// デバッグモードの場合、グローバル関数を追加
if (DEBUG) {
    window.reinitKuroshiro = async () => {
        kuroshiro = null;
        analyzer = null;
        isInitialized = false;
        return await initializeKuroshiro();
    };
    
    window.testKuroshiro = async (text) => {
        if (!isInitialized) {
            await initializeKuroshiro();
        }
        return await kuroshiro.convert(text || 'テスト', { to: 'katakana', mode: 'normal' });
    };
    
    window.manualConvert = async () => {
        await processInput();
    };
    
    console.log('デバッグモード有効: window.testKuroshiro() でテスト、window.reinitKuroshiro() で再初期化可能');
}
