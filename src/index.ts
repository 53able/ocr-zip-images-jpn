import fs from 'fs';
import path from 'path';
import prompts from 'prompts';
import Tesseract from 'tesseract.js';
import unzipper from 'unzipper';
import cliProgress from 'cli-progress';

/**
 * 目的: 画像ファイルから日本語テキストを抽出する
 * @param imageBuffer 
 * @returns 
 */
const recognizeJapaneseText = async (imageBuffer: Buffer): Promise<string> => {
  try {
    const result = await Tesseract.recognize(
      imageBuffer,
      'jpn+eng', // 使用する言語を指定（日本語と英語）
      {
        langPath: './tessdata', // データファイルのパスを指定
        logger: () => {} // ログ出力を無効にする
      }
    );

    // 結果オブジェクトから文字列を取得
    const { data: { text } } = result;
    return text;
  } catch (error) {
    console.error('OCR中にエラーが発生しました:', error);
    return '';
  }
};

/**
 * 目的: ZIPファイル内の画像ファイルを抽出する
 * @param zipFilePath 
 * @returns 
 */
const extractZipFiles = async (zipFilePath: string): Promise<Map<string, Buffer>> => {
  const fileMap = new Map<string, Buffer>();
  await fs.createReadStream(zipFilePath)
    .pipe(unzipper.Parse())
    .on('entry', async entry => {
      console.log('ZIPファイル内のファイル:', entry.path);
      const fileName = entry.path;
      const ext = path.extname(fileName);
      if (ext === '.png' && !fileName.includes('__MACOSX')) {
        const chunks: Buffer[] = [];
        for await (const chunk of entry) {
          chunks.push(chunk);
        }
        fileMap.set(fileName, Buffer.concat(chunks));
      } else {
        entry.autodrain();
      }
    })
    .promise();
  
  // 画像ファイル名で昇順にソート
  return new Map([...fileMap.entries()].sort());
};

/**
 * 目的: ZIPファイル内の画像ファイルからテキストを抽出する
 * @param zipFilePath
 */
const recognizeAllImagesInZip = async (fileMap: Map<string, Buffer>): Promise<string> => {
  try {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(fileMap.size, 0);

    const textPromises = Array.from(fileMap.values()).map(async (buffer) => {
      const text = await recognizeJapaneseText(buffer);
      progressBar.increment();
      return text;
    });

    const texts = await Promise.all(textPromises);
    progressBar.stop();

    return texts.join('\n');
  } catch (error) {
    console.error('ZIPファイル処理中にエラーが発生しました:', error);
    return '';
  }
};

/**
 * 目的: メイン処理
 */
const main = async () => {
  const zipFiles = fs.readdirSync('./assets').filter(file => path.extname(file) === '.zip');
  const response = await prompts({
    type: 'select',
    name: 'zipFile',
    message: 'OCRを実行するZIPファイルを選択してください',
    choices: zipFiles.map(file => ({ title: file, value: file }))
  });

  if (response.zipFile) {
    const zipFilePath = path.join('./assets', response.zipFile);
    const fileMap = await extractZipFiles(zipFilePath);
    const combinedText = await recognizeAllImagesInZip(fileMap);

    // 出力ディレクトリを生成
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // テキストをファイルに保存
    const unixTime = Math.floor(Date.now() / 1000);
    const outputFilePath = `${outputDir}/combined_text_${unixTime}.txt`;
    fs.writeFileSync(outputFilePath, combinedText);
    console.log(`連結されたテキストが ${outputFilePath} に保存されました。`);
  } else {
    console.log('ZIPファイルが選択されませんでした。');
  }
};

// 実行
main()
  .then(() => console.log('OCR処理が完了しました。'))
  .catch((err) => console.error('実行エラー:', err));
