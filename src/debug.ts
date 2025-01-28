import { program } from "commander";
import path from "path";
import fs from 'fs';
import { splitImage } from "./image-splitter";
import { spawn } from "child_process";

program
  .description('画像を分割します')
  .command('split')
  .requiredOption('-i, --input <input>', '入力画像ファイル')
  .option('-o, --output <dir>', 'output directory', 'output')
  .option('-h, --height <px>', '推奨の分割高さ（px）', '2000')
  .option('-t, --tolerance <0-255>', '空白ラインの判定基準（0〜255）', '80')
  .option('--open', '分割後の画像を開く')
  .action(async (options) => {
    const { input, output, height, tolerance, open } = options;
    console.log(input, output, height, tolerance);
    const inputPath = path.resolve(input);
    const imageBuffer = fs.readFileSync(inputPath);
    const segments = await splitImage(imageBuffer, parseInt(height), parseInt(tolerance));
    if (output) {
      const outputDir = output.endsWith('/') ? output : output + '/';
      if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
      }
      segments.forEach(async (segment, i) => {
        const fileName = path.basename(input, path.extname(input)) + `_${i + 1}.png`;
        const outputFile = path.join(outputDir, fileName);
        fs.writeFileSync(outputFile, Buffer.from(await segment.arrayBuffer()));
        if (open) {
          spawn('open', [outputFile]); // macOSで標準ビューアを起動
        }
      });
    }
  });

program.parse();
