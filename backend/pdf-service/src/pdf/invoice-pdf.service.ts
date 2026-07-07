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

  private buildHtml(d: InvoicePdfData): string {
    const paidDate = new Date(d.paid_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const tvaAmount = Number(d.total_amount_ttc) - Number(d.total_amount_ht) - Number(d.free_ticket_fees);
    const money = (n: number) => Number(n).toFixed(2) + ' €';

    const rows = d.items.map((item) => `
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
    .brand { font-size: 24px; font-weight: 900; color: #6c3de0; }
    .brand-info { font-size: 10px; color: #6b7280; margin-top: 6px; line-height: 1.5; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 20px; color: #1a1a1a; }
    .invoice-title .ref { font-size: 11px; color: #6b7280; margin-top: 4px; }

    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { font-size: 11px; line-height: 1.6; }
    .party-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 4px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #f3f0ff; color: #6c3de0; font-size: 10px; text-transform: uppercase; text-align: left; padding: 8px 10px; }
    thead th.num { text-align: right; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    tbody td.num { text-align: right; }

    .totals { margin-left: auto; width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 11px; }
    .totals-row.total { font-weight: 900; font-size: 14px; border-top: 2px solid #6c3de0; margin-top: 4px; padding-top: 10px; color: #6c3de0; }

    .footer { margin-top: 40px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 10px; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand">BilletiX</div>
      <div class="brand-info">
        ${this.esc(d.platform_legal_name)}<br/>
        ${d.platform_address ? this.esc(d.platform_address) + '<br/>' : ''}
        ${d.platform_siret ? 'SIRET : ' + this.esc(d.platform_siret) + '<br/>' : ''}
        ${d.platform_vat_number ? 'TVA intracommunautaire : ' + this.esc(d.platform_vat_number) : ''}
      </div>
    </div>
    <div class="invoice-title">
      <h1>FACTURE</h1>
      <div class="ref">N° ${this.esc(d.reference)}<br/>Payée le ${paidDate}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Facturé à</div>
      ${this.esc(d.billing_first_name)} ${this.esc(d.billing_last_name)}<br/>
      ${this.esc(d.billing_address_line1)}<br/>
      ${d.billing_address_line2 ? this.esc(d.billing_address_line2) + '<br/>' : ''}
      ${this.esc(d.billing_postal_code)} ${this.esc(d.billing_city)}<br/>
      ${this.esc(d.billing_country)}<br/>
      ${this.esc(d.billing_email)}
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
    ${d.discount_amount > 0 ? `<div class="totals-row"><span>Remise</span><span>-${money(d.discount_amount)}</span></div>` : ''}
    <div class="totals-row"><span>Total HT</span><span>${money(d.total_amount_ht)}</span></div>
    <div class="totals-row"><span>TVA (${(d.tva_rate * 100).toFixed(0)}%)</span><span>${money(tvaAmount)}</span></div>
    ${d.free_ticket_fees > 0 ? `<div class="totals-row"><span>Frais billets gratuits</span><span>${money(d.free_ticket_fees)}</span></div>` : ''}
    <div class="totals-row total"><span>Total TTC</span><span>${money(d.total_amount_ttc)}</span></div>
  </div>

  <div class="footer">
    Facture générée automatiquement par BilletiX — document à conserver pour votre comptabilité.
  </div>

</body>
</html>`;
  }

  private esc(s: string | null | undefined): string {
    return s?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '';
  }
}
