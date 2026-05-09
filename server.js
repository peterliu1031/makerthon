const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

// 啟用 CORS，允許所有來源連線 (黑客松 Demo 必備，避免跨網域阻擋)
app.use(cors());
// 解析 JSON 格式的請求本體
app.use(express.json());
// 提供靜態檔案服務 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.')));

// ==========================================
// 模擬資料庫 (MVP 狀態儲存)
// ==========================================
let status = "idle"; // 容器狀態：'idle' (在庫待租借), 'rented' (借出中)
let balance = 100;   // 模擬用戶錢包餘額
let points = 0;      // 模擬用戶獲得的環保獎勵點數

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
            timestamp: new Date().toISOString()
        }
    });
});

// 2. 用戶掃碼租借 (由前端網頁呼叫)
app.post('/api/rent', (req, res) => {
    if (status === "rented") {
        return res.status(400).json({ success: false, message: "容器已被借走" });
    }
    
    if (balance < 50) {
        return res.status(400).json({ success: false, message: "餘額不足，無法支付押金" });
    }

    // 執行借出邏輯：扣除押金，更改狀態
    balance -= 50;
    status = "rented";

    console.log(`[系統通知] 容器已借出！扣除押金 50 元。目前餘額: ${balance}`);

    res.json({
        success: true,
        message: "租借成功",
        data: { status, balance, points, timestamp: new Date().toISOString() }
    });
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
        data: { status, balance, points, timestamp: new Date().toISOString() }
    });
});

// ==========================================
// 啟動伺服器
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌍 環保容器後端系統已啟動！`);
    console.log(`📱 本機測試：http://localhost:${PORT}`);
    console.log(`🔗 遠端訪問：http://<你的電腦IP>:${PORT}`);
    console.log(`📄 用戶端：http://localhost:${PORT}/user.html`);
    console.log(`🏪 商家端：http://localhost:${PORT}/merchant.html`);
    console.log(`🤖 硬體連線：將 ESP32 指向 http://<電腦IP>:${PORT}\n`);
});
