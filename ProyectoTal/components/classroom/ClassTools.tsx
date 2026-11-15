"use client";

import { useState } from "react";

/** Print button for the worksheet (the rest of the page hides itself when printing). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="ge-pill print:hidden">
      Imprimir la hoja de trabajo
    </button>
  );
}

/** Shows the answers of the worksheet for the teacher. */
export function AnswerKey({ answers }: { answers: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="print:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="ge-link text-sm">
        {open ? "Ocultar respuestas" : "Ver respuestas (para el docente)"}
      </button>
      {open && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink/85">
          {answers.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
