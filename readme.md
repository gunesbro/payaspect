# PayAspect: Expense & Payment

**Privacy-first, fully on-device expense and payment analysis app.**

PayAspect analyzes and categorizes your expenses and payments on your phone. Our difference: **none of your data ever leaves your device.** Bank and receipt details are analyzed entirely locally by on-device AI.

## Why PayAspect?

- **Zero data leakage:** No APIs, no cloud, no telemetry.
- **On-device AI:** Receipt/bank images and PDFs are OCR'd and categorized on-device.
- **Small size & battery-friendly:** Lightweight core; heavy language model is optional and downloadable.
- **Multilingual:** Turkish and English first; more languages via translation files.
- **Encrypted local storage:** Data is stored encrypted on-device.

## Features (Roadmap)

- [ ] Expense entry via image / PDF / manual
- [ ] Automatic category classification (on-device, multilingual)
- [ ] Natural-language summary (lightweight core model)
- [ ] Chat / Q&A (optional, downloadable local LLM)
- [ ] Payment tracking and receipt analysis
- [ ] Spending insights and charts
- [ ] Encrypted backup / export (user-controlled)

## Architecture

```
payaspect/ (monorepo)
|-- core/        # UI-independent infrastructure: domain, db, ai, parsers, currency, i18n
|-- app/         # React Native (Expo dev client) UI
|-- models/      # model manifests (heavy files ignored)
`-- docs/        # specs and docs
```

## AI Strategy (two tiers)

1. **Core (lightweight):** Multilingual sentence-embedding (~30-50MB, quantized) for category classification + template-based natural-language summary. Fully on-device, battery-friendly.
2. **Optional (downloadable):** Quantized local LLM (llama.cpp, ~300-700MB) for free-form chat / Q&A. Downloaded only if the user opts in; battery and size stay under user control.

## Privacy Principles

- The app uses **no** analytics, crash reporting, or cloud services.
- Data is stored **encrypted** on-device.
- Export happens only when the user triggers it, and only to the user.
- OCR and AI inference run **only on-device**.

## Docs

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`

## Contributing & Fork

- **Use the infrastructure:** The `core/` package is UI-independent; use it in your own app.
- **Fork the whole project:** Fork the repo and change it as you like.

## License

MIT (see `LICENSE`).

---

# PayAspect: Expense & Payment (Turkce)

**Gizlilik odakli, tamamen cihaz uzerinde (on-device) calisan harcama ve odeme analiz uygulamasi.**

PayAspect, harcamalarinizi ve odemelerinizi analiz edip siniflandiran bir mobil finans uygulamasidir. Farkimiz: **hicbir veriniz cihazinizdan disari cikmaz.** Banka/fatura detaylari, on-device AI ile tamamen lokalde analiz edilir.

## Neden PayAspect?

- **Sifir veri sizintisi:** API yok, bulut yok, telemetri yok.
- **Cihaz uzerinde AI:** Fis/banka gorselleri ve PDF'ler cihazda OCR + siniflandirilir.
- **Kucuk boyut & pil dostu:** Hafif cekirdek; agir dil modeli opsiyonel ve indirilebilir.
- **Cok dilli:** Oncelik Turkce ve Ingilizce; diger diller ceviri dosyalariyla.
- **Sifreli yerel depolama:** Veriler cihazda sifreli tutulur.

## Ozellikler (Yol Haritasi)

- [ ] Resim / PDF / manuel giris ile harcama kaydi
- [ ] Otomatik kategori siniflandirma (on-device, cok dilli)
- [ ] Dogal dil ozeti (hafif cekirdek model)
- [ ] Sohbet / soru-cevap (opsiyonel, indirilebilir lokal LLM)
- [ ] Odeme takibi ve fatura analizi
- [ ] Genel harcama analizleri ve grafikler
- [ ] Sifreli yedekleme / disa aktarma (kullanici kontrollu)

## Mimari

```
payaspect/ (monorepo)
|-- core/        # UI'dan bagimsiz altyapi: domain, db, ai, parsers, currency, i18n
|-- app/         # React Native (Expo dev client) UI
|-- models/      # model manifestleri (agir dosyalar ignore)
`-- docs/        # dokumanlar
```

## AI Stratejisi (iki katmanli)

1. **Cekirdek (hafif):** Cok dilli sentence-embedding (~30-50MB, quantized) ile kategori siniflandirma + sablon tabanli dogal dil ozeti. Tamamen cihazda, pil dostu.
2. **Opsiyonel (indirilebilir):** Quantized lokal LLM (llama.cpp, ~300-700MB) ile serbest sohbet / soru-cevap. Yalnizca kullanici isterse indirilir; pil ve boyut kullanici kontrolunde.

## Gizlilik Ilkeleri

- Uygulama **hicbir** analytics, crash reporting veya bulut servisi kullanmaz.
- Veriler cihazda **sifreli** saklanir.
- Disa aktarma yalnizca kullanici tetiklediginde ve yalnizca kullaniciya olur.
- OCR ve AI cikarimi **yalnizca cihazda** gerceklesir.

## Dokumanlar

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`

## Katki & Fork

- **Altyapiyi kullan:** `core/` paketi UI'dan bagimsizdir; kendi uygulamanizda kullanabilirsiniz.
- **Tum projeyi forkla:** Repoyu forklayip dilediginiz gibi degistirin.

## Lisans

MIT (bkz. `LICENSE`).