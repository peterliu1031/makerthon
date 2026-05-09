const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 統一變數命名：status, balance, points, isPrepared
// ==========================================
let status = "idle";      // 'idle' 或 'rented'
let isPrepared = false;   // 商家是否準備好 QR Code
let balance = 100;        // 用戶餘額
let points = 0;           // 用戶點數

// 1. 取得當前狀態 (對應 user.html fetchStatus)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            status: status,
            balance: balance,
            points: points,
            isPrepared: isPrepared
        }
    });
});

// 2. 商家準備容器 (對應 merchant.html generateBtn)
// 這是你目前最可能漏掉的部分
app.post('/api/prepare', (req, res) => {
    isPrepared = true;
    console.log("[系統] 商家已生成 QR Code，等待租借...");
    res.json({ success: true, message: "準備就緒" });
});

// 3. 用戶租借 (對應 user.html rentBtn)
app.post('/api/rent', (req, res) => {
    // 檢查商家是否先點了準備
    if (!isPrepared) {
        return res.status(400).json({ success: false, message: "商家尚未準備好容器" });
    }
    if (status === "rented") {
        return res.status(400).json({ success: false, message: "容器借用中" });
    }
    if (balance < 50) {
        return res.status(400).json({ success: false, message: "餘額不足" });
    }

    balance -= 50;
    status = "rented";
    isPrepared = false; // 租借成功後重置準備狀態，下一位需重新生成

    console.log(`[系統] 租借成功！餘額剩餘: ${balance}`);
    res.json({ success: true });
});

// 4. 歸還邏輯 (對應 user.html returnBtn)
app.post('/api/return', (req, res) => {
    if (status === "idle") {
        return res.status(400).json({ success: false, message: "無須歸還" });
    }

    balance += 50;
    points += 10;
    status = "idle";

    console.log(`[系統] 歸還成功！目前餘額: ${balance}, 點數: ${points}`);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`後端伺服器運行中: http://localhost:${PORT}`);
});