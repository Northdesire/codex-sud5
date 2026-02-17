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
  } | null;
  positionen: PDFPosition[];
  raeume?: Array<{
    name: string;
    wandflaeche: number;
    deckenflaeche: number;
    gesamtflaeche: number;
  }>;
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
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " \u20AC";
}

function datumDE(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE");
}

export function generateAngebotPDF(data: PDFData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginL = 20;
  const marginR = 20;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  // --- FIRMEN-HEADER ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.firma?.firmenname || "Angebot", marginL, y);
  y += 6;

  if (data.firma) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const firmaZeile = `${data.firma.inhaberTitel ? data.firma.inhaberTitel + " " : ""}${data.firma.inhaberName} | ${data.firma.strasse} | ${data.firma.plz} ${data.firma.ort}`;
    doc.text(firmaZeile, marginL, y);
    y += 4;
    doc.text(
      `Tel: ${data.firma.telefon} | E-Mail: ${data.firma.email}`,
      marginL,
      y
    );
    y += 2;
  }

  // Trennlinie
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  y += 3;
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 8;

  // --- KUNDENADRESSE ---
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.kunde.name, marginL, y);
  y += 5;
  if (data.kunde.strasse) {
    doc.text(data.kunde.strasse, marginL, y);
    y += 5;
  }
  if (data.kunde.plz || data.kunde.ort) {
    doc.text(`${data.kunde.plz || ""} ${data.kunde.ort || ""}`.trim(), marginL, y);
    y += 5;
  }
  y += 3;

  // --- ANGEBOT-META ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Angebot ${data.nummer}`, marginL, y);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Datum: ${datumDE(data.datum)}`, pageWidth - marginR, y - 4, {
    align: "right",
  });
  doc.text(
    `Gültig bis: ${datumDE(data.gueltigBis)}`,
    pageWidth - marginR,
    y + 1,
    { align: "right" }
  );
  doc.setTextColor(0);
  y += 8;

  // Einleitung
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:",
    marginL,
    y,
    { maxWidth: contentWidth }
  );
  y += 10;

  // --- POSITIONEN-TABELLE ---
  const colPos = marginL;
  const colBez = marginL + 10;
  const colMenge = marginL + contentWidth - 70;
  const colEP = marginL + contentWidth - 40;
  const colGP = marginL + contentWidth;

  // Tabellenkopf
  doc.setFillColor(245, 245, 245);
  doc.rect(marginL, y - 4, contentWidth, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Pos.", colPos, y);
  doc.text("Bezeichnung", colBez, y);
  doc.text("Menge", colMenge, y, { align: "right" });
  doc.text("EP", colEP, y, { align: "right" });
  doc.text("GP", colGP, y, { align: "right" });
  y += 5;

  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 4;

  // Positionen
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const leistungen = data.positionen.filter((p) => p.typ === "LEISTUNG");
  const materialien = data.positionen.filter((p) => p.typ === "MATERIAL");
  const anfahrtPos = data.positionen.find((p) => p.typ === "ANFAHRT");

  function checkPageBreak(needed: number) {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  }

  // Leistungen
  if (leistungen.length > 0) {
    checkPageBreak(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Arbeitsleistungen", marginL, y);
    doc.setFont("helvetica", "normal");
    y += 5;

    for (const p of leistungen) {
      checkPageBreak(7);
      doc.text(String(p.posNr), colPos, y);
      doc.text(p.bezeichnung, colBez, y, {
        maxWidth: colMenge - colBez - 5,
      });
      doc.text(
        `${p.menge.toFixed(1)} ${p.einheit}`,
        colMenge,
        y,
        { align: "right" }
      );
      doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
      doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
      y += 6;
    }
    y += 2;
  }

  // Material
  if (materialien.length > 0) {
    checkPageBreak(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Material", marginL, y);
    doc.setFont("helvetica", "normal");
    y += 5;

    for (const p of materialien) {
      checkPageBreak(7);
      doc.text(String(p.posNr), colPos, y);
      doc.text(p.bezeichnung, colBez, y, {
        maxWidth: colMenge - colBez - 5,
      });
      doc.text(
        `${p.menge} ${p.einheit}`,
        colMenge,
        y,
        { align: "right" }
      );
      doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
      doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
      y += 6;
    }
    y += 2;
  }

  // Anfahrt
  if (anfahrtPos) {
    checkPageBreak(7);
    doc.text(String(anfahrtPos.posNr), colPos, y);
    doc.text("Anfahrtspauschale", colBez, y);
    doc.text(euro(anfahrtPos.gesamtpreis), colGP, y, { align: "right" });
    y += 6;
  }

  // --- SUMMENBLOCK ---
  checkPageBreak(40);
  y += 2;
  doc.setLineWidth(0.5);
  doc.line(marginL + contentWidth - 80, y, pageWidth - marginR, y);
  y += 6;

  const sumX = marginL + contentWidth - 80;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Arbeitsleistungen:", sumX, y);
  doc.text(euro(data.arbeitsNetto), colGP, y, { align: "right" });
  y += 5;

  doc.text("Material:", sumX, y);
  doc.text(euro(data.materialNetto), colGP, y, { align: "right" });
  y += 5;

  doc.text("Anfahrt:", sumX, y);
  doc.text(euro(data.anfahrt), colGP, y, { align: "right" });
  y += 5;

  doc.setLineWidth(0.3);
  doc.line(sumX, y, pageWidth - marginR, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Nettobetrag:", sumX, y);
  doc.text(euro(data.netto), colGP, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text(`MwSt. ${data.mwstSatz}%:`, sumX, y);
  doc.text(euro(data.mwstBetrag), colGP, y, { align: "right" });
  y += 5;

  doc.setLineWidth(0.5);
  doc.line(sumX, y, pageWidth - marginR, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bruttobetrag:", sumX, y);
  doc.text(euro(data.brutto), colGP, y, { align: "right" });
  y += 10;

  // --- FOOTER ---
  checkPageBreak(25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);

  doc.text(
    `Zahlungsziel: ${data.firma?.zahlungsziel || 14} Tage nach Rechnungsstellung`,
    marginL,
    y
  );
  y += 5;

  if (data.firma?.iban) {
    doc.text(
      `Bankverbindung: ${data.firma.bankname || ""} | IBAN: ${data.firma.iban}${data.firma.bic ? ` | BIC: ${data.firma.bic}` : ""}`,
      marginL,
      y,
      { maxWidth: contentWidth }
    );
  }

  return doc.output("blob");
}

/**
 * Server-side: returns ArrayBuffer (for email attachments)
 */
export function generateAngebotPDFBuffer(data: PDFData): Buffer {
  // Re-use the same logic but output as arraybuffer
  const doc = buildPDFDoc(data);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// Extract shared PDF logic
function buildPDFDoc(data: PDFData) {
  const jsPDFModule = require("jspdf");
  const jsPDFClass = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;
  const doc = new jsPDFClass({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginL = 20;
  const marginR = 20;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.firma?.firmenname || "Angebot", marginL, y);
  y += 6;

  if (data.firma) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const firmaZeile = `${data.firma.inhaberTitel ? data.firma.inhaberTitel + " " : ""}${data.firma.inhaberName} | ${data.firma.strasse} | ${data.firma.plz} ${data.firma.ort}`;
    doc.text(firmaZeile, marginL, y);
    y += 4;
    doc.text(`Tel: ${data.firma.telefon} | E-Mail: ${data.firma.email}`, marginL, y);
    y += 2;
  }

  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  y += 3;
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 8;

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.kunde.name, marginL, y);
  y += 5;
  if (data.kunde.strasse) { doc.text(data.kunde.strasse, marginL, y); y += 5; }
  if (data.kunde.plz || data.kunde.ort) {
    doc.text(`${data.kunde.plz || ""} ${data.kunde.ort || ""}`.trim(), marginL, y);
    y += 5;
  }
  y += 3;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Angebot ${data.nummer}`, marginL, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Datum: ${datumDE(data.datum)}`, pageWidth - marginR, y - 4, { align: "right" });
  doc.text(`Gültig bis: ${datumDE(data.gueltigBis)}`, pageWidth - marginR, y + 1, { align: "right" });
  doc.setTextColor(0);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:", marginL, y, { maxWidth: contentWidth });
  y += 10;

  const colPos = marginL;
  const colBez = marginL + 10;
  const colMenge = marginL + contentWidth - 70;
  const colEP = marginL + contentWidth - 40;
  const colGP = marginL + contentWidth;

  doc.setFillColor(245, 245, 245);
  doc.rect(marginL, y - 4, contentWidth, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Pos.", colPos, y);
  doc.text("Bezeichnung", colBez, y);
  doc.text("Menge", colMenge, y, { align: "right" });
  doc.text("EP", colEP, y, { align: "right" });
  doc.text("GP", colGP, y, { align: "right" });
  y += 5;
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const leistungen = data.positionen.filter((p) => p.typ === "LEISTUNG");
  const materialien = data.positionen.filter((p) => p.typ === "MATERIAL");
  const anfahrtPos = data.positionen.find((p) => p.typ === "ANFAHRT");

  function checkPageBreak(needed: number) {
    if (y + needed > 270) { doc.addPage(); y = 20; }
  }

  if (leistungen.length > 0) {
    checkPageBreak(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Arbeitsleistungen", marginL, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    for (const p of leistungen) {
      checkPageBreak(7);
      doc.text(String(p.posNr), colPos, y);
      doc.text(p.bezeichnung, colBez, y, { maxWidth: colMenge - colBez - 5 });
      doc.text(`${p.menge.toFixed(1)} ${p.einheit}`, colMenge, y, { align: "right" });
      doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
      doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
      y += 6;
    }
    y += 2;
  }

  if (materialien.length > 0) {
    checkPageBreak(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Material", marginL, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    for (const p of materialien) {
      checkPageBreak(7);
      doc.text(String(p.posNr), colPos, y);
      doc.text(p.bezeichnung, colBez, y, { maxWidth: colMenge - colBez - 5 });
      doc.text(`${p.menge} ${p.einheit}`, colMenge, y, { align: "right" });
      doc.text(euro(p.einzelpreis), colEP, y, { align: "right" });
      doc.text(euro(p.gesamtpreis), colGP, y, { align: "right" });
      y += 6;
    }
    y += 2;
  }

  if (anfahrtPos) {
    checkPageBreak(7);
    doc.text(String(anfahrtPos.posNr), colPos, y);
    doc.text("Anfahrtspauschale", colBez, y);
    doc.text(euro(anfahrtPos.gesamtpreis), colGP, y, { align: "right" });
    y += 6;
  }

  checkPageBreak(40);
  y += 2;
  doc.setLineWidth(0.5);
  doc.line(marginL + contentWidth - 80, y, pageWidth - marginR, y);
  y += 6;

  const sumX = marginL + contentWidth - 80;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Arbeitsleistungen:", sumX, y);
  doc.text(euro(data.arbeitsNetto), colGP, y, { align: "right" }); y += 5;
  doc.text("Material:", sumX, y);
  doc.text(euro(data.materialNetto), colGP, y, { align: "right" }); y += 5;
  doc.text("Anfahrt:", sumX, y);
  doc.text(euro(data.anfahrt), colGP, y, { align: "right" }); y += 5;
  doc.setLineWidth(0.3);
  doc.line(sumX, y, pageWidth - marginR, y); y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Nettobetrag:", sumX, y);
  doc.text(euro(data.netto), colGP, y, { align: "right" }); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`MwSt. ${data.mwstSatz}%:`, sumX, y);
  doc.text(euro(data.mwstBetrag), colGP, y, { align: "right" }); y += 5;
  doc.setLineWidth(0.5);
  doc.line(sumX, y, pageWidth - marginR, y); y += 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bruttobetrag:", sumX, y);
  doc.text(euro(data.brutto), colGP, y, { align: "right" }); y += 10;

  checkPageBreak(25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Zahlungsziel: ${data.firma?.zahlungsziel || 14} Tage nach Rechnungsstellung`, marginL, y);
  y += 5;
  if (data.firma?.iban) {
    doc.text(
      `Bankverbindung: ${data.firma.bankname || ""} | IBAN: ${data.firma.iban}${data.firma.bic ? ` | BIC: ${data.firma.bic}` : ""}`,
      marginL, y, { maxWidth: contentWidth }
    );
  }

  return doc;
}
