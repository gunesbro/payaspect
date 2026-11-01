# Gizlilik İlkeleri — PayAspect

PayAspect'in tüm mimarisi şu tek ilke etrafında kurulur:

> **Hiçbir kullanıcı verisi cihazdan dışarı çıkmaz.**

## Temel Kurallar

1. **Ağ yok:** Uygulama çekirdeği çalışırken hiçbir harici HTTP isteği yapmaz. API entegrasyonu yoktur.
2. **Hata raporu / analytics yok:** Firebase, Sentry, Google Analytics vb. entegre edilmez.
3. **Cihazda OCR:** Fatura/banka görselleri ML Kit (on-device) ile cihazda okunur.
4. **Cihazda AI:** Sınıflandırma ve özet çıkarımı cihazda (ONNX Runtime Mobile) çalışır.
5. **Şifreli depolama:** Veritabanı SQLCipher ile şifrelenir; anahtar cihaz anahtar zincirinde (Keychain / Keystore) saklanır.
6. **Opsiyonel model indirme:** Ağır LLM paketi yalnızca kullanıcı açıkça onayladığında indirilir. İndirme dışında ağ kullanılmaz.
7. **Kullanıcı kontrollü dışa aktarma:** Veri yalnızca kullanıcı kendi cihazından kendi seçtiği yere aktarır.

## Veri Akışı

```
Resim / PDF / Manuel giriş
        │
        ▼
[ On-device OCR (ML Kit) ]
        │
        ▼
[ On-device Sınıflandırıcı (ONNX) ] ──► Kategori + etiketler
        │
        ▼
[ Şifreli yerel DB (SQLCipher) ]
        │
        ▼
[ On-device Özet / Sohbet motoru ] ──► Kullanıcıya
```

Hiçbir adımda veri cihazı terk etmez.

## Tehdit Modeli (özet)

| Tehdit | Önlem |
|--------|-------|
| Sunucu sızıntısı | Sunucu yok |
| Ağ dinleme | Çekirdekte ağ yok |
| Cihaz kaybı | Şifreli DB + OS kilidi |
| Uygulama izleme | Analytics/telemetri yok |
| Üçüncü taraf SDK | Minimum, denetlenebilir bağımlılık |
