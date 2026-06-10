# Arduino Code for NodeMCU & Fingerprint Scanner

Berikut adalah contoh skrip Arduino untuk NodeMCU (ESP8266) yang terintegrasi dengan Firebase Firestore.

## Libraries yang dibutuhkan:
1. **Adafruit Fingerprint Sensor Library** (By Adafruit)
2. **Firebase ESP8266 Client** (By Mobizt)

## Pin Connection:
- Fingerprint VCC -> 3.3V
- Fingerprint GND -> GND
- Fingerprint TX -> D2 (Software Serial RX)
- Fingerprint RX -> D3 (Software Serial TX)

```cpp
#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>

// 1. Konfigurasi WiFi
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"

// 2. Konfigurasi Firebase (Ambil dari file firebase-applet-config.json)
#define API_KEY "AIzaSyA3EAWDG7PmJY8fn9uRTLptkrp9RiO3gS8"
#define FIREBASE_PROJECT_ID "gen-lang-client-0118775089"

// 3. Pin Fingerprint
SoftwareSerial mySerial(4, 0); // D2=4, D3=0
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  
  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }

  // Setup Firebase
  config.api_key = API_KEY;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Setup Fingerprint
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("Scanner ditemukan!");
  }
}

void loop() {
  // Ambil mode dari Firestore
  String path = "deviceConfigs/main-nodedcu";
  if (Firebase.Firestore.getDocument(&fbdo, FIREBASE_PROJECT_ID, "", path.c_str(), "")) {
    // Logic untuk switch mode (verify / enroll)
    // Gunakan fbdo.payload() untuk parse JSON mode
  }

  int id = getFingerprintID();
  if (id > 0) {
    sendAttendance(id);
  }
  delay(1000);
}

void sendAttendance(int fingerprintId) {
  // Logic: Cari employeeId berdasarkan fingerprintId di Firestore
  // Kemudian add document ke collection "attendance"
  Serial.print("Presensi sukses untuk ID: ");
  Serial.println(fingerprintId);
}

int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;
  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK) return -1;
  return finger.fingerID;
}
```

*Catatan: Skrip di atas adalah kerangka dasar. Anda perlu menyesuaikan logika parsing JSON untuk mengecek mode (Enroll/Verify) dan melakukan query ke Firestore dari ESP8266.*
