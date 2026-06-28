import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/panel/AppShell";
import { PanelProvider } from "@/components/panel/PanelContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de IA Autônomo" },
      { name: "description", content: "Orquestre agentes de IA com terminal de pensamento em tempo real." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PanelProvider>
      <AppShell />
    </PanelProvider>
  );
}
