"use client";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        <p className="mt-1 text-sm text-stone-600">{description}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
