import { useEffect, useState } from "react";
import { Unlock, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (modelId: string) => void;
}

const PRESETS: { id: string; label: string; hint: string }[] = [
  {
    id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    label: "Dolphin Mistral 24B (Venice)",
    hint: "Free · uncensored · OpenRouter",
  },
  {
    id: "cognitivecomputations/dolphin3.0-mistral-24b:free",
    label: "Dolphin 3.0 Mistral 24B",
    hint: "Free · uncensored · OpenRouter",
  },
  {
    id: "neversleep/llama-3.1-lumimaid-8b",
    label: "Lumimaid 8B",
    hint: "Pago · roleplay / sem filtros",
  },
];

export function UncensoredModal({ open, onClose, onConfirm }: Props) {
  const saved =
    (typeof window !== "undefined" && localStorage.getItem("jarvis_uncensored_model")) || PRESETS[0].id;
  const [model, setModel] = useState(saved);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open) setModel(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const finalModel = custom.trim() || model;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
              <Unlock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">A IA padrão não pôde ajudar</h2>
              <p className="text-[11px] text-muted-foreground">
                Detectamos uma recusa. Ative uma IA uncensored para continuar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Modelos sugeridos
            </label>
            <div className="space-y-1.5">
              {PRESETS.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-2 hover:border-primary/40"
                >
                  <input
                    type="radio"
                    name="uncmodel"
                    checked={model === p.id && !custom.trim()}
                    onChange={() => {
                      setModel(p.id);
                      setCustom("");
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{p.label}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{p.id}</div>
                    <div className="text-[10px] text-muted-foreground">{p.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Ou digite um modelo customizado
            </label>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="vendor/model-id"
              className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.setItem("jarvis_uncensored_model", finalModel);
              }
              onConfirm(finalModel);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
          >
            <Unlock className="h-3 w-3" />
            Ativar e reenviar
          </button>
        </div>
      </div>
    </div>
  );
}
