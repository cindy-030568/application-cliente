import type { Metadata } from "next";
import { IconeVideo } from "@/components/icones";
import { Surtitre } from "@/components/ui";
import { PagePlan } from "../page-plan";

export const metadata: Metadata = { title: "Sport" };

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  return (
    <>
      <PagePlan type="sport" version={version} />
      <section id="videos" className="mx-5 mt-8 flex scroll-mt-6 flex-col gap-3">
        <Surtitre>Vidéos d’exercices</Surtitre>
        <div className="flex items-center gap-4 rounded-carte border border-dashed border-caramel-clair bg-blanc-casse/60 p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-pale">
            <IconeVideo className="size-6" />
          </span>
          <p className="text-[14px] text-texte-2">
            La bibliothèque de vidéos d’exercices arrive bientôt, avec les points techniques à
            retenir.
          </p>
        </div>
      </section>
    </>
  );
}
