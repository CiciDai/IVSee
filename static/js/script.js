function handleLoadEvent() {
    var myFirebaseRef = new Firebase("XXXXX");
    myFirebaseRef.on("value", getDataFromFirebase);
    
}

var device_list=[]; //list for device in use
var prev = new Map(); //each device's previous data in database
function getDataFromFirebase(snapshot){
    var data = snapshot.val();
    // initialize new device
    for (var device in data){
        if(!device_list.includes(device) && data[device].length > 12){
            Initialize(data, device);
        }
    }
    // only update time countdown when data changes
    device_list.forEach(function(device){
                        if(data[device].length > 12){
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
                                   if(time>0){
                                   console.log("updated " +device+" data");
                                   countdown(time, "time"+device);
                                   prioritize_display();
                                   }
                                   },1000);
                        }
                        monitor_battery(device,data[device][11]);
                        }
                        });
}

function Initialize(data, device){
    device_list.push(device);
    var new_div =document.createElement('div');
    new_div.setAttribute('id',device);
    var num = device[device.length-1];
    var info = data[device][12];
    info = info.split(":");
    var name = info[1];
    var location = info[2];
    var condition = info[3];
    var medication = info[4]
    new_div.className = "demo-card-wide mdl-card mdl-shadow--2dp";
    new_div.style.display = "flex";
    new_div.style.flexDirection = "row";
    // treatment notes
    var notes = "<button id='show-dialog"+num+"' type='button' class='mdl-button' style='color: #80CBC4; font-size: 12pt; padding: 1px; text-transform: capitalize;'>treatment notes</button></p>";
    
    var text_row1 = "<div id='row1'><div><p1>"+name+"</p1><p2>Location: "+location+"</p2></div><div class='row1_battery'><div id='battery"+device+"'></div><div id='tbattery"+device+"' style='color:#FF6666'></div></div></div>";
    
    var text_col1 = "<div id='column1'><b>Condition:</b><p2>"+condition+"</p2><b>Current Medication:</b><p2>"+medication+"</p2>"+notes+"</div>";
    
    var text_col2 = "<div id='column2'><p3>Remaining Time:</p3><p></p><b2 id='time"+device+"'> -- min</b2><p></p><p3 id='rate"+device+"'>-- ml/min.</p3><p></p><input type='button' value= 'End Session' id='terminate"+device+"'></input></div>";
    
    var text_progress = "<div class='progress vertical'><div role='progressbar' style='height: 100%;'' class='progress-bar' id='progress"+device+"'></div></div>"
    
    new_div.innerHTML = "<div id='wrapper' class='mdl-card__supporting-text'><div id='rows'>"+text_row1+"<div id='row2'>"+text_col1+text_col2+"</div></div></div><div id='progress'>"+text_progress+"</div>";
    
    document.getElementById('container').appendChild(new_div);
    // dialog for treatment notes
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
    // terminate device
    var terminator = document.getElementById('terminate'+device);
    terminator.addEventListener('click',function(){
                                Terminate(device);
                                console.log(device + ' terminated.');
                                });
}
//used to record each device's remaining time, used for prioritize display
var remain_time=new Map();
var preRate = 0;//previous calculated rate

function updata_data(device,device_data){
    var diff = math.subtract(device_data.slice(0,device_data.length-2),device_data.slice(1,device_data.length-1));
    diff = diff.filter(function(v){
                       return v>0;
                       })
    
    if(diff.length<2){
        return -1;
    }
    var median = math.median(diff);
    console.log(diff);
    // console.log(median);
    if(median<0){
        return -1;
    }
    // Assume rate change +/-0.5 different from median caused by noise
    var diff_filtered = diff.filter(function(v){
                                    return v<=median+0.3 && v>=Math.max(0,median-0.3);
                                    });
    console.log(diff_filtered);
    var diff_rate = 0;
    if(diff_filtered.length == 0){
        if(remain_time.has(device)){
            return -1;
        }else{
            diff_rate = math.mean(math.mode(diff));
        }
    }else{
        diff_rate = math.mean(diff_filtered);
    }
    
    diff_rate = Math.round(100* diff_rate)/100.0;
    console.log(diff_rate);
    // find latest non-noise weight
    var count = diff.length-1;
    while(count>0 && (diff[count]<0 || diff[count] > median+1.5)){
        count = count -1;
    }
    var remain_vol = device_data[count] - diff_rate*(diff.length-count);
    // console.log(remain_vol);
    
    //rate - ml/min, assume denstiy is 1g/ml
    var rate = diff_rate/3*60;
    if(Math.abs(rate-preRate)<=0.5){
        rate = preRate;
        return -1;
    }else{
        preRate = rate;
    }
    var self_weight = 105; //g,can be change to device_data[12]
    var remaining = ((remain_vol-self_weight)/(rate+0.01)).toFixed(1); //seconds
    var device_div = document.getElementById(device);
    var rate_text = rate.toFixed(1) + " ml/min";
    var time_text = "Time Remaining " + remaining + " min";
    document.getElementById("rate"+device).innerHTML = rate_text;
    remain_time.set(device,remaining);
    return remaining;
}
// function used to monitor battery
// Battery full vcc>3300mV
// half full vcc>3000mV
// low battery vcc<3000mV
function monitor_battery(device,vcc){
    var battery_div = document.getElementById("battery"+device);
    if(vcc<3100){
        var text = "<p>Device Battery Low.</p>";
        var battery_div_text = document.getElementById("tbattery"+device);
        battery_div.setAttribute('class',"battery empty");
        battery_div_text.innerHTML = text;
    }else if(vcc>3350){
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
    var id = "time"+device;
    clearInterval(timer.get(id));
    timer.delete(id);
    var index = device_list.indexOf(device);
    if(index>-1){
        device_list.splice(index,1);
    }
}
// count down effects
var timer= new Map();
function countdown(time,id){
    if(timer.has(id)){
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
                        var t1 = 30*60;
                        var device = id.substring(4);
                        var progress_div = document.getElementById("progress"+device);
                        if(deadline < t1){
                        var pct = Math.round(100*deadline/t1);
                        if(deadline <0){
                        pct = 0;
                        }
                        progress_div.style.height = pct+'%';
                        }
                        // change remaining time and progress bar color if less than 10 min
                        if(deadline <= 600){
                        time_div.style.color = '#F19097';
                        progress_div.style.backgroundColor = '#F19097';
                        }else{
                        time_div.style.color = '#80CBC4';
                        progress_div.style.backgroundColor = '#80CBC4';
                        }
                        // when <= 3 min
                        if(deadline <= 180){
                        clearInterval(x);
                        
                        // timer.delete(id);
                        time_div.innerHTML = "URGENT";
                        var count = 0;
                        var y = setInterval(function(){
                                            timer.set(id,y);
                                            time_div.style.visibility = (time_div.style.visibility == 'visible') ? 'hidden' : 'visible';
                                            count = count + 1;
                                            if(pct>=1){
                                            pct = pct -1;
                                            }else{
                                            pct = 0;
                                            }
                                            progress_div.style.height = pct+'%';
                                            if(count > 10){
                                            clearInterval(y);
                                            }
                                            },1000)
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
