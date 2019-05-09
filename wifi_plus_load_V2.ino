#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>
#include "HX711.h"

String device = "device5";

#define FIREBASE_HOST "lab-2-9c033.firebaseio.com"
#define FIREBASE_AUTH "cMMxTB9rBPd1Le13FnaERqd36zM7gBontNgw1KYo"

//WiFi SSID and Password
const char* ssid="University of Washington";
const char* password = "";

//Loadcell input
const int LOADCELL_DOUT_PIN = 12;
const int LOADCELL_SCK_PIN = 14;
//Calibration
const long LOADCELL_OFFSET = 0;
const long LOADCELL_DIVIDER = 100;
//Button for tare
const int buttonPin = 2;
int buttonState = 0;

//default A0
ADC_MODE(ADC_VCC);

HX711 loadcell;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
  
  Serial.println();
  Serial.print("Wifi connecting to ");
  Serial.println( ssid );

  WiFi.begin(ssid,password);

  Serial.println();
  Serial.print("Connecting");

  while( WiFi.status() != WL_CONNECTED ){
      delay(500);
      Serial.print(".");        
  }

  Serial.println();

  Serial.println("Wifi Connected Success!");
  Serial.print("NodeMCU IP Address : ");
  Serial.println(WiFi.localIP() );

  Serial.println("Initialize load cell");
  Serial.println();
  loadcell.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  loadcell.set_scale(LOADCELL_DIVIDER);
  loadcell.set_offset(LOADCELL_OFFSET);
//  set buttonpin for tare
  pinMode(buttonPin, INPUT);
  
//  battery check - red LED
  pinMode(LED_BUILTIN, OUTPUT);

  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Serial.println("Firebase access authorized.");

}

void loop() {
  buttonState = digitalRead(buttonPin);
  if (buttonState == LOW) {
//    when button is pressed
    tare();
  }
  send_data();
  battery_check();
}

void battery_check(){
  int vcc = ESP.getVcc();
  String path = device+"/"+String(11);
  Firebase.setInt(path, vcc);
  Serial.println(vcc);
  if(vcc<3000){
    digitalWrite(LED_BUILTIN,HIGH);
  }else{
    digitalWrite(LED_BUILTIN,LOW);
  }
}
void tare(){
    loadcell.tare();
    Serial.println("New scale offset:");
    Serial.println(loadcell.get_offset());
}
void send_data(){
  int count = 0;
  while(count<11){
    String path = device+"/"+String(count);
    float weight;
    if(loadcell.is_ready()){
      long reading = loadcell.get_units(1);
      weight = floor(reading);
      Serial.println(reading);
    } else {
      weight = -1.0;
       Serial.println("HX711 Not Found");
    }
    Firebase.setFloat(path, weight);
    if(Firebase.failed()){
      Serial.println("Firebas failed, try to reconnect...");
      Serial.println(Firebase.error());
      Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
    }else{
//      Serial.println("updated");
//      Serial.println(weight);
    }
    count = count+1;
    delay(499);
    int count2 = 0;
    while(count2<10){
      buttonState = digitalRead(buttonPin);
      if(buttonState == LOW){
        tare();
      }
      delay(250);
      count2 = count2+1;
    }
  }
}
