import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXCLUSIONS, TABLES_SAUVEGARDEES, tablesCreees } from "./sauvegarde";

const DOSSIER = path.resolve(__dirname, "../../supabase/migrations");
const toutes = [...new Set(readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).flatMap((f) => tablesCreees(readFileSync(path.join(DOSSIER, f), "utf8"))))];

describe("sauvegarde de la coach", () => {
  it("lit bien les tables d'un fichier SQL", () => {
    expect(tablesCreees("create table public.a (id int);\n-- create table public.oubliee\ncreate table if not exists b (x int);")).toEqual(["a", "b"]);
  });
  it("chaque table des migrations est sauvegardée ou exclue volontairement", () => {
    const sauvegardees = new Set<string>(TABLES_SAUVEGARDEES);
    const oubliees = toutes.filter((t) => !sauvegardees.has(t) && !(t in EXCLUSIONS));
    expect(oubliees, `Ajoute ces tables à src/lib/sauvegarde.ts : ${oubliees.join(", ")}`).toEqual([]);
  });
  it("pas de table inconnue, en double, ou à la fois sauvegardée et exclue", () => {
    expect(TABLES_SAUVEGARDEES.filter((t) => !toutes.includes(t))).toEqual([]);
    expect(Object.keys(EXCLUSIONS).filter((t) => !toutes.includes(t))).toEqual([]);
    expect(new Set(TABLES_SAUVEGARDEES).size).toBe(TABLES_SAUVEGARDEES.length);
    expect(TABLES_SAUVEGARDEES.filter((t) => t in EXCLUSIONS)).toEqual([]);
  });
});
