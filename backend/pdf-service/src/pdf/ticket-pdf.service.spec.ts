import { Test } from '@nestjs/testing';
import { MinioService } from '../storage/minio.service';
import { TicketPdfService } from './ticket-pdf.service';

describe('TicketPdfService', () => {
  let service: TicketPdfService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TicketPdfService,
        { provide: MinioService, useValue: { uploadPdf: jest.fn() } },
      ],
    }).compile();

    service = module.get(TicketPdfService);
  });

  describe('esc (échappement HTML — protection XSS dans le PDF généré)', () => {
    const esc = (s: string) => (service as unknown as { esc(v: string): string }).esc(s);

    it('échappe les caractères HTML spéciaux', () => {
      expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it("échappe le esperluette avant les chevrons pour éviter un double échappement", () => {
      expect(esc('Rock & Roll <Live>')).toBe('Rock &amp; Roll &lt;Live&gt;');
    });

    it('gère une valeur vide ou nulle sans planter', () => {
      expect(esc('')).toBe('');
      expect(esc(undefined as unknown as string)).toBe('');
    });

    it('laisse un texte sans caractère spécial inchangé', () => {
      expect(esc('Jean Dupont')).toBe('Jean Dupont');
    });
  });
});
