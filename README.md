# BaitMe

BaitMe ir restorānu ēdienu piegādes platforma Latvijai. Klients maksā restorāna norādīto ēdiena cenu un konkrētā pasūtījuma piegādes cenu. BaitMe neietur komisiju, abonementu vai servisa maksu.

## Produkta modelis — apstiprināts 2026-10-18

- **Klients:** maksā tikai ēdienu un piegādi; nav platformas piemaksas.
- **Restorāns:** par ēdienu saņem pilnu restorāna cenu; BaitMe komisija un abonements ir 0 €.
- **Kurjers:** pēc **pabeigtas** piegādes saņem pilnu klienta samaksāto piegādes cenu; BaitMe komisija un abonements ir 0 €.
- **BaitMe:** 0% komisija un 0 € abonements visiem dalībniekiem.
- **Maksājumu procesora izmaksas:** ir reālas ārējās izmaksas. Ja nevienam dalībniekam netiek ieturēta summa, BaitMe nepieciešams atsevišķs finansējums šo izmaksu segšanai. Stripe Connect arhitektūra, juridiskā atbildība, PVN, atmaksa un maksājumu plūsma pirms produkcijas jāapstiprina.
- **Ēdiena cenu vienādība:** restorāna ēdienu cenu nepalielinām BaitMe pusē; dzīvē cenas atbilstību citām platformām nevar garantēt bez restorāna vienošanās.
- **Piegādes cena:** norādīta skaidri pirms apmaksas; par piegādes zonas un cenas konfigurēšanu atbild restorāns.
- **Veikalu piegāde:** nākamajā fāzē, ne MVP. Neveidojam taksometrus, sūtījumu servisu vai sludinājumus.

## Izstrādes secība

1. **Klienta mobilās lietotnes demonstrācijas prototips** — restorānu saraksts, meklēšana, izvēlne, grozs un cenu aprēķins; viss ar skaidri atzīmētiem demonstrācijas datiem.
2. Klientu konti, restorānu un ēdienkaršu datubāze, adreses un piegādes zonas.
3. Restorānu mobilā lietotne un biznesa tīmekļa panelis pasūtījumiem, cenām un atmaksām.
4. Kurjeru lietotne, piegādes uzdevumu piešķiršana, stāvokļi un izsekošana.
5. Stripe Connect maksājumu integrācija **tikai pēc** juridiskas/finansiālas plūsmas apstiprināšanas un testu vides pārbaudēm.

## Startēšana (klientu prototips)

Vajadzīgs Node.js >= 22.13.

```bash
git clone https://github.com/Klavmaster/BAITME.git
cd BAITME
npm install
npm run customer
```

Expo CLI rāda QR kodu. Atver ar Expo Go saderīgā ierīcē (SDK 57) vai ar simulatoru. Prototips darbojas bez backend, datubāzes vai Stripe.

## Ierobežojumi

**Šis nav produkcijas serviss.** Nav reālu pasūtījumu, maksājumu, autentifikācijas, kurjeru, restorānu datubāzes, atgriešanas mehānisma un GPS izsekošanas. Nespiediet `Maksāt` ar reāliem klientiem, līdz būs droša maksājumu integrācija un visi procesi. Nepievienot API atslēgas, paroli vai citu sensitīvu informāciju repozitorijam.
