"use client";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-cyan-300 px-5 py-2.5 font-semibold text-slate-950 print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
