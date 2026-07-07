import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ItemCard } from "../../components/ItemCard";

interface InventoryItem {
  id: string;
  quantity: number;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "sss_plus";
  slot: string;
  base_stats: Record<string, number>;
  level_requirement: number;
  tradable: boolean;
  stackable: boolean;
  special?: any;
  instance_stats?: any;
}

interface Props {
  characterId: string;
  onChange: () => void;
}

export function InventoryTab({ characterId, onChange }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingItem, setListingItem] = useState<InventoryItem | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [sellConfirm, setSellConfirm] = useState<InventoryItem | null>(null);
  const [exchangeItem, setExchangeItem] = useState<InventoryItem | null>(null);
  const [exchangeQty, setExchangeQty] = useState<number>(1);

  function load() {
    setLoading(true);
    api
      .get(`/inventory/${characterId}`)
      .then((res) => setItems(res.data.items))
      .finally(() => setLoading(false));
  }

  useEffect(load, [characterId]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3500);
    return () => clearTimeout(t);
  }, [successMsg]);

  const EQUIPPABLE_SLOTS = ["weapon", "armor", "helmet", "gloves", "boots", "trinket", "shard", "costume"];

  async function handleUse(itemInstanceId: string) {
    try {
      await api.post("/inventory/use", { characterId, itemInstanceId });
      setMessage(null);
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể sử dụng vật phẩm");
    }
  }

  // Use single or multiple depending on selected qty for that item
  async function handleUseWithQty(itemInstanceId: string) {
    const qty = selected[itemInstanceId] ?? 0;
    if (qty > 0) {
      try {
        await api.post('/inventory/use-multiple', { characterId, items: [{ id: itemInstanceId, qty }] });
        const next = { ...selected };
        delete next[itemInstanceId];
        setSelected(next);
        setMessage(null);
        load();
        onChange();
      } catch (err: any) {
        setMessage(err.response?.data?.error ?? 'Không thể sử dụng vật phẩm');
      }
    } else {
      return handleUse(itemInstanceId);
    }
  }

  async function handleUseMultiple() {
    const items = Object.entries(selected).map(([id, qty]) => ({ id, qty }));
    if (items.length === 0) return;
    try {
      await api.post('/inventory/use-multiple', { characterId, items });
      setSelected({});
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? 'Không thể sử dụng vật phẩm');
    }
  }

  async function handleSellToShop(itemInstanceId: string, itemName: string) {
    try {
      const res = await api.post('/shops/sell', { characterId, itemInstanceId });
      setMessage(null);
      setSuccessMsg(`Đã bán "${itemName}" được +${res.data.goldReceived} vàng`);
      setSellConfirm(null);
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? 'Không thể bán cho shop');
    }
  }

  async function handleExchangeMaterials(itemInstanceId: string, qty: number) {
    try {
      const res = await api.post('/shops/materials/exchange', { characterId, itemInstanceId, quantity: qty });
      setSuccessMsg(`Đã đổi nguyên liệu nhận +${res.data.goldReceived} vàng`);
      setExchangeItem(null);
      setExchangeQty(1);
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? 'Không thể đổi nguyên liệu');
    }
  }

  async function handleEquip(itemInstanceId: string) {
    try {
      await api.post("/inventory/equip", { characterId, itemInstanceId });
      setMessage(null);
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể mặc vật phẩm");
    }
  }

  async function handleList() {
    if (!listingItem || !price) return;
    try {
      await api.post("/marketplace/list", {
        characterId,
        itemInstanceId: listingItem.id,
        price: Number(price),
      });
      setListingItem(null);
      setPrice("");
      setMessage(null);
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể đăng bán");
    }
  }

  return (
    <div>
      <h1 className="page-title">Túi đồ</h1>
      <p className="page-subtitle">Trang bị vật phẩm hoặc đăng bán lên chợ giao dịch</p>

      {message && <div className="error-banner">{message}</div>}
      {successMsg && <div className="success-banner">{successMsg}</div>}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Túi đồ trống. Hãy đi khám phá để tìm vật phẩm!</p>
      ) : (
        <div className="item-grid">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              footer={
                <>
                  {item.slot === 'consumable' && item.quantity > 1 && (
                    <div className="qty-stepper" style={{ width: 90 }}>
                      <button
                        type="button"
                        className="qty-stepper__btn"
                        disabled={!selected[item.id]}
                        onClick={() => {
                          const next = { ...selected };
                          const cur = next[item.id] ?? 0;
                          if (cur <= 1) delete next[item.id];
                          else next[item.id] = cur - 1;
                          setSelected(next);
                        }}
                      >
                        −
                      </button>
                      <input
                        className="qty-stepper__input"
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={selected[item.id] ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0));
                          const next = { ...selected };
                          if (val === 0) delete next[item.id];
                          else next[item.id] = val;
                          setSelected(next);
                        }}
                      />
                      <button
                        type="button"
                        className="qty-stepper__btn"
                        disabled={(selected[item.id] ?? 0) >= item.quantity}
                        onClick={() => {
                          const next = { ...selected };
                          next[item.id] = Math.min(item.quantity, (next[item.id] ?? 0) + 1);
                          setSelected(next);
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {item.slot === 'consumable' && item.quantity <= 1 && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!selected[item.id]}
                        onChange={(e) => {
                          const next = { ...selected };
                          if (e.target.checked) next[item.id] = 1;
                          else delete next[item.id];
                          setSelected(next);
                        }}
                      />
                      Chọn để dùng gộp
                    </label>
                  )}
                  {EQUIPPABLE_SLOTS.includes(item.slot) && (
                    <button className="small-btn" onClick={() => handleEquip(item.id)}>
                      Mặc vào
                    </button>
                  )}
                  {item.slot === 'consumable' && (
                    <>
                      <button className="small-btn" onClick={() => handleUseWithQty(item.id)}>
                        Sử dụng
                      </button>
                    </>
                  )}
                  {item.slot === 'material' && (
                    <button className="small-btn" onClick={() => setExchangeItem(item)}>Đổi nguyên liệu</button>
                  )}
                  {/* Cho phép bán cả trang bị và tiêu hao */}
                  <button className="small-btn" onClick={() => setSellConfirm(item)}>
                    Bán cho cửa hàng
                  </button>
                  {item.tradable && (
                    <button className="small-btn" onClick={() => setListingItem(item)}>
                      Đăng bán
                    </button>
                  )}
                  {item.quantity > 1 && <span className="tag">x{item.quantity}</span>}
                </>
              }
            />
          ))}
        </div>
      )}

      {Object.keys(selected).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={handleUseMultiple}>Sử dụng vật phẩm đã chọn</button>
          <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={() => setSelected({})}>Bỏ chọn</button>
        </div>
      )}

      {listingItem && (
        <div className="auth-screen" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }}>
          <div className="auth-card" style={{ maxWidth: 360 }}>
            <div className="auth-title" style={{ fontSize: 18 }}>Đăng bán {listingItem.name}</div>
            <div className="field">
              <label htmlFor="price">Giá (vàng)</label>
              <input id="price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
            </div>
            <button className="btn-primary" onClick={handleList} disabled={!price}>
              Xác nhận đăng bán
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setListingItem(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}
      {sellConfirm && (
        <div className="auth-screen" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }}>
          <div className="auth-card" style={{ maxWidth: 420 }}>
            <div className="auth-title">Bán "{sellConfirm.name}"</div>
            <p>Bạn có chắc muốn bán vật phẩm này cho cửa hàng? Vật phẩm sẽ biến mất và bạn nhận vàng ngay lập tức.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => handleSellToShop(sellConfirm.id, sellConfirm.name)}>Xác nhận bán</button>
              <button className="btn-secondary" onClick={() => setSellConfirm(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {exchangeItem && (
        <div className="auth-screen" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }}>
          <div className="auth-card" style={{ maxWidth: 420 }}>
            <div className="auth-title">Đổi nguyên liệu {exchangeItem.name}</div>
            <div className="field">
              <label>Số lượng</label>
              <input type="number" min={1} max={exchangeItem.quantity} value={exchangeQty} onChange={(e) => setExchangeQty(Math.max(1, Math.min(exchangeItem.quantity, Number(e.target.value) || 1)))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => handleExchangeMaterials(exchangeItem.id, exchangeQty)}>Đổi</button>
              <button className="btn-secondary" onClick={() => { setExchangeItem(null); setExchangeQty(1); }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
