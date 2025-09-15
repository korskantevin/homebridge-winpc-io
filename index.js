var Service;
var Characteristic;
var os = require( "os" );
var packagedef = require( './package.json' );

var request = require("request");
var pollingtoevent = require('polling-to-event');
var wol = require('wake_on_lan');

module.exports = function(homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("WinPC", HttpStatusAccessory);
}

function HttpStatusAccessory(log, config) 
{
	this.log = log;
	var that = this;
	this.setAttempt = 0;

	// url info
	this.on_url = config["on_url"];
	this.on_body = config["on_body"];
	this.off_url = config["off_url"];
	this.off_body = config["off_body"];
	this.status_url = config["status_url"];
	this.http_method = config["http_method"] || "GET";;
	this.username  = config["username"] || "";
	this.password = config["password"] || "";
	this.sendimmediately = config["sendimmediately"]  || "";
	this.name = config["name"];
	this.interval = config["poll_status_interval"];
	this.wait = config["wait_after_set"];
	this.powerstateOnError = 0; //config["powerstateOnError"];
	this.powerstateOnConnect = 1; //config["powerstateOnConnect"];
	this.info = {
		manufacturer    : "Microsoft",
		model           : "Windows PC",
		serialNumber    : ( os.hostname() + "-" + this.name ),
		firmwareRevision: packagedef.version,
		softwareRevision: "Not provided"
	};
	if(config["info"]){
		if(config["info"]["manufacturer"]){
			this.info.manufacturer = config["info"]["manufacturer"];
		}
		if(config["info"]["model"]){
			this.info.model = config["info"]["model"];
		}
		if(config["info"]["serialNumber"]){
			this.info.serialNumber = config["info"]["serialNumber"];
		}
		if(config["info"]["firmwareRevision"]){
			this.info.firmwareRevision = config["info"]["firmwareRevision"];
		}
		if(config["info"]["softwareRevision"]){
			this.info.softwareRevision = config["info"]["softwareRevision"];
		}
	}
	//this.log("TEST" , this.info);
	
	
	this.switchHandling = "check";
	if (this.status_url && this.interval > 10 && this.interval < 100000) {
		this.switchHandling = "poll";
	}	
	this.state = false;
	this.waiting_after_set = false;
	// Status Polling
	if (this.switchHandling == "poll") {
		//var powerurl = this.status_url;
		
		var statusemitter = pollingtoevent(function(done) {
			//that.log("start polling..");
			if(that.waiting_after_set){
				that.log("no request, using current state: ", that.state);
			}else{
				that.getPowerState( function( error, response) {
					//pass also the setAttempt, to force a homekit update if needed
					done(error, response, that.setAttempt);
				}, "statuspoll");
			}
		}, {
			longpolling: true,
			interval: that.interval * 1000,
			longpollEventName: "statuspoll"
		});
		statusemitter.on("statuspoll", function(data) {
			that.state = data;
			that.log("event - status poller - new state: ", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
			}
		});
	}
}

function parse( url) {
	var address = {};
	var s = url.replace(/^WOL[:]?[\/]?[\/]?(.*)[\?]ip=(.*)|^WOL[:]?[\/]?[\/]?(.*)/ig, function( str, p1, p2, p3) {
		if (p1) {
			address.mac = p1;
			address.ip = p2;
		}
		if (p3) {
			address.mac  = p3;
		}
	});
	return address;
}

HttpStatusAccessory.prototype = {

httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
	if (url.substring( 0, 3).toUpperCase() == "WOL") {
		//Wake on lan request
		var address = parse( url);
		
		var opts={};
		var macAddress = address.mac;
		if (address.ip) {
			opts.address = address.ip;
		}
		
		this.log("Excuting WakeOnLan request to "+macAddress+" options: "+JSON.stringify( opts));
		wol.wake(macAddress, opts, function(error) {
		  if (error) {
			callback( error);
		  } else {
			callback( null, 200, "OK");
		  }
		});
	} else {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			timeout: 3000,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		});
	}
},

setPowerState: function(powerState, callback, context) {
	var url;
	var body;
	var that = this;
	
	//if context is statuspoll, then we need to ensure that we do not set the actual value
	if (context && context == "statuspoll") {
		this.log( "setPowerState - polling mode, ignore, state: %s", this.state);
		callback(null, powerState);
		return;
	}
	if (!this.on_url || !this.off_url) {
		this.log.warn("Ignoring request; No power url defined.");
		callback(new Error("No power url defined."));
		return;
	}
	
	this.setAttempt = this.setAttempt+1;
	
	if (powerState) {
		url = this.on_url;
		body = this.on_body;
		this.log("setPowerState - setting power state to on");
	} else {
		url = this.off_url;
		body = this.off_body;
		this.log("setPowerState - setting power state to off");
	}
	
	this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		if (error) {
			that.log('setPowerState - actual mode - failed: %s', error.message);
			powerState = false;
			that.state = powerState;
			that.log("setPowerState - actual mode - current state: %s", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(powerState, null, "statuspoll");
			}	
			callback(null, powerState);
		} else {
			that.state = powerState;
			that.log("setPowerState - actual mode - current state: %s", that.state);
			if(that.wait > 0){
				that.waiting_after_set = true;
				setTimeout(function(){
					that.waiting_after_set = false;
				}, that.wait*1000);
			}
			callback(null, powerState);
		}
	}.bind(this));
},

getPowerState: function(callback, context) {
	//if context is statuspoll, then we need to request the actual value
	if (!context || context != "statuspoll") {
		if (this.switchHandling == "poll") {
			this.log("getPowerState - polling mode, return state: ", this.state);
			callback(null, this.state);
			return;
		}
	}
	
	if (!this.status_url) {
		this.log.warn("Ignoring request; No status url defined.");
		callback(new Error("No status url defined."));
		return;
	}
	
	var url = this.status_url;
	this.log("getPowerState - actual mode");
	var that = this;
	
	this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		var tResp = responseBody;
		var tError = error;
		if (tError) {
			if (that.powerstateOnError) {
				tResp = that.powerstateOnError;
				tError = null;
			}
		} else {
			if (that.powerstateOnConnect) {
			  tResp = that.powerstateOnConnect;
			  tError = null;
			}
		}
		if (tError) {
			that.log('getPowerState - actual mode - failed: %s', error.message);
			var powerState = false;
			that.log("getPowerState - actual mode - current state: %s", powerState);
			that.state = powerState;
			callback(null, powerState);
		} else {
			var binaryState = parseInt(tResp);
			var powerState = binaryState > 0;
			that.log("getPowerState - actual mode - current state: %s", powerState);
			that.state = powerState;
			callback(null, powerState);
		}
	}.bind(this));
},

identify: function(callback) {
	this.log("Identify requested!");
	callback(); // success
},

getServices: function() {
	var informationService = new Service.AccessoryInformation();
	if (this.info){
		this.log('Setting info: '+ JSON.stringify( this.info));
		informationService
		.setCharacteristic(Characteristic.Manufacturer, this.info.manufacturer)
		.setCharacteristic(Characteristic.Model, this.info.model)
		.setCharacteristic(Characteristic.SerialNumber, this.info.serialNumber)
		.setCharacteristic(Characteristic.FirmwareRevision, this.info.firmwareRevision )
		.setCharacteristic(Characteristic.SoftwareRevision, this.info.softwareRevision );
	}
	
	this.switchService = new Service.Switch(this.name);
	this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));
	
	return [informationService, this.switchService];
}
};
