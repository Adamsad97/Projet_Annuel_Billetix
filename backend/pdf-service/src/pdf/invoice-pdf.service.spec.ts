import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../storage/minio.service';
import { InvoicePdfService } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicePdfService,
        { provide: MinioService, useValue: { uploadPdf: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((_, def) => def) } },
      ],
    }).compile();

    service = module.get(InvoicePdfService);
  });

  describe('esc (échappement HTML — protection XSS dans la facture générée)', () => {
    const esc = (s: string) => (service as unknown as { esc(v: string): string }).esc(s);

    it('échappe les caractères HTML spéciaux (ex: nom/adresse de facturation)', () => {
      expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it("échappe le esperluette avant les chevrons pour éviter un double échappement", () => {
      expect(esc('Dupont & Fils <SARL>')).toBe('Dupont &amp; Fils &lt;SARL&gt;');
    });

    it('gère une valeur vide ou nulle sans planter', () => {
      expect(esc('')).toBe('');
      expect(esc(undefined as unknown as string)).toBe('');
      expect(esc(null as unknown as string)).toBe('');
    });

    it('laisse un texte sans caractère spécial inchangé', () => {
      expect(esc('Jean Dupont')).toBe('Jean Dupont');
    });
  });
});
