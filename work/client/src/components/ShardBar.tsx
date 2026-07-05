interface ShardBarProps {
  label: string;
  value: number;
  max: number;
  colorVar: string; // vd: "--elem-fire", "--elem-water", "--accent-shard"
}

export function ShardBar({ label, value, max, colorVar }: ShardBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="shard-bar">
      <div className="shard-bar__labels">
        <span className="shard-bar__label">{label}</span>
        <span className="shard-bar__value">
          {value} / {max}
        </span>
      </div>
      <div className="shard-bar__track">
        <div
          className="shard-bar__fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, var(${colorVar}) 0%, color-mix(in srgb, var(${colorVar}) 60%, white) 100%)`,
            boxShadow: `0 0 10px color-mix(in srgb, var(${colorVar}) 70%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
