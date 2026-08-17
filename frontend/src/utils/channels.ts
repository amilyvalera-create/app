// Channel / customer view config per role. Each channel exposes only its own
// selling price keys (+ BF Goodrich). Channels are NEVER mixed.
export type Channel = { id: string; label: string; keys: string[] };

const CARACAS = ["CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"];
const TCC = ["TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"];
const PANOFRE = ["PANOFRE_BS", "PANOFRE_CASH"];
const OSUR = ["ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"];
const ONORTE = ["ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"];
const BF = ["BF_GOODRICH"];
const ALL = [...CARACAS, ...OSUR, ...ONORTE, ...PANOFRE, "OTROS_CASH", "OTROS_ZELLE", ...TCC, ...BF];

const C = (id: string, label: string, keys: string[]): Channel => ({ id, label, keys: [...keys, ...BF] });

export function channelsForRole(role: string): Channel[] {
  switch (role) {
    case "caracas_tirescenter":
      return [C("caracas", "Caracas", CARACAS), C("tires", "Tires Center", TCC)];
    case "caracas_panofre":
      return [C("caracas", "Caracas", CARACAS), C("panofre", "Panofre", PANOFRE)];
    case "caracas":
      return [C("caracas", "Caracas", CARACAS)];
    case "oriente_sur":
      return [C("osur", "Oriente Sur", OSUR)];
    case "oriente_norte":
      return [C("onorte", "Oriente Norte", ONORTE)];
    case "master":
      return [
        { id: "all", label: "Todos", keys: ALL },
        C("caracas", "Caracas", CARACAS),
        C("tires", "Tires Center", TCC),
        C("panofre", "Panofre", PANOFRE),
        C("osur", "Oriente Sur", OSUR),
        C("onorte", "Oriente Norte", ONORTE),
      ];
    default:
      return [{ id: "all", label: "Todos", keys: ALL }];
  }
}
