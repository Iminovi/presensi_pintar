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
#define API_KEY "YOUR_FIREBASE_API_KEY" // <-- GANTI DENGAN API KEY ANDA, JANGAN DI-COMMIT KE GITHUB
#define FIREBASE_PROJECT_ID "YOUR_FIREBASE_PROJECT_ID" // <-- GANTI DENGAN PROJECT ID ANDA

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
  Serial.print("Memproses presensi untuk ID Sensor: ");
  Serial.println(fingerprintId);

  // Menggunakan FirebaseJson bawaan dari Firebase_ESP_Client
  FirebaseJson content;
  
  // Sesuai dengan struktur Attendance di App.tsx
  // (Firestore REST API mewajibkan deklarasi tipe data seperti stringValue/integerValue)
  String employeeName = "Karyawan FP " + String(fingerprintId);
  
  content.set("fields/employeeId/stringValue", String(fingerprintId));
  content.set("fields/employeeName/stringValue", employeeName);
  content.set("fields/type/stringValue", "in"); // Atur logic 'in' atau 'out' sesuai kebutuhan
  
  // Path dokumen dikosongkan agar Firestore menghasilkan Document ID (Auto-ID) secara otomatis
  String documentPath = ""; 

  Serial.print("Mengirim data ke Firestore... ");
  
  // Syntax: createDocument(firebaseData, projectId, databaseId, collectionId, documentId, payload)
  // databaseId default adalah "" (kosong)
  if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "", "attendance", documentPath.c_str(), content.raw())) {
    Serial.println("Berhasil!");
    Serial.println("Payload Response: " + fbdo.payload());
  } else {
    Serial.println("Gagal!");
    Serial.println("Alasan Error: " + fbdo.errorReason());
  }
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
