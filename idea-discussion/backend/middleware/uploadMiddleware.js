import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, "../uploads/temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 一時ファイルには拡張子を付けない（拡張子は中身を確かめてから決める）
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}`);
  },
});

const TYPE_ERROR =
  "許可されていないファイル形式です。JPG、PNG、GIF画像のみ対応しています。";

// ブラウザが申告する形式での一次チェック（偽れるので、中身は verifyImage で確かめる）
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error(TYPE_ERROR), { status: 400 }), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// ファイルの先頭のバイト列から画像の形式を判定する
const SIGNATURES = [
  { ext: ".jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: ".png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: ".gif", bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
  { ext: ".gif", bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
];

export const detectImageExtension = (buffer) =>
  SIGNATURES.find(({ bytes }) => bytes.every((b, i) => buffer[i] === b))?.ext ??
  null;

const readHead = async (filePath) => {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(8);
    await handle.read(buffer, 0, 8, 0);
    return buffer;
  } finally {
    await handle.close();
  }
};

// multer のあとに置く。中身が画像でなければ一時ファイルを消して断る。
// 保存するときの拡張子は、元のファイル名ではなく判定した形式から決める（req.file.detectedExt）
export const verifyImage = async (req, res, next) => {
  if (!req.file) return next();
  const ext = detectImageExtension(await readHead(req.file.path));
  if (!ext) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: TYPE_ERROR });
  }
  req.file.detectedExt = ext;
  next();
};
