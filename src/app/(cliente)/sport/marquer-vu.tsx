"use client";

import { useEffect } from "react";
import { marquerProgrammeVu } from "@/app/programme-actions";

export function MarquerProgrammeVu({ programmeId }: { programmeId: string }) {
  useEffect(() => {
    void marquerProgrammeVu(programmeId);
  }, [programmeId]);
  return null;
}
