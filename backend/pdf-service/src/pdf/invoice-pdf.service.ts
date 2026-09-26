import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer';
import { MinioService } from '../storage/minio.service';

export interface InvoicePdfItem {
  ticket_category_name: string;
  quantity: number;
  unit_price_ht: number;
  unit_price_ttc: number;
  total_price_ht: number;
  total_price_ttc: number;
}

export interface InvoicePdfData {
  order_id: string;
  reference: string;
  paid_at: string;
  tva_rate: number;

  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  billing_address_line1: string;
  billing_address_line2?: string | null;
  billing_city: string;
  billing_postal_code: string;
  billing_country: string;

  items: InvoicePdfItem[];
  total_amount_ht: number;
  total_amount_ttc: number;
  discount_amount: number;
  free_ticket_fees: number;

  platform_legal_name: string;
  platform_siret: string;
  platform_vat_number: string;
  platform_address: string;
}

/** Couleur de marque (corail), identique au site (--color-brand). */
const BRAND = '#e8532b';

/**
 * Logo BilleTix en HTML + SVG autonome (aucune ressource externe à charger
 * par Chromium) : mot-symbole, accroche et icône des deux billets, repris
 * de components/layout/logo.tsx côté frontend.
 */
const LOGO_HTML = `<div class="logo" aria-label="BilleTix">
        <div class="logo-text">
          <div class="logo-word">Bille<span>Tix</span></div>
          <div class="logo-tagline">Simple &amp; sûr !</div>
        </div>
        <svg viewBox="0 0 44 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="logo-back">
              <rect x="-10" y="-10" width="64" height="54" fill="white"/>
              <circle cx="9" cy="12.5" r="3" fill="black"/>
              <circle cx="37" cy="12.5" r="3" fill="black"/>
            </mask>
            <mask id="logo-front">
              <rect x="-10" y="-10" width="64" height="54" fill="white"/>
              <circle cx="5" cy="20" r="3.2" fill="black"/>
              <circle cx="35" cy="20" r="3.2" fill="black"/>
            </mask>
          </defs>
          <g transform="rotate(12 22 14)">
            <rect x="9" y="5" width="28" height="15" rx="2.1" fill="#f4a07f" mask="url(#logo-back)"/>
          </g>
          <g transform="rotate(-10 20 20)">
            <rect x="5" y="12" width="30" height="16" rx="2.2" fill="${BRAND}" mask="url(#logo-front)"/>
            <polygon points="16,16 16.94,18.71 19.8,18.76 17.52,20.49 18.35,23.24 16,21.6 13.65,23.24 14.48,20.49 12.2,18.76 15.06,18.71" fill="white"/>
            <line x1="27" y1="14.9" x2="27" y2="25.1" stroke="white" stroke-width="1.1" stroke-dasharray="1.6 1.45" stroke-linecap="round"/>
          </g>
        </svg>
      </div>`;

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly minio: MinioService,
    private readonly config: ConfigService,
  ) {}

  async generate(data: InvoicePdfData): Promise<string> {
    const html = this.buildHtml(data);

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const raw = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      });
      pdfBuffer = Buffer.from(raw);
    } finally {
      await browser.close();
    }

    const key = `invoice-${data.reference}.pdf`;
    const bucket = this.config.get<string>('MINIO_BUCKET_INVOICES', 'invoices');
    const url = await this.minio.uploadPdf(key, pdfBuffer, bucket);
    this.logger.log(`Facture générée : ${key}`);
    return url;
  }

  private buildHtml(invoiceData: InvoicePdfData): string {
    const paidDate = new Date(invoiceData.paid_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const tvaAmount = Number(invoiceData.total_amount_ttc) - Number(invoiceData.total_amount_ht) - Number(invoiceData.free_ticket_fees);
    const money = (amount: number) => Number(amount).toFixed(2) + ' €';

    const rows = invoiceData.items.map((item) => `
      <tr>
        <td>${this.esc(item.ticket_category_name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${money(item.unit_price_ht)}</td>
        <td class="num">${money(item.total_price_ht)}</td>
        <td class="num">${money(item.total_price_ttc)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
    /* Logo BilleTix (identique à celui du site : components/layout/logo.tsx) */
    .logo { display: inline-flex; align-items: flex-start; }
    .logo-text { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
    .logo-word { font-size: 28px; font-weight: 900; letter-spacing: -1.4px; color: #111827; }
    .logo-word span { color: ${BRAND}; }
    .logo-tagline { font-size: 9px; font-weight: 700; color: ${BRAND}; margin-top: 1px; padding-right: 2px; letter-spacing: -0.2px; }
    .logo svg { margin-left: -4px; margin-top: -8px; width: 46px; height: 36px; }
    .brand-info { font-size: 10px; color: #6b7280; margin-top: 10px; line-height: 1.5; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 20px; color: #1a1a1a; }
    .invoice-title .ref { font-size: 11px; color: #6b7280; margin-top: 4px; }

    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { font-size: 11px; line-height: 1.6; }
    .party-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 4px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #fdeee8; color: ${BRAND}; font-size: 10px; text-transform: uppercase; text-align: left; padding: 8px 10px; }
    thead th.num { text-align: right; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    tbody td.num { text-align: right; }

    .totals { margin-left: auto; width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 11px; }
    .totals-row.total { font-weight: 900; font-size: 14px; border-top: 2px solid ${BRAND}; margin-top: 4px; padding-top: 10px; color: ${BRAND}; }

    .footer { margin-top: 40px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 10px; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      ${LOGO_HTML}
      <div class="brand-info">
        ${this.esc(invoiceData.platform_legal_name)}<br/>
        ${invoiceData.platform_address ? this.esc(invoiceData.platform_address) + '<br/>' : ''}
        ${invoiceData.platform_siret ? 'SIRET : ' + this.esc(invoiceData.platform_siret) + '<br/>' : ''}
        ${invoiceData.platform_vat_number ? 'TVA intracommunautaire : ' + this.esc(invoiceData.platform_vat_number) : ''}
      </div>
    </div>
    <div class="invoice-title">
      <h1>FACTURE</h1>
      <div class="ref">N° ${this.esc(invoiceData.reference)}<br/>Payée le ${paidDate}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Facturé à</div>
      ${this.esc(invoiceData.billing_first_name)} ${this.esc(invoiceData.billing_last_name)}<br/>
      ${this.esc(invoiceData.billing_address_line1)}<br/>
      ${invoiceData.billing_address_line2 ? this.esc(invoiceData.billing_address_line2) + '<br/>' : ''}
      ${this.esc(invoiceData.billing_postal_code)} ${this.esc(invoiceData.billing_city)}<br/>
      ${this.esc(invoiceData.billing_country)}<br/>
      ${this.esc(invoiceData.billing_email)}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="num">Qté</th>
        <th class="num">P.U. HT</th>
        <th class="num">Total HT</th>
        <th class="num">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    ${invoiceData.discount_amount > 0 ? `<div class="totals-row"><span>Remise</span><span>-${money(invoiceData.discount_amount)}</span></div>` : ''}
    <div class="totals-row"><span>Total HT</span><span>${money(invoiceData.total_amount_ht)}</span></div>
    <div class="totals-row"><span>TVA (${(invoiceData.tva_rate * 100).toFixed(0)}%)</span><span>${money(tvaAmount)}</span></div>
    ${invoiceData.free_ticket_fees > 0 ? `<div class="totals-row"><span>Frais billets gratuits</span><span>${money(invoiceData.free_ticket_fees)}</span></div>` : ''}
    <div class="totals-row total"><span>Total TTC</span><span>${money(invoiceData.total_amount_ttc)}</span></div>
  </div>

  <div class="footer">
    Facture générée automatiquement par BilleTix — document à conserver pour votre comptabilité.
  </div>

</body>
</html>`;
  }

  private esc(value: string | null | undefined): string {
    return value?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '';
  }
}
