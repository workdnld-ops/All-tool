(function () {
  const STORAGE_KEY = "storeCostSharingAddressesV1";
  const DEFAULT_ADDRESSES = [
    {
      storeName: "台北內湖店",
      recipient: "邱嘉葆",
      phone: "0918674787",
      address: "台北市內湖區內湖路一段70號1樓",
    },
    {
      storeName: "台北瑞光店",
      recipient: "邱嘉葆",
      phone: "0918674787",
      address: "台北市內湖區瑞光路423號1樓(iski滑雪俱樂部)",
    },
    {
      storeName: "桃園店",
      recipient: "楊百荷",
      phone: "0932374958",
      address: "桃園市中壢區高鐵南路二段352號5樓（環球購物中心5F iSKI滑雪俱樂部）",
    },
    {
      storeName: "新竹店",
      recipient: "許碧婷",
      phone: "0955380191",
      address: "302新竹縣竹北市東平里文興路一段396號",
    },
    {
      storeName: "台中店",
      recipient: "鄭天炫",
      phone: "0921379071",
      address: "台中市南屯區文心南九路6號",
    },
    {
      storeName: "台南店",
      recipient: "馮筱筑",
      phone: "0981660109",
      address: "701臺南市東區崇善里崇善十一街54巷1號",
    },
  ];

  function cloneDefaults() {
    return DEFAULT_ADDRESSES.map((entry) => ({ ...entry }));
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!Array.isArray(stored)) return cloneDefaults();
      return DEFAULT_ADDRESSES.map((fallback, index) => {
        const entry = stored[index] || {};
        return {
          storeName: typeof entry.storeName === "string" ? entry.storeName : fallback.storeName,
          recipient: typeof entry.recipient === "string" ? entry.recipient : fallback.recipient,
          phone: typeof entry.phone === "string" ? entry.phone : fallback.phone,
          address: typeof entry.address === "string" ? entry.address : fallback.address,
        };
      });
    } catch {
      return cloneDefaults();
    }
  }

  function save(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function format(entries) {
    return entries.map((entry) => [
      String(entry.storeName || "").trim(),
      `收件人：${String(entry.recipient || "").trim()}`,
      `收件人電話：${String(entry.phone || "").trim()}`,
      `收件地址：${String(entry.address || "").trim()}`,
    ].join("\n")).join("\n\n");
  }

  window.StoreCostAddresses = {
    load,
    save,
    format,
  };
})();
