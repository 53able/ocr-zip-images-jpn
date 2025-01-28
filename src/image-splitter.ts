import sharp from 'sharp';

/**
 * 画像を分割
 * @param image 画像のパスまたはバッファ
 * @param segmentHeight 推奨の分割高さ（px）
 * @param tolerance 空白ラインの判定基準（0〜255, デフォルト: 20）
 * @returns 分割された画像のバイナリ配列（オリジナルフォーマットを保持）
 */
export async function splitImage(
  image: string | Buffer,
  segmentHeight: number = 500,
  tolerance: number = 20
): Promise<Blob[]> {
  const base = sharp(image).toFormat('png'); // PNGに変換
  const { width, height } = await base.metadata();
  if (!width || !height) throw new Error("Failed to read image metadata.");

  // 画像全体をRGBAで読み込み、ピクセルレベルでアクセスする
  const rawData = await base.raw().ensureAlpha().toBuffer();
  const segments: Buffer[] = [];
  let startY = 0;
  while (startY < height) {
    const endY = findSplitLine(rawData, width, height, startY, segmentHeight, tolerance);
    const segHeight = endY - startY;
    if (segHeight <= 0) break;

    const segmentBuffer = await base
      .clone()
      .extract({ left: 0, top: startY, width, height: segHeight })
      .toFormat('png') // セグメントもPNG化
      .toBuffer();
    segments.push(segmentBuffer);
    startY = endY;
  }

  // Blob化
  return segments.map((buf) => new Blob([buf], { type: 'image/png' }));
}

/**
 * 空白ラインを探す
 */
function findSplitLine(
  data: Buffer,
  width: number,
  height: number,
  startY: number,
  segmentHeight: number,
  tolerance: number
): number {
  const end = Math.min(startY + segmentHeight, height);
  for (let y = end; y > startY; y--) {
    if (isLineBlank(data, width, y, tolerance)) {
      return y;
    }
  }
  return end;
}

/**
 * ラインが空白かどうか判定
 */
function isLineBlank(
  data: Buffer,
  width: number,
  y: number,
  tolerance: number
): boolean {
  let total = 0;
  // RGBA
  const rowStart = width * 4 * y;
  for (let i = rowStart; i < rowStart + width * 4; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    total += brightness;
  }
  const avgBrightness = total / width;
  return avgBrightness > tolerance;
}

/**
 * フォーマットを推定
 */
function getImageFormat(format: string | undefined): string {
  // sharpのmetadataに従い、png/jpegのみ対応
  if (format === 'png') return 'image/png';
  return 'image/jpeg';
}
