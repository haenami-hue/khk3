// public/photos/ 안의 "이름.jpg" 파일 목록을 public/photos/index.js 로 만든다.
// Netlify 빌드 때 자동 실행되고, 그때는 사진도 웹용(긴 변 1280px)으로 줄인다.
// 원본은 GitHub 저장소에 그대로 남는다 (줄이는 것은 빌드 서버의 복사본뿐).
import { readdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "photos");
const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_SIDE = 1280;

const files = readdirSync(dir).sort().filter((f) => IMAGE.has(extname(f).toLowerCase()));

if (process.env.NETLIFY === "true") {
  const { default: sharp } = await import("sharp");
  for (const file of files) {
    const path = join(dir, file);
    const ext = extname(file).toLowerCase();
    if (ext === ".gif") continue;
    const before = readFileSync(path);
    let img = sharp(before).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
    img = ext === ".png" ? img.png() : ext === ".webp" ? img.webp({ quality: 85 }) : img.jpeg({ quality: 85, mozjpeg: true });
    const after = await img.toBuffer();
    if (after.length < before.length) writeFileSync(path, after);
    console.log(`  ${file}: ${Math.round(before.length / 1024)} KB -> ${Math.round(Math.min(after.length, before.length) / 1024)} KB`);
  }
}

const list = {};
for (const file of files) list[basename(file, extname(file)).normalize("NFC").trim()] = file;
writeFileSync(join(dir, "index.js"), "window.KHK3_FILES = " + JSON.stringify(list, null, 2) + ";\n");
rmSync(join(dir, "index.json"), { force: true });   // 예전 형식
console.log(`사진 ${files.length}장: ${Object.keys(list).join(", ") || "(없음)"}`);
