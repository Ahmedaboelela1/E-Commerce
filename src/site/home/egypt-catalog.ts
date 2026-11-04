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
  highlights: string[];
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
    description: 'A competition-oriented programmable robot designed for robot soccer. The POP-32i control board supports C/C++ development, with a dedicated ball-shooting assembly and sensors for navigation and detection.',
    highlights: ['POP-32i (STM32F103CBT6)', 'Ball-shooting mechanism', 'HuskyLens camera module and ZX-IMU', 'LiPo battery and USB-C cable'],
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-soccer-robot-kit/',
  },
  {
    sku: '8300155',
    name: 'POP-BOT32i Rover Kit Plus',
    priceEgp: 20000,
    stockStatus: 'in-stock',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'An educational rover kit for building autonomous and remote-controlled robots using the POP-32i board. Includes ultrasonic, reflectance and collision sensing, plus wireless joystick control and a Gripper-X mechanism.',
    highlights: ['POP-32i control board', 'Ultrasonic, reflectance and touch sensors', 'Wireless joystick and receiver', 'Gripper-X object-handling mechanism'],
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-rover-kit-plus/',
  },
  {
    sku: '8300153',
    name: 'Robo-Creator Xi: SumoBOT Kit',
    priceEgp: 25000,
    stockStatus: 'in-stock',
    category: 'Robot Sumo',
    competition: 'WRG Sumo',
    description: 'A beginner-friendly sumo-robot kit featuring the ATX2i control board, line and distance sensors, a reinforced chassis and a metal front scoop for entry-level robot-sumo competition.',
    highlights: ['ATX2i controller (official standard kit)', 'Infrared distance and reflectance sensing', 'Four geared motors', 'Metal scoop and competition chassis'],
    supplierUrl: 'https://inex.co.th/home/product/robo-creator-xi-sumobot-kit/',
  },
  {
    sku: '8300130',
    name: 'POP-BOT32i Rover Kit Lite',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'A basic POP-32i programmable rover for learning C/C++ robotics, with simple assembly, ultrasonic distance detection, line sensors and collision switches.',
    highlights: ['POP-32i controller', 'Ultrasonic distance sensor', 'Reflectance and collision sensors'],
    supplierUrl: 'https://inex.co.th/home/product/pop-bot32i-rover-kit-lite/',
  },
  {
    sku: '8300163',
    name: 'X-ROVER Robot Kit',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'STEM Activities',
    description: 'A radio-controlled construction kit with the X-ROVER Main4 motor driver and eight-button wireless Remote8 controller; its remote operation does not require programming.',
    highlights: ['X-ROVER Main4 motor-driver board', 'Remote8 wireless controller', 'Mechanical assembly parts'],
    supplierUrl: 'https://inex.co.th/home/product/x-rover-robot-kit/',
  },
  {
    sku: '8300137',
    name: 'KidBright Rover Ai',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'AI & STEM',
    competition: 'AI Robotics',
    description: 'An autonomous KidBright32-based educational robot for introductory coding, embedded-system projects and hands-on artificial intelligence activities.',
    highlights: ['KidBright32 controller', 'Introductory AI and embedded learning', 'Autonomous rover platform'],
    supplierUrl: 'https://inex.co.th/home/product/kidbright-rover-ai/',
  },
  {
    sku: '8300152',
    name: 'Robo-Creator Xi: Rover Kit Plus',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Robotics Learning',
    competition: 'Robotics / STEM',
    description: 'An educational ATX2i rover kit intended for programmable robotics and sensor-based projects, with a gripping mechanism for object-handling activities.',
    highlights: ['ATX2i controller', 'Rover chassis and sensors', 'Gripper mechanism'],
    supplierUrl: 'https://inex.co.th/home/product/robo-creator-xi-rover-kit-plus/',
  },
  {
    sku: '8300146',
    name: 'KidBright 32iA JR-BOT',
    priceEgp: null,
    stockStatus: 'available-on-order',
    category: 'Junior Robotics',
    competition: 'STEM Junior',
    description: 'A compact KidBright32iA autonomous robot with servo-driven wheels and ultrasonic and infrared reflectance sensors. Supports visual programming, microPython and C/C++ learning.',
    highlights: ['KidBright32iA (ESP32) board', 'KidBright IDE / microPython / Arduino C/C++', 'Ultrasonic and infrared line sensors'],
    supplierUrl: 'https://inex.co.th/home/product/kidbright-32ia-jr-bot/',
  },
];

export const formatEgp = (value: number) =>
  new Intl.NumberFormat('en-EG', {style: 'currency', currency: 'EGP', maximumFractionDigits: 0}).format(value);
