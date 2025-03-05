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
    inputText.addEventListener('input', debounce(handleInputChange, 500));
    convertButton.addEventListener('click', () => {
        const text = inputText.value.trim();
        if (text) processInput(text);
    });
    clearButton.addEventListener('click', () => {
        inputText.value = '';
        outputText.textContent = '';
        lastInput = '';
    });
    copyButton.addEventListener('click', () => {
        const text = outputText.textContent;
        if (text) copyToClipboard(text);
    });
}

// 入力変更ハンドラ
function handleInputChange() {
    const text = inputText.value.trim();
    if (text === lastInput || text === '') return;
    processInput(text);
}

// 入力処理
async function processInput(text) {
    if (isProcessing || !text) return;

    isProcessing = true;
    lastInput = text;

    try {
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g.test(text);
        const hasNonJapanese = /[a-zA-Z]/g.test(text);

        if (!hasJapanese && hasNonJapanese && useTranslationAPI) {
            updateStatus('翻訳中...', true);
            const translatedText = await translateText(text, 'ja');
            if (translatedText) {
                updateStatus('カタカナに変換中...', true);
                const katakanaText = await convertToKatakanaWithAI(translatedText);
                outputText.textContent = katakanaText;
                updateStatus('変換完了', false);
            } else {
                throw new Error('翻訳に失敗しました。');
            }
        } else {
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, target: targetLang })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error('翻訳APIエラー: ' + (errorData.error?.message || '不明なエラー'));
        }

        const data = await response.json();
        return data.data.translations[0].translatedText || null;
    } catch (error) {
        console.error('翻訳エラー:', error);
        updateStatus('翻訳中にエラーが発生しました。', false);
        throw error;
    }
}

// AIを使用してカタカナに変換する関数
async function convertToKatakanaWithAI(text) {
    try {
        if (!apiKey) {
            throw new Error('APIキーが設定されていません');
        }

        // 日本語自然言語処理APIのエンドポイント
        const url = `https://language.googleapis.com/v1/documents:analyzeSyntax?key=${apiKey}`;
        
        // リクエストの作成
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document: {
                    type: 'PLAIN_TEXT',
                    content: text,
                    language: 'ja'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API応答エラー:', errorData);
            throw new Error('構文解析に失敗しました: ' + (errorData.error?.message || '不明なエラー'));
        }

        const data = await response.json();
        
        if (DEBUG) {
            console.log('API応答:', data);
        }

        // トークンからカタカナ読みを抽出
        let katakanaText = '';
        if (data.tokens && data.tokens.length > 0) {
            for (const token of data.tokens) {
                // 読みがある場合はそれを使用し、カタカナに変換
                if (token.text && token.text.content) {
                    if (token.partOfSpeech && 
                        (token.partOfSpeech.tag === 'NOUN' || 
                         token.partOfSpeech.tag === 'VERB' || 
                         token.partOfSpeech.tag === 'ADJ')) {
                        if (token.lemma) {
                            katakanaText += hiraganaToKatakana(token.lemma);
                        } else {
                            katakanaText += token.text.content;
                        }
                    } else {
                        katakanaText += token.text.content;
                    }
                }
            }
        } else {
            // APIがトークンを返さない場合は元のテキストを返す
            return hiraganaToKatakana(text);
        }

        return katakanaText;
    } catch (error) {
        console.error('AIによるカタカナ変換エラー:', error);
        // エラー時はフォールバックとして単純なひらがな→カタカナ変換を使用
        return hiraganaToKatakana(text);
    }
}

// ひらがなをカタカナに変換（フォールバック用）
function hiraganaToKatakana(text) {
    return text.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

// ステータス表示を更新
function updateStatus(message, isLoading) {
    statusText.textContent = message;
    statusIndicator.classList.toggle('loading', isLoading);
}

// テキストをクリップボードにコピー
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i> コピー完了';
            setTimeout(() => copyButton.innerHTML = originalText, 2000);
        })
        .catch(err => {
            console.error('クリップボードへのコピーに失敗しました:', err);
            alert('クリップボードへのコピーに失敗しました。');
        });
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
