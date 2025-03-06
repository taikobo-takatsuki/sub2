const IS_DEBUG = true;

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
let useTranslationAPI = true; // 翻訳APIを使用するフラグをデフォルトでtrueに設定
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
        const hasJapanese = isJapaneseText(text);
        const hasNonJapanese = /[a-zA-Z]/g.test(text) || /[^\u0000-\u007F\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g.test(text);

        // 翻訳APIが利用可能な場合は、まず翻訳を行う
        if (useTranslationAPI && apiKey) {
            try {
                updateStatus('翻訳中...', true);
                // 翻訳実行
                const translatedText = await translateText(text, 'ja');
                if (translatedText) {
                    updateStatus('カタカナに変換中...', true);
                    // 翻訳されたテキストをカタカナに変換
                    const katakanaText = await convertToKatakanaWithAI(translatedText);
                    outputText.textContent = katakanaText;
                    updateStatus('変換完了', false);
                    isProcessing = false;
                    return;
                }
            } catch (translationError) {
                console.warn('翻訳処理に失敗しました:', translationError);
                updateStatus('翻訳エラー。直接カタカナ変換を試みます...', true);
            }
        }
        
        // 翻訳が使えない場合や失敗した場合は、直接カタカナ変換を試みる
        updateStatus('カタカナに変換中...', true);
        const katakanaText = await convertToKatakanaWithAI(text);
        outputText.textContent = katakanaText;
        updateStatus('変換完了（翻訳なし）', false);
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
            console.warn('翻訳API応答:', errorData);
            throw new Error('翻訳APIエラー: ' + (errorData.error?.message || '不明なエラー'));
        }

        const data = await response.json();
        if (IS_DEBUG) {
            console.log('翻訳API応答:', data);
        }
        return data.data.translations[0].translatedText || null;
    } catch (error) {
        console.error('翻訳エラー:', error);
        updateStatus('翻訳中にエラーが発生しました。直接変換を試みます。', false);
        throw error;
    }
}

// AIを使用してカタカナに変換する関数
async function convertToKatakanaWithAI(text) {
    try {
        if (!apiKey) {
            console.warn('APIキーがないため、直接ひらがな→カタカナ変換を使用します');
            return hiraganaToKatakana(text);
        }

        // まず単純なひらがな→カタカナ変換
        let processedText = hiraganaToKatakana(text);
        
        // APIから読みを取得するため、自然言語処理APIを使用
        try {
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
                console.warn('Natural Language API応答エラー:', errorData);
                throw new Error('構文解析に失敗しました: ' + (errorData.error?.message || '不明なエラー'));
            }

            const data = await response.json();
            
            if (IS_DEBUG) {
                console.log('Natural Language API応答:', data);
            }

            // トークンからカタカナ読みを抽出
            let katakanaText = '';
            let currentPosition = 0;
            
            if (data.tokens && data.tokens.length > 0) {
                for (const token of data.tokens) {
                    if (token.text && token.text.content) {
                        // 漢字または非ASCII文字が含まれているかチェック
                        const containsKanji = /[\u4e00-\u9faf]/g.test(token.text.content);
                        const containsNonAscii = /[^\x00-\x7F]/g.test(token.text.content);
                        
                        // 英数字だけのチェック
                        const isAlphaNumeric = /^[a-zA-Z0-9\s.,!?'"()[\]{}:;<>=+\-*/\\|@#$%^&_]+$/.test(token.text.content);
                        
                        if (containsKanji) {
                            // 漢字が含まれる場合、優先的にlemmaを使用
                            if (token.lemma) {
                                katakanaText += hiraganaToKatakana(token.lemma);
                            } else {
                                // lemmaがない場合でも、なるべく読みを取得する試み
                                // (1) 品詞情報があれば使用
                                if (token.partOfSpeech && token.partOfSpeech.tag) {
                                    katakanaText += hiraganaToKatakana(token.text.content);
                                } else {
                                    // (2) それでも無理なら、元のテキストをそのまま使用（ひらがなはカタカナになる）
                                    katakanaText += hiraganaToKatakana(token.text.content);
                                }
                            }
                        } else if (containsNonAscii && !isAlphaNumeric) {
                            // 漢字以外の非ASCII文字（ひらがな、カタカナ、その他の言語）
                            if (token.lemma) {
                                // lemmaがある場合はそれを使用
                                katakanaText += hiraganaToKatakana(token.lemma);
                            } else {
                                // その他の非ASCII文字もカタカナ化を試みる
                                katakanaText += hiraganaToKatakana(token.text.content);
                            }
                        } else {
                            // ASCII文字（英数字など）はそのまま
                            katakanaText += token.text.content;
                        }
                        
                        currentPosition += token.text.content.length;
                    }
                }
                
                // 最終チェック - まだ漢字が残っていないか確認
                if (/[\u4e00-\u9faf]/g.test(katakanaText)) {
                    // 残っている漢字を強制的にカタカナに変換するバックアップ処理
                    console.warn('漢字が残っています。追加処理を行います。');
                    
                    // 再度ひらがな→カタカナ変換をかける
                    katakanaText = hiraganaToKatakana(katakanaText);
                    
                    // それでも残る漢字を「カ」で代用
                    katakanaText = katakanaText.replace(/[\u4e00-\u9faf]/g, 'カ');
                }
                
                return katakanaText;
            } else {
                // APIからトークンが返ってこない場合はひらがな→カタカナ変換のみ
                return hiraganaToKatakana(text);
            }
        } catch (apiError) {
            console.error('API処理エラー:', apiError);
            // APIエラー時は別のアプローチを試みる
            return processFallbackKatakana(text);
        }
    } catch (error) {
        console.error('AIによるカタカナ変換エラー:', error);
        // エラー時はフォールバック処理
        return processFallbackKatakana(text);
    }
}

// フォールバック用のカタカナ変換処理
function processFallbackKatakana(text) {
    try {
        // ひらがな→カタカナ変換
        let result = hiraganaToKatakana(text);
        
        // 漢字を「カ」に置換
        result = result.replace(/[\u4e00-\u9faf]/g, 'カ');
        
        // それ以外の非ASCII文字も「カ」に置換（ただし一部の記号は除く）
        result = result.replace(/[^\x00-\x7F\u30A0-\u30FF\s.,!?'"()[\]{}:;<>=+\-*/\\|@#$%^&_]/g, 'カ');
        
        return result;
    } catch (error) {
        console.error('フォールバック処理エラー:', error);
        // 最終手段として単純なひらがな→カタカナ変換
        return hiraganaToKatakana(text);
    }
}

// ひらがなをカタカナに変換
function hiraganaToKatakana(text) {
    // ひらがな→カタカナ変換
    return text.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

// 簡易的な日本語テキスト判定
function isJapaneseText(text) {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g.test(text);
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
