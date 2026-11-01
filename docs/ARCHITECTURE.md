# PayAspect — Teknik Mimari

**Durum:** Taslak — onay bekliyor
İlgili: `PRODUCT_SPEC.md`, `PRIVACY.md`

---

## 1. Genel Yapı (Monorepo)

```
payaspect/
├── core/                 # UI'dan bağımsız altyapı (kütüphane)
│   ├── src/
│   │   ├── db/           # şifreli SQLite, şema, migration, repository
│   │   ├── ai/           # OCR, sınıflandırıcı, özet motoru, LLM runtime
│   │   ├── parsers/      # OCR metin → işlem alanları, para/tarih parse
│   │   ├── domain/       # tipler, iş kuralları, tekrarlayan tespiti
│   │   ├── currency/     # çoklu para birimi, opsiyonel kur güncelleme
│   │   └── i18n/         # dil altyapısı + çeviriler
│   └── package.json
├── app/                  # React Native (Expo dev client) UI
│   ├── src/
│   │   ├── screens/      # dashboard, işlem ekle, analiz, hesaplar, ayarlar
│   │   ├── components/   # UI bileşenleri
│   │   ├── navigation/   # expo-router
│   │   ├── store/        # state (zustand vb.)
│   │   └── App.tsx
│   └── package.json
├── models/               # model manifestleri (ağır dosyalar gitignore)
├── docs/
└── package.json          # workspace root
```

- `core/` saf TypeScript + native modül köprüleri içerir, UI'dan bağımsızdır.
- İsteyen `core/`'u kendi uygulamasında kullanır; isteyen tüm repoyu forklar.

---

## 2. Veri Modeli (SQLite — SQLCipher)

### 2.1 Tablolar

**accounts**
| Alan | Tip | Not |
|------|-----|-----|
| id | TEXT PK | uuid |
| name | TEXT | kullanıcı adı |
| type | TEXT | cash, bank, credit_card, loan |
| currency | TEXT | ISO 4217 (TRY, USD...) |
| is_budget | INTEGER | 1 bütçe, 0 izleme |
| credit_limit | REAL NULL | opsiyonel (kart) |
| statement_day | INTEGER NULL | hesap kesim günü (ops.) |
| min_payment_day | INTEGER NULL | asgari ödeme günü (ops.) |
| note | TEXT NULL | |
| archived | INTEGER | 1 arşiv |
| created_at | INTEGER | epoch ms |

**categories**
| Alan | Tip | Not |
|------|-----|-----|
| id | TEXT PK | |
| key | TEXT | sabit kategoriler için (housing, groceries...) |
| name | TEXT | görünen ad (i18n key veya kullanıcı metni) |
| parent_id | TEXT NULL | alt kategori |
| type | TEXT | expense / income |
| is_system | INTEGER | 1 sabit varsayılan |
| hidden | INTEGER | 1 gizli |
| sort | INTEGER | |

**transactions**
| Alan | Tip | Not |
|------|-----|-----|
| id | TEXT PK | |
| type | TEXT | expense, income, transfer |
| amount | REAL | daima pozitif; yön type ile |
| currency | TEXT | ISO 4217 |
| account_id | TEXT FK | |
| to_account_id | TEXT NULL | transfer hedefi |
| category_id | TEXT NULL | transferde NULL |
| date | INTEGER | epoch ms |
| merchant | TEXT NULL | |
| note | TEXT NULL | |
| is_recurring | INTEGER | tekrarlayan tespiti |
| source | TEXT | manual, ocr |
| created_at | INTEGER | |

**attachments** (opsiyonel, fiş görseli — şifreli saklanır)
| id, transaction_id, file_path, mime, created_at |

**rates** (opsiyonel kur — kullanıcı tetikler)
| base, quote, rate, fetched_at |

### 2.2 İndeksler
- transactions(account_id, date)
- transactions(category_id, date)
- transactions(currency, date)
- categories(parent_id)

### 2.3 Güvenlik
- DB **SQLCipher** ile şifreli (op-sqlite, build flag `sqlcipher: true`).
- Anahtar: ilk açılışta 256-bit rastgele üretilir, **Keychain/Keystore** (expo-secure-store / react-native-keychain) saklanır.
- Anahtar hiçbir yere loglanmaz, ağa çıkmaz.
- DB dosyası uygulama sandbox'ında.

---

## 3. AI Pipeline

### 3.1 OCR (Resim → Metin)
- **ML Kit on-device Text Recognition**.
- Kamera/görsel → ön işleme (küçült, kontrast) → OCR → ham metin.
- Lisans/veri: tamamen cihazda.

### 3.2 Parse (Metin → Alanlar)
- Tutar, tarih, merchant, para birimi çıkarımı (TR + EN formatları: `1.234,56` / `1,234.56`, tarih varyantları).
- Regex + kurallı + sözlük tabanlı; sonuç **öneri** olarak forma dolar, kullanıcı onaylar.

### 3.3 Sınıflandırma (A katmanı — çekirdek)
- Çok dilli **sentence-embedding** (quantized, INT8, <50MB) + hafif sınıflandırıcı başlık.
- Girdi: merchant + not + OCR metni. Çıktı: 13 kategoriden skor.
- Çalışma: ONNX Runtime Mobile; çıkarım sonrası bellek serbest bırakılır.
- Model çekirdekte paketli; ağ yok.

### 3.4 Özet (A katmanı)
- Şablonlu cümle üretimi (i18n ile TR/EN), LLM gerekmez.

### 3.5 Sohbet (B katmanı — opsiyonel)
- İndirilebilir quantized LLM (Qwen2.5 / Gemma-2, GGUF, INT4).
- llama.cpp mobil runtime; yalnızca kullanıcı indirirse.
- Boyut/RAM/pil kullanıcıya açık şekilde gösterilir.

---

## 4. Para Birimi
- Para birimleri **ayrı toplanır** (MVP).
- Kurlar: offline varsayılan; **isteğe bağlı** güncelleme → tek açık kaynak, kullanıcı tetikler, sadece kur verisi.

---

## 5. Güvenlik Önlemleri
1. Şifreli DB (SQLCipher) + anahtar Keychain/Keystore.
2. Çekirdekte ağ yok; yalnızca opsiyonel kur/LLM indirme, açık kullanıcı eylemiyle.
3. Analytics/crash reporting yok; bağımlılıklar denetlenir.
4. Dışa aktarma kullanıcı kontrollü (CSV/JSON, şifreli yedek).
5. Girdi doğrulama (tutar/tarih), injection'a karşı parametreli SQL.
6. Ekran görüntüsü hassas ekranlarda maskeleme (opsiyonel, ileride).
7. Model dosyaları imza/checksum doğrulaması (indirme varsa).

---

## 6. Performans & Boyut
- **JSI tabanlı op-sqlite** (hızlı sorgular).
- FlatList/FlashList, memoization, native-driver animasyonlar.
- Lazy load ekranlar, kod bölme.
- Tree-shaking, yalnızca kullanılan native modüller; Hermes.
- Çekirdek model INT8 <50MB; ağır model indirilebilir.
- Sayfalama + sanallaştırma ile büyük veri listeleri.

---

## 7. i18n
- Baştan altyapı; `core/src/i18n` çeviri dosyaları (tr.json, en.json).
- Yeni dil = yeni çeviri dosyası.

---

## 8. Karar Bekleyenler
- [ ] State yönetimi: zustand (öneri) 
- [ ] Embedding model seçimi (çok dilli, quantized)
- [ ] Kur sağlayıcı (opsiyonel) — key'siz
- [ ] opsiyonel LLM modeli (Qwen vs Gemma) test sonrası
