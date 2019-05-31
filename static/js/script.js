function handleLoadEvent() {
  var myFirebaseRef = new Firebase("ADD HERE");
  myFirebaseRef.on("value", getDataFromFirebase);
}

var device_list=[];
var prev = new Map();
function getDataFromFirebase(snapshot){
  var data = snapshot.val();
  for (var device in data){
    if(!device_list.includes(device)){
      Initialize(device);
    }
  }
  device_list.forEach(function(device){
    if(data[device].length == 12){
      var device_data = data[device].slice(0,11);
      var sum = 0;
      if(prev.has(device)){
        var i;
        for(i=0;i<device_data.length;i++){
          sum = sum + prev.get(device)[i]-device_data[i];
        }
      }
      if(!prev.has(device) || sum!=0){
        prev.set(device,device_data);
        setTimeout(function(){
          var time = updata_data(device,device_data);
          console.log("updated " +device+" data");
          countdown(time, "time"+device);
          prioritize_display();
        },1000);
      }
      monitor_battery(device,data[device][11]);
    }
  });
}

function Initialize(device){
  device_list.push(device);
  var new_div =document.createElement('div');
  new_div.setAttribute('id',device);
  var num = device[device.length-1];
  new_div.className = "demo-card-wide mdl-card mdl-shadow--2dp";
  new_div.style.display = "flex";
  new_div.style.flexDirection = "row";

  var notes = "<button id='show-dialog"+num+"' type='button' class='mdl-button' style='color: #80CBC4; font-size: 12pt; padding: 1px; text-transform: capitalize;'>treatment notes</button></p>";

  var text_row1 = "<div id='row1'><div><p1>Patient "+num+"</p1><p2>Location: Room "+num+"</p2></div><div class='row1_battery'><div id='battery"+device+"'></div><div id='tbattery"+device+"' style='color:#FF6666'></div></div></div>";

  var text_col1 = "<div id='column1'><b>Condition:</b><p2>Example symptons</p2><b>Current Medication:</b><p2>Medication ABC</p2>"+notes+"</div>";

  var text_col2 = "<div id='column2'><p3>Remaining Time:</p3><p></p><b2 id='time"+device+"'> -- min</b2><p></p><p3 id='rate"+device+"'>-- ml/min.</p3><p></p><input type='button' value= 'End Session' id='terminate"+device+"'></input></div>";

  var text_progress = "<div class='progress vertical'><div role='progressbar' style='height: 100%;'' class='progress-bar' id='progress"+device+"'></div></div>"

  new_div.innerHTML = "<div id='wrapper' class='mdl-card__supporting-text'><div id='rows'>"+text_row1+"<div id='row2'>"+text_col1+text_col2+"</div></div></div><div id='progress'>"+text_progress+"</div>";

  document.getElementById('container').appendChild(new_div);

  var dialog1 = document.querySelector('dialog');
  var showDialogButton1 = document.querySelector('#show-dialog'+num);

  if (! dialog1.showModal) {
    dialogPolyfill.registerDialog(dialog1);
  }
  showDialogButton1.addEventListener('click', function() {
    dialog1.showModal();
  });
  dialog1.querySelector('.close').addEventListener('click', function() {
    dialog1.close();
  });

  var terminator = document.getElementById('terminate'+device);
    terminator.addEventListener('click',function(){
      Terminate(device);
      console.log(device + ' terminated.');
    });
}


function filter_data(device_data){
  var kf = new KalmanFilter();
  var filtered = [];
  var i;
  for(i=0;i<device_data.length;i++){
    filtered.push(Math.round(kf.filter(device_data[i]*100))/100)
  }
  console.log(filtered);
  // console.log("filtered weights:"+filtered);
  var diff =[];
  diff = math.subtract(filtered.slice(0,10),filtered.slice(1,11));
  for(i=0;i<diff.length;i++){
    diff[i] = Math.round(diff[i]*100)/100;
  }
  return diff;
}


var remain_time=new Map();
function updata_data(device,device_data){
  var diff = filter_data(device_data);
  var median = math.median(diff);
  // filter out large and small changes, keep (m-1.5,m+1.5)
  var diff_filtered = diff.filter(function(v){
    return v<median+1.5 && v>Math.max(0,median-1.5);
  });
  var diff_rate = math.sum(diff_filtered)/diff_filtered.length;

  // find latest non-noise weight
  var count = diff.length-1;
  while(count>0 && (diff[count]<0 || diff[count] > median+1.5)){
    count = count -1;
  }
  var remain_vol = device_data[count] - diff_rate*(diff.length-count);

  //rate - ml/min, assume denstiy is 1g/ml
  var rate = diff_rate/3*60;
  var self_weight = 105; //g,can be change to device_data[12]
  var remaining = ((remain_vol-self_weight)/(rate+0.001)).toFixed(1);
  var device_div = document.getElementById(device);
  var rate_text = rate.toFixed(1) + " ml/min";
  var time_text = "Time Remaining " + remaining + " min";

  document.getElementById("rate"+device).innerHTML = rate_text;

  remain_time.set(device,remaining);

  return remaining;
}


function monitor_battery(device,vcc){
  var battery_div = document.getElementById("battery"+device);
  if(vcc<3000){
    var text = "<p>Device Battery Low.</p>";
    var battery_div_text = document.getElementById("tbattery"+device);
    battery_div.setAttribute('class',"battery empty");
    battery_div_text.innerHTML = text;
  }else if(vcc>3300){
    battery_div.setAttribute('class',"battery full");
  }else{
    var battery_div = document.getElementById("battery"+device);
    battery_div.setAttribute('class',"battery half");
  }
}


function Terminate(device){
  var myFirebaseRef = new Firebase("https://lab-2-9c033.firebaseio.com/");
  myFirebaseRef.child(device).remove();
  var element = document.getElementById(device);
  element.parentNode.removeChild(element);
  remain_time.delete(device);
  var index = device_list.indexOf(device);
  if(index>-1){
    device_list.splice(index,1);
  }
}

var timer= new Map();
function countdown(time,id){
  if(timer.has(id)){
    console.log(id);
    clearInterval(timer.get(id));
  }
  var deadline = time*60;
  var x = setInterval(function(){
    var hours = Math.floor(deadline / (60*60));
    var minutes = Math.floor((deadline % (60*60)) / 60);
    var seconds = Math.floor(deadline % 60);
    var time_div = document.getElementById(id);
    time_div.innerHTML= ('0'+hours).slice(-2) + "h : "
  + ('0'+minutes).slice(-2) + "m : " + ('0'+seconds).slice(-2) + "s </p1>";
    // time_div.style.fontSize="large";

    var t1 = 20*60;
    var device = id.substring(4);
    var progress_div = document.getElementById("progress"+device);
    if(deadline < t1){
      var pct = Math.round(100*deadline/t1);
      if(deadline <0){
        pct = 0;
      }

      progress_div.style.height = pct+'%';
    }

    if(deadline <= 600){
      time_div.style.color = '#F19097';
      progress_div.style.backgroundColor = '#F19097';
      // time_div.style.fontSize="x-large";
    }else{
      time_div.style.color = '#80CBC4';
      progress_div.style.backgroundColor = '#80CBC4';
    }
    // when <1.5 min
    if(deadline < 90){
      clearInterval(x);
      timer.delete(id);
      time_div.innerHTML = "URGENT";
      var count = 0;
      var y = setInterval(function(){
        time_div.style.visibility = (time_div.style.visibility == 'visible') ? 'hidden' : 'visible';
        count = count + 1;
        if(count > 6){
          clearInterval(y);
        }
      },500)
    }
    deadline = deadline -1;
  },1000);
  timer.set(id,x);
}

function prioritize_display(){
  if(remain_time.size>1){
    remain_time = new Map([...remain_time.entries()].sort((a, b) => a[1] - b[1]));
    var items = [];
    for(var [k,v] of remain_time){
      items.push([k,v]);
    }
    var container_div = document.getElementById('container');
    var i;
    for(i=items.length-2;i>=0;i--){
      var div = document.getElementById(items[i][0]);
      var div_after = document.getElementById(items[i+1][0]);
      div.parentNode.insertBefore(div,div_after);
    }
  }
}


/*kalmanjs, Wouter Bulten, MIT, https://github.com/wouterbulten/kalmanjs */
var KalmanFilter = (function () {
  'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }



  var KalmanFilter =
  /*#__PURE__*/
  function () {
    /**
    * Create 1-dimensional kalman filter
    * @param  {Number} options.R Process noise
    * @param  {Number} options.Q Measurement noise
    * @param  {Number} options.A State vector
    * @param  {Number} options.B Control vector
    * @param  {Number} options.C Measurement vector
    * @return {KalmanFilter}
    */
    function KalmanFilter() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref$R = _ref.R,
          R = _ref$R === void 0 ? 1 : _ref$R,
          _ref$Q = _ref.Q,
          Q = _ref$Q === void 0 ? 1 : _ref$Q,
          _ref$A = _ref.A,
          A = _ref$A === void 0 ? 1 : _ref$A,
          _ref$B = _ref.B,
          B = _ref$B === void 0 ? 0 : _ref$B,
          _ref$C = _ref.C,
          C = _ref$C === void 0 ? 1 : _ref$C;

      _classCallCheck(this, KalmanFilter);

      this.R = R; // noise power desirable

      this.Q = Q; // noise power estimated

      this.A = A;
      this.C = C;
      this.B = B;
      this.cov = NaN;
      this.x = NaN; // estimated signal without noise
    }
    /**
    * Filter a new value
    * @param  {Number} z Measurement
    * @param  {Number} u Control
    * @return {Number}
    */


    _createClass(KalmanFilter, [{
      key: "filter",
      value: function filter(z) {
        var u = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

        if (isNaN(this.x)) {
          this.x = 1 / this.C * z;
          this.cov = 1 / this.C * this.Q * (1 / this.C);
        } else {
          // Compute prediction
          var predX = this.predict(u);
          var predCov = this.uncertainty(); // Kalman gain

          var K = predCov * this.C * (1 / (this.C * predCov * this.C + this.Q)); // Correction

          this.x = predX + K * (z - this.C * predX);
          this.cov = predCov - K * this.C * predCov;
        }

        return this.x;
      }
      /**
      * Predict next value
      * @param  {Number} [u] Control
      * @return {Number}
      */

    }, {
      key: "predict",
      value: function predict() {
        var u = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        return this.A * this.x + this.B * u;
      }
      /**
      * Return uncertainty of filter
      * @return {Number}
      */

    }, {
      key: "uncertainty",
      value: function uncertainty() {
        return this.A * this.cov * this.A + this.R;
      }
      /**
      * Return the last filtered measurement
      * @return {Number}
      */

    }, {
      key: "lastMeasurement",
      value: function lastMeasurement() {
        return this.x;
      }
      /**
      * Set measurement noise Q
      * @param {Number} noise
      */

    }, {
      key: "setMeasurementNoise",
      value: function setMeasurementNoise(noise) {
        this.Q = noise;
      }
      /**
      * Set the process noise R
      * @param {Number} noise
      */

    }, {
      key: "setProcessNoise",
      value: function setProcessNoise(noise) {
        this.R = noise;
      }
    }]);

    return KalmanFilter;
  }();

  return KalmanFilter;

}());
//# sourceMappingURL=kalman.js.map




