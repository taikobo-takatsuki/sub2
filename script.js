document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const copyBtn = document.getElementById('copy-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = statusIndicator.querySelector('.status-text');
    
    // APIキーを設定ファイルから取得（もし設定ファイルが読み込めない場合のフォールバック）
    let API_KEY = '';
    try {
        API_KEY = CONFIG.GOOGLE_TRANSLATE_API_KEY;
    } catch (error) {
        console.error('設定ファイルが読み込めませんでした:', error);
        updateStatus('API設定ヲ ヨミコメマセンデシタ', false);
    }
    
    // 変換タイマーと入力バッファ
    let convertTimer = null;
    let lastInputValue = '';
    const TYPING_DELAY = 1000; // 1秒間タイピングが止まったら変換
    
    // kuroshiroの初期化
    const kuroshiro = new Kuroshiro();
    const analyzer = new KuromojiAnalyzer();
    
    // ページ読み込み時にkuroshiroを初期化
    initKuroshiro();
    
    async function initKuroshiro() {
        try {
            updateStatus('初期化チュウ...', false);
            await kuroshiro.init(analyzer);
            console.log('Kuroshiro initialized successfully');
            updateStatus('準備カンリョウ！', true);
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
        
        // タイマーをリセット
        if (convertTimer) clearTimeout(convertTimer);
        
        updateStatus('ヘンカンジュンビチュウ...');
        
        // 一定時間後に変換
        convertTimer = setTimeout(async () => {
            await convertText(currentValue);
        }, TYPING_DELAY);
    });
    
    // テキスト変換処理
    async function convertText(text) {
        if (!text) return;
        
        try {
            updateStatus('ヘンカンチュウ...');
            
            // APIキーがない場合
            if (!API_KEY) {
                updateStatus('APIキーガ セッテイサレテイマセン', false);
                outputText.textContent = 'APIキーガ セッテイサレテイナイタメ ヘンカンデキマセン。';
                return;
            }
            
            // 言語を自動検出して日本語に翻訳
            const translatedText = await translateText(text);
            
            // 翻訳されたテキストをカタカナに変換
            const katakanaText = await kuroshiro.convert(translatedText, {
                to: 'katakana',
                mode: 'normal'
            });
            
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
            throw new Error('ホンヤク API ニ セツゾク デキマセンデシタ');
        }
        
        const data = await response.json();
        return data.data.translations[0].translatedText;
    }
}); 