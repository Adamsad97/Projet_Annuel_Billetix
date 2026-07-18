import { Test } from '@nestjs/testing';
import { MinioService } from '../storage/minio.service';
import { TicketPdfData, TicketPdfService } from './ticket-pdf.service';

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

  describe('buildHtml — affiche de l\'événement', () => {
    const buildHtml = (data: TicketPdfData) =>
      (service as unknown as { buildHtml(d: TicketPdfData): string }).buildHtml(data);

    const baseData: TicketPdfData = {
      ticket_id: 'ticket-1',
      reference: 'TKT-2026-ABC123',
      order_id: 'order-1',
      event_name: 'Concert Test',
      event_start_at: new Date().toISOString(),
      event_venue_name: 'Zenith',
      event_venue_address: '1 rue Test',
      event_city: 'Paris',
      artist_name: 'DJ Test',
      ticket_category_name: 'Standard',
      unit_price_ttc: 50,
      holder_first_name: 'Jean',
      holder_last_name: 'Dupont',
      buyer_email: 'jean@test.com',
      qr_code_url: 'data:image/png;base64,abc',
    };

    it("inclut l'affiche de l'événement quand event_poster_url est fourni", () => {
      const html = buildHtml({ ...baseData, event_poster_url: 'https://minio.local/posters/event-1.jpg' });

      expect(html).toContain('class="poster-image"');
      expect(html).toContain('https://minio.local/posters/event-1.jpg');
    });

    it("n'affiche aucune image quand event_poster_url est absent (pas de <img> cassée)", () => {
      const html = buildHtml(baseData);

      expect(html).not.toContain('class="poster-image"');
    });
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
