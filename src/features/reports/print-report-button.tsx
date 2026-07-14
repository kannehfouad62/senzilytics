"use client";

import {
  Printer,
} from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 print:hidden"
    >
      <Printer size={17} />
      Print Report
    </button>
  );
}