import { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TextInput, Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { restaurants, Restaurant, MenuItem } from '../src/data/demo';
import LiveHome from '../src/LiveHome';
import { calculateBreakdown, formatEuro } from '../src/lib/pricing';

const PURPLE = '#6B4FEF';
const INK = '#1E1B2E';
const categories = ['Visi', 'Burgeri', 'Pica', 'Āzijas'];

function SmallTag({ children }: { children: string }) {
  return <View style={styles.tag}><Text style={styles.tagText}>{children}</Text></View>;
}

function RoundedButton({ title, onPress, subtle = false }: {
  title: string; onPress: () => void; subtle?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.roundedButton, subtle && styles.lightButton]}>
      <Text style={[styles.roundedButtonText, subtle && styles.lightButtonText]}>{title}</Text>
    </Pressable>
  );
}

function DemoCustomerHome() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Visi');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cartRestaurantId, setCartRestaurantId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);

  const cartRestaurant = restaurants.find((r) => r.id === cartRestaurantId);
  const count = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const lines = cartRestaurant?.menu
    .filter((item) => (quantities[item.id] || 0) > 0)
    .map((item) => ({ unitPriceCents: item.priceCents, quantity: quantities[item.id] })) || [];
  const baseBreakdown = calculateBreakdown(lines, count > 0 ? (cartRestaurant?.deliveryCents || 0) : 0);
  // Customer pays only restaurant food price + courier delivery.
  // Stripe processing costs are allocated to the restaurant in a verified
  // settlement later; they are NEVER a checkout surcharge.
  const breakdown = calculateBreakdown(lines, baseBreakdown.deliveryCents, 0);

  const filtered = useMemo(() => restaurants.filter((r) =>
    (category === 'Visi' || r.category === category) &&
    (r.name.toLocaleLowerCase('lv-LV').includes(search.toLocaleLowerCase('lv-LV')) ||
     r.category.toLocaleLowerCase('lv-LV').includes(search.toLocaleLowerCase('lv-LV')))
  ), [category, search]);

  function addItem(item: MenuItem) {
    if (!selectedRestaurant) return;
    if (cartRestaurantId !== selectedRestaurant.id) {
      setCartRestaurantId(selectedRestaurant.id);
      setQuantities({ [item.id]: 1 });
      return;
    }
    setQuantities((old) => ({ ...old, [item.id]: (old[item.id] || 0) + 1 }));
  }

  function changeQuantity(itemId: string, amount: number) {
    setQuantities((old) => {
      const next = { ...old };
      const quantity = Math.max(0, (next[itemId] || 0) + amount);
      if (quantity === 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {showCart ? (
        <>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => setShowCart(false)}>
              <Text style={styles.back}>‹ Atpakaļ</Text>
            </Pressable>
            <Text style={styles.navTitle}>Tavs grozs</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <Text style={styles.overline}>DEMONSTRĀCIJAS REŽĪMS</Text>
            <Text style={styles.pageTitle}>Tavs pasūtījums 🛍️</Text>
            {count === 0 || !cartRestaurant ? (
              <Text style={styles.muted}>Grozs ir tukšs. Izvēlies restorānu un pievieno ēdienu!</Text>
            ) : (
              <>
                <Text style={styles.sectionTitle}>{cartRestaurant.name}</Text>
                {cartRestaurant.menu.filter((item) => (quantities[item.id] || 0) > 0).map((item) => (
                  <View key={item.id} style={styles.cartLine}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuName}>{item.name}</Text>
                      <Text style={styles.muted}>{formatEuro(item.priceCents)}</Text>
                    </View>
                    <Pressable accessibilityLabel={'Noņemt vienu ' + item.name} onPress={() => changeQuantity(item.id, -1)} style={styles.qtyButton}>
                      <Text style={styles.qtyText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyNumber}>{quantities[item.id]}</Text>
                    <Pressable accessibilityLabel={'Pievienot vienu ' + item.name} onPress={() => changeQuantity(item.id, 1)} style={styles.qtyButton}>
                      <Text style={styles.qtyText}>+</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.summary}>
                  <View style={styles.amountRow}><Text>Ēdiens</Text><Text>{formatEuro(breakdown.foodCents)}</Text></View>
                  <View style={styles.amountRow}><Text>Piegāde (kurjeram 100%)</Text><Text>{formatEuro(breakdown.deliveryCents)}</Text></View>
                  <View style={styles.amountRow}><Text>Klienta maksājumu apstrādes piemaksa</Text><Text>0,00 €</Text></View>
                  <View style={styles.amountRow}><Text>BaitMe komisija</Text><Text>0,00 €</Text></View>
                  <View style={[styles.amountRow, styles.totalRow]}>
                    <Text style={styles.totalText}>Kopā</Text>
                    <Text style={styles.totalText}>{formatEuro(breakdown.totalCents)}</Text>
                  </View>
                </View>
                <Text style={styles.info}>
                  Restorāns sedz maksājumu apstrādes izmaksas no saviem ieņēmumiem, kad tās būs pārbaudītas Stripe Connect. Klients papildu kartes maksu nemaksā. Restorāna ēdiena daļa pirms apstrādes izmaksām: {formatEuro(breakdown.restaurantReceivesCents)}; kurjera piegādes daļa: {formatEuro(breakdown.courierReceivesCents)}. Reāli maksājumi vēl nav pieslēgti.
                </Text>
                <View style={styles.disabledButton}>
                  <Text style={styles.disabledText}>Demo — apmaksa nav pieejama</Text>
                </View>
                <RoundedButton title="Iztukšot grozu" subtle onPress={() => {
                  setQuantities({});
                  setCartRestaurantId(null);
                }} />
              </>
            )}
          </ScrollView>
        </>
      ) : selectedRestaurant ? (
        <>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => setSelectedRestaurant(null)}>
              <Text style={styles.back}>‹ Restorāni</Text>
            </Pressable>
            <Text style={styles.navTitle}>BaitMe</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <View style={[styles.hero, { backgroundColor: selectedRestaurant.accent }]}>
              <Text style={styles.heroEmoji}>{selectedRestaurant.emoji}</Text>
            </View>
            <Text style={styles.overline}>DEMO RESTORĀNS</Text>
            <Text style={styles.pageTitle}>{selectedRestaurant.name}</Text>
            <Text style={styles.muted}>{selectedRestaurant.tagline}</Text>
            <View style={styles.metaRow}>
              <SmallTag>{'★ ' + selectedRestaurant.rating}</SmallTag>
              <SmallTag>{'⏱ ' + selectedRestaurant.eta}</SmallTag>
              <SmallTag>{'Piegāde ' + formatEuro(selectedRestaurant.deliveryCents)}</SmallTag>
            </View>
            <Text style={styles.sectionTitle}>Ēdienkarte</Text>
            {selectedRestaurant.menu.map((item) => (
              <View key={item.id} style={styles.menuCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.muted}>{item.description}</Text>
                  <Text style={styles.menuPrice}>{formatEuro(item.priceCents)}</Text>
                </View>
                <View style={styles.menuRight}>
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Pievienot ' + item.name}
                    onPress={() => addItem(item)} style={styles.addButton}>
                    <Text style={styles.addButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {cartRestaurantId && cartRestaurantId !== selectedRestaurant.id && count > 0 && (
              <Text style={styles.info}>Pievienojot ēdienu no cita restorāna, pašreizējais grozs tiks aizstāts.</Text>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.homeHeader}>
            <Text style={styles.brand}>bait<Text style={styles.brandAccent}>me.</Text></Text>
            <Text style={styles.overline}>PIEGĀDE UZ</Text>
            <Text style={styles.location}>📍 Latvija · izvēlies adresi vēlāk</Text>
            <Text style={styles.welcome}>Ko garšīgu šodien? 😋</Text>
            <Text style={styles.muted}>Ēdiens tieši no restorāna. Bez platformas komisijas.</Text>
            <TextInput
              accessibilityLabel="Meklēt restorānus"
              value={search}
              onChangeText={setSearch}
              placeholder="🔎  Meklēt restorānus vai virtuvi"
              placeholderTextColor="#92909D"
              style={styles.search}
            />
          </View>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
              {categories.map((name) => (
                <Pressable key={name} accessibilityRole="button" onPress={() => setCategory(name)}
                  style={[styles.chip, category === name && styles.chipActive]}>
                  <Text style={[styles.chipText, category === name && styles.chipTextActive]}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.valueBanner}>
              <Text style={styles.bannerTitle}>0% BaitMe komisija ✨</Text>
              <Text style={styles.bannerText}>Restorāns sedz maksājumu apstrādi, kurjers saņem pilnu piegādes maksu. Klients nemaksā BaitMe komisiju.</Text>
            </View>
            <Text style={styles.sectionTitle}>Garšīgākā izvēle tev</Text>
            <Text style={styles.demoNote}>Šobrīd redzami tikai paraugdati.</Text>
            {filtered.length === 0 && <Text style={styles.muted}>Nekas netika atrasts.</Text>}
            {filtered.map((r) => (
              <Pressable accessibilityRole="button" accessibilityLabel={'Atvērt ' + r.name}
                key={r.id} onPress={() => setSelectedRestaurant(r)} style={styles.restaurantCard}>
                <View style={[styles.restaurantArt, { backgroundColor: r.accent }]}>
                  <Text style={styles.restaurantEmoji}>{r.emoji}</Text>
                </View>
                <View style={styles.restaurantDetails}>
                  <Text style={styles.restaurantTitle}>{r.name}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{r.tagline}</Text>
                  <View style={styles.metaRow}>
                    <SmallTag>{'★ ' + r.rating}</SmallTag>
                    <SmallTag>{r.eta}</SmallTag>
                    <SmallTag>{formatEuro(r.deliveryCents) + ' piegāde'}</SmallTag>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {!showCart && count > 0 && (
        <Pressable accessibilityRole="button" onPress={() => setShowCart(true)} style={styles.cartBar}>
          <View style={styles.cartBubble}><Text style={styles.cartBubbleText}>{count}</Text></View>
          <Text style={styles.cartBarText}>Skatīt grozu</Text>
          <Text style={styles.cartBarText}>{formatEuro(breakdown.totalCents)}  →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F8FC' },
  scrollBody: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 130 },
  homeHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  brand: { color: INK, fontSize: 31, fontWeight: '900', letterSpacing: -1.8, marginBottom: 19 },
  brandAccent: { color: PURPLE },
  overline: { color: PURPLE, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  location: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 22 },
  welcome: { fontSize: 25, fontWeight: '900', color: INK, marginBottom: 5 },
  muted: { color: '#777482', fontSize: 13, lineHeight: 19 },
  search: { backgroundColor: '#F4F3F8', borderRadius: 16, marginTop: 20, paddingHorizontal: 17, height: 54, fontSize: 14, color: INK },
  filters: { marginBottom: 17, marginTop: 2 },
  chip: { paddingHorizontal: 19, paddingVertical: 11, marginRight: 9, borderRadius: 30, backgroundColor: '#ECEBF2' },
  chipActive: { backgroundColor: PURPLE },
  chipText: { color: INK, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  valueBanner: { backgroundColor: '#E7F9BC', borderRadius: 22, padding: 21, marginBottom: 23, borderWidth: 1, borderColor: '#D3EA98' },
  bannerTitle: { color: '#26341C', fontSize: 19, fontWeight: '900', marginBottom: 6 },
  bannerText: { color: '#485A32', fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: INK, fontSize: 20, fontWeight: '900', marginTop: 6, marginBottom: 12 },
  demoNote: { color: '#94919D', fontSize: 11, marginBottom: 10 },
  restaurantCard: { backgroundColor: 'white', borderRadius: 22, overflow: 'hidden', marginBottom: 17, borderWidth: 1, borderColor: '#ECEBF0' },
  restaurantArt: { height: 132, alignItems: 'center', justifyContent: 'center' },
  restaurantEmoji: { fontSize: 55 },
  restaurantDetails: { padding: 15, gap: 5 },
  restaurantTitle: { color: INK, fontSize: 18, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 3 },
  tag: { backgroundColor: '#F0EFF6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9 },
  tagText: { color: '#514F5E', fontWeight: '700', fontSize: 11 },
  topBar: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: PURPLE, fontSize: 15, fontWeight: '800' },
  navTitle: { color: INK, fontSize: 17, fontWeight: '900' },
  hero: { height: 172, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  heroEmoji: { fontSize: 85 },
  pageTitle: { color: INK, fontSize: 26, fontWeight: '900', marginBottom: 9 },
  menuCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EDEBF2', borderRadius: 16, padding: 17, marginBottom: 12, flexDirection: 'row', gap: 10 },
  menuName: { color: INK, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  menuPrice: { color: INK, fontSize: 16, fontWeight: '900', marginTop: 10 },
  menuRight: { alignItems: 'center', justifyContent: 'space-between' },
  menuEmoji: { fontSize: 38 },
  addButton: { backgroundColor: PURPLE, borderRadius: 99, height: 32, width: 32, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#FFF', fontSize: 25, lineHeight: 30, fontWeight: '600' },
  cartBar: { backgroundColor: PURPLE, marginHorizontal: 14, marginBottom: 12, padding: 13, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBarText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  cartBubble: { backgroundColor: '#FFF', height: 30, width: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cartBubbleText: { color: PURPLE, fontWeight: '900' },
  cartLine: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 13, marginBottom: 9 },
  qtyButton: { backgroundColor: '#EEEAFD', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  qtyText: { color: PURPLE, fontSize: 22, fontWeight: '700' },
  qtyNumber: { width: 34, textAlign: 'center', color: INK, fontWeight: '800' },
  summary: { backgroundColor: '#FFF', padding: 18, borderRadius: 16, marginTop: 13, marginBottom: 15, gap: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalRow: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#ECEBF2' },
  totalText: { fontSize: 19, fontWeight: '900', color: INK },
  info: { fontSize: 12, lineHeight: 19, color: '#666170', paddingVertical: 12 },
  disabledButton: { backgroundColor: '#D8D6E0', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 12 },
  disabledText: { color: '#635E70', fontWeight: '800', fontSize: 14 },
  roundedButton: { backgroundColor: PURPLE, padding: 16, alignItems: 'center', borderRadius: 15, marginTop: 10 },
  roundedButtonText: { color: '#FFF', fontWeight: '800' },
  lightButton: { backgroundColor: '#EEEAFD' },
  lightButtonText: { color: PURPLE },
});

export default function CustomerHome(){
  return process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? <LiveHome/> : <DemoCustomerHome/>;
}
