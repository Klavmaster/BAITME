# BaitMe — palaišana soli pa solim (2026-10-18)

## 1. Kas jau ir uzrakstīts

- **Klients:** Expo mobilā lietotne ar sākuma demonstrācijas režīmu; pēc pieslēgumu norādīšanas restorānu un ēdienkartes ielasa no API, ir Supabase reģistrācija, autorizācija, grozs, pasta indeksa zonu izvēle un neapmaksāta testa pasūtījuma uzmetums.
- **Restorāns:** Expo mobilā lietotne apstiprināta restorāna personālam, pasūtījumu pieņemšanai un gatavošanas statusiem (TIKAI apmaksātiem pasūtījumiem).
- **Kurjers:** Expo mobilā lietotne apstiprinātiem kurjeriem, pieejamo apmaksāto pasūtījumu saņemšanai un piegādes pabeigšanai.
- **Biznesa panelis:** Next.js tīmekļa saskarne restorānu darbiniekiem; ēdienkartes/cenas/pieejamība, piegādes zonas, pasūtījumi, vienkārša statistika.
- **API + DB:** Express 5, Supabase Auth validācija, servera lomu pārbaudes, Supabase/Postgres/RLS, atomiska cenas fiksēšana DB un piegādes uzdevuma piešķiršana.
- **FigCraft:** rediģējams 3 ekrānu SVG un dizaina tokeni mapē \`design/\`.

Visu reālo maksājumu, atmaksu un Stripe izmaksu funkcionalitāte vēl NAV pieslēgta.

## 2. Kas vajadzīgs

1. GitHub repozitorijs (jau izveidots): https://github.com/Klavmaster/BAITME
2. **Node.js 22+** uz Mac.
3. **Supabase projekts** un tā \`Project URL\`, \`anon/public key\`, \`service_role key\` (tikai serverim).
4. Testēšanai Expo Go saderīga versija / iOS/Android simulators.
5. HTTPS API serveris un hostings biznesa panelim, kad izvēlēsies publicēt.
6. Vēlāk: Stripe Connect uzņēmuma konts, izpēte par juridisko maksājumu un apliekamo summu modeli, geokodēšanas/adrešu serviss, Apple/Google izstrādātāja konti.

## 3. Uzstādīt projektu

Terminālī:

\`\`\`bash
git clone https://github.com/Klavmaster/BAITME.git
cd BAITME
npm install
npm test
npm run typecheck
\`\`\`

## 4. Izveidot Supabase

- https://supabase.com/dashboard -> New project
- Project URL un public anon key ir paredzētas klienta lietotnēm.
- Service role key dod pilnu DB piekļuvi, tāpēc to glabāt **tikai servera vidē** un NEKAD neievietot \`EXPO_PUBLIC_*\`, \`NEXT_PUBLIC_*\`, GitHub vai mobilajā lietotnē.
- SQL Editor: palaist secīgi:
  1. \`supabase/migrations/202610180001_baitme_init.sql\`
  2. \`supabase/migrations/202610180002_security_lockdown.sql\`
- Ieslēgt e-pasta autentifikāciju, pārbaudīt Supabase sūtīto reģistrācijas e-pastu un HTTPS URL.
- Darbinieku/kurjeru kontus sākotnēji izveidot caur Supabase Auth (apstiprināšana manuāla).

**DB izmaiņas jāveic staging/test vidē, nevis bez pārbaudes produkcijā.**

## 5. Pievienot vides konfigurāciju

\`\`\`bash
cp services/api/.env.example services/api/.env
cp apps/customer/.env.example apps/customer/.env.local
cp apps/restaurant/.env.example apps/restaurant/.env.local
cp apps/courier/.env.example apps/courier/.env.local
cp apps/business-web/.env.example apps/business-web/.env.local
\`\`\`

Aizstāj \`YOUR-PROJECT\`, publisko anon atslēgu un servera service-role atslēgu ar savām Supabase vērtībām. 
Mobilajām lietotnēm \`EXPO_PUBLIC_API_URL\` jābūt sasniedzamam no telefona, piem., \`http://192.168.1.100:8787\` (nevis \`localhost\` uz telefona).
Uz servera \`ALLOWED_ORIGINS\` pievieno sava web paneļa vietni, piem., \`https://business.baitme.lv\`.

**Neuzkopē .env failus GitHub!** Tie jau iekļauti .gitignore.

## 6. Lokāli palaist

Atver 5 Terminal logus:

\`\`\`bash
# Logs 1: API
npm run api

# Logs 2: biznesa panelis (http://localhost:3000)
npm run business

# Logs 3: klients
npm run customer

# Logs 4: restorāns
npm run restaurant

# Logs 5: kurjers
npm run courier
\`\`\`

Pirmajā reizē restorānu saraksts būs tukšs, kamēr nav ievadīti restorāni. Expo bez vides konfigurācijas rāda demonstrācijas datus.

## 7. Pievienot pirmo restorānu

1. Supabase → Authentication → Users: izveido restorāna darbinieka kontu un nokopē tā lietotāja \`UUID\`.
2. SQL Editor aizstāj \`USER_UUID\` ar šo UUID:

\`\`\`sql
with r as (
  insert into public.restaurants(owner_user_id,slug,name,category,description,published)
  values ('USER_UUID'::uuid,'mans-restorans','Mans restorāns','Burgeri','Ēdienu piegāde',true)
  returning id
)
insert into public.restaurant_staff(restaurant_id,user_id,role)
select id,'USER_UUID'::uuid,'owner' from r;
\`\`\`

3. Atver biznesa paneli, pieslēdzies ar restorāna kontu, pievieno ēdienus un piegādes zonas.
4. Klientu lietotnē ar konfigurētām Supabase/API adresēm parādīsies jaunais restorāns.

## 8. Apstiprināt kurjeru (staging)

1. Izveido kurjera Supabase Auth kontu, pieraksti tā UUID.
2. SQL Editor:

\`\`\`sql
insert into public.courier_profiles(user_id,display_name,approved)
values ('USER_UUID'::uuid,'Kurjers A',true);
\`\`\`

**Uzmanību:** produkcijā vajadzīga kurjeru identitātes, līgumu un Stripe Connect konta pārbaude.

## 9. Kas jāizdara pirms klientu palaišanas

Skati \`docs/PRODUCTION-GATES.md\`. Pat pēc Supabase pieslēgšanas aplikāciju vēl nedrīkst izmantot naudas iekasēšanai.

Pašlaik pasūtījums paliek \`awaiting_payment\`. Nav tiesību to atzīmēt kā samaksātu tikai ar lietotāja klikšķi — serverī jāievieš Stripe pārbaudīts webhook un pilna reconciliācijas sistēma. Testa pasūtījums nav īsts ēdiena pasūtījums.
