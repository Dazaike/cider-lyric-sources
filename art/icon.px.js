// Lyric Sources icon: a lyric bubble (Cider's lyrics glyph) with its first line half sung,
// stacked on two more bubbles for the other sources.
pal({
  k: "#120f1c", // outline
  B: "#17121f", b: "#241c36", v: "#33284d", // background
  w: "#f6f3fb", W: "#d3cbe3", // bubble
  c: "#4cd2e0", C: "#2b8fa3", // source 2
  y: "#ffcb4d", Y: "#d08f1a", // source 3
  r: "#ff2d55", // sung words
  g: "#a69fbb", // unsung words
})
ramps("kBbv", "kCc", "kYy", "gWw")

// One bubble: 18x14 body, rounded corners, tail bottom-left.
sprite("_card", { w: 18, h: 18, outline: "k" },
  rect(1, 0, 16, 14, "w"), rect(0, 1, 18, 12, "w"),
  poly([2, 13, 7, 13, 1, 18], "W"),
  rect(1, 12, 16, 2, "W"), rect(0, 12, 1, 1, "W"), rect(17, 12, 1, 1, "W"))
sprite("_card_c", { base: "_card", swap: { w: "c", W: "C" } })
sprite("_card_y", { base: "_card", swap: { w: "y", W: "Y" } })

// Rounded background tile: radius-5 corners cut away.
const corners = []
const R = 5
for (let y = 0; y < R; y++)
  for (let x = 0; x < R; x++)
    if ((x - R + 0.5) ** 2 + (y - R + 0.5) ** 2 > R * R)
      for (const [px_, py_] of [[x, y], [31 - x, y], [x, 31 - y], [31 - x, 31 - y]]) corners.push(px(px_, py_, "_"))

sprite("icon", { w: 32, h: 32 },
  grad(0, 0, 32, 32, "vb", "v", 0.35),
  ...corners,
  stamp("_card_y", 9, 3),
  stamp("_card_c", 6, 6),
  stamp("_card", 3, 9),
  // Lyric lines: the first is half sung.
  rect(7, 12, 6, 2, "r"), rect(13, 12, 5, 2, "g"),
  rect(7, 16, 11, 2, "g"),
  rect(7, 20, 7, 2, "g"))
