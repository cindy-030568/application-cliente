import type { Metadata } from "next";
import { PagePlan } from "../page-plan";

export const metadata: Metadata = { title: "Nutrition" };

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  return <PagePlan type="nutrition" version={version} />;
}
