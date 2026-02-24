import jsPDF from "jspdf";

interface PDFPosition {
  posNr: number;
  typ: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
}

interface PDFData {
  nummer: string;
  datum: Date;
  gueltigBis: Date;
  kunde: {
    name: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    email?: string;
    telefon?: string;
  };
  firma: {
    firmenname: string;
    inhaberName: string;
    inhaberTitel?: string | null;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
    iban?: string | null;
    bic?: string | null;
    bankname?: string | null;
    zahlungsziel?: number;
    steuernummer?: string | null;
    ustIdNr?: string | null;
    agbText?: string | null;
    logoUrl?: string | null;
  } | null;
  positionen: PDFPosition[];
  raeume?: Array<{
    name: string;
    wandflaeche: number;
    deckenflaeche: number;
    gesamtflaeche: number;
  }>;
  einleitungsText?: string | null;
  schlussText?: string | null;
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  zuschlagNetto?: number;
  rabattNetto?: number;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
}

function euro(n: number): string {
  return (
    n.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

function datumDE(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Shared PDF builder — used by both client (Blob) and server (Buffer)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPDF(data: PDFData, JsPDF: any): InstanceType<typeof jsPDF> {
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const mL = 25; // DIN 5008 left margin
  const mR = 20;
  const contentW = pageWidth - mL - mR;
  let y = 0;
  let pageNum = 1;

  function addPageNumber() {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(
      `Seite ${pageNum}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.setTextColor(0);
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 25) {
      addPageNumber();
      doc.addPage();
      pageNum++;
      y = 20;
    }
  }

  // ═══ HEADER: Firma ═══
  y = 15;

  // Logo (if available)
  if (data.firma?.logoUrl) {
    try {
      doc.addImage(data.firma.logoUrl, "AUTO", pageWidth - mR - 40, 10, 40, 14);
    } catch {
      // Ignore logo errors
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(data.firma?.firmenname || "Angebot", mL, y);

  if (data.firma) {
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const sub = [
      data.firma.inhaberTitel
        ? `${data.firma.inhaberTitel} ${data.firma.inhaberName}`
        : data.firma.inhaberName,
      `${data.firma.strasse}, ${data.firma.plz} ${data.firma.ort}`,
    ].join(" \u2022 ");
    doc.text(sub, mL, y);
    y += 3.5;
    doc.text(
      `Tel: ${data.firma.telefon} \u2022 ${data.firma.email}`,
      mL,
      y
    );
  }

  // Trennlinie
  y += 4;
  doc.setDrawColor(200);
  doc.setLineWidth(0.4);
  doc.line(mL, y, pageWidth - mR, y);

  // ═══ ABSENDER-ZEILE (klein, über Adressfenster) ═══
  y += 6;
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.setFont("helvetica", "normal");
  if (data.firma) {
    doc.text(
      `${data.firma.firmenname} \u2022 ${data.firma.strasse} \u2022 ${data.firma.plz} ${data.firma.ort}`,
      mL,
      y
    );
  }

  // ═══ KUNDENADRESSE (DIN 5008 Fensterposition) ═══
  y += 5;
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(data.kunde.name, mL, y);
  y += 4.5;
  if (data.kunde.strasse) {
    doc.text(data.kunde.strasse, mL, y);
    y += 4.5;
  }
  if (data.kunde.plz || data.kunde.ort) {
    doc.text(
      `${data.kunde.plz || ""} ${data.kunde.ort || ""}`.trim(),
      mL,
      y
    );
    y += 4.5;
  }

  // ═══ DATUM-BLOCK (rechts) ═══
  const datumBlockY = y - 9;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(`Datum: ${datumDE(data.datum)}`, pageWidth - mR, datumBlockY, {
    align: "right",
  });
  doc.text(
    `Gültig bis: ${datumDE(data.gueltigBis)}`,
    pageWidth - mR,
    datumBlockY + 4,
    { align: "right" }
  );
  if (data.kunde.telefon) {
    doc.text(
      `Kd.-Tel: ${data.kunde.telefon}`,
      pageWidth - mR,
      datumBlockY + 8,
      { align: "right" }
    );
  }

  // ═══ BETREFF ═══
  y += 6;
  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Angebot ${data.nummer}`, mL, y);
  y += 8;

  // ═══ EINLEITUNG ═══
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const intro =
    data.einleitungsText ||
    "Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:";
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, mL, y);
  y += introLines.length * 4 + 4;

  // ═══ POSITIONEN-TABELLE ═══
  const colPos = mL;
  const colBez = mL + 9;
  const colMenge = mL + contentW - 65;
  const colEP = mL + contentW - 35;
  const colGP = mL + contentW;

  // Tabellenkopf
  doc.setFillColor(240, 240, 240);
  doc.rect(mL, y - 3.5, contentW, 6.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Pos.", colPos + 0.5, y);
  doc.text("Bezeichnung", colBez, y);
  doc.text("Menge", colMenge, y, { align: "right" });
  doc.text("Einzelpreis", colEP, y, { align: "right" });
  doc.text("Gesamtpreis", colGP, y, { align: "right" });
  y += 4.5;

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(mL, y, pageWidth - mR, y);
  y += 3;

  doc.setTextColor(0);

  // Group positions by type
  const produkte = data.positionen.filter((p) => p.typ === "PRODUKT");
  const leistungen = data.positionen.filter((p) => p.typ === "LEISTUNG");
  const materialien = data.positionen.filter((p) => p.typ === "MATERIAL");
  const zuschlaege = data.positionen.filter((p) => p.typ === "ZUSCHLAG");
  const rabattPositionen = data.positionen.filter((p) => p.typ === "RABATT");
  const anfahrtPos = data.positionen.find((p) => p.typ === "ANFAHRT");

  // FeWo-Modus: hat PRODUKT-Positionen (Unterkünfte), keine Leistungen/Material
  const isFewo = produkte.length > 0 && leistungen.length === 0 && materialien.length === 0;

  let rowIndex = 0;

  function renderRow(p: PDFPosition) {
    checkPageBreak(7);

    // Alternating row background
    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(mL, y - 3, contentW, 5.5, "F");
    }
    rowIndex++;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(String(p.posNr).padStart(2, " "), colPos + 0.5, y);
    doc.setTextColor(30);
    doc.text(p.bezeichnung, colBez, y, {
      maxWidth: colMenge - colBez - 3,
    });
    doc.setTextColor(80);
    doc.text(
      `${p.menge % 1 === 0 ? p.menge : p.menge.toFixed(1)} ${p.einheit}`,
      colMenge,
      y,
      { align: "right" }
    );
    doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 5;
  }

  function renderSectionHeader(title: string) {
    checkPageBreak(10);
    y += 1;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text(title, mL, y);
    y += 4;
    rowIndex = 0;
  }

  // Render sections
  if (produkte.length > 0) {
    const isFahrrad = produkte.some((p) => p.bezeichnung.includes("×"));
    renderSectionHeader(isFahrrad ? "Fahrräder" : "Unterkunft");
    for (const p of produkte) renderRow(p);
  }

  if (leistungen.length > 0) {
    renderSectionHeader("Arbeitsleistungen");
    for (const p of leistungen) renderRow(p);
  }

  if (materialien.length > 0) {
    renderSectionHeader("Material");
    for (const p of materialien) renderRow(p);
  }

  if (zuschlaege.length > 0) {
    renderSectionHeader("Zuschläge");
    for (const p of zuschlaege) renderRow(p);
  }

  if (rabattPositionen.length > 0) {
    renderSectionHeader("Rabatte");
    for (const p of rabattPositionen) renderRow(p);
  }

  if (anfahrtPos) {
    y += 1;
    checkPageBreak(7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(String(anfahrtPos.posNr).padStart(2, " "), colPos + 0.5, y);
    doc.setTextColor(30);
    doc.text("Anfahrtspauschale", colBez, y);
    doc.setFont("helvetica", "bold");
    doc.text(euro(anfahrtPos.gesamtpreis), colGP, y, { align: "right" });
    y += 5;
  }

  // ═══ SUMMENBLOCK ═══
  checkPageBreak(50);
  y += 3;
  const sumX = mL + contentW - 75;

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(sumX, y, pageWidth - mR, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  if (isFewo) {
    // FeWo: Preise sind brutto — Gesamtbetrag, dann USt-Aufschlüsselung
    if (data.rabattNetto && data.rabattNetto > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text("Rabatt:", sumX, y);
      doc.text(`- ${euro(data.rabattNetto)}`, colGP, y, { align: "right" });
      doc.setTextColor(80);
      y += 4;
    }

    // Brutto (Gesamtbetrag)
    doc.setDrawColor(30);
    doc.setLineWidth(0.5);
    doc.line(sumX, y, pageWidth - mR, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Gesamtbetrag:", sumX, y);
    doc.text(euro(data.brutto), colGP, y, { align: "right" });
    y += 5;

    // USt-Info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`darin enth. ${data.mwstSatz}% USt.:`, sumX, y);
    doc.text(euro(data.mwstBetrag), colGP, y, { align: "right" });
    y += 4;
    doc.text("Nettobetrag:", sumX, y);
    doc.text(euro(data.netto), colGP, y, { align: "right" });
    y += 10;
  } else {
    // Maler/Shop: Netto-basiert
    doc.text("Arbeitsleistungen:", sumX, y);
    doc.text(euro(data.arbeitsNetto), colGP, y, { align: "right" });
    y += 4;

    doc.text("Material:", sumX, y);
    doc.text(euro(data.materialNetto), colGP, y, { align: "right" });
    y += 4;

    if (data.anfahrt > 0) {
      doc.text("Anfahrt:", sumX, y);
      doc.text(euro(data.anfahrt), colGP, y, { align: "right" });
      y += 4;
    }

    if (data.zuschlagNetto && data.zuschlagNetto > 0) {
      doc.text("Zuschläge:", sumX, y);
      doc.text(euro(data.zuschlagNetto), colGP, y, { align: "right" });
      y += 4;
    }

    if (data.rabattNetto && data.rabattNetto > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text("Rabatt:", sumX, y);
      doc.text(`- ${euro(data.rabattNetto)}`, colGP, y, { align: "right" });
      doc.setTextColor(80);
      y += 4;
    }

    // Netto
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(sumX, y, pageWidth - mR, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.setFontSize(9);
    doc.text("Nettobetrag:", sumX, y);
    doc.text(euro(data.netto), colGP, y, { align: "right" });
    y += 4.5;

    // MwSt
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`MwSt. ${data.mwstSatz}%:`, sumX, y);
    doc.text(euro(data.mwstBetrag), colGP, y, { align: "right" });
    y += 4;

    // Brutto
    doc.setDrawColor(30);
    doc.setLineWidth(0.5);
    doc.line(sumX, y, pageWidth - mR, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Bruttobetrag:", sumX, y);
    doc.text(euro(data.brutto), colGP, y, { align: "right" });
    y += 10;
  }

  // ═══ SCHLUSSTEXT ═══
  checkPageBreak(20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  const schluss =
    data.schlussText ||
    "Wir freuen uns auf Ihren Auftrag und stehen für Rückfragen gerne zur Verfügung.";
  const schlussLines = doc.splitTextToSize(schluss, contentW);
  doc.text(schlussLines, mL, y);
  y += schlussLines.length * 4 + 6;

  // Unterschrift
  checkPageBreak(15);
  doc.text("Mit freundlichen Grüßen", mL, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(data.firma?.inhaberName || "", mL, y);
  y += 10;

  // ═══ FOOTER ═══
  checkPageBreak(30);
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(mL, y, pageWidth - mR, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);

  const footerLines: string[] = [];
  footerLines.push(
    `Zahlungsziel: ${data.firma?.zahlungsziel || 14} Tage nach Rechnungsstellung`
  );

  if (data.firma?.iban) {
    let bankLine = "Bankverbindung:";
    if (data.firma.bankname) bankLine += ` ${data.firma.bankname}`;
    bankLine += ` | IBAN: ${data.firma.iban}`;
    if (data.firma.bic) bankLine += ` | BIC: ${data.firma.bic}`;
    footerLines.push(bankLine);
  }

  if (data.firma?.steuernummer) {
    let taxLine = `Steuernummer: ${data.firma.steuernummer}`;
    if (data.firma.ustIdNr) taxLine += ` | USt-IdNr: ${data.firma.ustIdNr}`;
    footerLines.push(taxLine);
  }

  for (const line of footerLines) {
    doc.text(line, mL, y, { maxWidth: contentW });
    y += 3.5;
  }

  // AGB
  if (data.firma?.agbText) {
    y += 2;
    const agbLines = doc.splitTextToSize(data.firma.agbText, contentW);
    for (const line of agbLines) {
      checkPageBreak(5);
      doc.text(line, mL, y);
      y += 3;
    }
  }

  addPageNumber();

  return doc;
}

/**
 * Client-side: returns Blob for download
 */
export function generateAngebotPDF(data: PDFData): Blob {
  const doc = buildPDF(data, jsPDF);
  return doc.output("blob");
}

/**
 * Server-side: returns Buffer for email attachments
 */
export function generateAngebotPDFBuffer(data: PDFData): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jsPDFModule = require("jspdf");
  const JsPDFClass = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;
  const doc = buildPDF(data, JsPDFClass);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ═══════════════════════════════════════════
// RECHNUNG PDF
// ═══════════════════════════════════════════

interface RechnungPDFData {
  nummer: string;
  datum: Date;
  faelligAm: Date;
  kunde: {
    name: string;
    strasse?: string;
    plz?: string;
    ort?: string;
  };
  firma: {
    firmenname: string;
    inhaberName: string;
    inhaberTitel?: string | null;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
    iban?: string | null;
    bic?: string | null;
    bankname?: string | null;
    steuernummer?: string | null;
    ustIdNr?: string | null;
    agbText?: string | null;
    logoUrl?: string | null;
  } | null;
  positionen: PDFPosition[];
  einleitungsText?: string | null;
  schlussText?: string | null;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRechnungPDF(data: RechnungPDFData, JsPDF: any): InstanceType<typeof jsPDF> {
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const mL = 25;
  const mR = 20;
  const contentW = pageWidth - mL - mR;
  let y = 0;
  let pageNum = 1;

  function addPageNumber() {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Seite ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.setTextColor(0);
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 25) {
      addPageNumber();
      doc.addPage();
      pageNum++;
      y = 20;
    }
  }

  // ═══ HEADER ═══
  y = 15;
  if (data.firma?.logoUrl) {
    try {
      doc.addImage(data.firma.logoUrl, "AUTO", pageWidth - mR - 40, 10, 40, 14);
    } catch {
      // Ignore logo errors
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(data.firma?.firmenname || "Rechnung", mL, y);

  if (data.firma) {
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const sub = [
      data.firma.inhaberTitel
        ? `${data.firma.inhaberTitel} ${data.firma.inhaberName}`
        : data.firma.inhaberName,
      `${data.firma.strasse}, ${data.firma.plz} ${data.firma.ort}`,
    ].join(" \u2022 ");
    doc.text(sub, mL, y);
    y += 3.5;
    doc.text(`Tel: ${data.firma.telefon} \u2022 ${data.firma.email}`, mL, y);
  }

  y += 4;
  doc.setDrawColor(200);
  doc.setLineWidth(0.4);
  doc.line(mL, y, pageWidth - mR, y);

  // ═══ ABSENDER-ZEILE ═══
  y += 6;
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.setFont("helvetica", "normal");
  if (data.firma) {
    doc.text(
      `${data.firma.firmenname} \u2022 ${data.firma.strasse} \u2022 ${data.firma.plz} ${data.firma.ort}`,
      mL, y
    );
  }

  // ═══ KUNDENADRESSE ═══
  y += 5;
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(data.kunde.name, mL, y);
  y += 4.5;
  if (data.kunde.strasse) {
    doc.text(data.kunde.strasse, mL, y);
    y += 4.5;
  }
  if (data.kunde.plz || data.kunde.ort) {
    doc.text(`${data.kunde.plz || ""} ${data.kunde.ort || ""}`.trim(), mL, y);
    y += 4.5;
  }

  // ═══ DATUM-BLOCK (rechts) ═══
  const datumBlockY = y - 9;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(`Datum: ${datumDE(data.datum)}`, pageWidth - mR, datumBlockY, { align: "right" });
  doc.text(`Zahlbar bis: ${datumDE(data.faelligAm)}`, pageWidth - mR, datumBlockY + 4, { align: "right" });

  // ═══ BETREFF ═══
  y += 6;
  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Rechnung ${data.nummer}`, mL, y);
  y += 8;

  // ═══ EINLEITUNG ═══
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const intro =
    data.einleitungsText ||
    "Sehr geehrte Damen und Herren,\nhiermit stellen wir Ihnen folgende Leistungen in Rechnung:";
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, mL, y);
  y += introLines.length * 4 + 4;

  // ═══ POSITIONEN-TABELLE (flache Liste) ═══
  const colPos = mL;
  const colBez = mL + 9;
  const colMenge = mL + contentW - 65;
  const colEP = mL + contentW - 35;
  const colGP = mL + contentW;

  doc.setFillColor(240, 240, 240);
  doc.rect(mL, y - 3.5, contentW, 6.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Pos.", colPos + 0.5, y);
  doc.text("Bezeichnung", colBez, y);
  doc.text("Menge", colMenge, y, { align: "right" });
  doc.text("Einzelpreis", colEP, y, { align: "right" });
  doc.text("Gesamtpreis", colGP, y, { align: "right" });
  y += 4.5;

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(mL, y, pageWidth - mR, y);
  y += 3;

  doc.setTextColor(0);

  // Flat list — no grouping
  data.positionen.forEach((p, index) => {
    checkPageBreak(7);
    if (index % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(mL, y - 3, contentW, 5.5, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(String(p.posNr).padStart(2, " "), colPos + 0.5, y);
    doc.setTextColor(30);
    doc.text(p.bezeichnung, colBez, y, { maxWidth: colMenge - colBez - 3 });
    doc.setTextColor(80);
    doc.text(
      `${p.menge % 1 === 0 ? p.menge : p.menge.toFixed(1)} ${p.einheit}`,
      colMenge, y, { align: "right" }
    );
    doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 5;
  });

  // ═══ SUMMENBLOCK (flat: Netto, MwSt, Brutto) ═══
  checkPageBreak(35);
  y += 3;
  const sumX = mL + contentW - 75;

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(sumX, y, pageWidth - mR, y);
  y += 5;

  // Netto
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.setFontSize(9);
  doc.text("Nettobetrag:", sumX, y);
  doc.text(euro(data.netto), colGP, y, { align: "right" });
  y += 4.5;

  // MwSt
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`MwSt. ${data.mwstSatz}%:`, sumX, y);
  doc.text(euro(data.mwstBetrag), colGP, y, { align: "right" });
  y += 4;

  // Brutto
  doc.setDrawColor(30);
  doc.setLineWidth(0.5);
  doc.line(sumX, y, pageWidth - mR, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Bruttobetrag:", sumX, y);
  doc.text(euro(data.brutto), colGP, y, { align: "right" });
  y += 10;

  // ═══ SCHLUSSTEXT ═══
  checkPageBreak(20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  const schluss =
    data.schlussText ||
    `Bitte überweisen Sie den Betrag bis zum ${datumDE(data.faelligAm)} auf das unten genannte Konto.`;
  const schlussLines = doc.splitTextToSize(schluss, contentW);
  doc.text(schlussLines, mL, y);
  y += schlussLines.length * 4 + 6;

  // Unterschrift
  checkPageBreak(15);
  doc.text("Mit freundlichen Grüßen", mL, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(data.firma?.inhaberName || "", mL, y);
  y += 10;

  // ═══ FOOTER ═══
  checkPageBreak(30);
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(mL, y, pageWidth - mR, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);

  const footerLines: string[] = [];
  footerLines.push(`Zahlbar bis: ${datumDE(data.faelligAm)}`);

  if (data.firma?.iban) {
    let bankLine = "Bankverbindung:";
    if (data.firma.bankname) bankLine += ` ${data.firma.bankname}`;
    bankLine += ` | IBAN: ${data.firma.iban}`;
    if (data.firma.bic) bankLine += ` | BIC: ${data.firma.bic}`;
    footerLines.push(bankLine);
  }

  if (data.firma?.steuernummer) {
    let taxLine = `Steuernummer: ${data.firma.steuernummer}`;
    if (data.firma.ustIdNr) taxLine += ` | USt-IdNr: ${data.firma.ustIdNr}`;
    footerLines.push(taxLine);
  }

  for (const line of footerLines) {
    doc.text(line, mL, y, { maxWidth: contentW });
    y += 3.5;
  }

  if (data.firma?.agbText) {
    y += 2;
    const agbLines = doc.splitTextToSize(data.firma.agbText, contentW);
    for (const line of agbLines) {
      checkPageBreak(5);
      doc.text(line, mL, y);
      y += 3;
    }
  }

  addPageNumber();

  return doc;
}

/**
 * Client-side: returns Blob for Rechnung PDF download
 */
export function generateRechnungPDF(data: RechnungPDFData): Blob {
  const doc = buildRechnungPDF(data, jsPDF);
  return doc.output("blob");
}

/**
 * Server-side: returns Buffer for Rechnung PDF email attachments
 */
export function generateRechnungPDFBuffer(data: RechnungPDFData): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jsPDFModule = require("jspdf");
  const JsPDFClass = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;
  const doc = buildRechnungPDF(data, JsPDFClass);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
