import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { MinioService } from '../storage/minio.service';

export interface TicketPdfData {
  ticket_id: string;
  reference: string;
  order_id: string;

  // Événement
  event_name: string;
  event_start_at: string;
  event_venue_name: string;
  event_venue_address: string;
  event_city: string;
  event_poster_url?: string;

  // Artiste
  artist_name: string;

  // Catégorie
  ticket_category_name: string;
  unit_price_ttc: number;
  seat_info?: string;

  // Porteur
  holder_first_name: string;
  holder_last_name: string;
  buyer_email: string;

  // QR
  qr_code_url: string; // data:image/png;base64,...
}

@Injectable()
export class TicketPdfService {
  private readonly logger = new Logger(TicketPdfService.name);

  constructor(private readonly minio: MinioService) {}

  async generate(data: TicketPdfData): Promise<string> {
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
        format: 'A5',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      pdfBuffer = Buffer.from(raw);
    } finally {
      await browser.close();
    }

    const key = `ticket-${data.reference}.pdf`;
    const url = await this.minio.uploadPdf(key, pdfBuffer);
    this.logger.log(`PDF généré : ${key}`);
    return url;
  }

  private buildHtml(d: TicketPdfData): string {
    const date = new Date(d.event_start_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const price = Number(d.unit_price_ttc).toFixed(2);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Arial', sans-serif;
      background: #fff;
      width: 148mm;
      min-height: 210mm;
    }
    .ticket {
      width: 148mm;
      min-height: 210mm;
      display: flex;
      flex-direction: column;
      border: 2px solid #6c3de0;
      border-radius: 12px;
      overflow: hidden;
    }
    /* En-tête violet */
    .header {
      background: linear-gradient(135deg, #6c3de0, #9333ea);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand { color: #fff; font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .ref { color: rgba(255,255,255,0.85); font-size: 10px; }

    /* Affiche événement */
    .poster-band {
      background: #f3f0ff;
      padding: 14px 20px;
      border-bottom: 1px solid #e0d9f8;
    }
    .poster-image {
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 10px;
      display: block;
    }
    .event-name { font-size: 17px; font-weight: bold; color: #1a1a1a; line-height: 1.3; }
    .artist     { font-size: 13px; color: #6c3de0; font-weight: 600; margin-top: 3px; }

    /* Infos lieu & date */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-bottom: 1px dashed #d1d5db;
    }
    .info-cell {
      padding: 12px 18px;
      border-right: 1px dashed #d1d5db;
    }
    .info-cell:last-child { border-right: none; }
    .info-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
    .info-value { font-size: 12px; font-weight: 600; color: #111; margin-top: 2px; line-height: 1.4; }

    /* Porteur */
    .holder-section {
      padding: 12px 18px;
      border-bottom: 1px dashed #d1d5db;
      background: #faf9ff;
    }
    .holder-name { font-size: 14px; font-weight: bold; color: #1a1a1a; }
    .holder-email { font-size: 10px; color: #6b7280; margin-top: 2px; }

    /* QR code */
    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      flex: 1;
    }
    .qr-section img {
      width: 130px;
      height: 130px;
      border: 6px solid #6c3de0;
      border-radius: 8px;
    }
    .qr-label {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 6px;
      text-align: center;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Prix & catégorie */
    .price-bar {
      background: #6c3de0;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cat-name { color: #e9d5ff; font-size: 11px; font-weight: 600; }
    .price     { color: #fff; font-size: 18px; font-weight: 900; }

    /* Pied de page */
    .footer {
      padding: 8px 18px;
      font-size: 8px;
      color: #9ca3af;
      text-align: center;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
<div class="ticket">

  <div class="header">
    <div class="brand">BilletiX</div>
    <div class="ref">#${d.reference}</div>
  </div>

  <div class="poster-band">
    ${d.event_poster_url ? `<img class="poster-image" src="${this.esc(d.event_poster_url)}" alt="Affiche"/>` : ''}
    <div class="event-name">${this.esc(d.event_name)}</div>
    <div class="artist">🎤 ${this.esc(d.artist_name)}</div>
  </div>

  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">Date</div>
      <div class="info-value">${formattedDate}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Heure</div>
      <div class="info-value">${formattedTime}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Lieu</div>
      <div class="info-value">${this.esc(d.event_venue_name)}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Ville</div>
      <div class="info-value">${this.esc(d.event_city)}</div>
    </div>
    ${d.seat_info ? `
    <div class="info-cell" style="grid-column:1/-1">
      <div class="info-label">Siège</div>
      <div class="info-value">${this.esc(d.seat_info)}</div>
    </div>` : ''}
  </div>

  <div class="holder-section">
    <div class="info-label">Porteur du billet</div>
    <div class="holder-name">${this.esc(d.holder_first_name)} ${this.esc(d.holder_last_name)}</div>
    <div class="holder-email">${this.esc(d.buyer_email)}</div>
  </div>

  <div class="qr-section">
    <img src="${d.qr_code_url}" alt="QR Code"/>
    <div class="qr-label">Présentez ce code à l'entrée • Usage unique</div>
  </div>

  <div class="price-bar">
    <div class="cat-name">${this.esc(d.ticket_category_name)}</div>
    <div class="price">${price} €</div>
  </div>

  <div class="footer">
    ${this.esc(d.event_venue_address)} — ${this.esc(d.event_city)} •
    Ce billet est nominatif et non remboursable sauf annulation de l'événement.
  </div>

</div>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '';
  }
}
