import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// A4 portrait, mm. Pages are rendered at PAGE_PX css pixels wide and
// scaled to the full sheet width; each page section carries its own
// padding so no extra margin is added here.
const A4_W = 210;
const A4_H = 297;
export const PAGE_PX = 794;

export type PdfProgress = { page: number; total: number };

/**
 * Renders every `[data-pdf-page]` section inside `root` to its own PDF
 * page (splitting oversize sections across sheets), stamps ASCII page
 * numbers, and triggers the browser download.
 */
export async function exportPacketAsPdf(
  root: HTMLElement,
  filename: string,
  onProgress?: (p: PdfProgress) => void,
): Promise<void> {
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>("[data-pdf-page]"),
  );
  if (sections.length === 0) throw new Error("Nothing to export");

  await document.fonts.ready;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let first = true;

  for (let i = 0; i < sections.length; i++) {
    onProgress?.({ page: i + 1, total: sections.length });
    const section = sections[i];
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#FFFFFF",
      width: PAGE_PX,
      windowWidth: PAGE_PX,
    });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    const imgH = (canvas.height * A4_W) / canvas.width;

    let offset = 0;
    while (offset < imgH - 0.5) {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(img, "JPEG", 0, -offset, A4_W, imgH, undefined, "FAST");
      offset += A4_H;
    }
    // yield so the progress UI can paint between heavy captures
    await new Promise((r) => setTimeout(r, 0));
  }

  const total = pdf.getNumberOfPages();
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.text(`${p} / ${total}`, A4_W - 10, A4_H - 6, { align: "right" });
  }

  pdf.save(filename);
}

/** Filesystem-safe filename from a project name (Georgian falls back to "kitchen"). */
export function pdfFilename(projectName: string): string {
  const ascii = projectName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `aewyo-${ascii || "kitchen"}-${date}.pdf`;
}
