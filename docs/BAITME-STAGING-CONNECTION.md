# BaitMe staging integrācija (18.10.2026)

## Pašreizējā infrastruktūra

| Vide | Adrese | Kas ir gatavs |
|---|---|---|
| Supabase PostgreSQL un Auth | https://supabase.com/dashboard/project/hwsbsdjrehjeqzxxcksr | 5 migrācijas, 15 tabulas, RLS, 0,50 € maksas uzskaite |
| Railway staging projekts | https://railway.com/project/fc5c6597-91bc-4670-a91a-561adea26a38 | Izveidots projekts, API un biznesa web servisi |
| API HTTPS | https://baitme-api-staging.up.railway.app | Railway domēns (pieejamība pēc deploy) |
| Biznesa web HTTPS | https://baitme-business-web-staging.up.railway.app | Railway domēns (pieejamība pēc deploy) |

## Kā pārbaudīt serveri

- `GET /health` — process atbild, **nenozīmē**, ka datubāze strādā.
- `GET /ready` — atgriež HTTP 200 tikai tad, ja servera Supabase secret/service-role atslēga ir konfigurēta UN datubāzes vaicājums izdodas; citādi 503.
- Stripe checkout paliek 503 jebkurā gadījumā, kamēr tas nav atsevišķi izveidots un auditēts.

## Vienīgā servera slepenā atslēga, kas vēl jāpievieno

1. Atver [Supabase API Keys](https://supabase.com/dashboard/project/hwsbsdjrehjeqzxxcksr/settings/api-keys).
2. Jaunā `sb_secret_...` atslēga vai vecā `service_role` atslēga ir **slepena**.
3. Atver [Railway BAITME](https://railway.com/project/fc5c6597-91bc-4670-a91a-561adea26a38), `staging` → `baitme-api` → Variables.
4. Pievieno `SUPABASE_SECRET_KEY` = jaunā `sb_secret_...` vērtība. Ja Supabase pieejama tikai vecā `service_role` atslēga, izmanto mainīgā nosaukumu `SUPABASE_SERVICE_ROLE_KEY`.
5. **Nekad neliec šo atslēgu GitHub, klienta .env, NEXT_PUBLIC, EXPO_PUBLIC vai čatā.** Ieslēdz Railway pārkonfigurētā servisa redeploy.
6. Verificē `https://baitme-api-staging.up.railway.app/ready` → `{"ready":true,"database":true,"payments":false}`.

Publiskā `SUPABASE_URL` un `SUPABASE_PUBLISHABLE_KEY` jau ir konfigurētas Railway API un web servisā. Tās var droši būt klienta build env; tās **nenodrošina** servera admin piekļuvi.

## Mobilās lietotnes no GitHub

Uz sava Mac:

```bash
git clone https://github.com/Klavmaster/BAITME.git
cd BAITME
npm install
npm run setup:staging
npm run customer
```

`setup:staging` izveido četrus git-ignorētus .env.local failus ar tikai PUBLIC staging parametriem. Eksistējošus failus tas neaizvieto, lai nebojātu lietotāja esošu konfigurāciju. Lai piespiedu kārtā atjaunotu staging konfigurāciju, palaid `npm run setup:staging -- --force` (tas pārraksta klienta .env.local).

Restorāna Expo: `npm run restaurant`; kurjera Expo: `npm run courier`. Biznesa panelis arī pieejams caur Railway HTTPS, kad web serviss būs izvietots.

## Funkcionālie smoke tests pēc servera noslēpuma pievienošanas

1. `GET /health` → 200; `GET /ready` → 200; `GET /v1/restaurants` → 200 un sākotnēji tukšs katalogs.
2. Supabase Authentication → Users: izveido **savus** autorizētos testa lietotājus, nevis izdomātus e-pastus; pārbaudi e-pasta apstiprinājumu.
3. Staging operatora kontam piešķir `public.platform_admins` pēc auth UUID pārbaudes (drošs SQL ir `docs/START-HERE-LV.md`).
4. Biznesa panelī pārbaudi pieteikumu/kurjeru apstiprināšanu, restorāna ēdienkarti, zonu un personāla atļaujas.
5. Klienta aplikācijā pārbaudi reģistrāciju, katalogu, grozu, pasūtījuma uzmetumu. Maksājums ir IZSLĒGTS, tāpēc pasūtījums paliek `awaiting_payment`.
6. Pilns `paid → delivered → EUR 0,50` process ir apstiprināts izolētā DB CI testā, **nevis** ar dzīvu Stripe maksājumu.

## Pirms īstiem klientiem

Stripe Connect testu maksājumi, maksājumu webhook ar idempotenci, daļējas atmaksas un naudas sadale, REST API rate-limiting, datu aizsardzība, adrešu validācija, kurjeru atļauju pārbaudes, monitorings, juridiskie dokumenti un veikala publicēšana vēl ir jāizdara.

## Neatkarīga pārbaude no GitHub Actions

Pēc katras izmaiņas `main` zarā atsevišķa darbplūsma [BaitMe staging smoke](https://github.com/Klavmaster/BAITME/actions/workflows/staging-smoke.yml) pārbauda abus publiskos HTTPS serverus. Tā izsauc `/health`, `/ready`, restorānu katalogu, atteikumu anonīmam `/v1/me`, un biznesa paneļa sākumlapu. `/ready` pierāda reālu servera Supabase piekļuvi; bez slepenās atslēgas tests nevar iziet. Tā neizveido pasūtījumus, lietotājus vai maksājumus.

Darbplūsmu var manuāli palaist arī GitHub Actions sadaļā. Staging pieejamības kļūda neietekmē CI lokālo PostgreSQL integrācijas testu rezultātus.

## Operatora pirmā konta izveide un droša piešķiršana

1. Atver https://baitme-business-web-staging.up.railway.app/apply un reģistrējies ar **savu** e-pastu un drošu paroli. Ja Supabase pieprasa e-pasta apstiprinājumu, pabeidz to, tad pieslēdzies.
2. Pieteikuma formu nav jāiesniedz, ja esi BaitMe operators. Kad pieslēdzies, redzams tava konta UUID (`Mans BaitMe testa konta ID`).
3. Konta ID nav parole. No šī ID pēc apstiprināšanas Supabase `platform_admins` tabulā tiek piešķirta operatora loma. Tikai autentificēts konts ar šo lomu drīkst atvērt /admin API darbības. **Nekādā gadījumā neļaut katram reģistrētam lietotājam sev piešķirt admin lomu.**
4. Atver https://baitme-business-web-staging.up.railway.app/admin un pieslēdzies ar to pašu kontu pēc operatora lomas piešķiršanas.

Svarīgi: neizveido nejaušus testa lietotājus tieši `auth.users` tabulā ar SQL; veido tos ar Supabase Auth reģistrāciju. Šobrīd nav Stripe, tādēļ visi reāli apmaksātie pasūtījumi ir bloķēti.

## Kategorijas un piegādes zonas (6. migrācija)

- Restorāna panelis → **Ēdienkarte**: vispirms izveido saglabājamu kategoriju, pēc tam ar **↑ Augstāk** / **↓ Zemāk** pārvieto to secībā. Kategoriju saraksts ir katram restorānam savs, nevis kopīgs visai platformai. Secība klienta katalogā nāk no DB.
- Esošajām ēdienu kategorijām migrācija automātiski noņēma tikai liekās sākuma/beigu atstarpes un pievienoja tās saglabāto kategoriju tabulai; ēdienu cenas un pasūtījumi nav mainīti.
- Restorāna panelis → **Piegādes zonas**: norādi sava restorāna **pilnu adresi** un **precīzas latitude/longitude koordinātas** (paņem no kartes, neuzmini), tad izveido zonas ar "No km", "Līdz km" un piegādes maksu. Piemērs: \`0–3 km / 3,50 €\`, \`3–7 km / 5,00 €\`. Katrai lokācijai jābūt savam restorāna ierakstam, ja nepieciešamas atsevišķas zonas/cenas.
- Zonu rādiuss šobrīd ir **taisnās līnijas attālums**, nevis braukšanas kilometri vai laiks. Aktīvās radiālās zonas vienam restorānam nevar pārklāties. Cits restorāns var izvēlēties pavisam citas zonas un cenas.
- **Drošības ierobežojums:** vēl nav integrēts uzticams klienta piegādes adreses ģeokodēšanas pakalpojums, tāpēc radius zonas var saglabāt un skatīt, taču tās **nav pasūtāmas**, kamēr serveris nespēj pats pārbaudīt attālumu. Klienta manuāli ievadīts LV pasta indekss vai pašdeklarētas koordinātas nav pierādījums par attālumu. Esošais legacy postal-prefix tests paliek tikai staging saderībai. Stripe joprojām izslēgts.

### Verifikācija

- GitHub Actions \`database-integration\`: pārbauda 6. migrāciju, kategoriju augšup/lejup secību, restorānu lomu izolāciju, attāluma zonu pārklāšanās aizliegumu un atteiktus radius pasūtījumus bez verificētas adreses.
- \`build-and-test\`: React Native TypeScript, API un Next.js biznesa panelis.
- \`staging-smoke\`: reāls HTTPS API, datubāzes un web pieejamības tests pēc izvietošanas.
