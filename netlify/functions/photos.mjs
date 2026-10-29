// 가계도 사진 저장소 (Netlify Blobs)
//   GET    /api/photos            → { photos: { personId: version } }
//   GET    /api/photos?id=p-1-0   → 사진 파일
//   POST   /api/photos?id=p-1-0   → 사진 등록·변경 (본문: 이미지 바이트)
//   DELETE /api/photos?id=p-1-0   → 사진 삭제
// 환경 변수 FAMILY_CODE 를 설정하면 등록·삭제에 그 코드가 필요하다.
import { getStore } from "@netlify/blobs";

const ID = /^p(-\d{1,2}){0,3}$/;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "family-photos", consistency: "strong" });
  const id = new URL(req.url).searchParams.get("id");
  if (id !== null && !ID.test(id)) return json({ code: "invalid_request" }, 400);

  if (req.method === "GET") {
    if (!id) {
      const { blobs } = await store.list();
      return json({ photos: Object.fromEntries(blobs.map((b) => [b.key, b.etag])) });
    }
    const hit = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!hit) return json({ code: "not_found" }, 404);
    return new Response(hit.data, {
      headers: {
        "content-type": TYPES.has(hit.metadata?.type) ? hit.metadata.type : "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (req.method !== "POST" && req.method !== "DELETE") return json({ code: "method_not_allowed" }, 405);
  if (!id) return json({ code: "invalid_request" }, 400);

  const code = process.env.FAMILY_CODE;
  if (code) {
    const given = req.headers.get("x-family-code") || "";
    if (!given) return json({ code: "need_code" }, 401);
    if (given !== code) return json({ code: "bad_code" }, 403);
  }

  if (req.method === "DELETE") {
    await store.delete(id);
    return json({ ok: true });
  }

  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES.has(type)) return json({ code: "unsupported_type" }, 415);
  const data = await req.arrayBuffer();
  if (!data.byteLength) return json({ code: "invalid_request" }, 400);
  if (data.byteLength > MAX_BYTES) return json({ code: "too_large" }, 413);

  const { etag } = await store.set(id, data, { metadata: { type, at: new Date().toISOString() } });
  return json({ ok: true, v: etag || String(Date.now()) });
};

export const config = { path: "/api/photos" };
