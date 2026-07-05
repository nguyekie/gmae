import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Requirement {
  itemTypeId: string;
  name: string;
  quantity: number;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  resultItemTypeId: string;
  goldCost: number;
  requirements: Requirement[];
}

interface Props {
  characterId: string;
  onChange: () => void;
}

export function CraftingTab({ characterId, onChange }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [gold, setGold] = useState(0);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.get("/crafting/recipes", { params: { characterId } }).then((res) => {
      setRecipes(res.data.recipes);
      setInventory(res.data.inventory);
      setGold(res.data.gold);
    });
  }

  useEffect(() => {
    load();
  }, [characterId]);

  async function craft(recipeId: string) {
    setBusyId(recipeId);
    setMessage("");
    try {
      await api.post("/crafting/craft", { characterId, recipeId });
      setMessage("Rèn thành công. Vật phẩm đã vào túi đồ.");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể rèn vật phẩm");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Rèn đồ</h1>
      <p className="page-subtitle">Dùng nguyên liệu từ Lò Rèn Lời Thề để tạo trang bị và bùa trợ thủ.</p>

      {message && <div className="alert">{message}</div>}

      <div className="zone-grid">
        {recipes.map((recipe) => {
          const canPayGold = gold >= recipe.goldCost;
          const canPayItems = recipe.requirements.every((req) => (inventory[req.itemTypeId] ?? 0) >= req.quantity);
          const canCraft = canPayGold && canPayItems;
          return (
            <div className="zone-card" key={recipe.id}>
              <div className="zone-card__name">{recipe.name}</div>
              <div className="zone-card__desc">{recipe.description}</div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--accent-gold)" }}>
                {recipe.goldCost.toLocaleString("vi-VN")} vàng
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {recipe.requirements.map((req) => {
                  const owned = inventory[req.itemTypeId] ?? 0;
                  return (
                    <div key={req.itemTypeId} className="zone-card__desc">
                      {req.name}: {owned}/{req.quantity}
                    </div>
                  );
                })}
              </div>
              <button className="btn-primary" style={{ marginTop: 14 }} disabled={!canCraft || busyId === recipe.id} onClick={() => craft(recipe.id)}>
                {busyId === recipe.id ? "Đang rèn..." : "Rèn"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
