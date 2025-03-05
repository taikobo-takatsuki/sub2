const DEBUG = true;

// DOM要素
const inputText = document.getElementById('input-text');
const outputText = document.querySelector('.output-text');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status-text');
const copyButton = document.querySelector('.copy-btn');
const convertButton = document.getElementById('convert-btn');
const clearButton = document.getElementById('clear-btn');

// グローバル変数
let kuroshiro;
let analyzer;
let isInitialized = false;
let apiKey;
let isProcessing = false;
let useTranslationAPI = true; // 翻訳APIを使用するかどうか
let lastInput = ''; // 最後の入力を記録

// 初期化チェック用変数
let initRetryCount = 0;
const MAX_INIT_RETRIES = 5;

// Kuroshiroが利用可能かどうかを確認
function isKuroshiroAvailable() {
    if (DEBUG) {
        console.log('Kuroshiroの可用性を確認:', {
            'typeof Kuroshiro': typeof Kuroshiro,
            'typeof KuromojiAnalyzer': typeof KuromojiAnalyzer
        });
    }
    return typeof Kuroshiro !== 'undefined' && typeof KuromojiAnalyzer !== 'undefined';
}

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMが読み込まれました。初期化を開始します。');
    updateStatus('ライブラリを読み込み中...', true);
    
    // APIキーを読み込む
    loadApiKey();
    
    // ライブラリの読み込みを待つ（最大10秒）
    await waitForLibraries();
    
    // ライブラリの初期化
    await initializeApplication();
    
    // イベントリスナーの設定
    setupEventListeners();
});

// APIキーを読み込む
function loadApiKey() {
    try {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.GOOGLE_TRANSLATE_API_KEY) {
            apiKey = window.CONFIG.GOOGLE_TRANSLATE_API_KEY;
            console.log('APIキー読み込み成功');
            useTranslationAPI = true;
        } else {
            console.warn('APIキーが見つかりません。翻訳機能は制限されます。');
            useTranslationAPI = false;
            updateStatus('APIキーがないため翻訳機能は制限されます。', true);
        }
    } catch (error) {
        console.error('APIキー読み込みエラー:', error);
        useTranslationAPI = false;
        updateStatus('APIキー設定エラー。翻訳機能は制限されます。', true);
    }
}

// ライブラリの読み込みを待つ
async function waitForLibraries() {
    let checkCount = 0;
    const MAX_CHECKS = 20;
    
    while (!isKuroshiroAvailable() && checkCount < MAX_CHECKS) {
        await new Promise(resolve => setTimeout(resolve, 500));
        checkCount++;
        console.log(`ライブラリの読み込み待機中... (${checkCount}/${MAX_CHECKS})`);
    }
    
    if (!isKuroshiroAvailable()) {
        console.error('Kuroshiroライブラリの読み込みに失敗しました。');
        updateStatus('必要なライブラリの読み込みに失敗しました。ページを再読み込みしてください。', false);
        return false;
    }
    
    console.log('Kuroshiroライブラリの読み込み成功！');
    return true;
}

// アプリケーションの初期化
async function initializeApplication() {
    try {
        // ライブラリが読み込まれているか確認
        if (isKuroshiroAvailable()) {
            // Kuroshiroを初期化
            const success = await initializeKuroshiro();
            
            if (success) {
                console.log('アプリケーションの初期化が完了しました。');
                updateStatus('準備完了！テキストを入力してください。', false);
                isInitialized = true;
                return true;
            } else {
                throw new Error('Kuroshiro初期化に失敗しました。');
            }
        } else {
            throw new Error('Kuroshiroライブラリが読み込まれていません。');
        }
    } catch (error) {
        console.error('初期化エラー:', error);
        updateStatus('初期化に失敗しました。ページを再読み込みしてください。', false);
        return false;
    }
}

// Kuroshiro初期化
async function initializeKuroshiro() {
    // ライブラリのロードを確認
    if (!isKuroshiroAvailable()) {
        console.error('Kuroshiroまたは関連ライブラリが読み込まれていません。');
        updateStatus('必要なライブラリの読み込みに失敗しました。', false);
        return false;
    }
    
    // 初期化済みの場合はスキップ
    if (isInitialized && kuroshiro) {
        return true;
    }
    
    try {
        updateStatus('日本語解析エンジンを初期化中...', true);
        console.log('Kuroshiro初期化を開始します...');
        
        // Kuroshiroインスタンス作成（直接グローバル変数に関数を代入）
        try {
            kuroshiro = new Kuroshiro();
            console.log('Kuroshiroインスタンス生成成功');
        } catch (error) {
            console.error('Kuroshiroインスタンス生成エラー:', error);
            
            // エラーメッセージとオブジェクト情報をログ出力
            console.log('Kuroshiroコンストラクタエラー詳細:', {
                'error': error.toString(),
                'typeof Kuroshiro': typeof Kuroshiro,
                'Kuroshiro.prototype': Kuroshiro.prototype
            });
            
            // 再試行
            if (initRetryCount < MAX_INIT_RETRIES) {
                initRetryCount++;
                console.log(`Kuroshiro初期化リトライ (${initRetryCount}/${MAX_INIT_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return initializeKuroshiro();
            }
            
            throw error;
        }
        
        // kuromojiインスタンス作成
        try {
            analyzer = new KuromojiAnalyzer();
            console.log('KuromojiAnalyzerインスタンス生成成功');
        } catch (error) {
            console.error('KuromojiAnalyzerインスタンス生成エラー:', error);
            throw error;
        }
        
        // kuroshiroの初期化
        try {
            updateStatus('日本語辞書を読み込み中...', true);
            await kuroshiro.init(analyzer);
            console.log('Kuroshiro初期化成功！');
            updateStatus('準備完了！テキストを入力してください。', false);
            isInitialized = true;
            return true;
        } catch (error) {
            console.error('Kuroshiro初期化エラー:', error);
            updateStatus('日本語エンジンの初期化に失敗しました。', false);
            throw error;
        }
    } catch (error) {
        console.error('Kuroshiro初期化中にエラーが発生しました:', error);
        updateStatus('日本語エンジンの初期化に失敗しました。ページを再読み込みしてください。', false);
        return false;
    }
}

// イベントリスナーを設定
function setupEventListeners() {
    // 入力欄の変更を監視
    inputText.addEventListener('input', debounce(handleInputChange, 500));
    
    // 変換ボタンのクリックイベント
    convertButton.addEventListener('click', () => {
        const text = inputText.value.trim();
        if (text) {
            processInput(text);
        }
    });
    
    // クリアボタンのクリックイベント
    clearButton.addEventListener('click', () => {
        inputText.value = '';
        outputText.textContent = '';
        lastInput = '';
    });
    
    // コピーボタンのクリックイベント
    copyButton.addEventListener('click', () => {
        const text = outputText.textContent;
        if (text) {
            copyToClipboard(text);
        }
    });
}

// 入力変更ハンドラ
function handleInputChange() {
    const text = inputText.value.trim();
    
    // 前回と同じ入力の場合や空の場合は処理しない
    if (text === lastInput || text === '') {
        return;
    }
    
    // 自動変換を行う
    processInput(text);
}

// 入力処理
async function processInput(text) {
    // 処理中の場合は無視
    if (isProcessing) {
        return;
    }
    
    // 入力が空の場合は処理しない
    if (!text) {
        return;
    }
    
    // 処理中フラグをオン
    isProcessing = true;
    lastInput = text;
    
    try {
        // 言語検出が必要か判断（正規表現で日本語かどうかを大まかに判定）
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g.test(text);
        const hasNonJapanese = /[a-zA-Z]/g.test(text);
        
        if (!hasJapanese && hasNonJapanese && useTranslationAPI) {
            // 日本語以外の文字が含まれる場合は翻訳を行う
            updateStatus('翻訳中...', true);
            
            // 翻訳APIを呼び出し
            const translatedText = await translateText(text, 'ja');
            
            if (translatedText) {
                // 翻訳結果をカタカナに変換
                updateStatus('カタカナに変換中...', true);
                const katakanaText = await convertToKatakana(translatedText);
                outputText.textContent = katakanaText;
                updateStatus('変換完了', false);
            } else {
                throw new Error('翻訳に失敗しました。');
            }
        } else {
            // 日本語の場合は直接カタカナに変換
            updateStatus('カタカナに変換中...', true);
            const katakanaText = await convertToKatakana(text);
            outputText.textContent = katakanaText;
            updateStatus('変換完了', false);
        }
    } catch (error) {
        console.error('処理エラー:', error);
        updateStatus('変換中にエラーが発生しました。', false);
        outputText.textContent = 'エラー: ' + error.message;
    } finally {
        // 処理中フラグをオフ
        isProcessing = false;
    }
}

// Google Translate APIを使って翻訳
async function translateText(text, targetLang) {
    if (!apiKey) {
        console.error('APIキーがありません。');
        updateStatus('APIキーがないため翻訳できません。', false);
        return null;
    }
    
    try {
        updateStatus('翻訳中...', true);
        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                target: targetLang
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('翻訳APIエラー:', errorData);
            throw new Error('翻訳APIエラー: ' + (errorData.error?.message || '不明なエラー'));
        }
        
        const data = await response.json();
        
        if (data && data.data && data.data.translations && data.data.translations[0]) {
            return data.data.translations[0].translatedText;
        } else {
            console.error('無効な翻訳APIレスポンス:', data);
            throw new Error('無効な翻訳結果');
        }
    } catch (error) {
        console.error('翻訳エラー:', error);
        updateStatus('翻訳中にエラーが発生しました。', false);
        throw error;
    }
}

// テキストをカタカナに変換
async function convertToKatakana(text) {
    // 初期化状態を確認
    if (!isInitialized || !kuroshiro) {
        console.error('Kuroshiroが初期化されていません。');
        
        // 再初期化を試みる
        const success = await initializeKuroshiro();
        if (!success) {
            throw new Error('Kuroshiroが利用できません。');
        }
    }
    
    try {
        // カタカナに変換
        const result = await kuroshiro.convert(text, {
            to: 'katakana',
            mode: 'normal'
        });
        
        return result;
    } catch (error) {
        console.error('カタカナ変換エラー:', error);
        throw new Error('カタカナ変換中にエラーが発生しました。');
    }
}

// ステータス表示を更新
function updateStatus(message, isLoading) {
    statusText.textContent = message;
    
    if (isLoading) {
        statusIndicator.classList.add('loading');
    } else {
        statusIndicator.classList.remove('loading');
    }
}

// テキストをクリップボードにコピー
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            // コピー成功
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i> コピー完了';
            
            setTimeout(() => {
                copyButton.innerHTML = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('クリップボードへのコピーに失敗しました:', err);
            alert('クリップボードへのコピーに失敗しました。');
        });
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
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
