const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. 數據存儲結構：容器池
// ==========================================
// 容器類型定義
const CONTAINER_TYPES = {
  CUP: { label: "環保杯", prefix: "100" },
  BOX: { label: "環保餐盒", prefix: "200" },
  BOWL: { label: "環保碗", prefix: "300" }
};

// 初始化容器資料 (每個種類各 4 個)
let inventory = [];

function initInventory() {
  Object.keys(CONTAINER_TYPES).forEach(key => {
    const typeInfo = CONTAINER_TYPES[key];
    for (let i = 1; i <= 4; i++) {
      inventory.push({
        id: `${typeInfo.prefix}${String(i).padStart(6, '0')}`, // 9碼：前3碼種類，後6碼流水號
        type: typeInfo.label,
        typeKey: key, // 方便後端邏輯判斷
        status: "idle", // 'idle' 或 'rented'
        rentedBy: null, // 租借人名稱
        rentedDate: null // 租出時間
      });
    }
  });
}

initInventory();

// 用戶資訊
let userAccount = {
  balance: 300,
  points: 0
};

// 目前準備中的訂單 (QRCode 內容)
let pendingOrder = {
  isPrepared: false,
  items: [] // 存放預計租借的容器 ID 清單
};

// ==========================================
// 2. API 端點設定
// ==========================================

// [GET] 取得系統所有資訊 (供商家端管理面板使用)
app.get('/api/admin/inventory', (req, res) => {
  res.json({
    success: true,
    data: {
      inventory,
      userAccount,
      pendingOrder
    }
  });
});

// [GET] 取得用戶端基本狀態 (輪詢用)
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      balance: userAccount.balance,
      points: userAccount.points,
      isPrepared: pendingOrder.isPrepared,
      itemCount: pendingOrder.items.length // 告知用戶掃描後會借到幾個
    }
  });
});

// [POST] 商家準備容器 (支援多種類、多數量)
// 請求格式: { "CUP": 2, "BOWL": 1 }
app.post('/api/prepare', (req, res) => {
  const requestedItems = req.body; // 例如 { CUP: 2, BOWL: 1 }
  let itemsToRent = [];

  // 根據請求數量，從 inventory 中挑選 idle 的容器
  for (const [typeKey, count] of Object.entries(requestedItems)) {
    const available = inventory.filter(i => i.typeKey === typeKey && i.status === "idle");
    
    if (available.length < count) {
      return res.status(400).json({ 
        success: false, 
        message: `${CONTAINER_TYPES[typeKey].label} 庫存不足` 
      });
    }
    
    // 取出前 N 個 ID
    const selected = available.slice(0, count).map(i => i.id);
    itemsToRent = itemsToRent.concat(selected);
  }

  if (itemsToRent.length === 0) {
    return res.status(400).json({ success: false, message: "請選擇至少一個容器" });
  }

  pendingOrder.isPrepared = true;
  pendingOrder.items = itemsToRent;

  console.log(`[商家] 已準備 QRCode，包含容器: ${itemsToRent.join(', ')}`);
  res.json({ success: true, items: itemsToRent });
});

// [POST] 用戶執行租借 (一次租借多個)
app.post('/api/rent', (req, res) => {
  if (!pendingOrder.isPrepared || pendingOrder.items.length === 0) {
    return res.status(400).json({ success: false, message: "商家尚未準備好 QRCode" });
  }

  const totalDeposit = pendingOrder.items.length * 50; // 每個容器 50 元

  if (userAccount.balance < totalDeposit) {
    return res.status(400).json({ success: false, message: "餘額不足以支付總押金" });
  }

  // 更新容器池狀態
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  pendingOrder.items.forEach(id => {
    const item = inventory.find(i => i.id === id);
    if (item) {
      item.status = "rented";
      item.rentedBy = "測試用戶"; // 未來可從用戶登入資訊獲取
      item.rentedDate = now;
    }
  });

  // 扣款
  userAccount.balance -= totalDeposit;

  console.log(`[系統] 用戶租借了 ${pendingOrder.items.length} 個容器，扣除 ${totalDeposit} 元`);

  // 重置準備狀態 (QRCode 刷新/失效)
  pendingOrder.isPrepared = false;
  pendingOrder.items = [];

  res.json({ success: true, message: "租借成功" });
});

// [POST] 模擬歸還 (歸還指定 ID)
// 請求格式: { "id": "100000001" }
app.post('/api/return', (req, res) => {
  const { id } = req.body;
  const item = inventory.find(i => i.id === id);

  if (!item || item.status === "idle") {
    return res.status(400).json({ success: false, message: "無效的容器編號或該容器已在店內" });
  }

  item.status = "idle";
  item.rentedBy = null;
  item.rentedDate = null;
  
  userAccount.balance += 50;
  userAccount.points += 10;

  console.log(`[系統] 容器 ${id} 已歸還`);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`後端伺服器運行中: http://localhost:${PORT}`);
});