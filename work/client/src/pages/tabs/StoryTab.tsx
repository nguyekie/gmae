interface QuestStep {
  levelRequirement: number;
  title: string;
  npc: string;
  dialogue: string;
  objective: string;
}

const QUEST_STEPS: QuestStep[] = [
  {
    levelRequirement: 1,
    title: "Chương 1 — Tiếng Gọi Từ Mảnh Vỡ",
    npc: "Trưởng Làng Oris",
    dialogue:
      "\"Con đã Thức Tỉnh rồi đấy... ta cảm nhận được mảnh vỡ trong con đang rung động. Hãy cẩn thận — kể từ Đại Vỡ Vụn, Rừng Thì Thầm không còn an toàn như trước nữa.\"",
    objective: "Đánh bại 3 Nhớt Rừng tại Rừng Thì Thầm để chứng minh bản thân.",
  },
  {
    levelRequirement: 3,
    title: "Chương 2 — Bóng Tối Trong Rừng Sâu",
    npc: "Thợ Săn Lyra",
    dialogue:
      "\"Lũ Sói Bóng Tối gần đây hung hãn khác thường. Có kẻ nào đó đang kích động chúng từ sâu trong rừng. Ta cần một Người Thức Tỉnh đủ can đảm để tìm hiểu.\"",
    objective: "Đánh bại Sói Bóng Tối và thu thập Da Sói Rừng.",
  },
  {
    levelRequirement: 6,
    title: "Chương 3 — Con Đường Đến Hầm Mộ",
    npc: "Học Giả Ren",
    dialogue:
      "\"Ta đã giải mã được một phần bản đồ cổ. Hầm Mộ Đá Vỡ không phải nơi chôn cất — đó là một trong những nơi Lõi Nguyên Tố vỡ ra đầu tiên. Nếu con đủ mạnh, hãy đi tìm sự thật.\"",
    objective: "Đạt cấp độ 8 và bước vào Hầm Mộ Đá Vỡ.",
  },
  {
    levelRequirement: 9,
    title: "Chương 4 — Vệ Thần Cuối Cùng",
    npc: "(không có NPC — gặp trực tiếp trong hầm mộ)",
    dialogue:
      "Vệ Thần Mộ Đá thức dậy từ giấc ngủ ngàn năm: \"Kẻ mang mảnh vỡ... ngươi đến để lấy nốt phần còn lại sao?\"",
    objective: "Đánh bại Vệ Thần Mộ Đá để mở khóa khu vực sâu hơn của hầm mộ.",
  },
  {
    levelRequirement: 13,
    title: "Chương 5 — Sứ Giả Vực Thẳm",
    npc: "Lữ Khách Bí Ẩn",
    dialogue:
      "\"Ta đã dò được dấu vết dẫn sâu vào Vực Thẳm — những Kẻ Rình Rập Hư Không đang tụ tập gần lối vào. Hãy giúp ta loại bỏ chúng và tìm manh mối.\"",
    objective: "Đánh bại 3 Kẻ Rình Rập Hư Không tại Vực Thẳm Hư Không.",
  },
  {
    levelRequirement: 15,
    title: "Chương 6 — Thám Hiểm Rạn Nứt",
    npc: "Học Giả Rạn",
    dialogue:
      "\"Cổng Rạn Nứt mở ra — bên trong có nhiều nguyên liệu quý và cỗ máy bảo vệ. Hãy tiêu diệt Thợ Săn Vực Thẳm để tiến vào sâu hơn.\"",
    objective: "Đánh bại 4 Thợ Săn Vực Thẳm tại Cánh Đồng Rạn Nứt.",
  },
  {
    levelRequirement: 17,
    title: "Chương 7 — Sụp Đổ Cỗ Máy",
    npc: "Học Giả Rạn",
    dialogue: "\"Cỗ Máy Rạn Nứt được kích hoạt — tiêu diệt nó để ngăn dòng năng lượng hủy hoại bản đồ.\"",
    objective: "Đánh bại Cỗ Máy Rạn Nứt — vết tạo rạn sẽ hiển lộ một Lõi Nguyên Tố khác.",
  },
  {
    levelRequirement: 19,
    title: "Chương 8 — Lời Thề (rẽ nhánh chọn phe)",
    npc: "Chỉ Huy Vera hoặc Hiệp Sĩ Kael",
    dialogue:
      "Tại Đồng Bằng Tro Tàn, hai tiếng nói đối lập chờ đợi: Vera của Hội Bảo Tồn muốn niêm phong sức mạnh mảnh vỡ; Kael của Liên Minh Thức Tỉnh muốn dùng nó để tái thiết Etheria. Chỉ có thể thề trung thành với MỘT trong hai — lựa chọn này không thể đổi lại.",
    objective: "Đánh bại 4 Cướp Tro Tàn (theo Vera) hoặc 4 Cấu Trúc Nổi Loạn (theo Kael) để hoàn thành lời thề.",
  },
  {
    levelRequirement: 21,
    title: "Chương 9 — Thánh Kỵ Sĩ Sa Ngã",
    npc: "(không có NPC — gặp trực tiếp tại Đồng Bằng Tro Tàn)",
    dialogue:
      "Một hiệp sĩ từng bảo vệ Etheria đã ngã quỵ trước sức mạnh mảnh vỡ hắn tìm thấy — giờ hắn chỉ còn là vỏ bọc hắc ám của lời thề đã vỡ. Dù bạn chọn phe nào ở Chương 8, đây vẫn là việc phải làm.",
    objective: "Đánh bại Thánh Kỵ Sĩ Sa Ngã — chương tiếp theo đang được biên soạn.",
  },
];

const FACTIONS = [
  { name: "Hội Bảo Tồn", desc: "Tin rằng các mảnh vỡ nên được thu thập và niêm phong để tránh thảm họa lặp lại." },
  { name: "Liên Minh Thức Tỉnh", desc: "Cho rằng sức mạnh của mảnh vỡ nên được dùng để tái thiết Etheria, không phải giấu đi." },
  { name: "Chợ Đen Vực Sâu", desc: "Phe phái trung lập kiểm soát phần lớn giao dịch mảnh vỡ ngoài luồng — nguồn gốc của hệ thống chợ giao dịch trong game." },
];

interface Props {
  characterLevel: number;
}

export function StoryTab({ characterLevel }: Props) {
  return (
    <div>
      <h1 className="page-title">Tàn Tích Etheria</h1>
      <p className="page-subtitle">Thế giới quan & cốt truyện chính</p>

      <div className="zone-card" style={{ marginBottom: 28 }}>
        <div className="zone-card__name">Thế giới sau Đại Vỡ Vụn</div>
        <div className="zone-card__desc" style={{ lineHeight: 1.7 }}>
          300 năm trước, 5 Đại Tộc từng cai trị Etheria trong hòa bình, mỗi tộc nắm giữ một Lõi Nguyên Tố: Lửa,
          Nước, Đất, Gió và Hư Không. Rồi Đại Vỡ Vụn xảy ra — không ai biết vì sao — và 5 Lõi Nguyên Tố vỡ thành
          hàng ngàn mảnh nhỏ, rải khắp thế giới. Những mảnh vỡ ấy giờ đây là thứ quý giá nhất Etheria: chúng ban
          sức mạnh cho bất kỳ ai tìm thấy, biến người đó thành một <em>Người Thức Tỉnh</em>. Bạn là một trong số
          họ.
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 14, color: "var(--text-muted)" }}>Các phe phái</h2>
      <div className="zone-grid">
        {FACTIONS.map((f) => (
          <div className="zone-card" key={f.name}>
            <div className="zone-card__name" style={{ fontSize: 15 }}>{f.name}</div>
            <div className="zone-card__desc">{f.desc}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, margin: "28px 0 14px", color: "var(--text-muted)" }}>Nhiệm vụ chính tuyến</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {QUEST_STEPS.map((q) => {
          const unlocked = characterLevel >= q.levelRequirement;
          return (
            <div
              key={q.title}
              className="zone-card"
              style={{ opacity: unlocked ? 1 : 0.45 }}
            >
              <div className="zone-card__name" style={{ fontSize: 15 }}>
                {q.title} {!unlocked && <span className="tag" style={{ marginLeft: 8 }}>Cần cấp {q.levelRequirement}</span>}
              </div>
              {unlocked && (
                <>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", margin: "6px 0" }}>{q.npc}</div>
                  <div className="zone-card__desc" style={{ fontStyle: "italic" }}>{q.dialogue}</div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--accent-shard)" }}>🎯 {q.objective}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
