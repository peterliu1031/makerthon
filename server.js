const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// 啟用 CORS，允許所有來源連線 (黑客松 Demo 必備，避免跨網域阻擋)
app.use(cors());
// 解析 JSON 格式的請求本體
app.use(express.json());

// ==========================================
// 模擬資料庫 (MVP 狀態儲存)
// ==========================================
let status = "idle"; // 容器狀態：'idle' (在庫待租借), 'rented' (借出中)
let balance = 100;  // 模擬用戶錢包餘額
let points = 0;     // 模擬用戶獲得的環保獎勵點數
let isPrepared = false; //商家是否已準備好容器

// ==========================================
// API 端點設定
// ==========================================

// 1. 取得當前系統狀態 (提供給前端網頁定期輪詢使用)
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

// 2. 商家準備容器 (由 merchant.html 呼叫)
app.post('/api/prepare', (req, res) => {
    isPrepared = true;
    res.json({ success: true, message: "QR Code 已激活，等待客戶掃描" });
});

// 3. 用戶租借 (加入判斷條件)
app.post('/api/rent', (req, res) => {
    if (!isPrepared) {
        return res.status(400).json({ success: false, message: "商家尚未生成租借碼" });
    }
    if (cupStatus === "rented") {
        return res.status(400).json({ success: false, message: "容器借用中" });
    }
    
    balance -= 50;
    status = "rented";
    isPrepared = false; // 租借完成後重置準備狀態
    res.json({ success: true, message: "租借成功" });
});

// 3. 實體歸還通知 (由 ESP32 呼叫)
app.post('/api/return', (req, res) => {
    if (status === "idle") {
        return res.status(400).json({ success: false, message: "容器目前已經是在庫狀態" });
    }

    // 執行歸還邏輯：退回押金，給予環保點數，更改狀態
    balance += 50;
    points += 10;
    status = "idle";

    console.log(`[系統通知] 容器已歸還！退回押金 50 元，並發放 10 點獎勵。目前餘額: ${balance}, 點數: ${points}`);

    res.json({
        success: true,
        message: "歸還成功",
        data: { status, balance, points }
    });
});

// ==========================================
// 啟動伺服器
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`環保容器後端系統已啟動！`);
    console.log(`本機測試請訪問: http://localhost:${PORT}`);
    console.log(`硬體連線請將 ESP32 指向這台電腦的區域網路 IP 加上 port ${PORT}`);
});