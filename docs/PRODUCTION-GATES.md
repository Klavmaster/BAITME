# BaitMe — release blockers & acceptance gates

**Stāvoklis:** izstrādes/staging MVP, **nav** produkcijas gatavības apliecinājums.

| Bloks | Tagad | Obligāti pirms produkcijas |
|---|---|---|
| Klienta katalogs/grozs | Servera dati, e-pasta autentifikācija, test-order uzmetums | UX QA, pieejamība, faktiski restorāni |
| Restorānu vadība | Lomu pārbaudes, ēdienkarte, statusi, piegādes zonas | Restorāna datu verifikācija, līgums, statusu notifikācijas |
| Kurjera darbība | Apstiprināta kurjera pieteikšanās, atomiska job claim un apmaksātu order piegādes stāvokļi | GPS maršruts, atrašanās vieta, notifikācijas, atbalsts, KYC/līgumi |
| Maksājumi | Reāla apmaksa izslēgta | Stripe Connect, SCA/3DS, verificēti webhook, idempotence, refund/chargeback, ledger un reconciliation |
| Maksājumu apstrādes izmaksas | Demo kalkulators, LIVE papildu maksa 0 | Saskaņot juristu/PSP atļauto modeli; parasta karšu surcharge Latvijā aizliegta |
| Adreses/piegādes zonas | Pasta indeksa prefiksu sākotnējā pieeja | Reāla servera geokodēšana, zonas/attālumi, cenu pārbaude, kļūdainu adrešu apstrāde |
| Juridiskā atbilstība | Tikai pamatprincipu dokumentācija | GDPR, privātuma politika, noteikumi, PVN/invoicing, tiesības par restorānu pārdošanu, pārtikas drošība, kurjeru līgumi |
| Drošība | API auth, lomas, RLS, server-side prices, SecureStore mobilajā | Rate limiting, audit, penetration testing, secret rotation, backups, monitoring, abuse/fraud controls |
| Reliability | Automātiskie unit testi un TypeScript | DB integrācijas testi, E2E, zaudētu webhook atkopšana, finanšu invarianti |
| Ops/admin | Restorāna biznesa panelis | Platformas administratora UI, restorānu/kurjeru apstiprināšana, strīdi, refunds, failover |
| Publicēšana | Lokāla Expo/Next/API palaišana | HTTPS, domēni, Apple App Store/Google Play konti, review, release pipeline |

## Maksājumu arhitektūras drošība

BaitMe biznesa modelis: platformas komisija 0%, abonementi 0€, restorāna ēdiena cena 100% restorānam un piegādes cena 100% kurjeram **par sekmīgi izpildītu piegādi**. Ja klients arī segs apstrādes izmaksas, tas jāpanāk tikai tiesiski atļautā veidā. Stripe Connect separate charges and transfers platformai var nozīmēt negatīvo atlikumu, strīdu un refund atbildību; šo modeli nedrīkst uzskatīt par bezmaksas/bezriska BaitMe. Gan klienta maksa, gan nodokļi jāizvērtē individuāli.

**NEDRĪKST**: atzīmēt \`payment_status='paid'\` pēc klienta paziņojuma, izsniegt pārtiku par neapmaksātu pasūtījumu, izdarīt kurjera pārskaitījumu pirms \`delivered\`, automātiski refundēt kurjera atlīdzību bez specifikācijas.

## Īstais pirmais produkcijas milestones

1. Drošs maksājumu modelis parakstīts un verificēts ar Stripe un juristu.
2. Checkout PaymentIntent + webhook + split and escrow accounting, server-side idempotency.
3. Refunds/cancel/dispute policy, drošs courier ledger.
4. Geokodēšana un dzīva adreses validācija.
5. End-to-end staging tests: nopirkt, pieņemt, sagatavot, piegādāt, daļēji atmaksāt, chargeback.
6. Monitoring, datu piekļuves audits, pilota restorāni/kurjeri, tad publicēšana.

## Kowalski

Atvērtā koda Kowalski no \`yarenty/kowalski\` ir atsevišķa Rust AI aģentu sistēma. Tava GitHub \`Klavmaster\` konta repozitoriju sarakstā šobrīd nav Kowalski repozitorija. Nav droši automātiski pievienot vai izpildīt nezināmu ārēju aģentu izstrādes/produkcijas piekļuvē. Vajadzīgs precīzs rīka avots, versija, licencēšana un atļaujas; tas nav nepieciešams BaitMe klienta lietotnes darbībai.

## Craft / FigCraft

Atvērtā koda FigCraft no tava \`Klavmaster/figcraft-vendor\` repo ir dizaina izveides rīks. Oriģinālais BaitMe dizaina avots: \`design/baitme-figcraft-screens.svg\`. Importē FigCraft kā rediģējamu SVG; mobilais React Native dizains joprojām jāpielāgo tā dizaina sistēmas tokeniem.
