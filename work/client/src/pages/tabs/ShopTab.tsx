import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ItemCard } from "../../components/ItemCard";

interface ShopItem {
  id: string;
  shop_id: string;
  item_type_id: string;
  price: number;
  stock: number;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "sss_plus";
  slot: string;
  base_stats: Record<string, number>;
  level_requirement: number;
  special?: any;
}

interface Shop {
  id: string;
  name: string;
  description: string;
}

interface Props {
  characterId: string;
  gold: number;
  onChange: () => void;
}

export function ShopTab({ characterId, gold, onChange }: Props) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function load() {
    setLoading(true);
    api
      .get("/shops")
      .then((res) => {
        setShops(res.data.shops || []);
        setItems(res.data.items || []);
      })
      .catch(() => setError("Không thể tải cửa hàng"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function getQty(itemId: string, max: number) {
    return Math.min(quantities[itemId] ?? 1, Math.max(1, max));
  }

  function setQty(itemId: string, qty: number, max: number) {
    const clamped = Math.max(1, Math.min(qty, Math.max(1, max)));
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  }

  async function buy(shopItem: ShopItem) {
    const qty = getQty(shopItem.id, shopItem.stock);
    setError(null);
    setSuccess(null);
    setBuyingId(shopItem.id);
    try {
      await api.post("/shops/buy", { characterId, shopItemId: shopItem.id, quantity: qty });
      setSuccess(`Đã mua ${qty > 1 ? `${qty}x ` : ""}"${shopItem.name}"`);
      setQuantities((prev) => ({ ...prev, [shopItem.id]: 1 }));
      load();
      onChange();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Mua thất bại");
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Cửa hàng</h1>
      <p className="page-subtitle">
        Vàng của bạn: <strong style={{ color: "var(--accent-shard)" }}>{gold.toLocaleString("vi-VN")}</strong>
      </p>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      ) : shops.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Cửa hàng hiện chưa có gì để bán.</p>
      ) : (
        shops.map((s) => {
          const shopItems = items.filter((i) => i.shop_id === s.id);
          return (
            <div key={s.id} style={{ marginBottom: 28 }}>
              <div className="zone-card" style={{ marginBottom: 16 }}>
                <div className="zone-card__name">{s.name}</div>
                <div className="zone-card__desc">{s.description}</div>
              </div>

              {shopItems.length === 0 ? (
                <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Đã hết hàng.</p>
              ) : (
                <div className="item-grid">
                  {shopItems.map((it) => {
                    const qty = getQty(it.id, it.stock);
                    const totalPrice = it.price * qty;
                    const canAfford = gold >= totalPrice;
                    return (
                      <ItemCard
                        key={it.id}
                        item={it}
                        footer={
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                            <span className="tag">Còn lại: {it.stock}</span>
                            {it.stock > 1 && (
                              <div className="qty-stepper">
                                <button
                                  className="qty-stepper__btn"
                                  disabled={qty <= 1}
                                  onClick={() => setQty(it.id, qty - 1, it.stock)}
                                >
                                  −
                                </button>
                                <input
                                  className="qty-stepper__input"
                                  type="number"
                                  min={1}
                                  max={it.stock}
                                  value={qty}
                                  onChange={(e) => setQty(it.id, Number(e.target.value) || 1, it.stock)}
                                />
                                <button
                                  className="qty-stepper__btn"
                                  disabled={qty >= it.stock}
                                  onClick={() => setQty(it.id, qty + 1, it.stock)}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            <button
                              className="small-btn"
                              disabled={it.stock <= 0 || !canAfford || buyingId === it.id}
                              onClick={() => buy(it)}
                            >
                              {buyingId === it.id
                                ? "Đang mua..."
                                : it.stock <= 0
                                ? "Hết hàng"
                                : `Mua${qty > 1 ? ` x${qty}` : ""} — ${totalPrice.toLocaleString("vi-VN")} vàng`}
                            </button>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
