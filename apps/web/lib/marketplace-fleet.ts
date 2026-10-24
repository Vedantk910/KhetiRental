// Demo fleet: the pricing inputs for every machine the matching API serves
// (lib/h3-dispatch DEMO_FLEET), keyed by the same id, so anything search finds
// can be priced and booked. Makes, owners and villages are invented for the
// demo; asset values follow showcase/contracts/escrow-state-machine.md §5.
import { DEMO_FLEET } from "./h3-dispatch";
import { nearestVillage } from "./marketplace-places";
import type { HpTier, Soil } from "./pricing-engine";

export interface FleetMachine {
  id: string;
  label: string;
  owner: string;
  village: string;
  hp: HpTier;
  ageYears: number;
  acquisitionCostInr: number;
  soil: Soil;
  rating: number; // 0-5, demo value
}

const TIER_BY_HP: Record<number, HpTier> = { 35: "35", 45: "45", 55: "55", 75: "75_4wd" };
export const tierFromHp = (hp: number): HpTier | undefined => TIER_BY_HP[hp];

const MAKES: Record<HpTier, string[]> = {
  "35": ["Mahindra 275 DI", "Swaraj 735 FE", "Eicher 380"],
  "45": ["Swaraj 744 FE", "John Deere 5050 D", "Kubota MU4501"],
  "55": ["New Holland 3630", "Mahindra Arjun 555", "Sonalika DI 750"],
  "75_4wd": ["Sonalika Tiger 75", "John Deere 5075E 4WD", "New Holland 7510"],
};
const ASSET_VALUE: Record<HpTier, number> = {
  "35": 390_000,
  "45": 640_000,
  "55": 980_000,
  "75_4wd": 1_720_000,
};
const OWNERS = [
  "Ramesh Meena",
  "Sunita Choudhary",
  "Mahesh Saini",
  "Kavita Sharma",
  "Bhanwar Lal Jat",
  "Pooja Yadav",
  "Gopal Gurjar",
  "Anita Kumawat",
];
const SOILS: Soil[] = ["loam", "sandy", "loam", "black_cotton"];

export const FLEET: Record<string, FleetMachine> = Object.fromEntries(
  DEMO_FLEET.map((d, i): [string, FleetMachine] => {
    const hp = tierFromHp(d.hp);
    if (!hp) throw new Error(`no HP tier for ${d.id}`);
    return [
      d.id,
      {
        id: d.id,
        label: MAKES[hp][i % 3],
        owner: OWNERS[i % OWNERS.length],
        village: nearestVillage(d).name,
        hp,
        ageYears: (i * 7) % 11,
        acquisitionCostInr: ASSET_VALUE[hp],
        soil: SOILS[i % SOILS.length],
        rating: Math.round(d.reputation * 50) / 10,
      },
    ];
  }),
);

export const fleetMachine = (id: string): FleetMachine | undefined =>
  Object.prototype.hasOwnProperty.call(FLEET, id) ? FLEET[id] : undefined;

export const HP_LABEL: Record<HpTier, string> = {
  "35": "35 HP",
  "45": "45 HP",
  "55": "55 HP",
  "75_4wd": "75 HP 4WD",
};
