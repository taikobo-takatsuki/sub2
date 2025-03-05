document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const translateBtn = document.getElementById('translate-btn');
    const copyBtn = document.getElementById('copy-btn');
    
    // Google Translation API Key
    const API_KEY = 'AIzaSyBMBBy6FWq_AJCPSsvAYOmjlOEhR6G08Ro';
    
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
            
            // 翻訳されたテキストをカタカナに変換
            const katakanaText = convertToKatakana(translatedText);
            
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
    
    // 平仮名とひらがなをカタカナに変換する関数
    function convertToKatakana(text) {
        // ひらがなをカタカナに変換するマッピング
        const hiraganaToKatakana = {
            'あ': 'ア', 'い': 'イ', 'う': 'ウ', 'え': 'エ', 'お': 'オ',
            'か': 'カ', 'き': 'キ', 'く': 'ク', 'け': 'ケ', 'こ': 'コ',
            'さ': 'サ', 'し': 'シ', 'す': 'ス', 'せ': 'セ', 'そ': 'ソ',
            'た': 'タ', 'ち': 'チ', 'つ': 'ツ', 'て': 'テ', 'と': 'ト',
            'な': 'ナ', 'に': 'ニ', 'ぬ': 'ヌ', 'ね': 'ネ', 'の': 'ノ',
            'は': 'ハ', 'ひ': 'ヒ', 'ふ': 'フ', 'へ': 'ヘ', 'ほ': 'ホ',
            'ま': 'マ', 'み': 'ミ', 'む': 'ム', 'め': 'メ', 'も': 'モ',
            'や': 'ヤ', 'ゆ': 'ユ', 'よ': 'ヨ',
            'ら': 'ラ', 'り': 'リ', 'る': 'ル', 'れ': 'レ', 'ろ': 'ロ',
            'わ': 'ワ', 'を': 'ヲ', 'ん': 'ン',
            'が': 'ガ', 'ぎ': 'ギ', 'ぐ': 'グ', 'げ': 'ゲ', 'ご': 'ゴ',
            'ざ': 'ザ', 'じ': 'ジ', 'ず': 'ズ', 'ぜ': 'ゼ', 'ぞ': 'ゾ',
            'だ': 'ダ', 'ぢ': 'ヂ', 'づ': 'ヅ', 'で': 'デ', 'ど': 'ド',
            'ば': 'バ', 'び': 'ビ', 'ぶ': 'ブ', 'べ': 'ベ', 'ぼ': 'ボ',
            'ぱ': 'パ', 'ぴ': 'ピ', 'ぷ': 'プ', 'ぺ': 'ペ', 'ぽ': 'ポ',
            'ぁ': 'ァ', 'ぃ': 'ィ', 'ぅ': 'ゥ', 'ぇ': 'ェ', 'ぉ': 'ォ',
            'ゃ': 'ャ', 'ゅ': 'ュ', 'ょ': 'ョ', 'っ': 'ッ',
            '。': '。', '、': '、', '！': '！', '？': '？',
            '「': '「', '」': '」', '（': '（', '）': '）'
        };
        
        // 文字ごとに変換
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            // ひらがなであればカタカナに変換、それ以外はそのまま
            if (hiraganaToKatakana[char]) {
                result += hiraganaToKatakana[char];
            } else {
                result += char;
            }
        }
        
        return result;
    }
}); 