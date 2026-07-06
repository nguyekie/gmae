import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ItemCard } from "../../components/ItemCard";

interface Listing {
  id: string;
  price: number;
  seller_character_id: string;
  seller_name: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "sss_plus";
  slot: string;
  base_stats: Record<string, number>;
  level_requirement: number;
  instance_stats?: Record<string, any>;
}

interface Props {
  characterId: string;
  gold: number;
  onChange: () => void;
}

export function MarketplaceTab({ characterId, gold, onChange }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get("/marketplace")
      .then((res) => setListings(res.data.listings))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleBuy(listingId: string) {
    setMessage(null);
    setSuccess(null);
    try {
      await api.post("/marketplace/buy", { characterId, listingId });
      setSuccess("Mua thành công!");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể mua vật phẩm");
    }
  }

  async function handleCancel(listingId: string) {
    setMessage(null);
    setSuccess(null);
    try {
      await api.post("/marketplace/cancel", { characterId, listingId });
      setSuccess("Đã hủy ký gửi. Vật phẩm đã trở về túi đồ.");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể hủy ký gửi");
    }
  }

  return (
    <div>
      <h1 className="page-title">Chợ giao dịch</h1>
      <p className="page-subtitle">
        Vàng của bạn: <strong style={{ color: "var(--accent-shard)" }}>{gold.toLocaleString("vi-VN")}</strong> · Phí giao
        dịch chợ: 5%
      </p>

      {message && <div className="error-banner">{message}</div>}
      {success && <div className="success-banner">{success}</div>}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      ) : listings.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Chưa có ai đăng bán vật phẩm nào.</p>
      ) : (
        <div className="item-grid">
          {listings.map((listing) => {
            const isOwnListing = listing.seller_character_id === characterId;
            return (
              <ItemCard
                key={listing.id}
                item={listing}
                footer={
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    <span className="tag">Người bán: {listing.seller_name}</span>
                    <button
                      className={isOwnListing ? "small-btn small-btn--danger" : "small-btn"}
                      onClick={() => (isOwnListing ? handleCancel(listing.id) : handleBuy(listing.id))}
                      disabled={!isOwnListing && gold < listing.price}
                    >
                      {isOwnListing ? "Hủy ký gửi" : `Mua — ${listing.price.toLocaleString("vi-VN")} vàng`}
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
}
