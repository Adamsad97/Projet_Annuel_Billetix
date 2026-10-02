import { RealtimePublisher } from "./realtime.publisher";

describe("RealtimePublisher", () => {
  const client = { emit: jest.fn() };
  const publisher = new RealtimePublisher(client as never);

  beforeEach(() => client.emit.mockClear());

  it("publie le billet scanné pour son titulaire, avec une date ISO", () => {
    publisher.ticketScanned("holder-1", {
      ticket_id: "t-1",
      event_name: "Concert",
      ticket_category_name: "VIP",
      scanned_at: new Date("2026-10-02T20:00:00Z"),
    });
    expect(client.emit).toHaveBeenCalledWith("realtime.ticket_scanned", {
      holder_id: "holder-1",
      ticket_id: "t-1",
      event_name: "Concert",
      ticket_category_name: "VIP",
      scanned_at: "2026-10-02T20:00:00.000Z",
    });
  });

  it("publie le changement de tableau de bord et les alertes admin sur leur propre clé", () => {
    publisher.dashboardChanged("e-1", "sale");
    publisher.adminAlert({ type: "dispute_spike", severity: "warning", data: { count: 6, threshold: 5 } });
    expect(client.emit).toHaveBeenNthCalledWith(1, "realtime.dashboard_changed", { event_id: "e-1", reason: "sale" });
    expect(client.emit).toHaveBeenNthCalledWith(2, "realtime.admin_alert", { type: "dispute_spike", severity: "warning", data: { count: 6, threshold: 5 } });
  });
});
