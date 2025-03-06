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

        // 非日本語テキストがあり、APIキーが利用可能な場合は翻訳を試みる
        if ((!hasJapanese || hasNonJapanese) && useTranslationAPI && apiKey) {
            try {
                updateStatus('翻訳中...', true);
                const translatedText = await translateText(text, 'ja');
                if (translatedText) {
                    updateStatus('カタカナに変換中...', true);
                    // 翻訳されたテキストをカタカナに変換
                    let katakanaText;
                    try {
                        // まずAIによるカタカナ変換を試みる
                        katakanaText = await convertToKatakanaWithAI(translatedText);
                    } catch (aiError) {
                        console.warn('AI変換エラー、強制カタカナ変換を使用します:', aiError);
                        // AIによる変換に失敗した場合は強制カタカナ変換を使用
                        katakanaText = forceKatakana(translatedText);
                    }
                    outputText.textContent = katakanaText;
                    updateStatus('変換完了', false);
                    return;
                }
            } catch (translationError) {
                console.warn('翻訳処理に失敗しました。直接カタカナ変換を試みます:', translationError);
                // 翻訳に失敗した場合は、そのまま次の処理に進む（直接カタカナ変換を試みる）
            }
        }
        
        // 翻訳が不要、または翻訳に失敗した場合は直接カタカナ変換
        updateStatus('カタカナに変換中...', true);
        try {
            // まずAIによるカタカナ変換を試みる
            const katakanaText = await convertToKatakanaWithAI(text);
            outputText.textContent = katakanaText;
        } catch (directError) {
            console.warn('直接変換エラー、強制カタカナ変換を使用します:', directError);
            // 直接変換に失敗した場合は強制カタカナ変換を使用
            outputText.textContent = forceKatakana(text);
        }
        updateStatus('変換完了', false);
    } catch (error) {
        console.error('処理エラー:', error);
        updateStatus('変換中にエラーが発生しました。', false);
        // エラー時も何らかの結果を表示
        try {
            outputText.textContent = forceKatakana(text);
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
        if (!apiKey) {
            console.warn('APIキーがないため、直接ひらがな→カタカナ変換を使用します');
            return forceKatakana(text);
        }

        // まず単純なひらがな→カタカナ変換
        let processedText = hiraganaToKatakana(text);
        
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
                // すべてのトークンを処理
                if (token.text && token.text.content) {
                    // 日本語文字かどうかを判定
                    const hasJapaneseChars = isJapaneseText(token.text.content);
                    
                    if (hasJapaneseChars) {
                        if (token.lemma && token.partOfSpeech) {
                            // 漢字を含む場合は読みを優先的に使用
                            const containsKanji = /[\u4e00-\u9faf]/g.test(token.text.content);
                            
                            if (containsKanji && token.partOfSpeech.tag === 'NOUN' && token.lemma) {
                                // 名詞の場合はlemmaを使用
                                katakanaText += hiraganaToKatakana(token.lemma);
                            } else if (token.partOfSpeech.tag === 'VERB' || token.partOfSpeech.tag === 'ADJ') {
                                // 動詞や形容詞もlemmaを使用
                                katakanaText += hiraganaToKatakana(token.lemma);
                            } else {
                                // それ以外は強制カタカナ変換
                                katakanaText += forceKatakana(token.text.content);
                            }
                        } else {
                            // lemmaがない場合は強制カタカナ変換
                            katakanaText += forceKatakana(token.text.content);
                        }
                    } else {
                        // 英数字などの非日本語はそのまま
                        katakanaText += token.text.content;
                    }
                }
            }
        } else {
            // APIがトークンを返さない場合は強制カタカナ変換
            return forceKatakana(text);
        }

        // 最終的な結果がまだ漢字やひらがなを含んでいたら強制的にカタカナ化
        const nonKatakanaPattern = /[^\u30A0-\u30FF\u0020-\u007E\u3000-\u303F\uFF00-\uFFEF]/g;
        if (nonKatakanaPattern.test(katakanaText)) {
            katakanaText = forceKatakana(katakanaText);
        }

        return katakanaText;
    } catch (error) {
        console.error('AIによるカタカナ変換エラー:', error);
        // エラー時はフォールバックとして強制カタカナ変換を使用
        return forceKatakana(text);
    }
}

// ひらがなをカタカナに変換（フォールバック用）
function hiraganaToKatakana(text) {
    // ひらがなをカタカナに変換
    return text.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

// すべての文字をカタカナに強制変換する関数
function forceKatakana(text) {
    // まず既存のひらがな→カタカナ変換を実行
    text = hiraganaToKatakana(text);
    
    // カタカナ、英数字、記号以外の文字を検出するための正規表現
    const nonKatakanaPattern = /[^\u30A0-\u30FF\u0020-\u007E\u3000-\u303F\uFF00-\uFFEF]/g;
    
    // 漢字やその他の文字が残っているかチェック
    if (nonKatakanaPattern.test(text)) {
        // 文字ごとに処理して変換
        const chars = [...text];
        let result = '';
        
        for (const char of chars) {
            if (nonKatakanaPattern.test(char)) {
                // 漢字などの場合は、文字に応じたカタカナに変換
                // 基本的には「カ」に変換するが、一部の漢字には特定のマッピングを用意
                const kanjiToKatakana = {
                    // 基本的な漢字→カタカナのマッピング
                    '一': 'イチ', '二': 'ニ', '三': 'サン', '四': 'ヨン', '五': 'ゴ',
                    '六': 'ロク', '七': 'ナナ', '八': 'ハチ', '九': 'キュウ', '十': 'ジュウ',
                    '百': 'ヒャク', '千': 'セン', '万': 'マン', '円': 'エン', '年': 'ネン',
                    '月': 'ツキ', '日': 'ヒ', '時': 'ジ', '分': 'フン', '秒': 'ビョウ',
                    '人': 'ヒト', '名': 'メイ', '前': 'マエ', '後': 'ゴ', '右': 'ミギ',
                    '左': 'ヒダリ', '上': 'ウエ', '下': 'シタ', '中': 'ナカ', '外': 'ソト',
                    '大': 'ダイ', '小': 'ショウ', '高': 'タカ', '低': 'テイ', '新': 'シン',
                    '古': 'フル', '多': 'タ', '少': 'ショウ', '長': 'ナガ', '短': 'タン',
                    '水': 'ミズ', '火': 'ヒ', '土': 'ツチ', '風': 'カゼ', '空': 'ソラ',
                    '山': 'ヤマ', '川': 'カワ', '海': 'ウミ', '道': 'ミチ', '駅': 'エキ',
                    '車': 'クルマ', '店': 'ミセ', '家': 'イエ', '学': 'ガク', '校': 'コウ',
                    '社': 'シャ', '会': 'カイ', '国': 'クニ', '語': 'ゴ', '文': 'ブン',
                    '字': 'ジ', '本': 'ホン', '手': 'テ', '足': 'アシ', '目': 'メ',
                    '耳': 'ミミ', '口': 'クチ', '心': 'ココロ', '思': 'オモ', '考': 'カンガ',
                    '見': 'ミ', '聞': 'キ', '食': 'ショク', '飲': 'ノ', '寝': 'ネ',
                    '起': 'オ', '立': 'タ', '座': 'スワ', '歩': 'アル', '走': 'ハシ',
                    '話': 'ハナ', '笑': 'ワラ', '泣': 'ナ', '怒': 'オコ', '楽': 'タノ',
                    '好': 'ス', '嫌': 'キラ', '春': 'ハル', '夏': 'ナツ', '秋': 'アキ',
                    '冬': 'フユ', '朝': 'アサ', '昼': 'ヒル', '夕': 'ユウ', '夜': 'ヨル'
                };
                
                // マッピングにある場合はそれを使用、なければ「カ」を使用
                result += kanjiToKatakana[char] || 'カ';
            } else {
                // カタカナ、英数字、記号はそのまま
                result += char;
            }
        }
        return result;
    }
    
    // すでにカタカナや英数字のみの場合はそのまま返す
    return text;
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
