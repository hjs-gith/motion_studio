import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
import type { DeckSpec } from "../spec";

/** Assembles slide PNG stills into a PDF, one page per slide. */
export async function exportPdf(deck: DeckSpec, stills: string[], output: string): Promise<string> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(deck.title);
  if (deck.author) pdf.setAuthor(deck.author);
  pdf.setCreator("motion-studio");
  // 16:9 at 13.333in x 7.5in = 960 x 540 pt.
  const pageW = 960;
  const pageH = (pageW * deck.format.height) / deck.format.width;
  for (const file of stills) {
    const img = await pdf.embedPng(readFileSync(file));
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  }
  writeFileSync(output, await pdf.save());
  return output;
}
