export interface AyahShareCardInput {
  surahName: string;
  ayahNumber: number;
  ayahText: string;
  tafsirSnippet?: string;
  tafsirBookName?: string;
}

function wrapArabicLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a refined 1080x1080 Madinah-parchment calligraphic Ayah & Tadabbur card
 * locally via HTML5 Canvas (zero external requests, zero emojis).
 */
export async function exportAyahShareCardPng(input: AyahShareCardInput): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  if (typeof document.fonts?.ready !== 'undefined') {
    await document.fonts.ready.catch(() => undefined);
  }

  // Warm Madinah Cream Background
  ctx.fillStyle = '#FBF6EA';
  ctx.fillRect(0, 0, size, size);

  // Subtle double calligraphic frame
  ctx.strokeStyle = '#C59B27';
  ctx.lineWidth = 4;
  ctx.strokeRect(44, 44, size - 88, size - 88);

  ctx.strokeStyle = 'rgba(20, 72, 58, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(58, 58, size - 116, size - 116);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // Top Header Badge
  ctx.fillStyle = '#14483A';
  ctx.font = '700 30px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`سورة ${input.surahName} — الآية ${input.ayahNumber}`, size / 2, 136);

  ctx.strokeStyle = 'rgba(197, 155, 39, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(size / 2 - 140, 162);
  ctx.lineTo(size / 2 + 140, 162);
  ctx.stroke();

  // Main Quranic Text
  const cleanAyah = `﴿ ${input.ayahText.trim()} ﴾`;
  const fontSize = cleanAyah.length > 260 ? 38 : cleanAyah.length > 140 ? 46 : 54;
  ctx.fillStyle = '#1C1915';
  ctx.font = `400 ${fontSize}px "Amiri Quran", "Amiri", serif`;
  const ayahLines = wrapArabicLines(ctx, cleanAyah, size - 210).slice(0, 8);
  const lineHeight = Math.round(fontSize * 1.95);
  let y = input.tafsirSnippet ? 265 : 340;

  for (const line of ayahLines) {
    ctx.fillText(line, size / 2, y);
    y += lineHeight;
  }

  // Optional brief Tafsir reflection
  if (input.tafsirSnippet?.trim()) {
    const snippet = input.tafsirSnippet.trim().slice(0, 220) + (input.tafsirSnippet.trim().length > 220 ? '…' : '');
    const boxTop = Math.max(y + 24, 700);
    ctx.fillStyle = 'rgba(20, 72, 58, 0.05)';
    ctx.fillRect(100, boxTop, size - 200, 210);

    ctx.fillStyle = '#8C6A16';
    ctx.font = '700 22px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(input.tafsirBookName || 'التفسير الموثق', size / 2, boxTop + 42);

    ctx.fillStyle = '#3B352D';
    ctx.font = '400 24px "Amiri", "IBM Plex Sans Arabic", serif';
    const tafsirLines = wrapArabicLines(ctx, snippet, size - 260).slice(0, 3);
    let ty = boxTop + 88;
    for (const tLine of tafsirLines) {
      ctx.fillText(tLine, size / 2, ty);
      ty += 42;
    }
  }

  // Footer Signature
  ctx.fillStyle = '#14483A';
  ctx.font = '700 24px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('وِرد | WIRD — منصة القرآن الكريم والحفظ المتقن', size / 2, size - 88);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  const fileName = `wird-ayah-${input.surahName}-${input.ayahNumber}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
