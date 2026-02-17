import { Header } from "@/components/dashboard/header";

export default function TextvorlagenPage() {
  return (
    <>
      <Header
        title="Textvorlagen"
        description="Angebotstexte, Follow-up E-Mails, Bewertungsanfragen"
      />
      <div className="p-8">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Textvorlagen — wird in Phase 2 gebaut
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Vorlagen mit Variablen wie &#123;KUNDE&#125;, &#123;FIRMA&#125;, &#123;BRUTTO&#125; etc.
          </p>
        </div>
      </div>
    </>
  );
}
