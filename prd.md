İşte React Native + Expo ile geliştirmeyi planladığın **Memoro** uygulamasına özel hazırlanmış bir PRD (Product Requirements Document – Ürün Gereksinimleri Dokümanı). Bu dokümanda:

- Proje özeti,
- 3 fazdan oluşan geliştirme planı,
- Yapıldı / Yapılacaklar listesi,
- Tema özelliği detayları yer alıyor.

---

## 📄 Product Requirements Document – **Memoro**

---

### 🔍 Proje Özeti

**Memoro**, kullanıcıların İngilizce kelime dağarcığını geliştirmelerine yardımcı olan bir mobil uygulamadır. Uygulama, kullanıcının seviyesine uygun kelimeleri günlük olarak sunar ve bu kelimelerle özel kilit ekranı görüntüleri oluşturur. Böylece kullanıcı, telefon ekranını her açtığında pasif öğrenme sağlar. 

---

### 🎯 Hedef Kitle

- İngilizce öğrenen tüm bireyler (A1-C2 seviyeleri arasında)
- Pasif öğrenmeye zaman ayıramayan ama görsel tekrar ile öğrenmeyi tercih eden kullanıcılar

---

### 🧩 Uygulama Özellikleri

#### Kullanıcı Akışı:
1. Seviye seçimi (A1 - C2 arası)
2. Günlük kelime sayısı seçimi (5-10 arası)
3. Rastgele kelimelerin listelenmesi
4. Onaylanan kelimelerle görsel oluşturulması
5. Görselin galeriye kaydedilmesi
6. Öğrenilen kelimelerin seviyelere göre takibi

---

### 🚧 Geliştirme Aşamaları

#### **Faz 1 – Temel Özellikler**
- [x] Seviye seçme ekranı
- [x] Kelime sayısı seçme (5-10 arası)
- [x] JSON dosyasından seviyeye göre rastgele kelime seçme
- [x] Kelimelerin kullanıcıya listelenmesi
- [x] Kullanıcının kelimeleri onaylaması
- [x] Onaylanan kelimelerin bir sonraki ekrana aktarılması
- [x] Asset klasöründen görsel seçimi
- [x] Seçilen görselin üzerine kelimelerin eklenmesi (alt alta dizilim)

#### **Faz 2 – Gelişmiş Özellikler**
- [x] Görselin galeriye kaydedilmesi (Expo Media Library entegrasyonu)
- [x] Öğrenilen kelimelerin local olarak kaydı (AsyncStorage veya SQLite)
- [x] Öğrenilen kelimelerin seviyeye göre listelenmesi (istatistik ekranı)
- [x] Tema seçimi (aşağıda detaylandırıldı)
- [x] Günlük bildirim ile kullanıcıyı uygulamaya çağırma

#### **Faz 3 – Kişiselleştirme ve Yayın Öncesi Hazırlıklar**
- [x] Uygulama içi tema desteği (açık/karanlık ve özel renk paletleri)
- [x] Kelime açıklaması/örnek cümle (isteğe bağlı detay modülü)
- [x] Onboarding ekranları (ilk açılışta kullanım rehberi)
- [ ] App Icon, Splash Screen ve Expo EAS ile Build alma
- [ ] Play Store / App Store için yayın dosyalarının hazırlanması

---

### 🎨 Tema Özelliği

Uygulama kullanıcıya temayı özelleştirme şansı verecek. Temalar şunları kapsayacak:

- **Açık Tema**: Beyaz arka plan, siyah yazılar
- **Karanlık Tema**: Siyah arka plan, beyaz yazılar
- **Pastel Tema**: Yumuşak renk paleti, arka plan ve yazı renkleri kullanıcı dostu

Kullanıcı, ayarlar ekranından bu temalardan birini seçebilecek ve uygulamanın tüm arayüzü bu temaya göre şekillenecek.

---

### ✅ Yapıldı / 🔧 Yapılacaklar Listesi

| Görev                                                                 | Durum     | Faz |
|----------------------------------------------------------------------|-----------|-----|
| Proje başlangıcı (Expo + React Native kurulumu)                      | ✅ Yapıldı | 1 |
| Kelime JSON dosyalarının oluşturulması                               | ✅ Yapıldı | 1 |
| Tema sistemi oluşturulması                                           | ✅ Yapıldı | 1 |
| Temel bileşenlerin oluşturulması (LevelButton, NumberSelector)       | ✅ Yapıldı | 1 |
| Seviye seçim ekranı                                                  | ✅ Yapıldı | 1 |
| Kelime sayısı seçim ekranı                                          | ✅ Yapıldı | 1 |
| Navigasyon sistemi kurulumu                                          | ✅ Yapıldı | 1 |
| Kelime listesi ekranı ve bileşenleri                                | ✅ Yapıldı | 1 |
| JSON'dan seviyeye göre kelime seçme                                  | ✅ Yapıldı | 1 |
| Görsel seçim ekranı (assets klasöründen)                             | ✅ Yapıldı | 1 |
| Seçilen görsele kelimeleri alt alta yapıştırma (Canvas kullanımı)   | ✅ Yapıldı | 1 |
| Görseli galeriye kaydetme                                            | ✅ Yapıldı | 2 |
| Öğrenilen kelimeleri seviyeye göre kaydetme                          | ✅ Yapıldı | 2 |
| Öğrenilen kelimelerin istatistik ekranı                              | ✅ Yapıldı | 2 |
| Tema desteği (Açık / Karanlık / Pastel)                              | ✅ Yapıldı | 3 |
| Bildirim ile günlük hatırlatma                                       | ✅ Yapıldı | 2 |
| Onboarding ekranları                                                 | ✅ Yapıldı | 3 |
| Yayın öncesi build alma                                              | 🔧 Yapılacak | 3 |

---

### 📁 Dosya Yapısı (Mevcut)

```
/words
   a1.json
   a2.json
   b1.json
   b2.json
   c1.json
   c2.json
   yds.json
App.tsx
```

### 📁 Dosya Yapısı (Hedeflenen)

```
/assets
   /images (görsel seçim için)
/data
   /words (kelime JSON dosyaları)
/components
/screens
/utils
/theme
```