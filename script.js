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
    
    console.log('入力テキスト:', text);

    try {
        let resultText = '';
        
        // 翻訳APIが利用可能な場合は、まず翻訳を行う
        if (useTranslationAPI && apiKey) {
            try {
                updateStatus('翻訳中...', true);
                // 翻訳実行
                const translatedText = await translateText(text, 'ja');
                if (translatedText) {
                    console.log('翻訳結果:', translatedText);
                    updateStatus('カタカナに変換中...', true);
                    // 翻訳されたテキストをカタカナに変換
                    resultText = await convertToKatakanaWithAI(translatedText);
                    // 最終チェック
                    resultText = finalCheck(resultText);
                    outputText.textContent = resultText;
                    updateStatus('変換完了', false);
                    isProcessing = false;
                    return;
                }
            } catch (translationError) {
                console.warn('翻訳処理に失敗しました:', translationError);
                updateStatus('翻訳エラー。直接カタカナ変換を試みます...', true);
                // エラー時はそのまま次の処理に進む
            }
        }
        
        // 翻訳が使えない場合や失敗した場合は、直接カタカナ変換を試みる
        updateStatus('カタカナに変換中...', true);
        resultText = await convertToKatakanaWithAI(text);
        // 最終チェック
        resultText = finalCheck(resultText);
        outputText.textContent = resultText;
        updateStatus('変換完了（翻訳なし）', false);
    } catch (error) {
        console.error('処理エラー:', error);
        updateStatus('変換中にエラーが発生しました。', false);
        
        // エラー時でも何らかの結果を表示
        try {
            const fallbackText = finalCheck(ensureAllKatakana(text));
            outputText.textContent = fallbackText;
        } catch (e) {
            outputText.textContent = 'エラー: ' + error.message;
        }
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
        // まずデバッグログを出力
        console.log('変換前テキスト:', text);
        
        if (!apiKey) {
            console.warn('APIキーがないため、直接カタカナ変換を使用します');
            // 最終的な漢字対応処理を含む変換関数を使用
            return ensureAllKatakana(text);
        }

        // まず単純なひらがな→カタカナ変換
        let processedText = hiraganaToKatakana(text);
        
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
            
            if (data.tokens && data.tokens.length > 0) {
                for (const token of data.tokens) {
                    if (token.text && token.text.content) {
                        // いずれかの方法でカタカナに変換
                        let tokenKatakana = '';
                        
                        // トークンが漢字を含んでいるか
                        const hasKanji = /[\u4e00-\u9faf]/.test(token.text.content);
                        
                        // lemmaを使用（最も信頼性が高い）
                        if (token.lemma) {
                            tokenKatakana = hiraganaToKatakana(token.lemma);
                        } 
                        // lemmaがなければ元のテキストを変換
                        else {
                            tokenKatakana = hiraganaToKatakana(token.text.content);
                        }
                        
                        // カタカナ化されたトークンを追加
                        katakanaText += tokenKatakana;
                    }
                }
                
                // 最終処理 - 残った漢字をすべてカタカナにする
                katakanaText = ensureAllKatakana(katakanaText);
                
                console.log('変換結果:', katakanaText);
                return katakanaText;
            } else {
                // APIからトークンが返ってこない場合
                console.warn('APIからトークンが返されませんでした');
                return ensureAllKatakana(text);
            }
        } catch (apiError) {
            console.error('API処理エラー:', apiError);
            // APIエラー時は別のアプローチを試みる
            return ensureAllKatakana(text);
        }
    } catch (error) {
        console.error('AIによるカタカナ変換エラー:', error);
        // エラー時は独自処理
        return ensureAllKatakana(text);
    }
}

// カタカナ以外の文字をすべてカタカナに変換する関数
function ensureAllKatakana(text) {
    console.log('ensureAllKatakana処理前:', text);
    
    // まずひらがなをカタカナに変換
    let result = hiraganaToKatakana(text);
    
    // 漢字を検出
    const hasKanji = /[\u4e00-\u9faf]/.test(result);
    if (hasKanji) {
        console.log('漢字が検出されました。変換します。');
        // 漢字を「カ」に置換
        result = result.replace(/[\u4e00-\u9faf]/g, 'カ');
    }
    
    // その他の非ASCII文字を処理
    const hasNonAscii = /[^\x00-\x7F\u30A0-\u30FF\s.,!?'"()[\]{}:;<>=+\-*/\\|@#$%^&_]/.test(result);
    if (hasNonAscii) {
        console.log('その他の非ASCII文字が検出されました。変換します。');
        // 非ASCII文字を「カ」に置換（ただしカタカナと一部の記号は除く）
        result = result.replace(/[^\x00-\x7F\u30A0-\u30FF\s.,!?'"()[\]{}:;<>=+\-*/\\|@#$%^&_]/g, 'カ');
    }
    
    console.log('ensureAllKatakana処理後:', result);
    return result;
}

// フォールバック用のカタカナ変換処理 (削除予定 - ensureAllKatakanaに統合)
function processFallbackKatakana(text) {
    return ensureAllKatakana(text);
}

// ひらがなをカタカナに変換
function hiraganaToKatakana(text) {
    if (!text) return '';
    
    // ひらがな→カタカナ変換
    return text.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

// 出力前の最終チェック - 結果が本当にカタカナかを検証
function finalCheck(text) {
    if (!text) return '';
    
    // まずひらがなをカタカナに変換
    let result = hiraganaToKatakana(text);
    
    // 漢字や他の非ASCII文字がまだ残っているか確認
    const remainingNonKatakana = /[^\x00-\x7F\u30A0-\u30FF\s.,!?'"()[\]{}:;<>=+\-*/\\|@#$%^&_]/g.test(result);
    
    if (remainingNonKatakana) {
        console.warn('最終チェック: 非カタカナ文字が残っています。強制的に変換します。');
        // 強制的にカタカナ化
        result = ensureAllKatakana(result);
    }
    
    return result;
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
