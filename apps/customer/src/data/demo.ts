// DEMO ONLY. Replace these with authenticated backend data before launch.
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
};

export type Restaurant = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  emoji: string;
  accent: string;
  rating: string;
  eta: string;
  deliveryCents: number;
  menu: MenuItem[];
};

export const restaurants: Restaurant[] = [
  {
    id: 'burgeri', name: 'Burgeru Darbnīca', category: 'Burgeri',
    tagline: 'Sulīgi burgeri un kraukšķīgi kartupeļi', emoji: '🍔',
    accent: '#FFE8CE', rating: '4,8', eta: '25–35 min', deliveryCents: 250,
    menu: [
      { id: 'classic', name: 'Klasiskais burgers', description: 'Liellops, siers, salāti un īpašā mērce', priceCents: 890, emoji: '🍔' },
      { id: 'chicken', name: 'Kraukšķīgās vistas burgers', description: 'Vista, salāti, tomāts un maiga mērce', priceCents: 850, emoji: '🍗' },
      { id: 'fries', name: 'Frī kartupeļi', description: 'Ar jūras sāli', priceCents: 320, emoji: '🍟' },
    ],
  },
  {
    id: 'pica', name: 'Pica Pilsētā', category: 'Pica',
    tagline: 'Karsta pica no krāsns', emoji: '🍕',
    accent: '#FFE6E2', rating: '4,7', eta: '30–40 min', deliveryCents: 300,
    menu: [
      { id: 'margarita', name: 'Margarita', description: 'Tomātu mērce, mocarella, baziliks', priceCents: 990, emoji: '🍕' },
      { id: 'pepperoni', name: 'Pepperoni', description: 'Mocarella un pepperoni', priceCents: 1190, emoji: '🍕' },
      { id: 'drink', name: 'Limonāde', description: 'Atspirdzinošs dzēriens 330 ml', priceCents: 250, emoji: '🥤' },
    ],
  },
  {
    id: 'azija', name: 'Āzijas Bļoda', category: 'Āzijas',
    tagline: 'Nūdeles, rīsi un svaigas garšas', emoji: '🍜',
    accent: '#E4F4D9', rating: '4,9', eta: '20–30 min', deliveryCents: 220,
    menu: [
      { id: 'noodles', name: 'Vistas nūdeles', description: 'Wok dārzeņi, vista un sezams', priceCents: 1050, emoji: '🍜' },
      { id: 'rice', name: 'Rīsu bļoda', description: 'Rīsi, dārzeņi un tofu', priceCents: 950, emoji: '🍚' },
      { id: 'rolls', name: 'Pavasara rullīši', description: '3 gabali ar saldo čili mērci', priceCents: 440, emoji: '🥟' },
    ],
  },
];
