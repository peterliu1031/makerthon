const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;
const COOL_DOWN_TIME = 0;

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


// 【新增】碳足跡與信用評分、貢獻度變數
let userCreditScore = 100;         // 用戶信用評分 (預設 100)
let userCarbonSaved = 0.0;         // 用戶累積減碳量 (kg)
let merchantEcoContribution = 0;   // 商家環保貢獻度 (累計借出容器數)
let merchantCarbonSaved = 0.0;     // 商家累積減碳量 (kg)

const TYPES = {
    CUP:  { code: '001', name: '環保杯' },
    BOX:  { code: '002', name: '環保餐盒' },
    BOWL: { code: '003', name: '環保碗' }
};

function initInventory() {
    Object.keys(TYPES).forEach(typeKey => {
        const typeInfo = TYPES[typeKey];
        for (let i = 1; i <= 10; i++) {
            inventory.push({
                id: `${typeInfo.code}${String(i).padStart(6, '0')}`,
                typeKey: typeKey,
                typeName: typeInfo.name,
                status: 'idle' 
            });
        }
    });
}
initInventory();

// ==========================================
// 2. API 端點設定
// ==========================================

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            balance,
            points,
            userCreditScore,
            userCarbonSaved,
            merchantEcoContribution,
            merchantCarbonSaved,
            isPrepared,
            transactions,
            inventory 
        }
    });
});

app.post('/api/prepare', (req, res) => {
    const requested = req.body; 
    pendingItems = [];

    for (const [typeKey, count] of Object.entries(requested)) {
        if (count > 0) {
            const available = inventory.filter(i => i.typeKey === typeKey && i.status === 'idle');
            if (available.length < count) {
                return res.status(400).json({ success: false, message: `${TYPES[typeKey].name} 庫存不足` });
            }
            
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

app.post('/api/rent', (req, res) => {
    if (!isPrepared || pendingItems.length === 0) return res.status(400).json({ success: false, message: "商家尚未準備容器" });
    
    // 【信用評分阻擋機制】
    if (userCreditScore < 60) return res.status(400).json({ success: false, message: "信用評分過低，暫時無法租借" });

    const rentAmount = pendingItems.length * 50; 
    if (balance < rentAmount) return res.status(400).json({ success: false, message: "餘額不足" });

    const now = new Date();
    const deadline = new Date();
    deadline.setDate(now.getDate() + 7); 
    const rentTimeMs = Date.now(); // 紀錄租借的毫秒時間 (防弊用)

    const newTx = {
        id: "TXN" + rentTimeMs, 
        merchantName: "猩火環保飯廳",
        renterName: "USER_5487",
        date: now.toLocaleString(),
        rentTimeMs: rentTimeMs, 
        amount: rentAmount,
        deadline: deadline.toLocaleDateString(),
        isCompleted: false,
        details: pendingItems.map(item => {
            item.status = 'rented'; 
            return { ...item, isReturned: false, returnDate: null };
        })
    };

    balance -= rentAmount;
    
    // 【責任脫鉤】店家只要借出，環保貢獻度直接增加
    merchantEcoContribution += pendingItems.length;
    merchantCarbonSaved += (pendingItems.length * 0.05);

    transactions.unshift(newTx); 
    isPrepared = false;
    pendingItems = [];

    res.json({ success: true, message: "租借成功" });
});

// 獎勵商店兌換 API
app.post('/api/redeem', (req, res) => {
    const { cost, itemName } = req.body;
    
    if (points < cost) {
        return res.status(400).json({ success: false, message: "點數不足，無法兌換！" });
    }
    
    points -= cost;
    console.log(`[系統通知] 用戶成功兌換了 ${itemName}，扣除 ${cost} 點，剩餘 ${points} 點`);
    
    // 實務上可以把兌換紀錄存入資料庫，這裡直接回傳成功
    res.json({ success: true, message: `兌換成功！已獲得「${itemName}」` });
});

app.post('/api/return', (req, res) => {
    const target = transactions.find(t => !t.isCompleted);
    if (!target) return res.status(400).json({ success: false, message: "沒有待歸還的紀錄" });

    // 【冷卻期防弊機制】檢查借出到歸還的時間差
    const nowMs = Date.now();
    const timeDiff = nowMs - target.rentTimeMs;
    
    // 使用剛才設定的常數來判斷
    const isCoolingOff = timeDiff < COOL_DOWN_TIME; 

    target.isCompleted = true;
    target.details.forEach(detailItem => {
        detailItem.isReturned = true;
        detailItem.returnDate = new Date().toLocaleString();
        const invItem = inventory.find(i => i.id === detailItem.id);
        if (invItem) invItem.status = 'idle';
    });

    balance += target.amount; // 押金一律退還

    let message = "";
    if (isCoolingOff) {
        // 如果是洗點數行為，不給點數與碳足跡，並跳出警告
        message = "歸還成功！但因使用時間過短，觸發防弊機制，本次不計算點數與減碳量。";
    } else {
        // 正常使用，發放獎勵
        points += (target.details.length * 10);
        userCarbonSaved += (target.details.length * 0.05);
        message = "歸還成功！獲得環保獎勵與減碳量！";
    }

    res.json({ success: true, message: message });
});

app.listen(PORT, () => {
    console.log(`✅ 伺服器已啟動: http://localhost:${PORT}`);
    console.log(`👉 登入頁面: http://localhost:${PORT}/login.html`);
});