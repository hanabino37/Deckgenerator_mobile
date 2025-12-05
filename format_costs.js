const fs = require('fs');
const path = require('path');

// 入力ファイルと出力ファイルのパスを定義
const inputFilePath = path.join(__dirname, 'mtg_TLA_list.txt');
const outputFilePath = path.join(__dirname, 'mtg_TLA_list_fixed.txt');

// 置換ルールを定義
const costReplacements = {
    '白': 'W',
    '青': 'U',
    '黒': 'B',
    '赤': 'R',
    '緑': 'G'
};

try {
    // 1. ファイルを読み込む
    const fileContent = fs.readFileSync(inputFilePath, 'utf8');

    // 2. ファイルを行ごとに分割し、処理を行う
    const processedLines = fileContent.split('\n').map(line => {
        // 行の先頭が「　コスト：」で始まるかチェック
        if (line.startsWith('　コスト：')) {
            let modifiedLine = line;
            // 3. 定義されたルールに従って文字を置換
            for (const [jpChar, enChar] of Object.entries(costReplacements)) {
                // 'g'フラグを使って行内のすべての該当文字を置換する
                modifiedLine = modifiedLine.replace(new RegExp(jpChar, 'g'), enChar);
            }
            return modifiedLine;
        }
        // 4. 対象外の行はそのまま返す
        return line;
    });

    // 処理後の行を結合して新しいファイル内容を作成
    const newFileContent = processedLines.join('\n');

    // 新しいファイルとして書き出す
    fs.writeFileSync(outputFilePath, newFileContent, 'utf8');

    console.log(`✅ 整形が完了しました。`);
    console.log(`新しいファイルが '${outputFilePath}' に保存されました。`);

} catch (error) {
    console.error('❌ ファイルの処理中にエラーが発生しました:', error.message);
}
