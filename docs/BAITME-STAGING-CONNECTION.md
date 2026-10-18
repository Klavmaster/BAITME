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
