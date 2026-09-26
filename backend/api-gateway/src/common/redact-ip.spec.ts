import { redactIpUnlessSuperAdmin } from "./redact-ip";

describe("redactIpUnlessSuperAdmin", () => {
  const data = {
    total: 1,
    data: [{ id: "t1", ip_address: "203.0.113.7", user_agent: "Chrome", transfer: { ip_address: "203.0.113.8" } }],
  };

  it("retire l'IP (même imbriquée) pour un admin, garde l'appareil", () => {
    const result = redactIpUnlessSuperAdmin({ sub: "a", email: "a@x", role: "ADMIN" }, data);
    expect(JSON.stringify(result)).not.toContain("203.0.113");
    expect(result.data[0]).toMatchObject({ id: "t1", user_agent: "Chrome" });
  });

  it("laisse l'IP au super admin", () => {
    expect(redactIpUnlessSuperAdmin({ sub: "s", email: "s@x", role: "SUPER_ADMIN" }, data)).toBe(data);
  });
});
