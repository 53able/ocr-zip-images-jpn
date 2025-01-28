import sharp from 'sharp';

/**
 * 画像を分割
 * @param image 画像のパスまたはバッファ
 * @param segmentHeight 推奨の分割高さ（px）
 * @param tolerance 空白ラインの判定基準（0〜255, デフォルト: 20）
 * @param blankHeight 空白ラインの高さ（行数, デフォルト: 1）
 * @returns 分割された画像のバイナリ配列（オリジナルフォーマットを保持）
 */
export async function splitImage(
  image: string | Buffer,
  segmentHeight: number = 2000,
  tolerance: number = 20,
  blankHeight: number = 1
): Promise<Blob[]> {
  const base = sharp(image).toFormat('png'); // PNGに変換
  const { width, height } = await base.metadata();
  console.log(`Image size: ${width}x${height}`);
  if (!width || !height) throw new Error("Failed to read image metadata.");

  // 画像全体をRGBAで読み込み、ピクセルレベルでアクセスする
  const rawData = await base.raw().ensureAlpha().toBuffer();
  const segments: Buffer[] = [];
  let startY = 0;
  while (startY < height) {
    const endY = findSplitLine(rawData, width, height, startY, segmentHeight, tolerance, blankHeight);
    const segHeight = endY - startY;
    console.log(`Segment: ${startY} - ${endY} (${segHeight})`);
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
  tolerance: number,
  blankHeight: number
): number {
  const end = Math.min(startY + segmentHeight, height);
  for (let y = end; y > startY; y--) {
    if (checkConsecutiveBlank(data, width, y, tolerance, blankHeight)) {
      return y;
    }
  }
  return end;
}

/**
 * blankHeight 行連続で空白ラインか判定
 */
function checkConsecutiveBlank(
  data: Buffer,
  width: number,
  yEnd: number,
  tolerance: number,
  blankHeight: number
): boolean {
  for (let line = 0; line < blankHeight; line++) {
    const testLine = yEnd - line;
    if (testLine < 0 || !isLineBlank(data, width, testLine, tolerance)) {
      return false;
    }
  }
  return true;
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
