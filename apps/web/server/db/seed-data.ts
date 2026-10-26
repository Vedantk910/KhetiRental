// Sample data for Maharashtra (Latur, Pune, Nashik, Satara, Kolhapur, Solapur, Chhatrapati Sambhajinagar,
// Nagpur, Jalgaon) and Jaipur (Rajasthan), D-13. Pure and deterministic: the same seed gives the same rows;
// dates are relative to `today` so bookings stay upcoming.
import {
  JOB_MACHINES,
  JOBS,
  type Attachment,
  type BookingStatus,
  type Category,
  type Job,
  type PriceUnit,
  type Role,
  type Slot,
} from "@/lib/domain";
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
    pin: "422001",
    office: "Nashik H.O",
    village: "Nashik",
    district: "Nashik",
    state: "Maharashtra",
    lat: 19.9975,
    lng: 73.7898,
  },
  {
    pin: "422103",
    office: "Sinnar S.O",
    village: "Sinnar",
    district: "Nashik",
    state: "Maharashtra",
    lat: 19.8469,
    lng: 74.0007,
  },
  {
    pin: "415001",
    office: "Satara H.O",
    village: "Satara",
    district: "Satara",
    state: "Maharashtra",
    lat: 17.6805,
    lng: 74.0183,
  },
  {
    pin: "415110",
    office: "Karad S.O",
    village: "Karad",
    district: "Satara",
    state: "Maharashtra",
    lat: 17.2894,
    lng: 74.1815,
  },
  {
    pin: "416001",
    office: "Kolhapur H.O",
    village: "Kolhapur",
    district: "Kolhapur",
    state: "Maharashtra",
    lat: 16.705,
    lng: 74.2433,
  },
  {
    pin: "416115",
    office: "Ichalkaranji S.O",
    village: "Ichalkaranji",
    district: "Kolhapur",
    state: "Maharashtra",
    lat: 16.691,
    lng: 74.4605,
  },
  {
    pin: "413001",
    office: "Solapur H.O",
    village: "Solapur",
    district: "Solapur",
    state: "Maharashtra",
    lat: 17.6599,
    lng: 75.9064,
  },
  {
    pin: "413304",
    office: "Pandharpur S.O",
    village: "Pandharpur",
    district: "Solapur",
    state: "Maharashtra",
    lat: 17.6792,
    lng: 75.3319,
  },
  {
    pin: "431001",
    office: "Chhatrapati Sambhajinagar H.O",
    village: "Chhatrapati Sambhajinagar",
    district: "Chhatrapati Sambhajinagar",
    state: "Maharashtra",
    lat: 19.8762,
    lng: 75.3433,
  },
  {
    pin: "431107",
    office: "Paithan S.O",
    village: "Paithan",
    district: "Chhatrapati Sambhajinagar",
    state: "Maharashtra",
    lat: 19.4767,
    lng: 75.3833,
  },
  {
    pin: "440001",
    office: "Nagpur H.O",
    village: "Nagpur",
    district: "Nagpur",
    state: "Maharashtra",
    lat: 21.1458,
    lng: 79.0882,
  },
  {
    pin: "441302",
    office: "Katol S.O",
    village: "Katol",
    district: "Nagpur",
    state: "Maharashtra",
    lat: 21.2711,
    lng: 78.5833,
  },
  {
    pin: "425001",
    office: "Jalgaon H.O",
    village: "Jalgaon",
    district: "Jalgaon",
    state: "Maharashtra",
    lat: 21.0077,
    lng: 75.5626,
  },
  {
    pin: "425201",
    office: "Bhusawal S.O",
    village: "Bhusawal",
    district: "Jalgaon",
    state: "Maharashtra",
    lat: 21.0446,
    lng: 75.785,
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

/** Owners and renters for the other districts. The generated machines and bookings below use USERS only. */
const MORE_USERS: SeedUser[] = [
  {
    key: "o7",
    name: "Dnyaneshwar Gaikwad",
    email: "dnyaneshwar@khetirental.test",
    phone: "+919800000007",
    roles: ["owner"],
    district: "Nashik",
  },
  {
    key: "o8",
    name: "Savita Bhosale",
    email: "savita@khetirental.test",
    phone: "+919800000008",
    roles: ["owner"],
    district: "Satara",
  },
  {
    key: "o9",
    name: "Prakash Chavan",
    email: "prakash@khetirental.test",
    phone: "+919800000009",
    roles: ["owner"],
    district: "Kolhapur",
  },
  {
    key: "o10",
    name: "Rekha Waghmare",
    email: "rekha@khetirental.test",
    phone: "+919800000010",
    roles: ["owner", "renter"],
    district: "Solapur",
  },
  {
    key: "o11",
    name: "Santosh Pagare",
    email: "santosh@khetirental.test",
    phone: "+919800000015",
    roles: ["owner"],
    district: "Chhatrapati Sambhajinagar",
  },
  {
    key: "o12",
    name: "Mangesh Raut",
    email: "mangesh@khetirental.test",
    phone: "+919800000016",
    roles: ["owner"],
    district: "Nagpur",
  },
  {
    key: "o13",
    name: "Alka Borse",
    email: "alka@khetirental.test",
    phone: "+919800000017",
    roles: ["owner"],
    district: "Jalgaon",
  },
  {
    key: "r5",
    name: "Vitthal Jagtap",
    email: "vitthal@khetirental.test",
    phone: "+919800000018",
    roles: ["renter"],
    district: "Nashik",
  },
  {
    key: "r6",
    name: "Meena Kulkarni",
    email: "meena@khetirental.test",
    phone: "+919800000019",
    roles: ["renter"],
    district: "Satara",
  },
  {
    key: "r7",
    name: "Rajendra Thorat",
    email: "rajendra@khetirental.test",
    phone: "+919800000020",
    roles: ["renter"],
    district: "Kolhapur",
  },
  {
    key: "r8",
    name: "Poonam Tiwari",
    email: "poonam@khetirental.test",
    phone: "+919800000021",
    roles: ["renter"],
    district: "Nagpur",
  },
  {
    key: "r9",
    name: "Shivaji Gawande",
    email: "shivaji@khetirental.test",
    phone: "+919800000022",
    roles: ["renter"],
    district: "Jalgaon",
  },
  {
    key: "r10",
    name: "Ramkishan Yadav",
    email: "ramkishan@khetirental.test",
    phone: "+919800000023",
    roles: ["renter"],
    district: "Nagpur",
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
  rcStatus: "pending" | "checked" | "rejected";
  active: boolean;
}

/** A hand-picked machine for the other districts, so every category has several and every screen has variety. */
interface Extra {
  key: string;
  owner: string;
  category: Category;
  make: string;
  model: string;
  hp: number | null;
  year: number;
  attachments?: Attachment[];
  pin: string;
  unit: PriceUnit;
  rupees: number;
  operator?: boolean;
  diesel?: boolean;
  rc?: SeedMachine["rcStatus"];
  paused?: boolean;
}

const EXTRAS: Extra[] = [
  {
    key: "nashik-tractor",
    owner: "o7",
    category: "tractor",
    make: "Mahindra",
    model: "475 DI",
    hp: 42,
    year: 2017,
    attachments: ["rotavator", "plough"],
    pin: "422001",
    unit: "hour",
    rupees: 750,
  },
  {
    key: "nashik-sprayer",
    owner: "o7",
    category: "sprayer",
    make: "Aspee",
    model: "Power Sprayer 600L",
    hp: null,
    year: 2020,
    pin: "422103",
    unit: "day",
    rupees: 650,
    diesel: false,
  },
  {
    key: "nashik-baler",
    owner: "o7",
    category: "baler",
    make: "Fieldking",
    model: "Square Baler",
    hp: null,
    year: 2019,
    pin: "422001",
    unit: "acre",
    rupees: 1250,
  },
  {
    key: "satara-tractor",
    owner: "o8",
    category: "tractor",
    make: "Swaraj",
    model: "735 FE",
    hp: 40,
    year: 2015,
    attachments: ["cultivator", "plough"],
    pin: "415001",
    unit: "hour",
    rupees: 650,
    diesel: false,
  },
  {
    key: "satara-thresher",
    owner: "o8",
    category: "thresher",
    make: "Kisankraft",
    model: "Multicrop",
    hp: null,
    year: 2016,
    pin: "415110",
    unit: "hour",
    rupees: 600,
    rc: "pending",
  },
  {
    key: "satara-baler",
    owner: "o8",
    category: "baler",
    make: "Shaktiman",
    model: "Round Baler",
    hp: null,
    year: 2021,
    pin: "415001",
    unit: "acre",
    rupees: 1500,
  },
  {
    key: "kolhapur-tractor",
    owner: "o9",
    category: "tractor",
    make: "John Deere",
    model: "5310",
    hp: 55,
    year: 2019,
    attachments: ["rotavator", "trolley"],
    pin: "416001",
    unit: "hour",
    rupees: 950,
  },
  {
    key: "kolhapur-combine",
    owner: "o9",
    category: "combine_harvester",
    make: "Preet",
    model: "987",
    hp: 100,
    year: 2018,
    pin: "416115",
    unit: "acre",
    rupees: 2600,
  },
  {
    key: "kolhapur-seed-drill",
    owner: "o9",
    category: "seed_drill",
    make: "Dasmesh",
    model: "9-Row Seed Drill",
    hp: null,
    year: 2020,
    pin: "416001",
    unit: "acre",
    rupees: 800,
    operator: false,
  },
  {
    key: "kolhapur-trolley",
    owner: "o9",
    category: "trolley",
    make: "Local",
    model: "Tipping trolley",
    hp: null,
    year: 2014,
    pin: "416115",
    unit: "day",
    rupees: 1000,
    paused: true,
  },
  {
    key: "solapur-tractor",
    owner: "o10",
    category: "tractor",
    make: "Sonalika",
    model: "DI 750",
    hp: 50,
    year: 2016,
    attachments: ["plough", "cultivator"],
    pin: "413001",
    unit: "hour",
    rupees: 800,
    rc: "rejected",
  },
  {
    key: "solapur-rotavator",
    owner: "o10",
    category: "rotavator",
    make: "Fieldking",
    model: "Heavy Duty",
    hp: null,
    year: 2021,
    pin: "413304",
    unit: "acre",
    rupees: 1300,
  },
  {
    key: "solapur-thresher",
    owner: "o10",
    category: "thresher",
    make: "Dasmesh",
    model: "Paddy-Wheat",
    hp: null,
    year: 2013,
    pin: "413001",
    unit: "hour",
    rupees: 550,
  },
  {
    key: "solapur-baler",
    owner: "o10",
    category: "baler",
    make: "Kartar",
    model: "Mini Baler",
    hp: null,
    year: 2022,
    pin: "413304",
    unit: "day",
    rupees: 3500,
    paused: true,
  },
  {
    key: "sambhajinagar-tractor",
    owner: "o11",
    category: "tractor",
    make: "New Holland",
    model: "3630",
    hp: 55,
    year: 2020,
    attachments: ["trolley"],
    pin: "431001",
    unit: "hour",
    rupees: 900,
  },
  {
    key: "sambhajinagar-seed-drill",
    owner: "o11",
    category: "seed_drill",
    make: "Fieldking",
    model: "Multi Crop",
    hp: null,
    year: 2018,
    pin: "431107",
    unit: "acre",
    rupees: 750,
  },
  {
    key: "sambhajinagar-sprayer",
    owner: "o11",
    category: "sprayer",
    make: "Neptune",
    model: "HTP Power",
    hp: null,
    year: 2022,
    pin: "431001",
    unit: "day",
    rupees: 550,
  },
  {
    key: "sambhajinagar-rotavator",
    owner: "o11",
    category: "rotavator",
    make: "Shaktiman",
    model: "Semi Champion",
    hp: null,
    year: 2019,
    pin: "431107",
    unit: "acre",
    rupees: 1200,
    rc: "pending",
  },
  {
    key: "nagpur-tractor",
    owner: "o12",
    category: "tractor",
    make: "Eicher",
    model: "485",
    hp: 45,
    year: 2014,
    attachments: ["plough"],
    pin: "440001",
    unit: "hour",
    rupees: 700,
    rc: "rejected",
  },
  {
    key: "nagpur-combine",
    owner: "o12",
    category: "combine_harvester",
    make: "Kartar",
    model: "4000",
    hp: 95,
    year: 2017,
    pin: "441302",
    unit: "acre",
    rupees: 2400,
    rc: "pending",
  },
  {
    key: "nagpur-thresher",
    owner: "o12",
    category: "thresher",
    make: "Dasmesh",
    model: "Multicrop",
    hp: null,
    year: 2019,
    pin: "440001",
    unit: "hour",
    rupees: 600,
  },
  {
    key: "nagpur-trolley",
    owner: "o12",
    category: "trolley",
    make: "Local",
    model: "4-wheel trolley",
    hp: null,
    year: 2018,
    pin: "441302",
    unit: "day",
    rupees: 900,
    operator: false,
  },
  {
    key: "nagpur-baler",
    owner: "o12",
    category: "baler",
    make: "Fieldking",
    model: "Square Baler",
    hp: null,
    year: 2020,
    pin: "440001",
    unit: "acre",
    rupees: 1350,
  },
  {
    key: "jalgaon-tractor",
    owner: "o13",
    category: "tractor",
    make: "Mahindra",
    model: "575 DI",
    hp: 47,
    year: 2018,
    attachments: ["rotavator"],
    pin: "425001",
    unit: "hour",
    rupees: 800,
  },
  {
    key: "jalgaon-rotavator",
    owner: "o13",
    category: "rotavator",
    make: "Fieldking",
    model: "Maxx",
    hp: null,
    year: 2020,
    pin: "425201",
    unit: "acre",
    rupees: 1250,
  },
  {
    key: "jalgaon-seed-drill",
    owner: "o13",
    category: "seed_drill",
    make: "Dasmesh",
    model: "Zero Till",
    hp: null,
    year: 2017,
    pin: "425001",
    unit: "acre",
    rupees: 700,
  },
  {
    key: "jalgaon-sprayer",
    owner: "o13",
    category: "sprayer",
    make: "Aspee",
    model: "Boom 400L",
    hp: null,
    year: 2021,
    pin: "425201",
    unit: "day",
    rupees: 600,
  },
  {
    key: "jalgaon-trolley",
    owner: "o13",
    category: "trolley",
    make: "Local",
    model: "4-wheel trolley",
    hp: null,
    year: 2016,
    pin: "425001",
    unit: "day",
    rupees: 850,
    operator: false,
  },
];

interface SeedBooking {
  machineIdx: number;
  renter: string;
  code: string;
  startDate: string;
  endDate: string;
  slot: Slot;
  status: BookingStatus;
  /** What the renter wanted done, and how far they searched from (km, a multiple of 0.5). */
  job?: Job;
  distanceKm?: number;
  stars?: number;
  review?: string;
  /** Minutes since the request was made; set for requests that should show a live reply timer or have lapsed. */
  ageMin?: number;
  declineReason?: string;
  cancelReason?: string;
  cancelledBy?: "renter" | "owner";
  method?: "upi" | "cash";
  notify: boolean;
  problem?: {
    by: "renter" | "owner";
    type: string;
    text: string;
    status: "open" | "resolved";
    note?: string;
  };
}

/** A hand-written booking on one of the EXTRAS (by key); `day` is days from today, negative for the past. */
interface ExtraBooking extends Partial<Omit<SeedBooking, "machineIdx" | "startDate" | "endDate" | "notify">> {
  machine: string;
  renter: string;
  status: BookingStatus;
  day: number;
  days?: number;
}

const EXTRA_BOOKINGS: ExtraBooking[] = [
  // Requests waiting on owners: plenty of time left, little time left, just sent.
  { machine: "nashik-tractor", renter: "r5", status: "REQUESTED", day: 3, slot: "full", ageMin: 25 },
  {
    machine: "satara-tractor",
    renter: "r6",
    status: "REQUESTED",
    day: 4,
    days: 2,
    slot: "morning",
    ageMin: 100,
  },
  {
    machine: "sambhajinagar-tractor",
    renter: "r1",
    status: "REQUESTED",
    day: 5,
    slot: "afternoon",
    ageMin: 5,
  },
  // Confirmed and upcoming.
  { machine: "kolhapur-tractor", renter: "r7", status: "CONFIRMED", day: 2, slot: "full", method: "upi" },
  { machine: "solapur-rotavator", renter: "r5", status: "CONFIRMED", day: 6, slot: "morning" },
  { machine: "jalgaon-tractor", renter: "r9", status: "CONFIRMED", day: 3, slot: "full", method: "upi" },
  { machine: "nagpur-combine", renter: "r8", status: "CONFIRMED", day: 9, days: 2, slot: "full" },
  // Out in the field today.
  { machine: "nagpur-tractor", renter: "r10", status: "IN_PROGRESS", day: 0, slot: "full", method: "upi" },
  { machine: "nashik-baler", renter: "r5", status: "IN_PROGRESS", day: 0, slot: "full" },
  {
    machine: "jalgaon-sprayer",
    renter: "r2",
    status: "IN_PROGRESS",
    day: -1,
    days: 3,
    slot: "full",
    problem: {
      by: "renter",
      type: "broke_down",
      text: "The pump stopped after an hour. The owner is sending a fitter.",
      status: "open",
    },
  },
  // Finished and reviewed.
  {
    machine: "satara-baler",
    renter: "r6",
    status: "COMPLETED",
    day: -12,
    slot: "full",
    stars: 5,
    review: "Baling finished in one afternoon.",
  },
  {
    machine: "nashik-sprayer",
    renter: "r5",
    status: "COMPLETED",
    day: -8,
    slot: "morning",
    stars: 4,
    review: "Machine in good condition.",
  },
  {
    machine: "kolhapur-combine",
    renter: "r7",
    status: "COMPLETED",
    day: -20,
    days: 2,
    slot: "full",
    stars: 5,
    review: "Cut the whole field in two days.",
    problem: {
      by: "renter",
      type: "overcharged",
      text: "Billed for 12 acres but the field is 9.",
      status: "open",
    },
  },
  {
    machine: "solapur-thresher",
    renter: "r7",
    status: "COMPLETED",
    day: -15,
    slot: "afternoon",
    stars: 3,
    review: "Late by an hour but did the work.",
    problem: {
      by: "owner",
      type: "late_return",
      text: "Returned about an hour late.",
      status: "resolved",
      note: "Spoke to both sides. No extra charge.",
    },
  },
  { machine: "nagpur-baler", renter: "r8", status: "COMPLETED", day: -6, slot: "full", stars: 5 },
  {
    machine: "jalgaon-tractor",
    renter: "r9",
    status: "COMPLETED",
    day: -25,
    slot: "full",
    stars: 5,
    review: "Came on time, good driver.",
  },
  // Cancelled, declined, lapsed.
  {
    machine: "sambhajinagar-seed-drill",
    renter: "r4",
    status: "CANCELLED",
    day: 7,
    slot: "full",
    cancelledBy: "renter",
    cancelReason: "Rain forecast, sowing postponed.",
  },
  {
    machine: "solapur-tractor",
    renter: "r2",
    status: "CANCELLED",
    day: 4,
    slot: "full",
    cancelledBy: "owner",
    cancelReason: "Tractor is in the workshop.",
  },
  {
    machine: "nashik-tractor",
    renter: "r6",
    status: "DECLINED",
    day: 8,
    slot: "full",
    declineReason: "busy",
  },
  {
    machine: "satara-thresher",
    renter: "r1",
    status: "DECLINED",
    day: 5,
    slot: "morning",
    declineReason: "too_far",
  },
  { machine: "sambhajinagar-rotavator", renter: "r5", status: "EXPIRED", day: 3, slot: "full", ageMin: 400 },
  { machine: "nagpur-trolley", renter: "r4", status: "EXPIRED", day: 2, slot: "full", ageMin: 300 },
];

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
      active: true,
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
        notify: false,
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
      notify: true,
    });
  }
  const blocks = machines
    .filter((_, i) => i % 6 === 0)
    .map((m, i) => ({ machineIdx: m.idx, day: addDays(today, 15 + i) }));

  const idxOf = new Map<string, number>();
  for (const e of EXTRAS) {
    const place = PINS.find((p) => p.pin === e.pin);
    if (!place) throw new Error(`seed: unknown PIN ${e.pin}`);
    const idx = machines.length;
    idxOf.set(e.key, idx);
    machines.push({
      idx,
      owner: e.owner,
      category: e.category,
      make: e.make,
      model: e.model,
      hp: e.hp,
      year: e.year,
      hourMeter: Math.round(between(300, 6000)),
      lastServiced: addDays(today, -Math.floor(between(10, 200))),
      attachments: e.attachments ?? [],
      lat: Math.round((place.lat + between(-0.05, 0.05)) * 1e5) / 1e5,
      lng: Math.round((place.lng + between(-0.05, 0.05)) * 1e5) / 1e5,
      village: place.village,
      pin: e.pin,
      priceUnit: e.unit,
      pricePaise: e.rupees * 100,
      operatorIncluded: e.operator ?? true,
      dieselIncluded: e.diesel ?? true,
      rcStatus: e.rc ?? "checked",
      active: !e.paused,
    });
  }
  let extraCode = 2000;
  for (const { machine, day, days = 1, ...b } of EXTRA_BOOKINGS) {
    const machineIdx = idxOf.get(machine);
    if (machineIdx === undefined) throw new Error(`seed: unknown machine ${machine}`);
    const startDate = addDays(today, day);
    bookings.push({
      slot: "full",
      ...b,
      machineIdx,
      code: `KR-${++extraCode}`,
      startDate,
      endDate: addDays(startDate, days - 1),
      notify: b.status !== "COMPLETED" || !!b.problem || !!b.stars,
    });
  }
  // Days the owners are unavailable (their own work, a wedding, a festival).
  for (const [i, key] of [
    "nashik-baler",
    "satara-tractor",
    "kolhapur-combine",
    "nagpur-tractor",
    "jalgaon-rotavator",
  ].entries()) {
    blocks.push({ machineIdx: idxOf.get(key) ?? 0, day: addDays(today, 12 + i * 2) });
  }
  // Every sample booking says what job it is for (one the machine can do) and how far the renter was.
  const jobOf = (m: SeedMachine, n: number): Job => {
    const can = JOBS.filter(
      (j) =>
        JOB_MACHINES[j].categories.includes(m.category) ||
        (m.category === "tractor" && JOB_MACHINES[j].attachments.some((a) => m.attachments.includes(a))),
    );
    return can.length ? can[n % can.length] : "plough";
  };
  for (const b of bookings) {
    const n = Number(b.code.slice(3));
    b.job ??= jobOf(machines[b.machineIdx], n);
    b.distanceKm ??= 1 + ((n * 7) % 36) / 2;
  }
  return { pins: PINS, users: [...USERS, ...MORE_USERS], machines, bookings, blocks };
}
