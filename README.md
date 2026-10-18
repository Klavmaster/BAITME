# BaitMe — 0% commission food delivery

**Status: staging development, not a production booking/payment platform.**

BaitMe Latvijā: klientam restorāna ēdiena cena un piegāde; restorānam ēdiena cena, no kuras tas sedz maksājumu apstrādes izmaksas; kurjeram pilna piegādes atlīdzība tikai pēc apmaksātas, pabeigtas piegādes; BaitMe komisija 0%, abonementi 0 €.

🚀 **[SĀKT ŠEIT — uzstādīšanas instrukcija latviski](docs/START-HERE-LV.md)**

## Jaunie noteikumi (18.10.2026)

- Klients ievada precīzu adresi (pašlaik iela/māja un LV pasta indekss, bez ģeokodēšanas verifikācijas).
- Kurjers **pats** atļauj priekšplāna GPS kopīgošanu tikai savai aktīvajai piegādei; var jebkurā brīdī izslēgt; nepieciešams fona izsekošanas un karšu infrastruktūras darbs pirms produkcijas.
- Restorāns sedz maksājuma apstrādes izmaksas; BaitMe komisija ir 0%, kurjeram piegādes maksa tiek ieskaitīta pilnā apmērā pēc veiksmīgas piegādes.
- Klients var iesniegt sūdzību tikai par apmaksātu pasūtījumu; restorāns sniedz skaidrojumu un rekomendē daļēju atmaksu, operators apstiprina vai noraida. **Apstiprinājums nav reāls Stripe refund.**
- Atmaksas termiņš pēc izpildes iniciēšanas parasti ir 5–10 darba dienas (aptuveni 14 kalendārās dienas), taču bankas var aizkavēt izmaksu.

## Sistēmas daļas

| Projekts | Funkcija | Startēšana |
|---|---|---|
| \`apps/customer\` | Expo iOS/Android klients, katalogs, grozs, auth, neapmaksāti testa pasūtījumi | \`npm run customer\` |
| \`apps/restaurant\` | Expo restorāna pasūtījumu vadība | \`npm run restaurant\` |
| \`apps/courier\` | Expo kurjera piegāžu vadība | \`npm run courier\` |
| \`apps/business-web\` | Next.js restorāna biznesa panelis | \`npm run business\` |
| \`services/api\` | Express API, Supabase Auth, cenas un statusi tikai serverī | \`npm run api\` |
| \`packages/core\` | Zero-commission domēna aprēķini, statusu noteikumi | \`npm test\` |
| \`supabase/migrations\` | DB, lomas, RLS, atomiski RPC | manuāla migrāciju izpilde Supabase |
| \`design/\` | FigCraft-importējams BaitMe UI dizains, tokeni | \`design/README.md\` |

\`\`\`sh
git clone https://github.com/Klavmaster/BAITME.git
cd BAITME
npm install
npm test
npm run typecheck
\`\`\`

**Nepieciešamie pieslēgumi:** Supabase URL, anon key un server-only service-role key; API hostinga adrese; restorānu un kurjeru konti. Kā to izdarīt soli pa solim: [docs/START-HERE-LV.md](docs/START-HERE-LV.md).

**Maksājumi NAV aktivizēti:** restorāns segs maksājuma apstrādes izmaksas; klientam kartes piemaksa netiek iekasēta. Stripe Connect izmaksu sadales un atbildības mehānisms vēl jāintegrē un jāverificē. Skati [produkcijas bloķētājus](docs/PRODUCTION-GATES.md). Neievadi nevienu Stripe secret, Supabase service role vai citu noslēpumu git repozitorijā.

Viss restorānu, karšu, ierīču un pasūtījumu saturs bez reāliem ārējiem kontiem ir staging/demo dati. Īstu pasūtījumu piegāde ir bloķēta, kamēr nav pārbaudītu maksājumu.
