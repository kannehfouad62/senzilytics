"use client";
import { Printer } from "lucide-react";
export function PrintAuditReportButton() { return <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 print:hidden"><Printer size={16}/> Print report</button>; }
