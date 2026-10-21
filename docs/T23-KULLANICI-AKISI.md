# T23 · Yerel kullanıcı akışı tasarım notu

## Kullanıcı ve an

Doğukan, modeli üretmek için uygulamayı açtığında tek tıkla doğru yerel sunucuya ulaşmak; bir sorun olduğunda hangi Node/engine sürümünün çalıştığını görmek; işi bitince yalnız bu uygulamanın sunucusunu güvenle kapatmak istiyor.

## Üç soru

1. Uygulama açıldı mı, doğru proje kopyası mı açıldı?
2. CAD ve organik motor paketleri ile Node sürümü uyumlu mu?
3. Sunucuyu durdurursam yanlış bir Node sürecini kapatır mıyım?

## Risk ve karşılığı

| Sızıntı | Önce | T23 davranışı |
|---|---|---|
| Kullanıcının vakti | Kurulum Git ister, vendor kaynaklarını klonlar; aktif çalışma için gerekmediği halde ağ ve indirme bekletir. | Kilit dosyasına bağlı `npm ci` + build; kaynak kopyaları yerinde kalır, otomatik yeniden indirilmez. |
| Yanlış instance | Başlatma 8765'te aynı engine/version yanıtını başka bir kopyadan alıp onu kendi sunucusu sanabilir. | Health yanıtında yerel kurulum kimliği; port seçilebilir ve proje kimliği kontrol edilir. |
| Yanlış process kill | Basit PID tek başına PID'nin hâlâ bu uygulamaya ait olduğunu kanıtlamaz. | Durdurma, PID + tam `server.mjs` yolu eşleşmesini arar; eşleşme yoksa sürece dokunmaz. |
| Lisans karışıklığı | Uygulama, bağımlılık lisansı ile projenin lisansını aynı şey gibi sunabilir. | Doğrudan motor/viewer lisansları envanterlenir; projenin yayın lisansı seçilmez. Transitive/lisans hukuki yorumu ayrıca denetlenmiş sayılmaz. |

## Akış

- İlk kurulum: `Kodla3D.cmd setup` (`npm ci`, production arayüz build'i).
- Açma: `Baslat.cmd` veya `Kodla3D.cmd start`; varsayılan 127.0.0.1:8765. İsteğe bağlı başka port `Kodla3D.cmd start -Port 18765`.
- Kontrol: `Kodla3D.cmd status`, `Kodla3D.cmd diagnose`.
- Kapatma: `Kodla3D.cmd stop`; yalnız bu kurulumun tanınan PID'si kapatılır.

## Bilerek yapılmayanlar ve karar sınırı

- Sunucu loopback'te kalır; dış ağa bağlama, hesap, bulut veya ödeme yok.
- CadQuery, Replicad ve kaynak snapshot'ları silinmez. CadQuery başarıyla çalışan motor olarak gösterilmez; `vendor/` uygulamanın runtime bağımlılığı değildir.
- Bu kayıt teknik lisans envanteridir, dağıtım/yayımlama izni veya hukuki uyum görüşü değildir. Projenin kendi açık kaynak lisansı kullanıcı adına seçilmez.
- Ağ kurulum sırasında hâlâ gerekebilir; npm cache mevcut değilse `npm ci` registry erişimi bekler. Ölçülmüş internet/kurulum süresi yoktur.
