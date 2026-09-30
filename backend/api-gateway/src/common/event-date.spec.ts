import { formatEventDate, formatEventDateTime } from "./event-date";

describe("dates des emails", () => {
  // 30 septembre 2026, 05:05 UTC = 07:05 à Paris (heure d'été).
  const scan = "2026-09-30T05:05:00Z";

  it("formate dans le fuseau de l'événement, pas celui du serveur", () => {
    expect(formatEventDateTime(scan)).toBe("le 30 septembre 2026 à 07:05");
    expect(formatEventDateTime(scan, "Africa/Dakar")).toBe("le 30 septembre 2026 à 05:05");
  });

  it("garde le bon jour pour un événement proche de minuit", () => {
    // 22:30 UTC = 00:30 le lendemain à Paris.
    expect(formatEventDate("2026-10-23T22:30:00Z")).toBe("samedi 24 octobre 2026");
  });
});
