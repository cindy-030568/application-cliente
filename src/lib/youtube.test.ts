import { describe, expect, it } from "vitest";
import { idYoutube, urlLecteur } from "./youtube";

describe("idYoutube", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    [`https://www.youtube.com/watch?v=${id}`],
    [`https://youtube.com/watch?v=${id}&t=42s`],
    [`https://m.youtube.com/watch?v=${id}`],
    [`https://youtu.be/${id}`],
    [`https://youtu.be/${id}?si=abcdef`],
    [`https://www.youtube.com/shorts/${id}`],
    [`https://www.youtube.com/embed/${id}`],
    [`https://www.youtube-nocookie.com/embed/${id}`],
    [`https://www.youtube.com/live/${id}?feature=share`],
    [`youtu.be/${id}`],
    [id],
    [`  https://youtu.be/${id}  `],
  ])("reconnaît %s", (lien) => {
    expect(idYoutube(lien)).toBe(id);
  });
  it.each([
    ["https://vimeo.com/123456"],
    ["https://www.youtube.com/watch?v=trop-court"],
    ["https://www.youtube.com/channel/UC123"],
    ["https://evil.com/watch?v=dQw4w9WgXcQ"],
    ["n'importe quoi"],
    [""],
  ])("refuse %s", (lien) => {
    expect(idYoutube(lien)).toBeNull();
  });
});

describe("urlLecteur", () => {
  it("utilise le domaine sans cookie et sans vidéos suggérées d'autres chaînes", () => {
    const u = new URL(urlLecteur("dQw4w9WgXcQ"));
    expect(u.hostname).toBe("www.youtube-nocookie.com");
    expect(u.searchParams.get("rel")).toBe("0");
  });
});
