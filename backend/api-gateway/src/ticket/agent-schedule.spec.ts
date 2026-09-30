import { findScheduleConflict } from "./agent-schedule";

const event = (id: string, start: string, end: string, status = "PUBLISHED") => ({
  id,
  title: `Événement ${id}`,
  start_date: start,
  end_date: end,
  status,
});

describe("findScheduleConflict — un agent, un événement à la fois", () => {
  const concert = event("a", "2026-10-10T18:00:00Z", "2026-10-10T23:00:00Z");

  it("refuse un événement qui commence avant la fin d'un autre", () => {
    const target = event("b", "2026-10-10T22:00:00Z", "2026-10-11T02:00:00Z");
    expect(findScheduleConflict(target, [concert])).toMatchObject({ id: "a" });
  });

  it("refuse un événement englobant ou englobé", () => {
    expect(findScheduleConflict(event("b", "2026-10-10T19:00:00Z", "2026-10-10T20:00:00Z"), [concert])).not.toBeNull();
    expect(findScheduleConflict(event("c", "2026-10-10T12:00:00Z", "2026-10-11T12:00:00Z"), [concert])).not.toBeNull();
  });

  it("accepte des créneaux successifs, même bout à bout", () => {
    expect(findScheduleConflict(event("b", "2026-10-10T23:00:00Z", "2026-10-11T02:00:00Z"), [concert])).toBeNull();
    expect(findScheduleConflict(event("c", "2026-10-11T18:00:00Z", "2026-10-11T23:00:00Z"), [concert])).toBeNull();
  });

  it("ignore un événement annulé ou archivé", () => {
    const target = event("b", "2026-10-10T20:00:00Z", "2026-10-10T22:00:00Z");
    expect(findScheduleConflict(target, [{ ...concert, status: "CANCELLED" }])).toBeNull();
  });
});
