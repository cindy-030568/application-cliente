import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, IconeVideo } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { Surtitre } from "@/components/ui";
import { PagePlan } from "../page-plan";

export const metadata: Metadata = { title: "Sport" };

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  const { supabase } = await exigerCliente();
  const { count } = await supabase.from("videos").select("id", { count: "exact", head: true });
  const nbVideos = count ?? 0;
  return (
    <>
      <PagePlan type="sport" version={version} />
      <section id="videos" className="mx-5 mt-8 flex scroll-mt-6 flex-col gap-3">
        <Surtitre>Vidéos d’exercices</Surtitre>
        <Link
          href="/sport/videos"
          className="flex items-center gap-4 rounded-carte bg-chocolat p-5 text-creme transition-transform active:scale-[0.98]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-carte-sombre text-caramel-clair">
            <IconeVideo className="size-6" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-titre text-lg font-bold">La bibliothèque</span>
            <span className="text-[14px] text-texte-clair">
              {nbVideos > 0
                ? `${nbVideos} exercice${nbVideos > 1 ? "s" : ""} expliqué${nbVideos > 1 ? "s" : ""} en vidéo`
                : "Bientôt disponible"}
            </span>
          </span>
          <IconeFleche className="size-5 shrink-0" />
        </Link>
      </section>
    </>
  );
}
