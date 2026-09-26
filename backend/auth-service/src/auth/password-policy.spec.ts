import { getPasswordViolations, PERSONAL_INFO_VIOLATION } from "./password-policy";

describe("getPasswordViolations", () => {
  it("accepte un mot de passe respectant toutes les règles", () => {
    expect(getPasswordViolations("Soleil-Levant-42", 12)).toEqual([]);
  });

  it("signale chaque règle manquante séparément", () => {
    expect(getPasswordViolations("abc", 12)).toEqual([
      "Au moins 12 caractères",
      "Au moins une majuscule",
      "Au moins un chiffre",
      "Au moins un caractère spécial (ex : ! @ # ? -)",
    ]);
  });

  it("utilise la longueur minimale reçue, pas une valeur figée", () => {
    expect(getPasswordViolations("Court-1a", 8)).toEqual([]);
    expect(getPasswordViolations("Court-1a", 9)).toEqual(["Au moins 9 caractères"]);
  });

  it("accepte les lettres accentuées comme majuscules/minuscules", () => {
    expect(getPasswordViolations("ÉTÉ-été-2026-!", 12)).toEqual([]);
  });

  it("refuse le prénom ou le nom, sans tenir compte de la casse ni des accents", () => {
    const info = { first_name: "Éloïse", last_name: "Dupont" };
    expect(getPasswordViolations("MonEloise-2026!", 12, info)).toContain(PERSONAL_INFO_VIOLATION);
    expect(getPasswordViolations("xxDUPONTxx-2026!", 12, info)).toContain(PERSONAL_INFO_VIOLATION);
  });

  it("vérifie chaque partie d'un nom composé", () => {
    const info = { first_name: "Jean-Marie", last_name: "de la Tour" };
    expect(getPasswordViolations("Super-Marie-2026", 12, info)).toContain(PERSONAL_INFO_VIOLATION);
    expect(getPasswordViolations("Grande-Tour-2026", 12, info)).toContain(PERSONAL_INFO_VIOLATION);
  });

  it("ignore les fragments trop courts pour ne pas bloquer à tort", () => {
    // "Li" (2 lettres) ne doit pas interdire "Limonade".
    expect(getPasswordViolations("Limonade-2026!", 12, { first_name: "Li" })).toEqual([]);
  });

  describe("date de naissance", () => {
    const info = { birth_date: "1998-05-12" };

    it.each([
      ["année seule", "Soleil-Levant-1998"],
      ["jour + mois", "Soleil-Levant-1205"],
      ["date FR avec séparateurs", "Soleil-12/05/1998"],
      ["date FR année courte", "Soleil-12-05-98!"],
      ["date ISO", "Soleil-1998.05.12"],
    ])("refuse %s", (_, password) => {
      expect(getPasswordViolations(password, 12, info)).toContain(PERSONAL_INFO_VIOLATION);
    });

    it("accepte des chiffres sans rapport avec la date", () => {
      expect(getPasswordViolations("Soleil-Levant-4271", 12, info)).toEqual([]);
    });

    it("ignore une date absente (compte Google/Facebook)", () => {
      expect(getPasswordViolations("Soleil-Levant-1998", 12, { birth_date: null })).toEqual([]);
    });
  });
});
