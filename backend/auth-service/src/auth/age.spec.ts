import { ageInYears } from "./age";

describe("ageInYears", () => {
  const today = new Date(2026, 8, 26); // 26 septembre 2026

  it("compte l'année entière le jour même de l'anniversaire", () => {
    expect(ageInYears("2008-09-26", today)).toBe(18);
  });

  it("n'a pas encore l'année la veille de l'anniversaire", () => {
    expect(ageInYears("2008-09-27", today)).toBe(17);
  });

  it("gère un anniversaire déjà passé dans l'année", () => {
    expect(ageInYears("1998-05-12", today)).toBe(28);
  });

  it("gère une naissance un 29 février", () => {
    expect(ageInYears("2008-02-29", today)).toBe(18);
  });
});
