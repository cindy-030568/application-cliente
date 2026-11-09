import { exigerCliente } from "@/lib/auth";
import { BarreOnglets } from "./barre-onglets";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  await exigerCliente();
  return (
    <>
      <div className="pb-onglets mx-auto min-h-dvh w-full max-w-lg">{children}</div>
      <BarreOnglets />
    </>
  );
}
