// ファイルが存在することを確認

document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const copyBtn = document.getElementById('copy-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = statusIndicator.querySelector('.status-text');
    
    // デバッグモード
    const DEBUG = true;
    
    // APIキーを設定ファイルから取得（もし設定ファイルが読み込めない場合のフォールバック）
    let API_KEY = '';
    try {
        API_KEY = CONFIG.GOOGLE_TRANSLATE_API_KEY;
        if (DEBUG) console.log('APIキー読み込み成功:', API_KEY ? 'APIキーあり' : 'APIキーなし');
    } catch (error) {
        console.error('設定ファイルが読み込めませんでした:', error);
        updateStatus('API設定ヲ ヨミコメマセンデシタ', false);
    }
    
    // 変換タイマーと入力バッファ
    let convertTimer = null;
    let lastInputValue = '';
    const TYPING_DELAY = 1000; // 1秒間タイピングが止まったら変換
    
    // kuroshiroの初期化
    let kuroshiro = new Kuroshiro();
    let kuromojiInitialized = false;
    
    // ページ読み込み時にkuroshiroを初期化
    initKuroshiro();
    
    async function initKuroshiro() {
        try {
            updateStatus('初期化チュウ...', false);
            if (DEBUG) console.log('kuroshiro初期化開始');
            
            // Kuroshiroの前に単独でKuromojiを初期化することで信頼性を高める
            const analyzer = new KuromojiAnalyzer({
                dictPath: "https://unpkg.com/kuromoji@0.1.2/dict"
            });
            
            await kuroshiro.init(analyzer);
            kuromojiInitialized = true;
            
            if (DEBUG) console.log('kuroshiro初期化完了');
            updateStatus('準備カンリョウ！', true);
            
            // サンプルテキストで動作確認
            if (DEBUG) {
                try {
                    const testResult = await kuroshiro.convert("漢字のテスト", {
                        to: 'katakana',
                        mode: 'normal'
                    });
                    console.log('kuroshiro動作テスト:', testResult);
                } catch (e) {
                    console.error('動作テストエラー:', e);
                }
            }
            
            // 初期化完了後、入力フィールドにフォーカス
            inputText.focus();
            
            setTimeout(() => {
                statusIndicator.classList.add('hidden');
            }, 2000);
        } catch (error) {
            console.error('Failed to initialize Kuroshiro:', error);
            updateStatus('初期化シッパイ', false);
        }
    }
    
    // ステータス表示を更新
    function updateStatus(message, isSuccess = false) {
        statusText.textContent = message;
        statusIndicator.classList.remove('hidden', 'success');
        if (isSuccess) {
            statusIndicator.classList.add('success');
        }
        if (DEBUG) console.log('ステータス更新:', message, isSuccess ? '(成功)' : '');
    }
    
    // テキスト入力時にタイマーをセット
    inputText.addEventListener('input', () => {
        const currentValue = inputText.value.trim();
        
        // 入力がない場合は出力をクリア
        if (!currentValue) {
            outputText.textContent = '';
            return;
        }
        
        // 入力値が前回と同じなら処理しない
        if (currentValue === lastInputValue) return;
        lastInputValue = currentValue;
        
        if (DEBUG) console.log('入力検知:', currentValue);
        
        // タイマーをリセット
        if (convertTimer) clearTimeout(convertTimer);
        
        updateStatus('ヘンカンジュンビチュウ...');
        
        // 一定時間後に変換
        convertTimer = setTimeout(async () => {
            await convertText(currentValue);
        }, TYPING_DELAY);
    });
    
    // 直接変換用の関数（テストやボタン押下時用）
    inputText.addEventListener('keydown', async (e) => {
        // Ctrl+Enter または Command+Enter で即時変換
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const text = inputText.value.trim();
            if (text) {
                await convertText(text);
            }
        }
    });
    
    // テキスト変換処理
    async function convertText(text) {
        if (!text) return;
        
        try {
            if (DEBUG) console.log('変換処理開始:', text);
            updateStatus('ヘンカンチュウ...');
            
            // kuroshiroが初期化されていない場合
            if (!kuromojiInitialized) {
                updateStatus('システムガ マダ ジュンビデキテイマセン', false);
                return;
            }
            
            // APIキーがない場合
            if (!API_KEY) {
                updateStatus('APIキーガ セッテイサレテイマセン', false);
                outputText.textContent = 'APIキーガ セッテイサレテイナイタメ ヘンカンデキマセン。';
                return;
            }
            
            // 言語を自動検出して日本語に翻訳
            if (DEBUG) console.log('Google翻訳API呼び出し開始');
            const translatedText = await translateText(text);
            if (DEBUG) console.log('翻訳結果:', translatedText);
            
            // 翻訳されたテキストをカタカナに変換
            if (DEBUG) console.log('カタカナ変換開始');
            let katakanaText;
            try {
                katakanaText = await kuroshiro.convert(translatedText, {
                    to: 'katakana',
                    mode: 'normal'
                });
                if (DEBUG) console.log('カタカナ変換結果:', katakanaText);
            } catch (error) {
                console.error('カタカナ変換エラー:', error);
                // カタカナ変換に失敗した場合は翻訳テキストをそのまま使用
                katakanaText = translatedText;
            }
            
            // 結果を表示
            outputText.textContent = katakanaText;
            updateStatus('ヘンカンカンリョウ!', true);
            
            // 2秒後にステータスを隠す
            setTimeout(() => {
                statusIndicator.classList.add('hidden');
            }, 2000);
        } catch (error) {
            console.error('変換エラー:', error);
            updateStatus('エラーガ ハッセイシマシタ');
            outputText.textContent = 'エラーガ ハッセイシマシタ。モウイチド オタメシクダサイ。';
        }
    }
    
    // コピーボタンのイベントリスナー
    copyBtn.addEventListener('click', () => {
        if (!outputText.textContent) {
            updateStatus('コピースル テキストガ アリマセン');
            return;
        }
        
        navigator.clipboard.writeText(outputText.textContent)
            .then(() => {
                updateStatus('コピーシマシタ!', true);
                setTimeout(() => {
                    statusIndicator.classList.add('hidden');
                }, 2000);
            })
            .catch(err => {
                console.error('クリップボードヘノ コピーニ シッパイシマシタ:', err);
                updateStatus('コピーニ シッパイシマシタ');
            });
    });
    
    // Google Translation APIを使用してテキストを翻訳する関数
    async function translateText(text) {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`;
        
        if (DEBUG) console.log('API URL:', url.replace(API_KEY, '***'));
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: 'ja',
                    format: 'text'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (DEBUG) console.error('API応答エラー:', response.status, errorData);
                throw new Error(`ホンヤク API エラー: ${response.status}`);
            }
            
            const data = await response.json();
            if (DEBUG) console.log('API応答データ:', data);
            
            if (!data.data || !data.data.translations || !data.data.translations[0]) {
                throw new Error('API応答データが不正');
            }
            
            return data.data.translations[0].translatedText;
        } catch (error) {
            console.error('翻訳エラー:', error);
            throw new Error('ホンヤク API ニ セツゾク デキマセンデシタ');
        }
    }
    
    // 手動変換ボタンを追加（自動変換の代替手段として）
    const addManualButton = () => {
        const container = document.querySelector('.input-container');
        if (!container) return;
        
        const button = document.createElement('button');
        button.textContent = 'ヘンカン';
        button.className = 'action-button manual-button';
        button.innerHTML = '<i class="fas fa-sync-alt"></i> ヘンカン';
        button.addEventListener('click', async () => {
            const text = inputText.value.trim();
            if (text) {
                await convertText(text);
            } else {
                updateStatus('テキストヲ ニュウリョクシテクダサイ');
            }
        });
        
        container.appendChild(button);
    };
    
    // 手動変換ボタンを追加
    addManualButton();
    
    // テスト用の手動変換トリガー（開発用）
    if (DEBUG) {
        window.manualConvert = async (text) => {
            if (!text) text = inputText.value.trim();
            await convertText(text);
        };
        console.log('デバッグモード有効: window.manualConvert() でテスト可能');
    }
});
