"use client";

import { Printer } from "lucide-react";

export function PrintManagementReviewButton(){return <button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-300 print:hidden"><Printer size={16}/>Print review record</button>}
