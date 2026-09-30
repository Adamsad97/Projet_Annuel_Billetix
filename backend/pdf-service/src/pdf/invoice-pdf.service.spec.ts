import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../storage/minio.service';
import { InvoicePdfData, InvoicePdfService } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicePdfService,
        { provide: MinioService, useValue: { uploadPdf: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((_, defaultValue) => defaultValue) } },
      ],
    }).compile();

    service = module.get(InvoicePdfService);
  });

  describe('buildHtml — identité visuelle', () => {
    const buildHtml = (data: InvoicePdfData) =>
      (service as unknown as { buildHtml(invoiceData: InvoicePdfData): string }).buildHtml(data);
    const data: InvoicePdfData = {
      order_id: 'o1',
      reference: 'ORD-2026-TEST1',
      paid_at: '2026-09-26T12:00:00.000Z',
      tva_rate: 0.2,
      billing_first_name: 'Éloïse',
      billing_last_name: 'Martin',
      billing_email: 'eloise@example.com',
      billing_address_line1: '1 rue Test',
      billing_city: 'Paris',
      billing_postal_code: '75001',
      billing_country: 'FR',
      items: [],
      total_amount_ht: 25,
      total_amount_ttc: 30,
      discount_amount: 0,
      free_ticket_fees: 0,
      platform_legal_name: 'BilleTix SAS',
      platform_siret: '',
      platform_vat_number: '',
      platform_address: '',
    };

    it('affiche le logo BilleTix (mot-symbole + icône des billets), sans ressource externe', () => {
      const html = buildHtml(data);
      expect(html).toContain('Bille<span>Tix</span>');
      expect(html).toContain('Simple &amp; sûr !');
      expect(html).toContain('<svg viewBox="0 0 44 34"');
      expect(html).not.toMatch(/<img|https?:\/\/(?!www\.w3\.org)/);
    });

    it('utilise la couleur de marque du site, plus l’ancien violet', () => {
      const html = buildHtml(data);
      expect(html).toContain('#e8532b');
      expect(html).not.toContain('#6c3de0');
    });
  });

  describe('esc (échappement HTML — protection XSS dans la facture générée)', () => {
    const esc = (rawValue: string) => (service as unknown as { esc(value: string): string }).esc(rawValue);

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

  describe("buildCreditNoteHtml — avoir", () => {
    const note = {
      credit_note_id: '11111111-1111-4111-8111-111111111111',
      number: 'AV-2026-00042',
      issued_at: '2026-10-01T10:00:00.000Z',
      invoice_reference: 'ORD-2026-ABCDE',
      reason: 'Événement annulé',
      event_name: 'Soirée <Jazz>',
      tva_rate: 0.2,
      billing_first_name: 'Awa',
      billing_last_name: 'Diallo',
      billing_email: 'awa@example.com',
      billing_address_line1: '1 rue de Paris',
      billing_city: 'Paris',
      billing_postal_code: '75001',
      billing_country: 'France',
      amount_ht: 98,
      tva_amount: 19.6,
      fees_amount: 2.4,
      amount_ttc: 120,
      platform_legal_name: 'BilletiX SAS',
      platform_siret: '',
      platform_vat_number: '',
      platform_address: '',
    };

    it("titre, numéro, facture d'origine et montants en négatif", () => {
      const html = service.buildCreditNoteHtml(note);
      expect(html).toContain('<h1>AVOIR</h1>');
      expect(html).toContain('N° AV-2026-00042');
      expect(html).toContain('Sur facture N° ORD-2026-ABCDE');
      expect(html).toContain('-120.00 €');
      expect(html).toContain('-19.60 €');
      expect(html).toContain('Motif :</strong> Événement annulé');
    });

    it("échappe les champs saisis (nom d'événement)", () => {
      expect(service.buildCreditNoteHtml(note)).toContain('Soirée &lt;Jazz&gt;');
    });
  });
});
