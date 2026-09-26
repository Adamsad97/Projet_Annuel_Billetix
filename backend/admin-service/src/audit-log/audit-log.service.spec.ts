import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService.getLogs', () => {
  let service: AuditLogService;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: { createQueryBuilder: () => qb } },
      ],
    }).compile();
    service = module.get(AuditLogService);
  });

  it('recherche aussi dans les détails (ex. référence de billet ou email du bénéficiaire)', async () => {
    await service.getLogs({ q: ' TKT-2026-4D31ED ' });

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('log.metadata::text ILIKE :q'), {
      q: '%TKT-2026-4D31ED%',
    });
  });

  it('filtre par action et ignore une recherche vide', async () => {
    await service.getLogs({ action: AuditAction.TICKET_TRANSFERRED, q: '  ' });

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    expect(qb.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'TICKET_TRANSFERRED' });
  });
});
