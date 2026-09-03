// Shared drawing helpers for the Canvas-based share cards (Instagram-story-style
// photo card in Albums, Year in Review card in Stats) — both need to load a
// remote image onto a canvas and export it, so that part lives here once.

// `crossOrigin = "anonymous"` is required to export the canvas via toBlob/toDataURL
// without a SecurityError — Supabase Storage's public buckets serve permissive CORS
// headers by default, so this works for every image URL this app produces.
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

// Draws `img` into the (x, y, w, h) box using "cover" fit (crops overflow, no
// stretching) — the same behavior as CSS `object-fit: cover`.
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
): void {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Wraps text at `maxWidth`, drawing each line with `lineHeight` spacing starting
// at (x, y). Returns the y position just after the last line, so callers can
// stack more content beneath it.
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3,
): number {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    shown[maxLines - 1] = last + "…";
  }

  shown.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}

// Draws `text` horizontally centered on `centerX` with extra letter-spacing —
// canvas text has no native tracking, so this walks character-by-character.
// Used for small uppercase "eyebrow" labels where tight default spacing looks cramped.
export function fillTextTracked(
  ctx: CanvasRenderingContext2D,
  text: string, centerX: number, y: number, tracking: number,
): void {
  const chars = text.split("");
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  const originalAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = centerX - totalWidth / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + tracking;
  });
  ctx.textAlign = originalAlign;
}

// A dashed horizontal divider echoing the app's own map route line — used to
// separate sections on a share card without a hard rule.
export function drawRouteDivider(
  ctx: CanvasRenderingContext2D, y: number, width: number, margin: number, color = "rgba(255,255,255,0.2)",
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.setLineDash([2, 14]);
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(width - margin, y);
  ctx.stroke();
  ctx.restore();
}
