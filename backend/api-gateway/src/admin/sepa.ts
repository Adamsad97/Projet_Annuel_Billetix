/**
 * Fichier de virements SEPA (ISO 20022 pain.001.001.03), à importer dans
 * l'espace bancaire de la plateforme : un ordre groupé, une ligne par
 * reversement.
 */

export interface SepaDebtor {
  name: string;
  iban: string;
  bic: string;
}

export interface SepaCredit {
  endToEndId: string;
  amount: number;
  creditorName: string;
  creditorIban: string;
  remittance: string;
}

/** Jeu de caractères SEPA : lettres latines sans accents, chiffres et / - ? : ( ) . , ' + espace. */
export function sepaText(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Identifiant SEPA (35 caractères max, sans espace). */
export function sepaId(prefix: string, id: string): string {
  return `${prefix}${id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 35);
}

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const amount = (value: number) => value.toFixed(2);

export function buildSepaCreditTransfer(input: {
  messageId: string;
  createdAt: Date;
  executionDate: string;
  debtor: SepaDebtor;
  credits: SepaCredit[];
}): string {
  const total = input.credits.reduce((sum, credit) => sum + Math.round(credit.amount * 100), 0) / 100;
  const count = input.credits.length;
  const debtorName = xml(sepaText(input.debtor.name, 70));
  const debtorAgent = input.debtor.bic
    ? `<BIC>${xml(input.debtor.bic.replace(/\s+/g, "").toUpperCase())}</BIC>`
    : "<Othr><Id>NOTPROVIDED</Id></Othr>";

  const transactions = input.credits
    .map(
      (credit) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${xml(credit.endToEndId)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${amount(credit.amount)}</InstdAmt></Amt>
        <Cdtr><Nm>${xml(sepaText(credit.creditorName, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${xml(credit.creditorIban)}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${xml(sepaText(credit.remittance, 140))}</Ustrd></RmtInf>
      </CdtTrfTxInf>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xml(input.messageId)}</MsgId>
      <CreDtTm>${input.createdAt.toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${amount(total)}</CtrlSum>
      <InitgPty><Nm>${debtorName}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xml(input.messageId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${amount(total)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${input.executionDate}</ReqdExctnDt>
      <Dbtr><Nm>${debtorName}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${xml(input.debtor.iban.replace(/\s+/g, "").toUpperCase())}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId>${debtorAgent}</FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
