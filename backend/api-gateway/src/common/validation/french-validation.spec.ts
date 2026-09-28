import { ValidationPipe } from "@nestjs/common";
import { ReasonDto, PaginationQueryDto } from "../dto/common.dto";
import { ReserveStockDto } from "../../order/dto/order.dto";
import { frenchValidationException } from "./french-validation";

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: frenchValidationException,
});

async function messages(metatype: new () => object, value: unknown, type: "body" | "query" = "body"): Promise<string[]> {
  try {
    await pipe.transform(value, { type, metatype });
    return [];
  } catch (error) {
    return (error as { getResponse: () => { message: string[] } }).getResponse().message;
  }
}

describe("Validation en français", () => {
  it("garde le message déclaré dans le DTO", async () => {
    expect(await messages(ReasonDto, { reason: "   " })).toContain("Le motif est obligatoire.");
  });

  it("traduit les messages par défaut de class-validator", async () => {
    const result = await messages(ReasonDto, { reason: "x".repeat(3000) });
    expect(result.join(" ")).toMatch(/trop long \(2000 caractères maximum\)/);
  });

  it("refuse un champ non prévu, en français", async () => {
    expect(await messages(ReasonDto, { reason: "ok", pirate: true })).toContain("Le champ « pirate » n'est pas accepté.");
  });

  it("valide les objets imbriqués", async () => {
    const result = await messages(ReserveStockDto, {
      event_id: "11111111-1111-4111-8111-111111111111",
      items: [{ ticket_category_id: "pas-un-uuid", quantity: 0 }],
    });
    expect(result).toEqual(expect.arrayContaining(["Catégorie de billet invalide."]));
    expect(result.join(" ")).toMatch(/items\.0\.quantity/);
  });

  it("borne la pagination et convertit les nombres", async () => {
    expect(await messages(PaginationQueryDto, { limit: "500" }, "query")).toEqual([
      "Le champ « limit » est trop grand (maximum 100).",
    ]);
    const ok = await pipe.transform({ limit: "20", offset: "40" }, { type: "query", metatype: PaginationQueryDto });
    expect(ok).toEqual({ limit: 20, offset: 40 });
  });
});
