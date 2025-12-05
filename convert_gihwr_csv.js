const fs = require('fs');
const path = require('path');

// --- Configuration ---
const LIST_FILE_PATH = path.join(__dirname, 'mtg_TLA_list_fixed.txt');
const CSV_INPUT_PATH = path.join(__dirname, 'TLA_UB_GIHWR_2025-12-04.csv');
const CSV_OUTPUT_PATH = path.join(__dirname, 'TLA_UB_GIHWR_2025-12-04_fixed.csv');
// --- End Configuration ---

/**
 * Parses the card list file to create a mapping from English names to Japanese names.
 * @param {string} filePath - Path to the mtg_TLA_list_fixed.txt file.
 * @returns {Map<string, string>} A map where the key is the English name and the value is the Japanese name.
 */
function createNameMap(filePath) {
    console.log(`1. Reading card list from: ${filePath}`);
    const nameMap = new Map();
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);

    let currentEnName = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('英語名：')) {
            currentEnName = trimmedLine.replace('英語名：', '').trim();
        } else if (trimmedLine.startsWith('日本語名：') && currentEnName) {
            let jpName = trimmedLine.replace('日本語名：', '').trim();
            // Remove furigana in parentheses to get a clean name
            jpName = jpName.replace(/（.+?）/g, '').replace(/\(.+?\)/g, '').trim();
            nameMap.set(currentEnName, jpName);
            currentEnName = null; // Reset for the next entry
        }
    }
    console.log(`   => Created a map with ${nameMap.size} entries.`);
    return nameMap;
}

/**
 * Processes the CSV file, replacing the 'Name' column using the provided map.
 * @param {string} csvPath - Path to the input CSV file.
 * @param {Map<string, string>} nameMap - The English-to-Japanese name mapping.
 */
function convertCsv(csvPath, nameMap) {
    console.log(`2. Processing CSV file: ${csvPath}`);
    if (!fs.existsSync(csvPath)) {
        throw new Error(`Input CSV file not found at: ${csvPath}`);
    }
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/);

    if (lines.length === 0) {
        throw new Error("CSV file is empty.");
    }

    const header = lines[0];
    const headerColumns = header.split(',');
    // 【修正】ヘッダー検索時に不要な引用符を削除
    const nameColumnIndex = headerColumns.findIndex(col => col.trim().replace(/"/g, '').toLowerCase() === 'name');
    // 【追加】GIH WR カラムのインデックスも検索
    const gihWrColumnIndex = headerColumns.findIndex(col => col.trim().replace(/"/g, '').toLowerCase() === 'gih wr');

    if (nameColumnIndex === -1) {
        throw new Error("Could not find a 'Name' column in the CSV header.");
    }
    // 【追加】GIH WR カラムが見つからない場合のエラーハンドリング
    if (gihWrColumnIndex === -1) {
        throw new Error("Could not find a 'GIH WR' column in the CSV header.");
    }

    const outputLines = [header]; // Start with the original header

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // Skip empty lines

        const columns = line.split(',');

        // Nameカラムの処理
        if (columns.length > nameColumnIndex) {
            const originalName = columns[nameColumnIndex].replace(/"/g, '').trim();
            const japaneseName = nameMap.get(originalName);

            if (japaneseName) {
                // If a match is found, replace the name
                columns[nameColumnIndex] = `"${japaneseName}/${originalName}"`;
            }
            // If no match, the original name remains unchanged
        }

        // 【追加】GIH WRカラムの処理
        if (columns.length > gihWrColumnIndex) {
            if (!columns[gihWrColumnIndex] || columns[gihWrColumnIndex].trim() === '') {
                columns[gihWrColumnIndex] = '"-"'; // 値が空ならハイフンを代入
            }
        }
        outputLines.push(columns.join(','));
    }

    console.log(`   => Processed ${outputLines.length - 1} data rows.`);
    return outputLines.join('\n');
}

// --- Main Execution ---
try {
    // Step 1: Create the name mapping
    const enToJpMap = createNameMap(LIST_FILE_PATH);

    // Step 2: Convert the CSV data
    const newCsvContent = convertCsv(CSV_INPUT_PATH, enToJpMap);

    // Step 3: Save the new CSV file
    fs.writeFileSync(CSV_OUTPUT_PATH, newCsvContent, 'utf8');
    console.log(`\n✅ Success! The converted file has been saved to:\n   ${CSV_OUTPUT_PATH}`);

} catch (error) {
    console.error(`\n❌ An error occurred: ${error.message}`);
    process.exit(1);
}
