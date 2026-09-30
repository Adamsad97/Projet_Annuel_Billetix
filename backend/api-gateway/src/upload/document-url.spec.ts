import { BadRequestException } from "@nestjs/common";
import { assertOwnDocumentUrl } from "./document-url";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333.pdf";

describe("assertOwnDocumentUrl", () => {
  it("accepte un document déposé par l'organisateur", () => {
    expect(() => assertOwnDocumentUrl(`http://localhost:9000/documents/${OWNER}/${FILE}`, OWNER, "documents")).not.toThrow();
  });

  it.each([
    ["le document d'un autre", `http://localhost:9000/documents/${OTHER}/${FILE}`],
    ["un autre bucket", `http://localhost:9000/posters/${OWNER}/${FILE}`],
    ["une adresse quelconque", "https://exemple.fr/kbis.pdf"],
    ["un chemin détourné", `http://localhost:9000/documents/${OWNER}/../${OTHER}/${FILE}`],
    ["une adresse invalide", "pas une url"],
  ])("refuse %s", (_label, url) => {
    expect(() => assertOwnDocumentUrl(url, OWNER, "documents")).toThrow(BadRequestException);
  });
});
