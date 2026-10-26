/**
 * IEEE reference numbers for the landing page, in order of first citation.
 * The bibliography in components/references.tsx renders `references` as-is.
 * Keep `source` and `references` in the same order.
 *
 * Worksheet: apps/web/public/Simulator_Reference_Data_and_Sources.pdf
 */

const repo = "https://github.com/1chooo/mjhh-usc-ieee-HackIoT/blob/main";

export const source = {
  ladwpRates: 1,
  ladwpTiers: 2,
  ladwpZones: 3,
  hoyt: 4,
  ghahramani: 5,
  cbe: 6,
  deChalendar: 7,
  ashrae: 8,
  model: 9,
} as const;

export type ReferenceLink = {
  href: string;
  label: string;
  external?: boolean;
};

type Segment = {
  text: string;
  italic?: boolean;
};

export type ReferenceEntry = {
  id: number;
  segments: readonly Segment[];
  usedFor: string;
  links: readonly ReferenceLink[];
};

export const references: readonly ReferenceEntry[] = [
  {
    id: source.ladwpRates,
    segments: [
      {
        text: "Los Angeles Department of Water and Power, “Residential rates: R-1A standard residential rate,” 2026. [Online]. Available: ",
      },
      {
        text: "https://www.ladwp.com/account/customer-service/electric-rates/residential-rates",
      },
      { text: ". Accessed: Oct. 25, 2026." },
    ],
    usedFor:
      "2026 R-1A total consumption charge, including adjustment factors, in dollars per kWh by month. November Tier 1 is $0.27292/kWh, the opening price on this page. The monthly Power Access Charge and the city utility tax are omitted. A campus account would be a commercial schedule with demand charges. R-1A is the residential schedule, used because its bill is two months long.",
    links: [
      {
        href: "https://www.ladwp.com/account/customer-service/electric-rates/residential-rates",
        label: "LADWP residential rates",
        external: true,
      },
    ],
  },
  {
    id: source.ladwpTiers,
    segments: [
      {
        text: "Los Angeles Department of Water and Power, “Residential electric rates,” 2026. [Online]. Available: ",
      },
      {
        text: "https://www.ladwp.com/account/understanding-your-rates/residential-electric-rates",
      },
      { text: ". Accessed: Oct. 25, 2026." },
    ],
    usedFor:
      "Published kWh allotments, including the bi-monthly column. Zone 2 bi-monthly is the first 1,000 kWh, the next 2,000 kWh, then everything above 3,000 kWh. The simulator starts a new bill at Tier 1 every two months and uses these Zone 2 limits.",
    links: [
      {
        href: "https://www.ladwp.com/account/understanding-your-rates/residential-electric-rates",
        label: "LADWP tier allotments",
        external: true,
      },
    ],
  },
  {
    id: source.ladwpZones,
    segments: [
      {
        text: "Los Angeles Department of Water and Power, “Electric rates,” rate ordinance, Los Angeles, CA, USA. [Online]. Available: ",
      },
      {
        text: "https://www.ladwp.com/sites/default/files/documents/LADWP_Electric_Rates.pdf",
      },
      { text: ". Accessed: Oct. 25, 2026." },
    ],
    usedFor:
      "Zip-code table for Schedule R-1 zones. 90007, the USC campus, is printed under Zone 2, so the simulator uses the Zone 2 bi-monthly allotments in [2].",
    links: [
      {
        href: "https://www.ladwp.com/sites/default/files/documents/LADWP_Electric_Rates.pdf",
        label: "LADWP electric rate ordinance (PDF)",
        external: true,
      },
    ],
  },
  {
    id: source.hoyt,
    segments: [
      {
        text: "T. Hoyt, E. Arens, and H. Zhang, “Extending air temperature setpoints: Simulated energy savings and design considerations for new and retrofit buildings,” ",
      },
      { text: "Building and Environment", italic: true },
      {
        text: ", vol. 88, pp. 89–96, Jun. 2015, doi: 10.1016/j.buildenv.2014.09.010.",
      },
    ],
    usedFor:
      "The campus-scale cooling factor: about 10% less electricity per 1°C warmer room, compounded from a 24°C reference. Raising the cooling setpoint from 22.2°C to 25°C saved 29% of cooling energy and 27% of HVAC energy on average, in DOE medium-office models across seven U.S. climates. Spread across 2.8°C, 29% is about 10.4% per degree, or about 11.5% if compounded. The page uses 10%, below both. The study measures office thermostats. The scale applies the factor to classrooms, using room temperature.",
    links: [
      {
        href: "https://doi.org/10.1016/j.buildenv.2014.09.010",
        label: "doi:10.1016/j.buildenv.2014.09.010",
        external: true,
      },
      {
        href: "https://escholarship.org/uc/item/13s1q2xc",
        label: "Open PDF, eScholarship",
        external: true,
      },
    ],
  },
  {
    id: source.ghahramani,
    segments: [
      {
        text: "A. Ghahramani, K. Dutta, Z. Yang, G. Ozcelik, and B. Becerik-Gerber, “Quantifying the influence of temperature setpoints, building and system features on energy consumption,” in ",
      },
      {
        text: "Proc. 2015 Winter Simulation Conf. (WSC)",
        italic: true,
      },
      {
        text: ", Huntington Beach, CA, USA, Dec. 2015, pp. 1000–1011, doi: 10.1109/WSC.2015.7408228.",
      },
    ],
    usedFor:
      "University of Southern California check on Hoyt’s 29% cooling and 27% HVAC figures. The paper’s own EnergyPlus runs, which include Los Angeles, find 16.2% savings when the deadband widens from 3 K to 6 K, and 6.63% average savings from climate-specific annual setpoints. The page keeps Hoyt’s rounded 10% as the cooling factor.",
    links: [
      {
        href: "https://doi.org/10.1109/WSC.2015.7408228",
        label: "doi:10.1109/WSC.2015.7408228",
        external: true,
      },
      {
        href: "https://www.informs-sim.org/wsc15papers/119.pdf",
        label: "Open PDF, WSC 2015",
        external: true,
      },
    ],
  },
  {
    id: source.cbe,
    segments: [
      {
        text: "Center for the Built Environment, “Setpoint energy savings calculator,” Univ. California, Berkeley, CA, USA, 2018. [Online]. Available: ",
      },
      {
        text: "https://cbe.berkeley.edu/research/setpoint-energy-savings-calculator/",
      },
      { text: ". Accessed: Oct. 25, 2026." },
    ],
    usedFor:
      "The calculator published with the Hoyt study. Opened to confirm that citation. The formula keeps Hoyt’s rounded 10%.",
    links: [
      {
        href: "https://cbe.berkeley.edu/research/setpoint-energy-savings-calculator/",
        label: "CBE project page",
        external: true,
      },
      {
        href: "https://cbe.berkeley.edu/tool/setpoint-energy-savings-calculator/",
        label: "Calculator",
        external: true,
      },
    ],
  },
  {
    id: source.deChalendar,
    segments: [
      {
        text: "J. A. de Chalendar, C. McMahon, L. Fuentes Valenzuela, P. W. Glynn, and S. M. Benson, “Unlocking demand response in commercial buildings: Empirical response of commercial buildings to daily cooling set point adjustments,” ",
      },
      { text: "Energy and Buildings", italic: true },
      {
        text: ", vol. 278, Art. no. 112599, 2023, doi: 10.1016/j.enbuild.2022.112599.",
      },
    ],
    usedFor:
      "Field bound from six commercial buildings. A cooling setpoint 2°F (1.1°C) warmer cut daily cooling loads 13–28% in four offices and 3–4% in two labs. Electric load, excluding cooling water and including ventilation, changed by under 2%. Cited as that measured range. The campus scale keeps Hoyt’s rounded 10% and estimates cooling electricity.",
    links: [
      {
        href: "https://doi.org/10.1016/j.enbuild.2022.112599",
        label: "doi:10.1016/j.enbuild.2022.112599",
        external: true,
      },
      {
        href: "https://web.stanford.edu/~glynn/papers/2023/deChalendarMcMahonValenzuelaGBenson2023.pdf",
        label: "Open PDF, Stanford",
        external: true,
      },
    ],
  },
  {
    id: source.ashrae,
    segments: [
      {
        text: "ASHRAE, “Nonresidential cooling and heating load calculations,” in ",
      },
      { text: "ASHRAE Handbook—Fundamentals", italic: true },
      {
        text: ". Atlanta, GA, USA: ASHRAE, 2025, ch. 18, Table 4.",
      },
    ],
    usedFor:
      "Heat from one seated person at very light work: 72 W sensible and 45 W latent, 117 W combined, added to the cooling load. The project read 245 Btu/h sensible and 155 Btu/h latent from Autodesk Revit help, which attributes that I-P table to ASHRAE Handbook—Fundamentals 30.4 Table 1. The 2025 SI handbook states 72 W and 45 W for the same activity.",
    links: [
      {
        href: "https://handbook.ashrae.org/Handbooks/F25/SI/F25_Ch18/f25_ch18_si.aspx",
        label: "2025 Handbook, ch. 18 (SI)",
        external: true,
      },
      {
        href: "http://help.autodesk.com/cloudhelp/2016/ENU/Revit-Analyze/files/GUID-7668C78B-7B33-4D60-B838-57D2656D8AD5.htm",
        label: "Autodesk Revit help, people heat gain",
        external: true,
      },
    ],
  },
  {
    id: source.model,
    segments: [
      {
        text: "MJHH, “Classroom AC setpoint model,” acmodel.py, 2026. [Online]. Available: ",
      },
      { text: `${repo}/apps/alg/acmodel.py` },
      { text: "." },
    ],
    usedFor:
      "The starting line on this page: 26°C (78.8°F) at one person to 18°C (64.4°F) at 300 people, and the memory of a returning group’s offset. Vote correction uses 0.5°C steps from 16°C to 30°C. The parameters were chosen for this prototype.",
    links: [
      {
        href: `${repo}/apps/alg/acmodel.py`,
        label: "apps/alg/acmodel.py",
        external: true,
      },
      {
        href: `${repo}/apps/web/lib/ac-model.ts`,
        label: "Web port, apps/web/lib/ac-model.ts",
        external: true,
      },
    ],
  },
];

export type ProjectSource = {
  path: string;
  href: string;
  external?: boolean;
  note: string;
};

export const projectSources: readonly ProjectSource[] = [
  {
    path: "apps/web/public/Simulator_Reference_Data_and_Sources.pdf",
    href: "/Simulator_Reference_Data_and_Sources.pdf",
    note: "Worksheet for this list, dated October 25, 2026, with the arithmetic behind each number.",
  },
  {
    path: "apps/web/lib/model-sim.ts",
    href: `${repo}/apps/web/lib/model-sim.ts`,
    external: true,
    note: "Campus-scale cooling: hourKwh(), 10% per °C, 72 W + 45 W, COP 3, 0.4 kg CO₂e/kWh, and 10 W/m² of lights and plugs. Baseline AC is 22°C. An empty room sets back to 26°C. The room sits above the AC setpoint by heatLiftC(), −2 + 8×(N−1)/299 °C at the default 100 W per person. COP, the grid factor, the lighting density, and the lift are project assumptions.",
  },
  {
    path: "apps/web/lib/billing.ts",
    href: `${repo}/apps/web/lib/billing.ts`,
    external: true,
    note: "Two-month R-1A bills. Tier limits in code are the Zone 2 bi-monthly allotments, 1,000 kWh and 3,000 kWh.",
  },
  {
    path: "apps/web/lib/sim-run.ts",
    href: `${repo}/apps/web/lib/sim-run.ts`,
    external: true,
    note: "dailySavings(): the next 8 weeks of one simulator room, averaged to the per-day figure on the campus scale.",
  },
  {
    path: "apps/web/lib/thermal.ts",
    href: `${repo}/apps/web/lib/thermal.ts`,
    external: true,
    note: "The room comparison above the campus scale. Steady-state thermal load, separate from the 10% cooling model. Default envelope loss is 1.8 W/m²·K, a project assumption.",
  },
  {
    path: "apps/web/lib/energy-impact.ts",
    href: `${repo}/apps/web/lib/energy-impact.ts`,
    external: true,
    note: "Turns that thermal load into kWh, dollars, and CO₂e. COP 3 and 0.4 kg CO₂e/kWh are labeled illustrative.",
  },
  {
    path: "apps/web/lib/sim-rooms.ts",
    href: `${repo}/apps/web/lib/sim-rooms.ts`,
    external: true,
    note: "Demo rooms and timetables. The campus scale uses 27°C and 50% relative humidity outdoors.",
  },
];

const ids = Object.values(source);
if (
  references.length !== ids.length ||
  references.some(
    (entry, index) => entry.id !== index + 1 || entry.id !== ids[index],
  )
) {
  throw new Error("Landing-page references are out of order.");
}
