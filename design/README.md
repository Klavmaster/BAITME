# BaitMe dizains FigCraft vidē

Šis ir oriģināls, FigCraft rediģējams BaitMe mobilās lietotnes dizains trīs ekrāniem.
Tiek izmantots `figcraft-vendor` projekts no šī GitHub konta (agrīna alpha), nevis DesignCraft, kas ir piemērotāks publikāciju maketēšanai.

## Atvērt dizainu

1. Atver `design/baitme-figcraft-screens.svg` FigCraft — SVG tiek importēts kā rediģējamas formas, ceļi un teksta slāņi.
2. Ar FigCraft CLI (ja programma ir kompilēta/instalēta):

```bash
figcraft-cli convert design/baitme-figcraft-screens.svg design/baitme-screens.figcraft
figcraft-cli info design/baitme-screens.figcraft
figcraft-cli export design/baitme-screens.figcraft -o design-preview.png
```

`figcraft-cli` nav integrēts BaitMe React Native lietotnē; dizaina fails ir produkta avots, bet mobilais UI tiek programmēts Expo / React Native.

## Ekrāni

- **01 Restorānu atlase:** piegādes adrese, meklēšana, virtuves filtri, 0% komisijas stāsts, restorānu kartītes.
- **02 Ēdienkarte:** restorāna profils, cena un laika aprēķins, ēdienkarte, pievienošana grozam.
- **03 Pasūtījums:** ēdienu saraksts, piegāde, ilustratīva apstrādes izmaksu simulācija, kopējā summa, deaktivēts maksājums.

Krāsas, tipogrāfija un atstarpes: `design/tokens.json`. Tās jāsaskaņo arī ar Expo UI.

## Maksājumu juridiskais bloķētājs

Latvijas Maksājumu pakalpojumu un elektroniskās naudas likuma 77. panta trešā daļa aizliedz piemaksu par konkrēta maksājuma instrumenta izmantošanu; Stripe apstiprina, ka parastiem EEZ B2C karšu maksājumiem šādas piemaksas ir aizliegtas.

Tāpēc 0,61 € šajā ekrānā ir **tikai aprēķina demonstrācija**, nevis dzīva maksājuma summa. Tā ir aprēķināta kā ilustratīvs bruto uzcenojums pie 1,5% + 0,25 € izmaksām 23,50 € pamatdarījumam; tas neaptver visas Stripe Connect izmaksas.

Pirms produkcijas: juridiski pārbaudīt alternatīvas maksājuma metodes vai finansēšanas modeli un apstiprināt maksājumu plūsmu. Nedrīkst slēpt kartes piemaksu zem citas etiķetes.

## Autortiesības

Visas šī SVG vektoru formas radītas tieši BaitMe prototipam. Nav kopēti Wolt vai Bolt Food logotipi, attēli vai ikonas.
