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
let cupStatus = "idle"; // 容器狀態：'idle' (在庫待租借), 'rented' (借出中)
let userBalance = 100;  // 模擬用戶錢包餘額
let userPoints = 0;     // 模擬用戶獲得的環保獎勵點數

// ==========================================
// API 端點設定
// ==========================================

// 1. 取得當前系統狀態 (提供給前端網頁定期輪詢使用)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            cupStatus: cupStatus,
            userBalance: userBalance,
            userPoints: userPoints
        }
    });
});

// 2. 用戶掃碼租借 (由前端網頁呼叫)
app.post('/api/rent', (req, res) => {
    if (cupStatus === "rented") {
        return res.status(400).json({ success: false, message: "容器已被借走" });
    }
    
    if (userBalance < 50) {
        return res.status(400).json({ success: false, message: "餘額不足，無法支付押金" });
    }

    // 執行借出邏輯：扣除押金，更改狀態
    userBalance -= 50;
    cupStatus = "rented";

    console.log(`[系統通知] 容器已借出！扣除押金 50 元。目前餘額: ${userBalance}`);

    res.json({
        success: true,
        message: "租借成功",
        data: { cupStatus, userBalance }
    });
});

// 3. 實體歸還通知 (由 ESP32 呼叫)
app.post('/api/return', (req, res) => {
    if (cupStatus === "idle") {
        return res.status(400).json({ success: false, message: "容器目前已經是在庫狀態" });
    }

    // 執行歸還邏輯：退回押金，給予環保點數，更改狀態
    userBalance += 50;
    userPoints += 10;
    cupStatus = "idle";

    console.log(`[系統通知] 容器已歸還！退回押金 50 元，並發放 10 點獎勵。目前餘額: ${userBalance}, 點數: ${userPoints}`);

    res.json({
        success: true,
        message: "歸還成功",
        data: { cupStatus, userBalance, userPoints }
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