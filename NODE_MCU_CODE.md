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

// 3. Konfigurasi Pin Indikator (Buzzer & LED)
#define BUZZER_PIN 5 // D1 pada NodeMCU
#define LED_PIN LED_BUILTIN // Menggunakan LED bawaan NodeMCU (biasanya aktif LOW)

// 3. Pin Fingerprint
SoftwareSerial mySerial(4, 0); // D2=4, D3=0
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  
  // Setup Pin Indikator
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Pastikan buzzer mati di awal
  digitalWrite(LED_PIN, HIGH);   // Matikan LED bawaan (HIGH = mati untuk LED built-in ESP8266)
  
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
    // Parse JSON dari payload response Firestore
    FirebaseJson json;
    FirebaseJsonData jsonData;
    json.setJsonData(fbdo.payload());

    // Ambil nilai "mode"
    String currentMode = "idle";
    if (json.get(jsonData, "fields/mode/stringValue")) {
      currentMode = jsonData.stringValue;
    }

    // Percabangan logika berdasarkan mode
    if (currentMode == "verify") {
      int id = getFingerprintID();
      if (id > 0) {
        sendAttendance(id);
        delay(2000); // Jeda agar tidak terjadi pengiriman berulang/spam saat jari masih menempel
      }
    } 
    else if (currentMode == "enroll") {
      int targetId = 1;
      // Ambil nilai target ID untuk didaftarkan
      if (json.get(jsonData, "fields/enrollTargetId/integerValue")) {
        targetId = jsonData.intValue;
      }
      enrollFingerprint(targetId);
    }
  } else {
    Serial.println("Gagal mendapatkan config: " + fbdo.errorReason());
  }
  delay(1500); // Polling delay agar tidak melampaui batas kuota Firebase
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

void resetModeToVerify() {
  FirebaseJson content;
  content.set("fields/mode/stringValue", "verify");
  
  String path = "deviceConfigs/main-nodedcu";
  
  // Parameter updateMask = "mode" memastikan hanya nilai "mode" yang di-update
  String updateMask = "mode"; 

  Serial.print("Mengembalikan alat ke mode verify... ");
  if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "", path.c_str(), content.raw(), updateMask.c_str())) {
    Serial.println("Berhasil!");
  } else {
    Serial.println("Gagal: " + fbdo.errorReason());
  }
}

void beepSuccess() {
  digitalWrite(LED_PIN, LOW);  // Nyalakan LED
  digitalWrite(BUZZER_PIN, HIGH); // Nyalakan Buzzer
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  delay(100);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW); // Matikan Buzzer
  digitalWrite(LED_PIN, HIGH); // Matikan LED
}

void beepError() {
  digitalWrite(BUZZER_PIN, HIGH); // Bunyi panjang
  delay(800);
  digitalWrite(BUZZER_PIN, LOW);
}

bool enrollFingerprint(int id) {
  Serial.print("Mode ENROLL aktif! Siap mendaftarkan ID: ");
  Serial.println(id);
  
  int p = -1;
  Serial.println("Silakan tempelkan jari Anda ke sensor...");
  
  // Langkah 1: Ambil gambar jari pertama
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      // Jari belum ditempel, tunggu
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("Gambar pertama berhasil diambil!");
    } else {
      Serial.println("Gagal membaca sidik jari.");
      beepError();
      return false;
    }
    yield(); // Mencegah Watchdog Timer (WDT) ESP8266 reset
  }

  // Langkah 2: Konversi gambar pertama
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println("Gagal mengonversi gambar pertama.");
    beepError();
    return false;
  }

  // Langkah 3: Minta pengguna mengangkat jari
  Serial.println("Angkat jari Anda...");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    yield();
  }

  // Langkah 4 & 5: Ambil gambar kedua dan konversi
  p = -1;
  Serial.println("Silakan tempelkan jari yang SAMA lagi...");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("Gambar kedua berhasil diambil!");
    }
    yield();
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println("Gagal mengonversi gambar kedua.");
    beepError();
    return false;
  }

  // Langkah 6: Buat model (cocokkan template 1 dan 2)
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println("Sidik jari tidak cocok. Pendaftaran gagal!");
    beepError();
    return false;
  }

  // Langkah 7: Simpan ke memori sensor
  p = finger.storeModel(id);
  if (p != FINGERPRINT_OK) {
    Serial.println("Gagal menyimpan ke sensor!");
    beepError();
    return false;
  }
  
  Serial.println("Pendaftaran sidik jari SUKSES!");
  beepSuccess();
  
  // Setelah proses enroll selesai dan sukses tersimpan di memori sensor,
  // ubah status di Firestore kembali menjadi 'verify' secara otomatis.
  resetModeToVerify();

  return true;
}
```

*Catatan: Skrip di atas adalah kerangka dasar. Anda perlu menyesuaikan logika parsing JSON untuk mengecek mode (Enroll/Verify) dan melakukan query ke Firestore dari ESP8266.*
