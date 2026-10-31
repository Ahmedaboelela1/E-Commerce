/**
 * Initial Egypt catalog preview supplied by Skillverse Global.
 * This is NOT live Vendure stock or checkout data. Actual on-hand quantities
 * must be entered in the local Egyptian agent's Vendure stock location.
 * Never use this static list to allocate stock or settle payments.
 */
export type EgyptCatalogProduct = {
  sku: string;
  name: string;
  priceEgp: number | null;
  stockStatus: 'in-stock' | 'available-on-order';
  category: string;
  description: string;
  supplierUrl: string;
  competition: string;
};

export const egyptCatalogProducts: EgyptCatalogProduct[] = [
  {
    sku: '8300158',
    name: 'POP-BOT32i Soccer Robot Kit',
    priceEgp: 25000,
    stockStatus: 'in-stock',
    category: 'Robot Soccer',
    competition: 'WRG Soccer',
    description: 'C/C++ programmable soccer robot kit with POP-32i controller and a ball-shooting mechanism.',
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-soccer-robot-kit/',
  },
  {
    sku: '8300155',
    name: 'POP-BOT32i Rover Kit Plus',
    priceEgp: 20000,
    stockStatus: 'in-stock',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'Programmable educational rover with POP-32i controller, sensors, wireless controls and gripper.',
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-rover-kit-plus/',
  },
  {
    sku: '8300153',
    name: 'Robo-Creator Xi: SumoBOT Kit',
    priceEgp: 25000,
    stockStatus: 'in-stock',
    category: 'Robot Sumo',
    competition: 'WRG Sumo',
    description: 'A robotics kit focused on building and programming a competition-style sumo robot. Check the controller variant before ordering.',
    supplierUrl: 'https://inex.co.th/home/product/robo-creator-xi-sumobot-kit/',
  },
  {
    sku: '8300130',
    name: 'POP-BOT32i Rover Kit Lite',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'Entry-level programmable rover kit using the POP-32i controller.',
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-rover-kit-lite/',
  },
  {
    sku: '8300163',
    name: 'X-ROVER Robot Kit',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'STEM Activities',
    description: 'Wireless remote-control robotics kit for hands-on mechanical building and control.',
    supplierUrl: 'https://inex.co.th/home/product/x-rover-robot-kit/',
  },
  {
    sku: '8300137',
    name: 'KidBright Rover Ai',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'AI & STEM',
    competition: 'AI Robotics',
    description: 'Educational robot for introductory AI, embedded systems and programming concepts.',
    supplierUrl: 'https://inex.co.th/home/product/kidbright-rover-ai/',
  },
  {
    sku: '8300152',
    name: 'Robo-Creator Xi: Rover Kit Plus',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'Educational rover based on the ATX2i controller with sensors and a gripper.',
    supplierUrl: 'https://inex.co.th/home/product/robo-creator-xi-rover-kit-plus/',
  },
  {
    sku: '8300146',
    name: 'KidBright 32iA JR-BOT',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Junior Robotics',
    competition: 'STEM Junior',
    description: 'Small educational autonomous robot kit with KidBright32iA controller.',
    supplierUrl: 'https://inex.co.th/home/product/kidbright-32ia-jr-bot/',
  },
];

export const formatEgp = (value: number) =>
  new Intl.NumberFormat('en-EG', {style: 'currency', currency: 'EGP', maximumFractionDigits: 0}).format(value);
