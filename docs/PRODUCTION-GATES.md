# BaitMe — release blockers & acceptance gates

**Stāvoklis:** izstrādes/staging MVP, **nav** produkcijas gatavības apliecinājums.

| Bloks | Tagad | Obligāti pirms produkcijas |
|---|---|---|
| Klienta katalogs/grozs | Servera dati, e-pasta autentifikācija, test-order uzmetums | UX QA, pieejamība, faktiski restorāni |
| Restorānu vadība | Lomu pārbaudes, ēdienkarte, statusi, piegādes zonas | Restorāna datu verifikācija, līgums, statusu notifikācijas |
| Kurjera darbība | Apstiprināta kurjera pieteikšanās, atomiska job claim un apmaksātu order piegādes stāvokļi | GPS kopīgošanas atļauja un pēdējā pozīcija izveidota, bet vēl vajag karti, servera dzēšanas grafiku, izsekošanu fonā tikai ar papildu piekrišanu, notifikācijas, atbalstu, KYC/līgumus |
| Fiksētā BaitMe maksa | 0,50 € uzkrājums DB tikai pēc `delivered`, **Stripe iekasēšana nav ieviesta** | PVN, rēķini, priekšlaicīgas/daļējas atmaksas, dublikātu aizsardzība, negatīvu izmaksu novēršana |
| Maksājumi | Reāla apmaksa izslēgta | Stripe Connect, SCA/3DS, verificēti webhook, idempotence, refund/chargeback, ledger un reconciliation |
| Maksājumu apstrādes izmaksas | Klienta piemaksa 0; paredzēta restorāna apstrādes izmaksu segšana | Stripe bilanču transakciju fee precīza uzskaite un restorāna neto izmaksas, platformas risku kontrole |
| Adreses/piegādes zonas | Pasta indeksa prefiksu sākotnējā pieeja | Reāla servera geokodēšana, zonas/attālumi, cenu pārbaude, kļūdainu adrešu apstrāde |
| Sūdzību izskatīšana un refund | Klienta sūdzība, restorāna skaidrojums, admin lēmums **bez Stripe naudas atgriešanas** | Stripe refund izpildes rinda, idempotence, webhook, transfer reversals, paziņojumi, bankas statusu salāgošana |
| Juridiskā atbilstība | Tikai pamatprincipu dokumentācija | GDPR, privātuma politika, noteikumi, PVN/invoicing, tiesības par restorānu pārdošanu, pārtikas drošība, kurjeru līgumi |
| Drošība | API auth, lomas, RLS, server-side prices, SecureStore mobilajā | Rate limiting, audit, penetration testing, secret rotation, backups, monitoring, abuse/fraud controls |
| Reliability | Automātiskie unit testi un TypeScript | DB integrācijas testi, E2E, zaudētu webhook atkopšana, finanšu invarianti |
| Ops/admin | Biznesa panelis, platformas operatora pieteikumu UI un manuāla priekšapstiprināšana | Pilna KYC verifikācija, restorāna publicēšanas/kuriers aktivācijas UI, strīdi, refunds, failover |
| Publicēšana | Lokāla Expo/Next/API palaišana | HTTPS, domēni, Apple App Store/Google Play konti, review, release pipeline |

## Maksājumu arhitektūras drošība

BaitMe biznesa modelis: procentuālā komisija 0%, fiksētā maksa 0,50 € par apmaksātu/pabeigtu pasūtījumu, abonementi 0€, restorāna ēdiena cena pirms izmaksām restorānam un piegādes cena 100% kurjeram **par sekmīgi izpildītu piegādi**. **Jaunais apstiprinātais modelis:** restorāns sedz maksājumu apstrādes izmaksas, nevis klients. Tās jāatskaita no restorāna neto norēķina pēc Stripe faktiskā `balance_transaction.fee`, saglabājot kurjera pilnu piegādes atlīdzību. BaitMe no restorāna saņem 0,50 € fiksētu platformas maksu par pabeigtu pasūtījumu (pagājušajā posmā bija 0%). Stripe Connect separate charges and transfers platformai var nozīmēt negatīvo atlikumu, strīdu un refund atbildību; šo modeli nedrīkst uzskatīt par bezmaksas/bezriska BaitMe. Gan klienta maksa, gan nodokļi jāizvērtē individuāli.

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
