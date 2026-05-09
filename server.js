const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// ==========================================
// 1. 模擬資料庫系統
// ==========================================
const COOL_DOWN_TIME = 0; // 開發模式設為 0

let balance = 300;
let points = 0;
let isPrepared = false;
let pendingItems = []; 
let transactions = [];
let inventory = [];

// 用戶與商家統計資料
let userCreditScore = 100;
let userCarbonSaved = 0.0;
let merchantEcoContribution = 1250; // 預設一些初始數據增加真實感
let merchantCarbonSaved = 62.5;

// 【選項 A】附近合作商家清單
let nearbyMerchants = [
    { name: "猩火環保飯廳", contribution: 1250, distance: "300m", rating: 4.8 },
    { name: "綠能精品咖啡", contribution: 840, distance: "550m", rating: 4.5 },
    { name: "好棒棒環保商店", contribution: 2100, distance: "1.2km", rating: 4.9 },
    { name: "永續健康輕食", contribution: 420, distance: "2.1km", rating: 4.2 }
];

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
// 2. API 端點
// ==========================================

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            balance, points, userCreditScore, userCarbonSaved,
            merchantEcoContribution, merchantCarbonSaved,
            isPrepared, transactions, inventory,
            nearbyMerchants // 回傳附近商家資料
        }
    });
});

app.post('/api/prepare', (req, res) => {
    const requested = req.body; 
    pendingItems = [];
    for (const [typeKey, count] of Object.entries(requested)) {
        if (count > 0) {
            const available = inventory.filter(i => i.typeKey === typeKey && i.status === 'idle');
            if (available.length < count) return res.status(400).json({ success: false, message: "庫存不足" });
            const selected = available.slice(0, count);
            selected.forEach(item => {
                item.status = 'pending';
                pendingItems.push(item);
            });
        }
    }
    isPrepared = true;
    res.json({ success: true });
});

app.post('/api/rent', (req, res) => {
    if (!isPrepared) return res.status(400).json({ success: false, message: "商家尚未準備" });
    
    // 【信用檢查】低於 60 分拒絕租借
    if (userCreditScore < 60) {
        return res.status(403).json({ success: false, message: "您的信用評分過低 (" + userCreditScore + ")，已被系統鎖定租借功能。" });
    }

    const rentAmount = pendingItems.length * 50; 
    if (balance < rentAmount) return res.status(400).json({ success: false, message: "餘額不足" });

    const now = new Date();
    const deadline = new Date();
    deadline.setDate(now.getDate() + 7);
    const rentTimeMs = Date.now();

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
    merchantEcoContribution += pendingItems.length;
    merchantCarbonSaved += (pendingItems.length * 0.05);
    transactions.unshift(newTx); 
    isPrepared = false;
    pendingItems = [];
    res.json({ success: true });
});

app.post('/api/return', (req, res) => {
    const target = transactions.find(t => !t.isCompleted);
    if (!target) return res.status(400).json({ success: false, message: "無待歸還紀錄" });

    const isCoolingOff = (Date.now() - target.rentTimeMs) < COOL_DOWN_TIME; 
    target.isCompleted = true;
    target.details.forEach(detailItem => {
        detailItem.isReturned = true;
        detailItem.returnDate = new Date().toLocaleString();
        const invItem = inventory.find(i => i.id === detailItem.id);
        if (invItem) invItem.status = 'idle';
    });

    balance += target.amount;

    if (isCoolingOff) {
        res.json({ success: true, message: "歸還成功，但觸發防弊機制不計獎勵。" });
    } else {
        points += (target.details.length * 10);
        userCarbonSaved += (target.details.length * 0.05);
        // 歸還後信用評分小幅度回升 (獎勵行為)
        if(userCreditScore < 100) userCreditScore += 2;
        res.json({ success: true, message: "歸還成功！獲得點數與減碳獎勵。" });
    }
});

// 【選項 B】模擬逾期懲罰機制
app.post('/api/test-overdue', (req, res) => {
    const target = transactions.find(t => !t.isCompleted);
    if (!target) return res.status(400).json({ success: false, message: "目前無租借中的容器可模擬逾期。" });
    
    // 依據要求：扣除 20 分信用評分
    userCreditScore -= 20; 
    if (userCreditScore < 0) userCreditScore = 0;
    
    console.log(`[警報] 使用者容器逾期，信用分數重挫至 ${userCreditScore}`);
    res.json({ success: true, message: "警告：系統偵測到容器逾期未還！信用分數已扣除 20 分。", newScore: userCreditScore });
});

// 獎勵兌換
app.post('/api/redeem', (req, res) => {
    const { cost, itemName } = req.body;
    if (points < cost) return res.status(400).json({ success: false, message: "點數不足" });
    points -= cost;
    res.json({ success: true, message: `已兌換「${itemName}」` });
});

app.listen(PORT, () => console.log(`伺服器運作中: http://localhost:${PORT}`));