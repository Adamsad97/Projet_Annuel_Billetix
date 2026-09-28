import { RpcException } from '@nestjs/microservices';
import { AuditAction, AuditEntityType } from '../audit-log/audit-log.entity';
import { GetLogsDto, LogActionDto } from '../audit-log/audit-log.service';
import { UpdateSettingPayload } from './payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

describe('Validation des messages internes (admin-service)', () => {
  it("journalise une action d'un admin comme une tâche automatique (« system »)", async () => {
    const entry = { action: AuditAction.EVENT_CANCELED, entity_type: AuditEntityType.EVENT, entity_id: null, performed_by: 'system', reason: null, metadata: null };
    await expect(run(LogActionDto, entry)).resolves.toMatchObject({ performed_by: 'system' });
  });

  it('refuse une action inconnue', async () => {
    await expect(run(LogActionDto, { action: 'PIRATAGE', entity_type: 'EVENT', performed_by: 'x' })).rejects.toBeInstanceOf(RpcException);
  });

  it('borne la pagination du journal', async () => {
    await expect(run(GetLogsDto, { limit: 5000 })).rejects.toBeInstanceOf(RpcException);
  });

  it('refuse une clé de paramètre mal formée', async () => {
    await expect(run(UpdateSettingPayload, { key: 'tva_rate; DROP TABLE', value: '0.2' })).rejects.toBeInstanceOf(RpcException);
    await expect(run(UpdateSettingPayload, { key: 'tva_rate', value: '0.2', actor_role: 'SUPER_ADMIN' })).resolves.toBeDefined();
  });
});
