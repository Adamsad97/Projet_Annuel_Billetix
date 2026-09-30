import { buildSepaCreditTransfer, sepaId, sepaText } from "./sepa";

describe("fichier de virements SEPA", () => {
  const xml = buildSepaCreditTransfer({
    messageId: "BTX-20261001100000",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    executionDate: "2026-10-01",
    debtor: { name: "BilletiX SAS", iban: "FR76 3000 6000 0112 3456 7890 189", bic: "" },
    credits: [
      { endToEndId: "BTX1", amount: 120.5, creditorName: "Awa Diallo", creditorIban: "FR7630006000011234567890189", remittance: "BilletiX reversement Fête" },
      { endToEndId: "BTX2", amount: 30.25, creditorName: "Société <Éclair> & Cie", creditorIban: "BE71096123456769", remittance: "x" },
    ],
  });

  it("totalise les virements et compte les transactions", () => {
    expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
    expect(xml).toContain("<CtrlSum>150.75</CtrlSum>");
    expect(xml).toContain('<InstdAmt Ccy="EUR">120.50</InstdAmt>');
  });

  it("IBAN émetteur compact, banque non renseignée acceptée", () => {
    expect(xml).toContain("<IBAN>FR7630006000011234567890189</IBAN>");
    expect(xml).toContain("<Othr><Id>NOTPROVIDED</Id></Othr>");
  });

  it("n'utilise que le jeu de caractères SEPA", () => {
    expect(xml).toContain("<Nm>Societe Eclair Cie</Nm>");
    expect(xml).toContain("BilletiX reversement Fete");
    expect(sepaText("Élodie   Müller", 70)).toBe("Elodie Muller");
  });

  it("identifiant limité à 35 caractères", () => {
    expect(sepaId("BTX", "0b3e2f7a-1c4d-4e5f-8a9b-0c1d2e3f4a5b")).toHaveLength(35);
  });
});
