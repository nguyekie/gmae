import { useState } from "react";
import { MapExplorer } from "../../components/MapExplorer";
import { ZONES } from "../../data/mapData";

interface Props {
  characterId: string;
  characterName: string;
  characterClass: "warrior" | "mage" | "archer";
  onChange: () => void;
}

export function ExploreTab({ characterId, characterName, characterClass, onChange }: Props) {
  const [zoneId, setZoneId] = useState("starting_village");
  const [spawn, setSpawn] = useState(ZONES["starting_village"].defaultSpawn);

  function handlePortal(toZone: string, x: number, y: number) {
    setZoneId(toZone);
    setSpawn({ x, y });
  }

  const zone = ZONES[zoneId];

  return (
    <div>
      <h1 className="page-title">Khám phá Etheria</h1>
      <p className="page-subtitle">
        Dùng phím mũi tên (hoặc WASD) để di chuyển · chạm quái để vào trận · đứng cạnh NPC rồi nhấn Enter để nói chuyện
        · bước vào ô cổng phát sáng để sang vùng khác
      </p>

      <MapExplorer
        key={zoneId}
        zoneId={zoneId}
        spawnPoint={spawn}
        characterId={characterId}
        characterName={characterName}
        characterClass={characterClass}
        onChange={onChange}
        onPortal={handlePortal}
      />

      <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-faint)" }}>
        Đang ở: {zone.name}
      </p>
    </div>
  );
}
