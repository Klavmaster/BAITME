# BaitMe — Stripe Connect un atmaksu izstrādes plāns (2026-10-18)

## Fiksēts biznesa modelis

- Klients apmaksā ēdienu + piegādi. **Nav papildu maksas par bankas kartes izmantošanu.**
- Kurjeram par sekmīgi pabeigtu pasūtījumu 100% no piegādes cenas.
- Restorāns saņem ēdiena cenu **pirms** izmaksu atvilkšanas. Restorāns **sedz faktiskās maksājumu apstrādes izmaksas**; neto izmaksājamā summa ir attiecīgi mazāka.
- BaitMe komisija 0% un abonementi 0 €. Tomēr Stripe Connect riski/izdevumi, PVN, chargeback un infrastruktūra nepazūd.

### Tikai ilustrācija (nevis Stripe cena)

| Pozīcija | Summa |
|---|---:|
| Klienta ēdiens | 20,00 € |
| Klienta piegāde | 3,50 € |
| Klients kopā | **23,50 €** |
| Kurjera piegādes atlīdzība | 3,50 € |
| Stripe transakcijas maksas piemērs (nav pārbaudīta likme) | 0,61 € |
| Restorāna hipotētiskais neto | 19,39 € |
| BaitMe komisija | 0,00 € |

Stripe faktiskā maksa var atšķirties pēc maksājuma veida, valsts, Connect līguma, valūtas un atmaksu apstrādes. Atsevišķos Stripe Connect modeļos Stripe primāri debetē **platformas** bilanci pat tad, ja ekonomiski restorāns sedz šo maksu. Pirms naudas izņemšanas jāsagatavo precīzs settlements/ledger un kompensācijas mehānisms. Neizmantot klienta piemaksu, lai paslēptu kartes apstrādes maksu.

## Nākamā maksājumu integrācijas fāze (TEST vide)

1. Stripe Dashboard → Developers: izveidot / izmantot test API atslēgu un atsevišķu webhook signing secret, glabāt servera sekrētos, ne GitHub.
2. Stripe Connect: pārbaudīt connected accounts modeļus restorāniem un kurjeriem; atšķirības starp direct/destination/separate charges. **Nesākt produkcijas maksājumus bez saderīga modeļa, jo platforma var būt atbildīga par refundiem un strīdiem.**
3. Checkout: serveris izveido PaymentIntent no DB pasūtījuma cenas, ar idempotency key. Kartes informāciju ievāc Stripe SDK, ne pašu API.
4. Signed webhook (raw body) apstiprina \`payment_intent.succeeded\`; tad un tikai tad DB atzīmē pasūtījumu kā apmaksātu. Dublikāti / nepieņemamu stāvokļu notikumi jāapstrādā idempotenti.
5. Pēc ēdiena sagatavošanas un pabeigtas piegādes: ledger un apstiprinātas transfers, saglabājot pilnu kurjera piegādes maksu.
6. Faktiskā \`balance_transaction.fee\` uzskaite, restorāna neto pārskats un payout reconciliation. Refund un chargeback kontroles.
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
