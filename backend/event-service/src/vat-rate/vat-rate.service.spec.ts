import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VatRate } from './vat-rate.entity';
import { VatRateService } from './vat-rate.service';

describe('VatRateService', () => {
  let service: VatRateService;
  let repo: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let manager: { update: jest.Mock };

  beforeEach(async () => {
    manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    repo = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation((value) => Promise.resolve({ id: 'new-id', is_active: true, ...value })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      remove: jest.fn(),
      manager: { transaction: jest.fn().mockImplementation((work: (m: typeof manager) => unknown) => work(manager)) },
    };
    const module = await Test.createTestingModule({
      providers: [VatRateService, { provide: getRepositoryToken(VatRate), useValue: repo }],
    }).compile();
    service = module.get(VatRateService);
  });

  it('liste vide au démarrage : crée le taux normal de 20 %, par défaut', async () => {
    repo.count.mockResolvedValue(0);
    await service.onModuleInit();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ rate: '0.2000', is_default: true }));
  });

  it('liste déjà remplie : rien n\'est créé', async () => {
    await service.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('création : taux stocké en fraction à 4 décimales, libellé nettoyé', async () => {
    const created = await service.create({ label: '  Spectacles vivants ', rate: 0.055 });
    expect(created).toMatchObject({ label: 'Spectacles vivants', rate: '0.0550', is_default: false });
  });

  it('nouveau taux par défaut : il remplace l\'ancien', async () => {
    const created = await service.create({ label: 'Taux réduit', rate: 0.1, is_default: true });
    expect(manager.update).toHaveBeenCalledWith(VatRate, { is_default: true }, { is_default: false });
    expect(manager.update).toHaveBeenCalledWith(VatRate, { id: 'new-id' }, { is_default: true });
    expect(created.is_default).toBe(true);
  });

  it('le taux par défaut ne peut être ni supprimé, ni désactivé, ni retiré du défaut', async () => {
    repo.findOne.mockResolvedValue({ id: 'd', is_default: true, is_active: true });
    await expect(service.remove('d')).rejects.toBeInstanceOf(RpcException);
    await expect(service.update('d', { is_active: false })).rejects.toBeInstanceOf(RpcException);
    await expect(service.update('d', { is_default: false })).rejects.toBeInstanceOf(RpcException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('un autre taux peut être supprimé : les événements gardent leur copie', async () => {
    repo.findOne.mockResolvedValue({ id: 'r', is_default: false, is_active: true });
    await expect(service.remove('r')).resolves.toEqual({ success: true });
  });

  it('résolution : taux choisi, sinon taux par défaut ; taux désactivé refusé', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'r', rate: '0.0550', label: 'Spectacles', is_active: true });
    await expect(service.resolve('r')).resolves.toEqual({ rate: 0.055, label: 'Spectacles' });
    repo.findOne.mockResolvedValueOnce({ id: 'd', rate: '0.2000', label: 'Taux normal', is_default: true, is_active: true });
    await expect(service.resolve()).resolves.toEqual({ rate: 0.2, label: 'Taux normal' });
    repo.findOne.mockResolvedValueOnce({ id: 'x', rate: '0.1000', label: 'Ancien', is_active: false });
    await expect(service.resolve('x')).rejects.toBeInstanceOf(RpcException);
  });
});
