import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "src", "data");
const apiUrl =
  "https://api.github.com/repos/thichhoc-org/thichhoc-dict/contents/dict-en-vi/data/entries";
const licenseUrl =
  "https://raw.githubusercontent.com/thichhoc-org/thichhoc-dict/main/dict-en-vi/LICENSE-DATA";
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "DolphinLingo-dataset-builder",
};

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

const directoryResponse = await fetch(apiUrl, { headers });
if (!directoryResponse.ok)
  throw new Error(
    `Không thể đọc danh sách dữ liệu: HTTP ${directoryResponse.status}`,
  );
const files = await directoryResponse.json();
const tierOneFiles = files
  .filter((file) => /^freq-tier1-.*\.jsonl$/.test(file.name))
  .sort((left, right) => left.name.localeCompare(right.name));

if (tierOneFiles.length === 0)
  throw new Error("Không tìm thấy các tệp freq-tier1 của thichhoc-dict.");

const words = new Map();
for (const file of tierOneFiles) {
  const content = await fetchText(file.download_url);
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    const term = String(entry.headword ?? "")
      .trim()
      .toLocaleLowerCase("en-US");
    const meanings = Array.isArray(entry.senses_vi)
      ? entry.senses_vi.map((value) => String(value).trim()).filter(Boolean)
      : [];
    if (
      !/^[a-z][a-z' -]{0,39}$/.test(term) ||
      term.split(/\s+/).length > 3 ||
      meanings.length === 0
    )
      continue;

    const frequency = Number(entry.freq ?? 0);
    const current = words.get(term) ?? { term, meanings: new Set(), frequency };
    meanings.forEach((meaning) => current.meanings.add(meaning));
    current.frequency = Math.max(current.frequency, frequency);
    words.set(term, current);
  }
}

const vocabulary = [...words.values()]
  .sort(
    (left, right) =>
      right.frequency - left.frequency || left.term.localeCompare(right.term),
  )
  .slice(0, 3000)
  .map(({ term, meanings }) => ({
    term,
    meaning: [...meanings].slice(0, 3).join("; ").slice(0, 300),
    example: "",
    pronunciation: "",
    imageUrl: "",
  }));

if (vocabulary.length !== 3000)
  throw new Error(`Chỉ tạo được ${vocabulary.length}/3000 từ hợp lệ.`);

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDir, "en-vi-3000.json"),
    `${JSON.stringify(vocabulary)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(outputDir, "THICHHOC-LICENSE-DATA.txt"),
    await fetchText(licenseUrl),
    "utf8",
  ),
]);

console.log(
  `Đã tạo ${vocabulary.length} từ từ ${tierOneFiles.length} tệp dữ liệu.`,
);
