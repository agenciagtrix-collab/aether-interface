import { createFileRoute } from "@tanstack/react-router";
import { IdeShell } from "@/components/ide/IdeShell";
import { PanelProvider } from "@/components/panel/PanelContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IDE de IA Autônoma" },
      { name: "description", content: "IDE estilo VSCode com chat de IA integrado: abra pastas locais, edite arquivos e converse com o modelo sobre o código." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PanelProvider>
      <IdeShell />
    </PanelProvider>
  );
}
