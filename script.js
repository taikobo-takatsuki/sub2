document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const translateBtn = document.getElementById('translate-btn');
    const copyBtn = document.getElementById('copy-btn');
    
    // Google Translation API Key
    const API_KEY = 'AIzaSyBMBBy6FWq_AJCPSsvAYOmjlOEhR6G08Ro';
    
    // kuroshiroの初期化
    const kuroshiro = new Kuroshiro();
    const analyzer = new KuromojiAnalyzer();
    
    // ページ読み込み時にkuroshiroを初期化
    initKuroshiro();
    
    async function initKuroshiro() {
        try {
            await kuroshiro.init(analyzer);
            console.log('Kuroshiro initialized successfully');
            // 初期化完了後、ボタンを有効化
            translateBtn.disabled = false;
        } catch (error) {
            console.error('Failed to initialize Kuroshiro:', error);
        }
    }
    
    // 翻訳ボタンのイベントリスナー
    translateBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        
        if (!text) {
            alert('テキストヲ ニュウリョクシテクダサイ');
            return;
        }
        
        try {
            translateBtn.disabled = true;
            translateBtn.textContent = 'ショリチュウ...';
            
            // まず言語を自動検出して日本語に翻訳
            const translatedText = await translateText(text);
            
            // 翻訳されたテキストを全てカタカナに変換
            // kuroshiroを使ってカタカナに変換
            const katakanaText = await kuroshiro.convert(translatedText, {
                to: 'katakana',
                mode: 'normal'
            });
            
            // 結果を表示
            outputText.textContent = katakanaText;
        } catch (error) {
            console.error('エラー:', error);
            outputText.textContent = 'エラーガ ハッセイシマシタ。モウイチド オタメシクダサイ。';
        } finally {
            translateBtn.disabled = false;
            translateBtn.textContent = 'ヘンカン';
        }
    });
    
    // コピーボタンのイベントリスナー
    copyBtn.addEventListener('click', () => {
        if (!outputText.textContent) {
            alert('コピースル テキストガ アリマセン');
            return;
        }
        
        navigator.clipboard.writeText(outputText.textContent)
            .then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'コピーシマシタ!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('クリップボードヘノ コピーニ シッパイシマシタ:', err);
                alert('コピーニ シッパイシマシタ');
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