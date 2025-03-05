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
let apiKey;
let isProcessing = false;
let useTranslationAPI = true; // 翻訳APIを使用するかどうか
let lastInput = ''; // 最後の入力を記録

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMが読み込まれました。初期化を開始します。');
    
    // APIキーを読み込む
    loadApiKey();
    
    // ステータスを更新
    updateStatus('準備完了！テキストを入力してください。', false);
    
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
                const katakanaText = await convertToKatakanaWithAI(translatedText);
                outputText.textContent = katakanaText;
                updateStatus('変換完了', false);
            } else {
                throw new Error('翻訳に失敗しました。');
            }
        } else {
            // 日本語の場合は直接カタカナに変換
            updateStatus('カタカナに変換中...', true);
            const katakanaText = await convertToKatakanaWithAI(text);
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

// テキストをカタカナに変換 (Google Natural Language API版)
async function convertToKatakanaWithAI(text) {
    if (!apiKey) {
        console.error('APIキーがありません。');
        updateStatus('APIキーがないためAI変換ができません。', false);
        throw new Error('APIキーがありません');
    }
    
    try {
        // ステータス更新
        updateStatus('AI解析中...', true);
        
        // APIリクエストの準備
        const url = `https://language.googleapis.com/v1/documents:analyzeSyntax?key=${apiKey}`;
        
        // APIリクエスト
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document: {
                    type: 'PLAIN_TEXT',
                    language: 'ja',
                    content: text
                },
                encodingType: 'UTF8'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Natural Language APIエラー:', errorData);
            throw new Error('Google APIエラー: ' + (errorData.error?.message || '不明なエラー'));
        }
        
        // レスポンスを解析
        const data = await response.json();
        
        // トークンを取得してカタカナに変換
        let katakanaText = '';
        if (data.tokens && data.tokens.length > 0) {
            // 各トークンの読み情報を取得
            for (const token of data.tokens) {
                if (token.text && token.text.content) {
                    // 品詞情報に基づいて変換方法を決定
                    if (token.partOfSpeech && token.partOfSpeech.tag !== 'PUNCT') {
                        // カタカナに変換（実際のAPIレスポンスに応じて調整が必要）
                        if (token.lemma) {
                            // APIから得られる情報に基づき変換
                            // 実際のレスポンス形式によって処理が異なる
                            const reading = token.text.content;
                            katakanaText += hiraganaToKatakana(reading);
                        } else {
                            katakanaText += token.text.content;
                        }
                    } else {
                        // 記号や特殊文字はそのまま
                        katakanaText += token.text.content;
                    }
                }
            }
        } else {
            // トークンが取得できなかった場合
            throw new Error('テキスト解析結果が取得できませんでした');
        }
        
        return katakanaText || text;
    } catch (error) {
        console.error('AI変換エラー:', error);
        
        // エラー時はシンプルなひらがな→カタカナ変換を試みる
        // 最低限の変換として、ひらがな文字をカタカナに置換
        return hiraganaToKatakana(text);
    }
}

// ひらがなをカタカナに変換
function hiraganaToKatakana(text) {
    return text.replace(/[\u3041-\u3096]/g, function(match) {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
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

