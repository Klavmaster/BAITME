# BaitMe — Stripe Connect un atmaksu izstrādes plāns (2026-10-18)

## Fiksēts biznesa modelis

- Klients apmaksā ēdienu + piegādi. **Nav papildu maksas par bankas kartes izmantošanu.**
- Kurjeram par sekmīgi pabeigtu pasūtījumu 100% no piegādes cenas.
- Restorāns saņem ēdiena cenu **pirms** izmaksu atvilkšanas. Restorāns **sedz faktiskās maksājumu apstrādes izmaksas**; neto izmaksājamā summa ir attiecīgi mazāka.
- **BaitMe fiksētā platformas maksa 0,50 € par katru apmaksātu, sekmīgi pabeigtu pasūtījumu.** Tā ir restorāna maksa (nevis klienta) un netiek aprēķināta atceltiem/nepiegādātiem pasūtījumiem. Procentuālā komisija 0%, abonementi 0 €.
- Maksa tiek **uzkrāta vienreiz** ar atomisku datubāzes ierakstu `platform_fee_ledger`, kad pasūtījuma statuss kļūst `delivered`. Pagaidām nav Stripe pārskaitījuma — tikai uzskaite. Stripe apstrāde, nodokļi, strīdi, atmaksas un infrastruktūra var radīt atsevišķas izmaksas.

### Tikai ilustrācija (nevis Stripe cena)

| Pozīcija | Summa |
|---|---:|
| Klienta ēdiens | 20,00 € |
| Klienta piegāde | 3,50 € |
| Klients kopā | **23,50 €** |
| Kurjera piegādes atlīdzība | 3,50 € |
| Stripe transakcijas maksas piemērs (nav pārbaudīta likme) | 0,61 € |
| BaitMe fiksētā maksa restorānam (uzkrāta, nevis vēl iekasēta) | 0,50 € |
| Restorāna hipotētiskais neto | **18,89 €** |
| BaitMe platformas bruto maksa | **0,50 €** |

**PVN:** 0,50 € uzskatāmi par kopējo fiksēto maksu (PVN, ja piemērojams, ietilpst tajā, nevis tiek klāt pielikti vēl 21%). Pirms produkcijas jānoskaidro BaitMe juridiskā pakalpojuma sniedzēja PVN statuss, rēķinu izrakstīšana un 50 centu ieturējuma nodokļu uzskaite. Latvijā standartlikme parasti ir 21%; konkrēto piemērošanu jāapstiprina grāmatvedim.
**Mazie pasūtījumi:** jāievieš minimālā pasūtījuma vērtība vai restorāna deficīta uzskaite, ja ēdiena cena mazāka par 0,50 € + Stripe izmaksām. Nedrīkst izpildīt negatīvu pārskaitījumu.

Stripe faktiskā maksa var atšķirties pēc maksājuma veida, valsts, Connect līguma, valūtas un atmaksu apstrādes. Atsevišķos Stripe Connect modeļos Stripe primāri debetē **platformas** bilanci pat tad, ja ekonomiski restorāns sedz šo maksu. Pirms naudas izņemšanas jāsagatavo precīzs settlements/ledger un kompensācijas mehānisms. Neizmantot klienta piemaksu, lai paslēptu kartes apstrādes maksu.

## Nākamā maksājumu integrācijas fāze (TEST vide)

1. Stripe Dashboard → Developers: izveidot / izmantot test API atslēgu un atsevišķu webhook signing secret, glabāt servera sekrētos, ne GitHub.
2. Stripe Connect: pārbaudīt connected accounts modeļus restorāniem un kurjeriem; atšķirības starp direct/destination/separate charges. **Nesākt produkcijas maksājumus bez saderīga modeļa, jo platforma var būt atbildīga par refundiem un strīdiem.**
3. Checkout: serveris izveido PaymentIntent no DB pasūtījuma cenas, ar idempotency key. Kartes informāciju ievāc Stripe SDK, ne pašu API.
4. Signed webhook (raw body) apstiprina \`payment_intent.succeeded\`; tad un tikai tad DB atzīmē pasūtījumu kā apmaksātu. Dublikāti / nepieņemamu stāvokļu notikumi jāapstrādā idempotenti.
5. Pēc ēdiena sagatavošanas un pabeigtas piegādes: kurjera atlīdzības ledger + vienreizēja 0,50 € BaitMe maksas uzkrāšana. Tikai pēc tam, kad Stripe norēķini būs saskaņoti, drīkst izpildīt transfers, saglabājot pilnu kurjera piegādes summu.
6. Faktiskā \`balance_transaction.fee\` uzskaite, restorāna neto pārskats = ēdiena cena − Stripe maksa − BaitMe 0,50 €; PVN/rēķini, refund/cancellation fee reversals un payout reconciliation. Refund un chargeback kontroles.
7. Tests ar Stripe TEST režīmu: veiksmīgs/neveiksmīgs maksājums, 3DS, webhook replay, partial refund, transfer reversal, atcelta piegāde, nepareiza adrese, nozaudēta darbība.

## Sūdzības un atmaksas

1. Klients atver pasūtījumu, iesniedz sūdzību un vēlamo daļējās atmaksas summu.
2. Restorāns redz **Sūdzības** cilni, pievieno savu skaidrojumu un atbalstīto summu (var būt 0).
3. Platformas operators izvērtē abas puses, apstiprina summu līdz ēdiena daļai vai noraida. Galīgais lēmums ir saglabāts \`approved_pending_refund\`.
4. **Apstiprināšana neizpilda naudas atgriešanu.** Vēl jāizstrādā servera izpildītājs ar Stripe refunds API, idempotence, connected transfer reversals un iegādātās summas kontroles. Stripe \`refund.succeeded\`/atbilstošs stāvoklis jāapstiprina ar verificētu webhook un salāgojumu.
5. Klienta ekrānā izšķirt *izmeklēšana*, *apstiprināta atmaksa, vēl nav nosūtīta*, *atmaksa nosūtīta*, *bankā saņemta / pārbaudīta*.

**Klienta paziņojums par termiņu:** parasti 5–10 **darba** dienas no Stripe atmaksas uzsākšanas (aptuveni līdz 14 kalendārajām dienām), bet tas **nav garantēts maksimālais termiņš**; kavējumi vai nepietiekams atlikums var prasīt vairāk laika. Nedrīkst klientam uzrādīt \`refunded\`, pirms reālā maksājuma stāvoklis nav pārbaudīts.

**Sources**
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://support.stripe.com/questions/where-is-my-customers-refund
- https://docs.stripe.com/api/refunds

## GPS / adreses

- Klienta adrese obligāta un pašlaik glabājas pasūtījumā (teksts + indekss); dzīvas piegādes pirms produkcijas jāatbalsta ar geokodēšanu un validētu maršrutu, piegādes zonas cenu servera aprēķinu.
- Kurjers pats pieslēdz foreground atrašanās vietu tikai savai aktīvajai piegādei; serveris nepieņem GPS no cita kurjera.
- GPS punkts klientam pieejams tikai konkrētā apmaksātā aktīvā pasūtījumā, tikai pēdējās minūtes laikā. Neaktīvus punktus dzēš servera regulārais cleanup (funkcija DB: \`purge_expired_baitme_locations\`); uz hostinga jāuzliek stundu grafiks. Jāizstrādā reāla karte un nepieciešamības gadījumā background permission ar skaidru izvēli.
