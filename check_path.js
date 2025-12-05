const fs = require('fs');
const path = require('path');

console.log('--- パス確認スクリプト ---');

try {
    // 1. 現在地の表示
    const currentDir = process.cwd();
    console.log(`\n1. コマンド実行場所 (カレントディレクトリ):`);
    console.log(`   ${currentDir}`);

    // 3. 絶対パスの表示 (先に解決)
    const imagesPathAbsolute = path.resolve(currentDir, 'images');
    console.log(`\n2. スクリプトが探そうとしている'images'フォルダの絶対パス:`);
    console.log(`   ${imagesPathAbsolute}`);

    // 2. フォルダ存在確認
    const imagesDirExists = fs.existsSync(imagesPathAbsolute);
    console.log(`\n3. 上記パスにフォルダが存在するか: ${imagesDirExists ? '✅ はい' : '❌ いいえ'}`);

    // 4. 中身の確認
    if (imagesDirExists) {
        const files = fs.readdirSync(imagesPathAbsolute);
        console.log(`\n4. フォルダの中身:`);
        console.log(`   - ファイル数: ${files.length}件`);
        if (files.length > 0) {
            console.log(`   - 最初のファイル名: ${files[0]}`);
        } else {
            console.log(`   - フォルダは空です。`);
        }
    }
} catch (error) {
    console.error('\nエラーが発生しました:', error.message);
}

console.log('\n--- 確認終了 ---');