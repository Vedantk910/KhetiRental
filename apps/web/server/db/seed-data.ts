// Sample data for Latur and Pune (Maharashtra) and Jaipur (Rajasthan), D-13. Pure and deterministic:
// the same seed gives the same rows; dates are relative to `today` so bookings stay upcoming.
import type { Attachment, Category, PriceUnit, Role, Slot } from "@/lib/domain";
import { addDays } from "../pricing";

/** mulberry32 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedPin {
  pin: string;
  office: string;
  village: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
}

// A hand-made subset in the India Post directory's shape; coordinates are approximate town centres (sample).
const PINS: SeedPin[] = [
  {
    pin: "413512",
    office: "Latur H.O",
    village: "Latur",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.4088,
    lng: 76.5604,
  },
  {
    pin: "413520",
    office: "Ausa S.O",
    village: "Ausa",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.2459,
    lng: 76.4977,
  },
  {
    pin: "413521",
    office: "Nilanga S.O",
    village: "Nilanga",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.1172,
    lng: 76.7506,
  },
  {
    pin: "413517",
    office: "Udgir S.O",
    village: "Udgir",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.3925,
    lng: 77.1167,
  },
  {
    pin: "413527",
    office: "Renapur S.O",
    village: "Renapur",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.5167,
    lng: 76.6,
  },
  {
    pin: "413513",
    office: "Chakur S.O",
    village: "Chakur",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.5122,
    lng: 76.8783,
  },
  {
    pin: "413515",
    office: "Ahmedpur S.O",
    village: "Ahmedpur",
    district: "Latur",
    state: "Maharashtra",
    lat: 18.7,
    lng: 76.9333,
  },
  {
    pin: "413102",
    office: "Baramati S.O",
    village: "Baramati",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.1514,
    lng: 74.5815,
  },
  {
    pin: "413801",
    office: "Daund S.O",
    village: "Daund",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.4637,
    lng: 74.5787,
  },
  {
    pin: "413106",
    office: "Indapur S.O",
    village: "Indapur",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.1167,
    lng: 75.0333,
  },
  {
    pin: "410502",
    office: "Junnar S.O",
    village: "Junnar",
    district: "Pune",
    state: "Maharashtra",
    lat: 19.2,
    lng: 73.8833,
  },
  {
    pin: "412210",
    office: "Shirur S.O",
    village: "Shirur",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.8269,
    lng: 74.3739,
  },
  {
    pin: "412206",
    office: "Bhor S.O",
    village: "Bhor",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.15,
    lng: 73.85,
  },
  {
    pin: "410505",
    office: "Rajgurunagar S.O",
    village: "Rajgurunagar",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.85,
    lng: 73.8833,
  },
  {
    pin: "302029",
    office: "Sanganer S.O",
    village: "Sanganer",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 26.8206,
    lng: 75.7933,
  },
  {
    pin: "303702",
    office: "Chomu S.O",
    village: "Chomu",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 27.1667,
    lng: 75.7167,
  },
  {
    pin: "303301",
    office: "Bassi S.O",
    village: "Bassi",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 26.8333,
    lng: 76.05,
  },
  {
    pin: "303005",
    office: "Phagi S.O",
    village: "Phagi",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 26.5667,
    lng: 75.55,
  },
  {
    pin: "302028",
    office: "Amer S.O",
    village: "Amer",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 26.9855,
    lng: 75.8513,
  },
  {
    pin: "303103",
    office: "Shahpura S.O",
    village: "Shahpura",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 27.3833,
    lng: 75.95,
  },
  {
    pin: "303008",
    office: "Dudu S.O",
    village: "Dudu",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 26.6833,
    lng: 75.2667,
  },
  {
    pin: "303108",
    office: "Kotputli S.O",
    village: "Kotputli",
    district: "Jaipur",
    state: "Rajasthan",
    lat: 27.7,
    lng: 76.2,
  },
];

interface SeedUser {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  roles: Role[];
  district: string | null;
}

const USERS: SeedUser[] = [
  {
    key: "o1",
    name: "Ramesh Patil",
    email: "ramesh@khetirental.test",
    phone: "+919800000001",
    roles: ["owner"],
    district: "Latur",
  },
  {
    key: "o2",
    name: "Sunita Jadhav",
    email: "sunita@khetirental.test",
    phone: "+919800000002",
    roles: ["owner", "renter"],
    district: "Latur",
  },
  {
    key: "o3",
    name: "Vijay Kale",
    email: "vijay@khetirental.test",
    phone: "+919800000003",
    roles: ["owner"],
    district: "Pune",
  },
  {
    key: "o4",
    name: "Anil Shinde",
    email: "anil@khetirental.test",
    phone: "+919800000004",
    roles: ["owner"],
    district: "Pune",
  },
  {
    key: "o5",
    name: "Mahendra Singh",
    email: "mahendra@khetirental.test",
    phone: "+919800000005",
    roles: ["owner"],
    district: "Jaipur",
  },
  {
    key: "o6",
    name: "Kavita Meena",
    email: "kavita@khetirental.test",
    phone: "+919800000006",
    roles: ["owner", "renter"],
    district: "Jaipur",
  },
  {
    key: "r1",
    name: "Sunil Pawar",
    email: "sunil@khetirental.test",
    phone: "+919800000011",
    roles: ["renter"],
    district: "Latur",
  },
  {
    key: "r2",
    name: "Asha More",
    email: "asha@khetirental.test",
    phone: "+919800000012",
    roles: ["renter"],
    district: "Pune",
  },
  {
    key: "r3",
    name: "Gopal Sharma",
    email: "gopal@khetirental.test",
    phone: "+919800000013",
    roles: ["renter"],
    district: "Jaipur",
  },
  {
    key: "r4",
    name: "Lata Deshmukh",
    email: "lata@khetirental.test",
    phone: "+919800000014",
    roles: ["renter"],
    district: "Latur",
  },
  {
    key: "admin",
    name: "Demo Admin",
    email: "admin@khetirental.test",
    phone: null,
    roles: ["admin", "renter", "owner"],
    district: null,
  },
];

interface Kind {
  category: Category;
  makes: [string, string][];
  hp: [number, number] | null;
  attachments: Attachment[][];
  unit: PriceUnit;
  rupees: [number, number];
}

const KINDS: Kind[] = [
  {
    category: "tractor",
    makes: [
      ["Mahindra", "575 DI"],
      ["Swaraj", "744 FE"],
      ["Sonalika", "DI 745"],
      ["John Deere", "5050 D"],
      ["Eicher", "380"],
      ["New Holland", "3630"],
    ],
    hp: [35, 75],
    attachments: [
      ["plough", "cultivator"],
      ["rotavator"],
      ["trolley"],
      ["seed_drill", "cultivator"],
      ["sprayer"],
      ["plough", "rotavator", "trolley"],
    ],
    unit: "hour",
    rupees: [600, 1100],
  },
  {
    category: "rotavator",
    makes: [
      ["Shaktiman", "Regular Plus"],
      ["Fieldking", "Maxx"],
    ],
    hp: null,
    attachments: [[]],
    unit: "acre",
    rupees: [1100, 1700],
  },
  {
    category: "seed_drill",
    makes: [
      ["Dasmesh", "Zero Till"],
      ["Fieldking", "Multi Crop"],
    ],
    hp: null,
    attachments: [[]],
    unit: "acre",
    rupees: [700, 1100],
  },
  {
    category: "sprayer",
    makes: [
      ["Aspee", "Boom 400L"],
      ["Neptune", "HTP Power"],
    ],
    hp: null,
    attachments: [[]],
    unit: "day",
    rupees: [500, 900],
  },
  {
    category: "combine_harvester",
    makes: [
      ["Kartar", "4000"],
      ["Preet", "987"],
    ],
    hp: [90, 110],
    attachments: [[]],
    unit: "acre",
    rupees: [2200, 3000],
  },
  {
    category: "thresher",
    makes: [["Dasmesh", "Multicrop"]],
    hp: null,
    attachments: [[]],
    unit: "hour",
    rupees: [500, 800],
  },
  {
    category: "trolley",
    makes: [["Local", "4-wheel trolley"]],
    hp: null,
    attachments: [[]],
    unit: "day",
    rupees: [800, 1400],
  },
];
// 40 machines: mostly tractors, then implements.
const MIX: number[] = [...Array<number>(22).fill(0), 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6];

interface SeedMachine {
  idx: number;
  owner: string;
  category: Category;
  make: string;
  model: string;
  hp: number | null;
  year: number;
  hourMeter: number;
  lastServiced: string;
  attachments: Attachment[];
  lat: number;
  lng: number;
  village: string;
  pin: string;
  priceUnit: PriceUnit;
  pricePaise: number;
  operatorIncluded: boolean;
  dieselIncluded: boolean;
  rcStatus: "pending" | "checked";
}

interface SeedBooking {
  machineIdx: number;
  renter: string;
  code: string;
  startDate: string;
  endDate: string;
  slot: Slot;
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED";
  stars?: number;
  review?: string;
}

const REVIEWS = [
  "Came on time, good driver.",
  "Machine in good condition.",
  "Did the job well.",
  "Fair price.",
  null,
];

export function buildSeed(today: string, seed = 2026) {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const owners = USERS.filter((u) => u.roles.includes("owner") && u.district);
  const machines: SeedMachine[] = MIX.map((k, idx) => {
    const kind = KINDS[k];
    const owner = owners[idx % owners.length];
    const place = pick(PINS.filter((p) => p.district === owner.district));
    const [make, model] = pick(kind.makes);
    // Parked within ~6 km of the village centre.
    const lat = place.lat + between(-0.05, 0.05);
    const lng = place.lng + between(-0.05, 0.05);
    const hp = kind.hp ? Math.round(between(kind.hp[0], kind.hp[1]) / 5) * 5 : null;
    return {
      idx,
      owner: owner.key,
      category: kind.category,
      make,
      model,
      hp,
      year: 2008 + Math.floor(r() * 17),
      hourMeter: Math.round(between(300, 6000)),
      lastServiced: addDays(today, -Math.floor(between(10, 200))),
      attachments: pick(kind.attachments),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      village: place.village,
      pin: place.pin,
      priceUnit: kind.unit,
      pricePaise: Math.round(between(kind.rupees[0], kind.rupees[1]) / 10) * 10 * 100,
      operatorIncluded: kind.category !== "trolley" ? r() > 0.15 : false,
      dieselIncluded: r() > 0.3,
      rcStatus: r() > 0.3 ? "checked" : "pending",
    };
  });
  const renters = USERS.filter((u) => u.key.startsWith("r"));
  const bookings: SeedBooking[] = [];
  let code = 1000;
  // Past, reviewed jobs: about half the machines have 1–8 reviews.
  for (const m of machines) {
    if (r() < 0.45) continue;
    const n = 1 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const start = addDays(today, -(10 + i * 9 + Math.floor(r() * 5)));
      bookings.push({
        machineIdx: m.idx,
        renter: pick(renters).key,
        code: `KR-${++code}`,
        startDate: start,
        endDate: start,
        slot: pick(["morning", "afternoon", "full"] as const),
        status: "COMPLETED",
        stars: r() < 0.75 ? 5 : r() < 0.6 ? 4 : 3,
        review: pick(REVIEWS) ?? undefined,
      });
    }
  }
  // Upcoming: some requests waiting on owners, some confirmed.
  for (let i = 0; i < 10; i++) {
    const m = machines[(i * 7) % machines.length];
    const start = addDays(today, 2 + i);
    bookings.push({
      machineIdx: m.idx,
      renter: renters[i % renters.length].key,
      code: `KR-${++code}`,
      startDate: start,
      endDate: i % 3 === 0 ? addDays(start, 1) : start,
      slot: i % 2 ? "morning" : "full",
      status: i % 2 ? "REQUESTED" : "CONFIRMED",
    });
  }
  const blocks = machines
    .filter((_, i) => i % 6 === 0)
    .map((m, i) => ({ machineIdx: m.idx, day: addDays(today, 15 + i) }));
  return { pins: PINS, users: USERS, machines, bookings, blocks };
}
