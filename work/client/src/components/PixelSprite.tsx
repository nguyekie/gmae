import type { SpriteMatrix } from "../data/sprites";

interface Props {
  matrix: SpriteMatrix;
  palette: Record<string, string>;
  size?: number;
  flip?: boolean;
  bob?: boolean;
}

export function PixelSprite({ matrix, palette, size = 32, flip = false, bob = false }: Props) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const cell = size / cols;

  return (
    <div
      className={`pixel-sprite${bob ? " pixel-sprite--bob" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows}, ${cell}px)`,
        width: size,
        height: size,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      {matrix.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <div key={`${x}-${y}`} style={{ background: ch === "." ? "transparent" : palette[ch] }} />
        ))
      )}
    </div>
  );
}
