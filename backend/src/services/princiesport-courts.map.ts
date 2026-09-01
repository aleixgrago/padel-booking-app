/**
 * Mapeo entre nuestro modelo de pistas (1-5) y los códigos internos que usa
 * la web de PrinciSport, confirmado con dos capturas .har reales (incluyendo
 * el proceso completo de login + reserva + confirmación de la Pista 5):
 *
 *  - Código de deporte "03" = pestaña "PADEL 1,2,3 i 4" (pistas 1-4, franjas de 1h30)
 *  - Código de deporte "02" = pestaña "PADEL 5 i 6" (pista 5/6, franjas de 1h15)
 *  - Cada pista es un <option> con un valor: 11=P1, 12=P2, 13=P3, 14=P4, 15=P5, 16=P6
 */
export const PRINCISPORT_COURT_MAP: Record<
  number,
  { sportCode: string; courtOptionValue: string; label: string }
> = {
  1: { sportCode: "03", courtOptionValue: "11", label: "P1" },
  2: { sportCode: "03", courtOptionValue: "12", label: "P2 PRINCIESPORT" },
  3: { sportCode: "03", courtOptionValue: "13", label: "P3 ESTRELL DAMM" },
  4: { sportCode: "03", courtOptionValue: "14", label: "P4" },
  5: { sportCode: "02", courtOptionValue: "15", label: "P5" },
};

export function getPrinciSportCourt(courtId: number) {
  const entry = PRINCISPORT_COURT_MAP[courtId];
  if (!entry) throw new Error(`No hay mapeo de PrinciSport para la pista ${courtId}`);
  return entry;
}
