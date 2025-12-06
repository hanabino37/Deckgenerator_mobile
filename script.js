// =================================================================
// == 完全版スクリプト ==
// =================================================================

// --- 1. 定数定義 ---
let deckCanvas;
let deckCtx;
const CARD_W = 200;
const CARD_H = 280;
const GAP = 10;
const PADDING = 20;
const HEADER_HEIGHT = 60;
const COUNT_COL_WIDTH = 60;
// COLORS 定数は現在使用されていないが、将来のために残しておく
const COLORS = { 'W': '#F8F8F6', 'U': '#C2D7E9', 'B': '#BAB1AB', 'R': '#E49977', 'G': '#9BD3AE', 'M': '#DCD6AC', 'C': '#D3D3D3', 'L': '#C7C2BC' };

// Tierの数値化用マッピング（表示順ソート用）
const tierOrder = {
    'A+': 13, 'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2,
    'F': 1, 'U': 0
};

// 日本語名 -> 英語名 のマッピングを作成（検索用）
const jpToEnMap = new Map(Object.entries(MASTER_CARD_DATA).map(([en, data]) => [data.jp.toLowerCase(), en]));
const masterCardEntries = Object.entries(MASTER_CARD_DATA);

// --- 初期化処理 (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    deckCanvas = document.getElementById('deck-canvas');
    if (deckCanvas) {
        deckCtx = deckCanvas.getContext('2d');
    } else {
        console.error('Canvas element not found during initialization');
    }

    // イベントリスナーの登録
    const genBtn = document.getElementById('generate-btn');
    if (genBtn) genBtn.addEventListener('click', onGenerateClick);

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', onSaveClick);
});


// --- 2. ヘルパー関数群 ---

// 以前の getTier() 関数は削除しました。gamedata.js の tier プロパティを使用します。

function getTierScore(tierStr) {
    return tierOrder[tierStr] || 0;
}

function getManaValue(costStr) {
    if (!costStr) return 0;
    let total = 0;
    const numMatch = costStr.match(/[\(（]([0-9０-９]+)[\)）]/g);
    if (numMatch) {
        numMatch.forEach(m => {
            let numStr = m.replace(/[\(（\)\）]/g, '').replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            const val = parseInt(numStr, 10);
            if (!isNaN(val)) total += val;
        });
    }
    const symMatch = costStr.match(/[\(（]([a-zA-Z/]+)[\)）]/g);
    if (symMatch) {
        symMatch.forEach(m => { if (!m.toUpperCase().includes('X')) total += 1; });
    }
    return total;
}

function parseColor(str) {
    if (!str) return { color: 'C' };
    const cSet = new Set();
    if (str.match(/[W白]/)) cSet.add('W'); if (str.match(/[U青]/)) cSet.add('U');
    if (str.match(/[B黒]/)) cSet.add('B'); if (str.match(/[R赤]/)) cSet.add('R');
    if (str.match(/[G緑]/)) cSet.add('G');
    if (cSet.size > 1) return { color: 'M' };
    if (cSet.size === 1) return { color: Array.from(cSet)[0] };
    if (str.includes('Land')) return { color: 'L' };
    return { color: 'C' };
}

function setStatus(message, isError = false) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff6b6b' : '#9BD3AE';
    }
}

/**
 * 画面幅に応じて列数を決定する
 */
function getColumnCount() {
    // 画面幅が768px以下の場合はモバイルとみなして4列、それ以外は7列
    return window.innerWidth <= 768 ? 4 : 7;
}

function drawTierIcon(ctx, x, y, tier) {
    if (!tier || tier === 'U') return;
    const iconX = x + 30, iconY = y + 50, radius = 18;
    const tierColors = { 'A': '#d92626', 'B': '#22a522', 'C': '#d4a000', 'D': '#2667d9', 'F': '#555555' };
    const color = tierColors[tier.charAt(0)] || '#888888';
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(iconX, iconY, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(tier, iconX, iconY + 1);
}

function drawBadge(ctx, x, y, cnt) {
    const badgeW = 50, badgeH = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(x + 5, y + CARD_H - (badgeH + 5), badgeW, badgeH);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial';
    ctx.fillText('×' + cnt, x + 5 + (badgeW / 2), y + CARD_H - 10);
}

function drawFallbackCard(ctx, x, y, c) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, CARD_W, CARD_H);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, CARD_W - 2, CARD_H - 2);

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 18px Arial';
    ctx.fillText("No Image", x + CARD_W / 2, y + CARD_H / 2 - 20);

    ctx.font = '14px Arial';
    let cardNameText = c.jpName || c.nameEn || c.displayName;
    if (cardNameText.length > 25) {
        cardNameText = cardNameText.substring(0, 22) + '...';
    }
    ctx.fillText(cardNameText, x + CARD_W / 2, y + CARD_H / 2 + 10);
    ctx.restore();

    if (c.cost) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.font = '12px Arial';
        ctx.fillText(c.cost, x + CARD_W - 10, y + 20);
    }

    drawTierIcon(ctx, x, y, c.tier);
    drawBadge(ctx, x, y, c.count);
}

// --- 3. メインロジック ---

function findCardData(inputName) {
    const cleanedName = inputName.trim();
    const cleanedNameLower = cleanedName.toLowerCase();

    if (MASTER_CARD_DATA[cleanedName]) {
        return { enName: cleanedName, data: MASTER_CARD_DATA[cleanedName] };
    }

    const enNameFromJp = jpToEnMap.get(cleanedNameLower);
    if (enNameFromJp && MASTER_CARD_DATA[enNameFromJp]) {
        return { enName: enNameFromJp, data: MASTER_CARD_DATA[enNameFromJp] };
    }

    if (cleanedName.includes('/')) {
        const parts = cleanedName.split('/');
        const enPart = parts[1].trim();
        if (MASTER_CARD_DATA[enPart]) {
            return { enName: enPart, data: MASTER_CARD_DATA[enPart] };
        }
    }

    const foundEntry = masterCardEntries.find(([en, data]) =>
        en.toLowerCase().includes(cleanedNameLower) ||
        data.jp.toLowerCase().includes(cleanedNameLower)
    );
    if (foundEntry) {
        return { enName: foundEntry[0], data: foundEntry[1] };
    }

    return null;
}

function parseDeck(deckText) {
    const lines = deckText.split('\n');
    const deckCards = [];
    const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', '平地', '島', '沼', '山', '森'];

    lines.forEach(line => {
        const originalLine = line.trim();
        if (!originalLine || originalLine.includes('??')) return;

        let count = 1;
        let namePart = originalLine;
        const countMatch = originalLine.match(/[x×]\s*(\d+)$/);
        if (countMatch) {
            count = parseInt(countMatch[1], 10);
            namePart = originalLine.substring(0, countMatch.index).trim();
        }

        // 正規表現の見直し: [CardName] (SET) 123 形式に対応しつつ、末尾括弧削除のリスクを減らす
        // 基本的にはArena形式の `(SET)` とコレクター番号を削除する意図
        // 念のため、末尾が `(SetCode) Number` のようなパターンのみ削除するように少し厳密化することもできるが
        // 既存ロジックを踏襲しつつ、簡単な修正にとどめる
        const cleanedName = namePart.replace(/\s*\(.*?\)\s*(\d*)$/, '').trim();

        const foundCard = findCardData(cleanedName);
        const isBasicLand = basicLands.some(l => cleanedName.includes(l));

        if (!foundCard && !isBasicLand) {
            console.warn(`見つかりません: "${cleanedName}"`);
            return;
        }

        const cardData = foundCard ? foundCard.data : {};
        const nameEn = foundCard ? foundCard.enName : cleanedName;

        let cardInfo = {
            displayName: cleanedName,
            count: count,
            nameEn: nameEn,
            jpName: cardData.jp || cleanedName,
            fileName: cardData.fileName || null,
            cost: cardData.cost || '',
            type: cardData.type || '',
            tier: cardData.tier || 'U', // gamedata.jsのtierをそのまま使う
            gihwr: cardData.wr || '-',
            imgObj: null,
        };

        cardInfo.cmc = getManaValue(cardInfo.cost);
        cardInfo.color = parseColor(cardInfo.cost).color;

        deckCards.push(cardInfo);
    });
    return deckCards;
}

function loadCardImages(deckList) {
    const promises = deckList.map(card => {
        return new Promise(resolve => {
            if (!card.fileName) {
                card.imgObj = null;
                resolve();
                return;
            }
            const img = new Image();
            // 【セキュリティ対応】必要であればcrossOriginを設定するが、fileプロトコルでは逆効果の場合あり
            // img.crossOrigin = 'Anonymous'; 
            const src = `./cardlist/${card.fileName}`;
            img.onload = () => {
                card.imgObj = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`画像ロード失敗: ${src}`);
                card.imgObj = null;
                resolve();
            };
            img.src = src;
        });
    });
    return Promise.all(promises);
}

function drawDeck(deckList) {
    // 【モバイル対応】列数を動的に決定
    const currentColCount = getColumnCount();

    const groupedCards = {
        cost0: [], cost1: [], cost2: [], cost3: [], cost4: [], cost5: [], cost6plus: [], lands: []
    };
    deckList.forEach(card => {
        if (card.type.includes('土地') || card.type.includes('Land')) {
            groupedCards.lands.push(card);
        }
        else {
            const cmcKey = card.cmc >= 6 ? 'cost6plus' : `cost${card.cmc}`;
            groupedCards[cmcKey].push(card);
        }
    });

    const sortInGroup = (a, b) => {
        const tierScoreA = getTierScore(a.tier);
        const tierScoreB = getTierScore(b.tier);
        if (tierScoreA !== tierScoreB) return tierScoreB - tierScoreA;
        const isCreatureA = a.type.includes('クリーチャー') || a.type.includes('Creature');
        const isCreatureB = b.type.includes('クリーチャー') || b.type.includes('Creature');
        if (isCreatureA !== isCreatureB) return isCreatureA ? -1 : 1;
        return 0;
    };
    for (const key in groupedCards) {
        if (key !== 'lands') groupedCards[key].sort(sortInGroup);
    }
    groupedCards.lands.sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.displayName.localeCompare(b.displayName);
    });

    // --- Canvas描画処理 ---
    const groupOrder = ['cost0', 'cost1', 'cost2', 'cost3', 'cost4', 'cost5', 'cost6plus', 'lands'];
    const groupSpacing = 20;

    let requiredHeight = GAP;
    groupOrder.forEach(key => {
        const group = groupedCards[key] || [];
        if (group.length > 0) {
            requiredHeight += Math.ceil(group.length / currentColCount) * (CARD_H + GAP) + groupSpacing;
        }
    });

    deckCanvas.width = (CARD_W + GAP) * currentColCount + GAP + COUNT_COL_WIDTH;
    deckCanvas.height = Math.max(requiredHeight, 400) + HEADER_HEIGHT + PADDING;
    deckCtx.fillStyle = '#111';
    deckCtx.fillRect(0, 0, deckCanvas.width, deckCanvas.height);

    const deckStats = calculateDeckStats(groupedCards);
    drawDeckStats(deckCtx, deckStats, GAP, GAP + 5);

    let y = GAP + HEADER_HEIGHT;
    groupOrder.forEach(key => {
        const group = groupedCards[key] || [];
        if (group.length > 0) {
            const groupStartY = y;
            let totalCountInGroup = 0;

            group.forEach((card, i) => {
                totalCountInGroup += card.count;
                const col = i % currentColCount;
                const row = Math.floor(i / currentColCount);
                const x = GAP + COUNT_COL_WIDTH + col * (CARD_W + GAP);
                const currentY = y + row * (CARD_H + GAP);

                if (card.imgObj) {
                    deckCtx.drawImage(card.imgObj, x, currentY, CARD_W, CARD_H);
                } else {
                    drawFallbackCard(deckCtx, x, currentY, card);
                }
                drawBadge(deckCtx, x, currentY, card.count);
                drawTierIcon(deckCtx, x, currentY, card.tier);
            });

            const numRowsInGroup = Math.ceil(group.length / currentColCount);
            const groupHeight = numRowsInGroup * (CARD_H + GAP) - GAP;
            deckCtx.save();
            deckCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            deckCtx.font = 'bold 32px Arial';
            deckCtx.textAlign = 'center';
            deckCtx.textBaseline = 'middle';
            deckCtx.shadowColor = "rgba(0, 0, 0, 0.8)";
            deckCtx.shadowBlur = 5;
            deckCtx.fillText(totalCountInGroup, GAP + (COUNT_COL_WIDTH / 2), groupStartY + groupHeight / 2);
            deckCtx.restore();

            y += numRowsInGroup * (CARD_H + GAP) + groupSpacing;
        }
    });

    deckCtx.save();
    deckCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    deckCtx.font = '12px Arial';
    deckCtx.textAlign = 'right';
    deckCtx.textBaseline = 'bottom';
    const creditText = "Data provided by 17Lands.com | © Wizards of the Coast | Generated by Decklist Generator";
    deckCtx.fillText(creditText, deckCanvas.width - 20, deckCanvas.height - 10);
    deckCtx.restore();
}

function calculateDeckStats(groupedCards) {
    const stats = { creatures: 0, spells: 0, lands: 0 };
    Object.values(groupedCards).flat().forEach(card => {
        if (card.type.includes('土地') || card.type.includes('Land')) {
            stats.lands += card.count;
        } else if (card.type.includes('クリーチャー') || card.type.includes('Creature')) {
            stats.creatures += card.count;
        } else {
            stats.spells += card.count;
        }
    });
    return stats;
}

function drawDeckStats(ctx, stats, x, y) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = "rgba(0, 0, 0, 1)";
    ctx.shadowBlur = 4;
    const total = stats.creatures + stats.spells + stats.lands;

    // 統計情報の表示位置も少し調整（幅が狭い場合は改行などを考慮すべきだが、今回はシンプルに横並べのまま）
    // 将来的にはここで canvas.width をチェックしてレイアウトを変えるのも手
    ctx.fillText(`Creatures: ${stats.creatures}`, x + 20, y + 20);
    ctx.fillText(`Spells: ${stats.spells}`, x + 250, y + 20);
    ctx.fillText(`Lands: ${stats.lands}`, x + 450, y + 20);
    ctx.fillText(`Total: ${total}`, x + 650, y + 20);
    ctx.restore();
}

// --- 4. イベントハンドラ ---


function onSaveClick() {
    console.log('Save button clicked');
    // deckCanvas変数が正しく初期化されているか確認
    if (!deckCanvas) {
        console.error('Canvas element not found in save handler!');
        setStatus('エラー: キャンバスが見つかりません', true);
        return;
    }

    const now = new Date();
    const timeStr = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const fileName = `decklist_${timeStr}.png`;

    try {
        deckCanvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to create Blob from canvas');
                setStatus('画像を長押しして保存してください (画像生成エラー)', true);
                return;
            }

            const file = new File([blob], fileName, { type: 'image/png' });

            // Web Share API が利用可能かチェック (主にモバイル)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'MTG Decklist',
                        text: 'Generated by Decklist Generator'
                    });
                    console.log('Shared successfully via Web Share API');
                    setStatus('画像を保存・共有しました', false);
                } catch (err) {
                    // キャンセル (AbortError) 以外はエラー表示
                    if (err.name !== 'AbortError') {
                        console.error('Web Share API failed:', err);
                        setStatus('画像を長押しして保存してください (共有エラー)', true);
                    }
                }
            } else {
                // PCなどのフォールバック: <a>タグによるダウンロード
                try {
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                    console.log('Download triggered via <a> tag');
                } catch (e) {
                    console.error('Fallback download failed:', e);
                    setStatus('画像を長押しして保存してください', true);
                }
            }
        }, 'image/png');
    } catch (e) {
        console.error('SecurityError or other synchronous error during toBlob:', e);
        setStatus('画像を長押しして保存してください (セキュリティ制限)', true);
    }
}


async function onGenerateClick() {
    try {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = "画像を保存";
        }

        setStatus('デッキリストを解析中...');
        const deckInput = document.getElementById('deck-input');
        if (!deckInput) throw new Error('Input element not found');

        const deckText = deckInput.value;
        const deckList = parseDeck(deckText);

        if (deckList.length === 0) {
            setStatus('カードが見つかりませんでした。入力データを確認してください。', true);
            return;
        }

        setStatus('カード画像を読み込み中...');
        await loadCardImages(deckList);

        setStatus('画像を生成中...');
        drawDeck(deckList);
        setStatus('画像生成完了！', false);

        // 保存ボタンを有効化
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = "画像を保存 (完了)";
        }

    } catch (e) {
        console.error(e);
        setStatus(`エラーが発生しました: ${e.message}`, true);
    }
}
