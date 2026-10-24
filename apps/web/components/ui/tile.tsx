import type { ComponentProps } from "react";
import { ChipGroup } from "./chip-group";

/** Picture choice (UI-SPEC §5.4): a 3-per-row radiogroup of pictogram tiles. */
export function TileGroup(
  props: Omit<Extract<ComponentProps<typeof ChipGroup>, { multiple?: false }>, "variant">,
) {
  return <ChipGroup {...props} variant="tile" />;
}
