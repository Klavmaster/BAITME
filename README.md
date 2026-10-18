# BaitMe

BaitMe ir restorānu ēdienu piegādes platforma Latvijai. Klients maksā restorāna norādīto ēdiena cenu un piegādi. Projekta mērķis ir, lai arī maksājumu apstrādes izmaksas segtu klients, kur to atļauj maksājuma veids un piemērojamie tiesību akti. BaitMe neietur komisiju vai abonementu.

## Produkta modelis — apstiprināts 2026-10-18

- **Klients:** maksā ēdienu un piegādi; maksājumu apstrādes maksa ir iecerēta tikai juridiski atļautam risinājumam. Demo kopsavilkumā redzams ilustratīvs aprēķins; reālas iekasēšanas nav.
- **Restorāns:** par ēdienu saņem pilnu restorāna cenu; BaitMe komisija un abonements ir 0 €.
- **Kurjers:** pēc **pabeigtas** piegādes saņem pilnu klienta samaksāto piegādes cenu; BaitMe komisija un abonements ir 0 €.
- **BaitMe:** 0% komisija un 0 € abonements visiem dalībniekiem.
- **Maksājumu apstrāde:** lietotājs vēlas šo maksu segt klientam. **Juridiski būtiski:** Latvijā Maksājumu pakalpojumu un elektroniskās naudas likuma 77. panta trešā daļa aizliedz papildmaksu par konkrētu maksājuma instrumentu. Stripe norāda, ka EEZ parastiem B2C kartes maksājumiem piemaksa ir aizliegta. Neieviešam kartes piemaksu un neslēpjam to zem citas etiķetes. Meklējam legālu risinājumu vai atsevišķu finansējumu neizbēgamajām izmaksām. Stripe Connect arhitektūra, juridiskā atbildība, PVN, atmaksa un izmaksas jāapstiprina pirms produkcijas.
- **Demo maksa:** tikai simulēta 1,5% + 0,25 € EEZ standarta kartes maksas piemēra bruto aprēķinā; neietver visas iespējamās Connect/strīdu/atmaksu izmaksas un nav apmaksas piedāvājums.
- **Ēdiena cenu vienādība:** restorāna ēdienu cenu nepalielinām BaitMe pusē; dzīvē cenas atbilstību citām platformām nevar garantēt bez restorāna vienošanās.
- **Piegādes cena:** norādīta skaidri pirms apmaksas; par piegādes zonas un cenas konfigurēšanu atbild restorāns.
- **Veikalu piegāde:** nākamajā fāzē, ne MVP. Neveidojam taksometrus, sūtījumu servisu vai sludinājumus.

## Izstrādes secība

1. **Klienta mobilās lietotnes demonstrācijas prototips** — restorānu saraksts, meklēšana, izvēlne, grozs, ilustratīva apstrādes izmaksu simulācija; viss ar skaidri atzīmētiem demonstrācijas datiem.
2. Klientu konti, restorānu un ēdienkaršu datubāze, adreses un piegādes zonas.
3. Restorānu mobilā lietotne un biznesa tīmekļa panelis pasūtījumiem, cenām un atmaksām.
4. Kurjeru lietotne, piegādes uzdevumu piešķiršana, stāvokļi un izsekošana.
5. Stripe Connect maksājumu integrācija **tikai pēc** juridiskas/finansiālas plūsmas apstiprināšanas un testu vides pārbaudēm.

## FigCraft dizains

- [Rediģējamie mobilie ekrāni (SVG)](design/baitme-figcraft-screens.svg)
- [Dizaina sistēma](design/tokens.json)
- [FigCraft importēšanas instrukcija](design/README.md)

Šo vektoru dizainu var atvērt FigCraft vai konvertēt ar `figcraft-cli convert`. Tas vēl nav automātiski sinhronizēts ar Expo komponentēm.

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
