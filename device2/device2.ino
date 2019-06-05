#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>
#include <QueueArray.h>
#include "HX711.h"

String device = "device2";

#define FIREBASE_HOST "lab-2-9c033.firebaseio.com"
#define FIREBASE_AUTH "cMMxTB9rBPd1Le13FnaERqd36zM7gBontNgw1KYo"

//WiFi SSID and Password
const char* ssid="University of Washington";
const char* password = "";

//Loadcell input
const int LOADCELL_DOUT_PIN = 12;
const int LOADCELL_SCK_PIN = 14;
//Calibration
const long LOADCELL_OFFSET = -223330;
const long LOADCELL_DIVIDER = 1317.5;
//Button for tare
const int buttonPin = 0;
int buttonState = 0;
const int tarePin =  5;
const int batteryPin =  4;
const int fakePin =  13;

int timeNow;
int timeNow2;
QueueArray <float> weights;

//default A0
ADC_MODE(ADC_VCC);

HX711 loadcell;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);

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
  pinMode(tarePin, OUTPUT);
  
//  battery check - red LED
  pinMode(batteryPin, OUTPUT);

  pinMode(fakePin, OUTPUT);
  digitalWrite(fakePin, HIGH);

  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Serial.println("Firebase access authorized.");
}

void loop() {
  battery_check();
//  the function takes 30 seconds to run
//  read 11 data every 3 seconds
  send_data();
  
}

//battery LED lights up if battery < 3V
void battery_check(){
  int vcc = ESP.getVcc();
  String path = device+"/"+String(11);
  Firebase.setInt(path, vcc);
  Serial.println(vcc);
  if(vcc<3350){
    digitalWrite(batteryPin,HIGH);
  }else{
    digitalWrite(batteryPin,LOW);
  }
}

void tare(){
    loadcell.tare();
    Serial.println("New scale offset:");
    Serial.println(loadcell.get_offset());
}

void send_data(){
  int count = 0;
  int max_length = 11;
  while(count<11){
    if(count == 0){
      //minus runtime for bat. check
      timeNow = (millis()-1163)%10000;
    }else{
      timeNow = millis()%10000;
    }
//    Serial.println(timeNow);
    String path = device+"/"+String(count);
    float weight;
    if(loadcell.is_ready()){
      float reading = -loadcell.get_units(1);
      weight = floor(reading*100)/100.0;
      weights.enqueue(weight);
      if(weights.count()>11){
        weights.dequeue();
//        update all 11 numbers to firebase
        int count3=0;
        while(count3<11){
          String path = device+"/"+String(count3);
          float num = weights.dequeue();
          weights.enqueue(num);

//          reconnect wifi and firebase if disconnected
          if( WiFi.status() != WL_CONNECTED ){
              Serial.println("WiFi connection failed, trying to reconnect...");
              WiFi.begin(ssid,password);       
          }
          if(Firebase.failed()){
            Serial.println("Firebas failed, trying to reconnect...");
            Serial.println(Firebase.error());
            Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
          }

//          send data to firebase
          Firebase.setFloat(path, num);
          count3 = count3 + 1;
        }
      }
      Serial.println(weight);
    } else {
      weight = -1.0;
      Serial.println("HX711 Not Found");
    }
    count = count+1;
    
    timeNow2 = millis()%10000;
    int delta=0;
    if(timeNow2<timeNow){
      timeNow2 = timeNow2+10000;
    }
    delta = 3000-(timeNow2 - timeNow);
//    listen to tare button status every 250 ms
//    Read one number from load cell every 3 seconds
    int count2 = 0;
    int cycle_num = 15;
    int delay_time = delta/cycle_num;
//    Serial.println(delay_time);
    while(count2<cycle_num){
      buttonState = digitalRead(buttonPin);
      if(buttonState == LOW){
        digitalWrite(tarePin, HIGH);
        tare();
      }else{
        digitalWrite(tarePin, LOW);
      }
      if(delay_time>0){
        delay(delay_time);
      }
      count2 = count2+1;
    }
    
  }
}
