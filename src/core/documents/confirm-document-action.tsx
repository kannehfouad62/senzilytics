"use client";

import {
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

type ConfirmDocumentActionProps = {
  title: string;
  description: string;
  confirmLabel: string;
  buttonLabel: string;
  buttonClassName: string;
  icon: React.ReactNode;
};

export function ConfirmDocumentAction({
  title,
  description,
  confirmLabel,
  buttonLabel,
  buttonClassName,
  icon,
}: ConfirmDocumentActionProps) {
  const dialogRef =
    useRef<HTMLDialogElement>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (isSubmitting) {
      return;
    }

    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={buttonClassName}
      >
        {icon}
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-0 text-white shadow-2xl backdrop:bg-slate-950/85 backdrop:backdrop-blur-sm"
        onCancel={(event) => {
          if (isSubmitting) {
            event.preventDefault();
          }
        }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-orange-400/10 p-3 text-orange-300">
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  {title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              aria-label="Close confirmation"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              onClick={() =>
                setIsSubmitting(true)
              }
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-red-300 disabled:opacity-60"
            >
              {isSubmitting && (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              )}

              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}