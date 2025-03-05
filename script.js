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
        // window.CONFIGも確認
        API_KEY = (typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG)?.GOOGLE_TRANSLATE_API_KEY || '';
        if (DEBUG) console.log('APIキー読み込み成功:', API_KEY ? 'APIキーあり' : 'APIキーなし');
    } catch (error) {
        console.error('設定ファイルが読み込めませんでした:', error);
        updateStatus('API設定ヲ ヨミコメマセンデシタ', false);
    }
    
    // グローバルオブジェクトの設定
    // グローバルスコープに確実に公開（読み込みタイミングの問題を回避）
    function exposeGlobalObjects() {
        if (typeof Kuroshiro === 'function' && !window.Kuroshiro) {
            window.Kuroshiro = Kuroshiro;
            if (DEBUG) console.log('Kuroshiroをグローバルに公開しました');
        }
        
        if (typeof KuromojiAnalyzer === 'function' && !window.KuromojiAnalyzer) {
            window.KuromojiAnalyzer = KuromojiAnalyzer;
            if (DEBUG) console.log('KuromojiAnalyzerをグローバルに公開しました');
        }
        
        return {
            kuroshiro: window.Kuroshiro || Kuroshiro,
            analyzer: window.KuromojiAnalyzer || KuromojiAnalyzer
        };
    }
    
    // ローカル環境向けの修正（モジュールをグローバルに公開）
    try {
        exposeGlobalObjects();
    } catch (e) {
        if (DEBUG) console.log('初期グローバルオブジェクト設定に失敗:', e);
    }
    
    // 変換タイマーと入力バッファ
    let convertTimer = null;
    let lastInputValue = '';
    const TYPING_DELAY = 1000; // 1秒間タイピングが止まったら変換
    
    // 変数の初期化
    let kuroshiro = null;
    let kuroshiroInitialized = false;
    let initializationAttempts = 0;
    const MAX_INIT_ATTEMPTS = 3;
    
    // Kuroshiroとanalyzerが読み込まれているか確認
    function checkLibrariesLoaded() {
        // グローバルオブジェクトとしてのチェック
        const kuroshiroClass = window.Kuroshiro || Kuroshiro;
        const analyzerClass = window.KuromojiAnalyzer || KuromojiAnalyzer;
        
        // 存在確認
        const kuroshiroExists = typeof kuroshiroClass === 'function';
        const analyzerExists = typeof analyzerClass === 'function';
        
        if (DEBUG) {
            console.log(`ライブラリチェック [${initializationAttempts+1}回目]:`);
            console.log('- Kuroshiro:', kuroshiroExists ? '✓' : '✗');
            console.log('- KuromojiAnalyzer:', analyzerExists ? '✓' : '✗');
        }
        
        return { 
            loaded: kuroshiroExists && analyzerExists,
            kuroshiroClass,
            analyzerClass
        };
    }
    
    // ページ読み込み時にkuroshiroを初期化
    // 初回は少し遅らせて確実にライブラリを読み込んでから初期化
    setTimeout(() => {
        initKuroshiro();
    }, 1000);
    
    async function initKuroshiro() {
        // 既に初期化されている場合は処理を行わない
        if (kuroshiroInitialized) {
            if (DEBUG) console.log('Kuroshiroは既に初期化済みです');
            return;
        }
        
        // 初期化試行回数をカウント
        initializationAttempts++;
        
        // ライブラリが読み込まれているか確認
        const { loaded, kuroshiroClass, analyzerClass } = checkLibrariesLoaded();
        
        if (!loaded) {
            if (initializationAttempts < MAX_INIT_ATTEMPTS) {
                if (DEBUG) console.log(`ライブラリが読み込まれていません。${initializationAttempts+1}回目を試行します。`);
                updateStatus(`ライブラリ読み込み中 (${initializationAttempts}/${MAX_INIT_ATTEMPTS})`, false);
                
                // グローバルに再公開を試みる
                try {
                    exposeGlobalObjects();
                } catch (e) {
                    console.error('グローバルオブジェクト公開エラー:', e);
                }
                
                // 再試行
                setTimeout(initKuroshiro, 1500);
                return;
            } else {
                console.error('Kuroshiroライブラリが見つかりません（最大試行回数に到達）');
                updateStatus('Kuroshiroライブラリが見つかりません', false);
                return;
            }
        }
        
        // 初期化処理
        try {
            if (DEBUG) console.log('Kuroshiroの初期化を開始します...');
            updateStatus('初期化中...', true);
            
            // Kuroshiroのインスタンス化
            kuroshiro = new kuroshiroClass();
            
            // analyzerの初期化と紐付け
            const analyzer = new analyzerClass({
                // ディクショナリパスを明示的に設定
                dictPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict"
            });
            
            // Kuroshiroの初期化
            await kuroshiro.init(analyzer);
            
            kuroshiroInitialized = true;
            updateStatus('準備完了', false);
            
            if (DEBUG) console.log('Kuroshiroの初期化に成功しました！');
            
            // グローバルに公開（デバッグ用）
            window.kuroshiroInstance = kuroshiro;
        } catch (error) {
            console.error('Kuroshiroの初期化に失敗しました:', error);
            updateStatus('初期化に失敗しました', false);
            
            // 再試行
            if (initializationAttempts < MAX_INIT_ATTEMPTS) {
                setTimeout(initKuroshiro, 2000);
            }
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
            if (!kuroshiroInitialized || !kuroshiro) {
                // 再初期化を試みる
                if (initializationAttempts < MAX_INIT_ATTEMPTS) {
                    updateStatus('システムヲ サイキドウチュウ...');
                    await initKuroshiro();
                    
                    // 再初期化後にまだ準備ができていなければエラー
                    if (!kuroshiroInitialized || !kuroshiro) {
                        updateStatus('システムガ マダ ジュンビデキテイマセン', false);
                        return;
                    }
                } else {
                    updateStatus('システムガ マダ ジュンビデキテイマセン', false);
                    return;
                }
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
        
        // 手動初期化トリガー
        window.reinitKuroshiro = initKuroshiro;
        
        console.log('デバッグモード有効: window.manualConvert() でテスト変換、window.reinitKuroshiro() で再初期化可能');
    }
});
