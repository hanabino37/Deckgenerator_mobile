const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CARD_LIST_PATH = path.join(__dirname, 'mtg_TLA_list_fixed.txt'); // カードリストのパス
const CSV_PATH = path.join(__dirname, 'ALL_card-ratings-2025-12-09.csv');
const OUTPUT_PATH = path.join(__dirname, 'gamedata.js');
const IMAGES_DIR = path.join(__dirname, 'cardlist');

/**
 * GIH WR の値からTierランクを計算します。
 * @param {string | number} gihwrValue - "58.5%" や 58.5 のような勝率データ
 * @returns {string} - "A+", "B-", "U" などのTier文字列
 */
function getTier(gihwrValue) {
    if (!gihwrValue || String(gihwrValue).trim() === '-' || String(gihwrValue).trim() === '') return 'U';
    const value = parseFloat(String(gihwrValue).replace('%', ''));
    if (isNaN(value)) return 'U';

    if (value >= 64.0) return 'A+';
    if (value >= 62.5) return 'A';
    if (value >= 61.5) return 'A-';
    if (value >= 60.0) return 'B+';
    if (value >= 58.8) return 'B';
    if (value >= 57.5) return 'B-';
    if (value >= 56.2) return 'C+';
    if (value >= 55.0) return 'C';
    if (value >= 53.7) return 'C-';
    if (value >= 52.5) return 'D+';
    if (value >= 51.2) return 'D';
    if (value >= 50.0) return 'D-';
    if (value < 50.0) return 'F';
    return 'U';
}

/**
 * カードリストのテキストファイルをパースして、英語名をキーにしたオブジェクトを返します。
 * @param {string} filePath - mtg_TLA_list_fixed.txt のパス
 * @returns {Promise<object>} - パースされたカードデータのオブジェクト
 */
function parseCardDatabase(filePath) {
    return new Promise((resolve, reject) => {
        const db = {};
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        let currentCard = {};

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            if (line.match(/^\d+\./) || line.startsWith('英語名：')) {
                // 前のカード情報を保存
                if (currentCard.nameEn) {
                    db[currentCard.nameEn] = {
                        jp: currentCard.nameJp || '',
                        cost: currentCard.cost || '',
                        type: currentCard.type || '' // 【要件1】タイプ情報を追加
                    };
                }
                // 新しいカードの処理開始
                currentCard = {};
                if (line.startsWith('英語名：')) {
                    currentCard.nameEn = line.replace('英語名：', '').trim();
                }
            } else if (line.startsWith('日本語名：')) {
                let jpName = line.replace('日本語名：', '').trim();
                // 読み仮名などを削除
                jpName = jpName.replace(/（.+）/, '').replace(/\(.+\)/, '').trim();
                currentCard.nameJp = jpName;
            } else if (line.startsWith('コスト：')) {
                currentCard.cost = line.replace('コスト：', '').trim();
            } else if (line.trim().startsWith('タイプ：')) { // 【要件1】タイプ行のパース追加
                // 全角スペースも考慮
                currentCard.type = line.trim().replace('タイプ：', '').trim();
            }
        });

        // ファイル末尾の最後のカードを保存
        if (currentCard.nameEn) {
            db[currentCard.nameEn] = {
                jp: currentCard.nameJp || '',
                cost: currentCard.cost || '',
                type: currentCard.type || '' // 【要件1】タイプ情報を追加
            };
        }

        // --- デバッグ要件2: カードリスト読み込みの確認 ---
        const firstCardKey = Object.keys(db)[0];
        if (firstCardKey) {
            console.log(`\n[デバッグ] パース後の最初のカードデータ:`);
            console.log(`  - enName: ${firstCardKey}`);
            console.log(`  - jpName: ${db[firstCardKey].jp}`);
        }

        console.log(`カードリストのパース完了: ${Object.keys(db).length}枚`);
        resolve(db);
    });
}

/**
 * カードデータに画像ファイル名を紐づける
 * @param {object} cardData - パースされたカードデータ
 * @returns {Promise<object>} - fileNameプロパティが追加されたカードデータ
 */
function linkImageFiles(cardData) {
    return new Promise((resolve, reject) => {
        console.log('\n画像ファイルの紐付けを開始...');
        // --- デバッグ要件1: パスの確認 ---
        if (!fs.existsSync(IMAGES_DIR)) {
            console.warn(`cardlistフォルダが見つかりません: ${IMAGES_DIR}`);
            console.warn('すべてのカードのfileNameはnullになります。');
            for (const nameEn in cardData) {
                cardData[nameEn].fileName = null;
            }
            return resolve(cardData);
        }

        let imageFiles = fs.readdirSync(IMAGES_DIR); // 同期的にファイルリストを取得
        // 【修正要件1】ファイルリストを日本語の五十音順にソート
        imageFiles.sort((a, b) => a.localeCompare(b, 'ja'));

        console.log(`  - cardlistフォルダから ${imageFiles.length} 件のファイルを検出しました。`);
        console.log(`  - ファイル名（先頭3件）:`, imageFiles.slice(0, 3));

        // 【修正要件3】正規化ロジックの微調整
        const normalize = (str) => {
            if (!str) return '';
            // 半角/全角スペース、読点、中黒、およびその他の全角記号を削除
            return str.replace(/[\s　、・！？（）：]/g, '');
        };

        // 検索を高速化するため、正規化済みのファイル名をキー、元のファイル名を値とするマップを作成
        const imageFileMap = new Map();
        imageFiles.forEach(file => {
            const nameWithoutExt = path.parse(file).name;
            imageFileMap.set(normalize(nameWithoutExt), file);
        });

        // --- デバッグ要件3: マッチングロジックの可視化 ---
        let isFirstCard = true;
        let matchCount = 0;
        let notFoundCount = 0;
        // 各カードデータにファイル名を紐付け
        for (const nameEn in cardData) {
            const card = cardData[nameEn];
            const jpName = card.jp;
            const normalizedJpName = normalize(jpName);
            const foundFile = imageFileMap.get(normalizedJpName) || null;

            if (isFirstCard) {
                // 【修正要件3】デバッグログを日本語名基準に変更
                console.log('\n[デバッグ] 最初の1枚のマッチング処理を可視化:');
                console.log(`  - 比較元(日本語名): [${card.jp}]`);
                console.log(`  - 正規化後: [${normalizedJpName}]`);
                const firstImageEntry = imageFileMap.entries().next().value;
                if (firstImageEntry) {
                    console.log(`  - ファイルリストの先頭と比較: [${firstImageEntry[0]}] vs [${normalizedJpName}]`);
                    console.log(`  - 結果: ${firstImageEntry[0] === normalizedJpName ? '一致' : '不一致'}`);
                }
                isFirstCard = false;
            }

            card.fileName = foundFile;
            if (foundFile) {
                matchCount++;
            } else {
                // 画像が見つからなかったカードをカウント
                notFoundCount++;
            }
        }

        console.log(`\n  - 合計 ${matchCount} 枚の画像パスを紐付けました。`);
        // ログ出力の抑制: 失敗をエラー扱いせず、情報としてサマリーのみ表示
        console.log(`  - ${notFoundCount} 枚のカードは画像なしとして登録されました。`);

        console.log('画像ファイルの紐付け完了。');
        resolve(cardData);
    });
}

/**
 * 17landsのCSVデータを読み込み、カードデータにTier情報をマージします。
 * @param {string} filePath - CSVファイルのパス
 * @param {object} cardData - parseCardDatabaseで作成したカードデータ
 * @returns {Promise<object>} - Tier情報がマージされたカードデータ
 */
function mergeTierData(filePath, cardData) {
    // 【要件2】名寄せ用正規化関数
    const normalizeKey = (str) => {
        if (!str) return '';
        return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    return new Promise((resolve, reject) => {
        const tierMap = new Map();
        let isFirstRow = true;

        fs.createReadStream(filePath)
            // 【修正】ヘッダーの引用符や前後の空白を自動的に除去するオプションを追加
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().replace(/"/g, '')
            }))
            .on('data', (row) => {
                // 【要件1】CSVヘッダーのデバッグ出力
                if (isFirstRow) {
                    console.log('\n[デバッグ] CSVのヘッダー情報:', Object.keys(row));
                    isFirstRow = false;
                }

                // 【要件3】正規化したキーで17landsデータを読み込み
                const name = row['Name'];
                const wr = row['GIH WR'];
                if (name && wr) {
                    const key = normalizeKey(name);
                    tierMap.set(key, wr);
                }
            })
            .on('end', () => {
                console.log(`17landsデータの読み込み完了: ${tierMap.size}件`);
                let matchCount = 0;
                let logCount = 0;

                // 【要件4】マージロジックの変更
                for (const nameEn in cardData) {
                    const card = cardData[nameEn];
                    const key = normalizeKey(nameEn);
                    const wrValue = tierMap.get(key);

                    if (wrValue) {
                        card.tier = getTier(wrValue);
                        card.wr = typeof wrValue === 'string' && wrValue.includes('%') ? wrValue : `${wrValue}%`;
                        matchCount++;
                        // 【要件5】最初の数件のマッチング結果ログ
                        if (logCount < 5) {
                            console.log(`  - [マッチ成功] ${nameEn}(${key}) -> WR: ${card.wr}`);
                            logCount++;
                        }
                    } else {
                        card.tier = 'U';
                        card.wr = '-';
                    }
                }
                console.log('Tierデータのマージ完了');
                // 【要件5】最終的なマッチング結果のログ
                console.log(`\n  - Tierデータが見つかった数: ${matchCount} / ${Object.keys(cardData).length} 枚`);
                resolve(cardData);
            })
            .on('error', reject);
    });
}

async function build() {
    try {
        let cardData = await parseCardDatabase(CARD_LIST_PATH);
        cardData = await linkImageFiles(cardData);

        // 【要件3】出力確認
        const firstCardKeyForTypeCheck = Object.keys(cardData)[0];
        if (firstCardKeyForTypeCheck) {
            console.log(`\n[デバッグ] 最初のカードのタイプ情報確認:`);
            console.log(`  - ${firstCardKeyForTypeCheck}: ${cardData[firstCardKeyForTypeCheck].type}`);
        }

        let finalData = await mergeTierData(CSV_PATH, cardData);

        const outputContent = `// 自動生成データ: 英語名をキーにしたオブジェクト\nconst MASTER_CARD_DATA = ${JSON.stringify(finalData, null, 4)};`;
        fs.writeFileSync(OUTPUT_PATH, outputContent, 'utf8');
        console.log(`\n✅ gamedata.js の生成が完了しました！`);
    } catch (error) {
        console.error('エラーが発生しました:', error);
    }
}

build();