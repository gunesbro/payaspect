# PayAspect — Ürün Tanım Dokümanı (v0.1)

**Uygulama:** PayAspect: Expense & Payment
**Konumlandırma:** Gizlilik odaklı, tamamen cihaz üzerinde (on-device) çalışan harcama/ödeme analiz uygulaması.
**Lisans:** MIT (ücretsiz, açık kaynak)
**Platformlar:** Android + iOS (React Native / Expo dev client)
**Doküman durumu:** Taslak — onay bekliyor

---

## 1. Farkımız (Konumlandırma)

- **Sıfırveri sızıntısı:** API yok, bulut yok, telemetri/analytics yok. Çekirdekte ağ yok.
- **On-device AI:** OCR (ML Kit) + sınıflandırma (ONNX) + şablonlu özet tamamen cihazda.
- **Opsiyonel ağır LLM:** Serbest sohbet yalnızca kullanıcı indirirse, cihazda çalışır.
- **Küçük boyut & pil dostu:** Ağır model çekirdekte değil.
- **Çok dilli altyapı:** MVP'de TR + EN, sonradan çeviri dosyasıyla dil eklenir.
- **Çoklu para birimi:** Para birimleri ayrı toplanır; tek kurda birleştirme yok (şimdilik).

---

## 2. Kapsam Dışı (Bilinçli Olarak Yok)

- **Sosyal / paylaşım** (ortak gider bölüşme vb.) — gizlilik ilkesiyle çelişir.
- **Banka API / otomatik banka senkronu** — bulut gerektirir.
- **Çoklu cihaz senkron** — bulut gerektirir.
- **Otomatik kur çekme (varsayılan)** — kapalı; yalnızca kullanıcı isteğiyle, tek amaçla.
- **Tek kurda birleşik toplam** — MVP dışı.

---

## 3. Özellik Seti — MVP (Faz 1)

### 3.1 Girdi
- **Manuel giriş** (gider / gelir / transfer).
- **Resim OCR** (fiş/fatura): OCR metni → önceden doldurulmuş form → **kullanıcı onayı**.
- **PDF** — ikinci faz (MVP dışı).

### 3.2 Sınıflandırma (A katmanı — hafif çekirdek)
- On-device çok dilli model ile **kategori tahmini** (12/13 sabit kategori).
- Merchant + tutar + tarih çıkarımı (OCR'dan; kullanıcı düzeltir).

### 3.3 Doğal dil özeti (A katmanı)
- Şablonlu cümleler ("Bu ay markete X harcadın", "Geçen aya göre %Y artış").
- **Şablonlu soru-cevap** — sonraki faz.

### 3.4 Sohbet (B katmanı — opsiyonel, indirilebilir)
- Lokal quantized LLM (Qwen/Gemma) — kullanıcı indirirse.
- Modeller test edilip seçilir; Türkçe performansı doğrulanır.

### 3.5 Hesaplar
- Türler (sabit): **Nakit / Banka / Kredi Kartı / Kredi (Loan)**. Yatırım → sonraki faz.
- **Bütçe hesabı** (Nakit, Banka, Kredi Kartı) vs. izleme.
- Kredi Kartı / Kredi için **opsiyonel** limit, asgari ödeme günü, borç.
- Görünüm: **tüm hesapların birleşik toplamı** + **hesap bazlı** detay.

### 3.6 İşlem tipleri
- **Gider / Gelir / Transfer** (transfer: hesap arası, kategori yok).

### 3.7 Kategoriler
- **13 sabit ana kategori** (aşağıda) + alt kategoriler.
- Kullanıcı **ekleme / düzenleme / gizleme** yapabilir.

### 3.8 Tekrarlayan işlem tespiti
- Kurallı: aynı merchant + benzer tutar + düzenli aralık → "tekrarlayan" etiketi.

### 3.9 Analiz
- Toplam harcama (aylık).
- Kategori dağılımı (pie).
- Zaman trendi.
- Hesap bazlı toplamlar.
- **Para birimi bazlı** ayrı toplamlar.
- Merchant/satıcı bazlı özet.
- Anomali/karşılaştırma ("geçen aya göre %X artış"); yetersiz veride zarif "veri yok" durumu.

### 3.10 Para birimi
- Çoklu para birimi; para birimleri **ayrı toplanır**.
- Kurlar: offline varsayılan; **isteğe bağlı** kur güncelleme (tek amaç, kullanıcı tetikler).

### 3.11 Veri & Gizlilik
- **SQLCipher** (op-sqlite) şifreli yerel DB; anahtar Keychain/Keystore'da.
- Kullanıcı kontrollü dışa aktarma (CSV/JSON) ve şifreli yedekleme.
- Hiçbir telemetri yok.

---

## 4. Kategori Taksonomisi (13 ana kategori)

| # | Ana Kategori | Alt kategori örnekleri | YNAB karşılığı |
|---|--------------|------------------------|----------------|
| 1 | Konut & Ev Yaşamı | Kira, Aidat, Ev Faturaları, Bakım/Onarım | Fixed / Immediate Obligations |
| 2 | Market & Gıda | Süpermarket, Pazar, Kasap | Frequent / True |
| 3 | Yeme-İçme (Dışarıda) | Restoran, Kafe, Paket Servis, Kahve | Frequent / Fun Money |
| 4 | Ulaşım | Yakıt, Toplu Taşıma, Taksi, Araç Bakım | Frequent / True |
| 5 | Dijital & Abonelik | Netflix, Spotify, iCloud, Spor Salonu | Fixed |
| 6 | Sağlık | Eczane, Doktor, Sağlık Sigortası | True |
| 7 | Giyim & Kişisel Bakım | Kıyafet, Kuaför, Kozmetik | Frequent |
| 8 | Eğitim | Okul Taksiti, Kurs, Kitap, Çocuk | True |
| 9 | Eğlence & Hobi | Sinema/Konser, Seyahat, Oyun | Quality of Life |
| 10 | Borç & Kredi Ödemesi | Tüketici Kredisi, Kart Asgarisi, Elden Borç | Debt Paydown |
| 11 | Tasarruf & Yatırım | Acil Fon, Fon/Hisse, Altın, Kripto | Financial Goals |
| 12 | Sigorta & Vergi | Deprem, Hayat, MTV, Gelir Vergisi | True (Büyük) |
| 13 | Diğer / Nakit Giderler | Cep Harçlığı, Öngörülemeyen | Just in Case |

---

## 5. Sonraki Fazlar

- **Faz 2:** PDF parse, bütçe (basit/envelope), şablonlu soru-cevap, Yatırım izleme hesabı, daha fazla analiz.
- **Faz 3:** Opsiyonel LLM sohbet olgunlaştırma, ek diller, gelişmiş anomali, examples/ paketi.

---

## 6. Teknik Mimari (özet)

```
payaspect/ (monorepo)
├── core/        # UI'dan bağımsız: AI, OCR, DB, sınıflandırma, parsers
├── app/         # React Native (Expo dev client) UI
├── models/      # model manifestleri (ağır dosyalar gitignore)
└── docs/        # dokümanlar
```

- **Test/fork ayrımı:** isteyen `core`'u kendi uygulamasında kullanır; isteyen tüm repoyu forklar.
- **AI:** ONNX Runtime Mobile (INT8/FP16, <50MB çekirdek), ML Kit OCR, opsiyonel llama.cpp.
- **DB:** op-sqlite + SQLCipher.
- **i18n:** baştan altyapı; TR + EN.

---

## 7. Açık / Doğrulanacak Noktalar

- [ ] A katmanı embedding modeli seçimi (çok dilli, quantized) — test edilecek.
- [ ] Türkçe sınıflandırma doğruluğu testi.
- [ ] Opsiyonel LLM (Qwen vs Gemma) Türkçe kalite/boyut testi.
- [ ] Kur sağlayıcı (opsiyonel güncelleme için) seçimi — key'siz, minimal.
