import { JobLock } from '../scheduler/job-lock.service';
import { ResaleCleanupService } from './resale-cleanup.service';
import { TicketResaleService } from './ticket-resale.service';

describe('ResaleCleanupService — tâches planifiées sous verrou de cluster', () => {
  const resale = { releaseStaleReservations: jest.fn(), expireOldListings: jest.fn() };
  const jobLock = { runOncePerPeriod: jest.fn((_name: string, _period: number, job: () => Promise<unknown>) => job()) };
  const service = new ResaleCleanupService(resale as unknown as TicketResaleService, jobLock as unknown as JobLock);

  it('libère les réservations de revente expirées une fois par créneau de 5 minutes', async () => {
    await service.releaseStaleReservations();
    expect(jobLock.runOncePerPeriod).toHaveBeenCalledWith('release-stale-resale-reservations', 300, expect.any(Function));
    expect(resale.releaseStaleReservations).toHaveBeenCalledTimes(1);
  });

  it('expire les annonces passées une fois par heure', async () => {
    await service.expireOldListings();
    expect(jobLock.runOncePerPeriod).toHaveBeenCalledWith('expire-old-resale-listings', 3600, expect.any(Function));
    expect(resale.expireOldListings).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien quand un autre exemplaire a déjà pris le créneau", async () => {
    jobLock.runOncePerPeriod.mockResolvedValueOnce(false as never);
    resale.expireOldListings.mockClear();
    await service.expireOldListings();
    expect(resale.expireOldListings).not.toHaveBeenCalled();
  });
});
