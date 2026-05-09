const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// ==========================================
// 1. 模擬資料庫與真實庫存系統
// ==========================================
let balance = 300;
let points = 0;
let isPrepared = false;
let pendingItems = []; 
let transactions = [];
let inventory = [];

// 容器類型設定
const TYPES = {
    CUP:  { code: '001', name: '環保杯' },
    BOX:  { code: '002', name: '環保餐盒' },
    BOWL: { code: '003', name: '環保碗' }
};

// 初始化庫存，賦予每一個物件「獨一無二的9碼編號」
function initInventory() {
    Object.keys(TYPES).forEach(typeKey => {
        const typeInfo = TYPES[typeKey];
        // 假設每種容器各有 10 個真實庫存
        for (let i = 1; i <= 10; i++) {
            inventory.push({
                id: `${typeInfo.code}${String(i).padStart(6, '0')}`, // 類型(3碼) + 獨立流水號(6碼)
                typeKey: typeKey,
                typeName: typeInfo.name,
                status: 'idle' // 'idle', 'pending', 'rented'
            });
        }
    });
}
initInventory();

// ==========================================
// 2. API 端點設定
// ==========================================

// 取得系統狀態與所有資料
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            balance,
            points,
            isPrepared,
            transactions,
            inventory // 回傳完整庫存給商家端計算數量
        }
    });
});

// 商家準備 QR Code
app.post('/api/prepare', (req, res) => {
    const requested = req.body; // { CUP: x, BOX: y, BOWL: z }
    pendingItems = [];

    for (const [typeKey, count] of Object.entries(requested)) {
        if (count > 0) {
            // 從庫存中挑選狀態為 idle 的特定容器
            const available = inventory.filter(i => i.typeKey === typeKey && i.status === 'idle');
            if (available.length < count) {
                return res.status(400).json({ success: false, message: `${TYPES[typeKey].name} 庫存不足` });
            }
            
            // 將挑選到的容器加入待租借清單，並暫時鎖定狀態
            const selected = available.slice(0, count);
            selected.forEach(item => {
                item.status = 'pending';
                pendingItems.push(item);
            });
        }
    }

    if (pendingItems.length === 0) return res.status(400).json({ success: false, message: "未選擇容器" });

    isPrepared = true;
    res.json({ success: true });
});

// 用戶確認租借
app.post('/api/rent', (req, res) => {
    if (!isPrepared || pendingItems.length === 0) return res.status(400).json({ success: false, message: "商家尚未準備容器" });
    
    const rentAmount = pendingItems.length * 50; 
    if (balance < rentAmount) return res.status(400).json({ success: false, message: "餘額不足" });

    const now = new Date();
    const deadline = new Date();
    deadline.setDate(now.getDate() + 7); // 7天後應歸還

    const newTx = {
        id: "TXN" + Date.now(), // 交易本身的編號
        merchantName: "好棒棒環保商店",
        date: now.toLocaleString(),
        amount: rentAmount,
        deadline: deadline.toLocaleDateString(),
        isCompleted: false,
        details: pendingItems.map(item => {
            item.status = 'rented'; // 正式借出
            return {
                ...item,
                isReturned: false,
                returnDate: null
            };
        })
    };

    balance -= rentAmount;
    transactions.unshift(newTx); // 將新紀錄放最上面
    isPrepared = false;
    pendingItems = [];

    res.json({ success: true, message: "租借成功" });
});

// 模擬歸還 (歸還最早一筆未完成的交易)
app.post('/api/return', (req, res) => {
    const target = transactions.find(t => !t.isCompleted);
    if (!target) return res.status(400).json({ success: false, message: "沒有待歸還的紀錄" });

    target.isCompleted = true;
    target.details.forEach(detailItem => {
        detailItem.isReturned = true;
        detailItem.returnDate = new Date().toLocaleString();
        
        // 將實體庫存狀態恢復為 idle
        const invItem = inventory.find(i => i.id === detailItem.id);
        if (invItem) invItem.status = 'idle';
    });

    balance += target.amount;
    points += (target.details.length * 10);

    res.json({ success: true, message: "歸還成功" });
});

app.listen(PORT, () => {
    console.log(`✅ 伺服器已啟動: http://localhost:${PORT}`);
});