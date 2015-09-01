const SOCKET_IO_DEBUG_MODE = false;

const CONFIG_FILE = './config.conf';

//const GROUP_URL_PATTERN = /\/webrtc_multi\/([a-zA-Z0-9]+)(\/?)$/;
//const GROUP_URL_PATTERN = /\/webrtc_multi\/([a-zA-Z0-9\?=\+]+)/;
const GROUP_URL_PATTERN = /\/webrtc_multi\/.+/;
const GROUP_NAME_URL_PATTERN = /\/webrtc_multi\/([a-zA-Z0-9]+)/;

const GET_REGISTERED_USERS_URL_PATTERN = /\/users\/list(\/?)$/;


const HTML_CONTENT_DIR = './html/';
const MAIN_INDEX = './html/index.html';
const LOGIN_PAGE = './html/login.html';
//------------ Call states ----------------------------------------------
const STATE_INITIATING = 'initiating';
const STATE_RINGING = 'ringing';
const STATE_ESTABLISHED = 'established';
const STATE_TERMINATING = 'terminating';
const STATE_TERMINATED = 'terminated';
const STATE_IDLE = 'idle';
// -----------------------------------------------------------------------


// ------------ Signalling message names ---------------------------------
const INVITE = 'invite';
const SESSION_PROGRESS = 'sessionProgress';  // ~ 183 (Session Progress)
const OK = 'ok';  // ~ 200 (OK)
const BYE = 'bye';
const ACK = 'ack';
const ICE_CANDIDATE = 'iceCandidate';
const RINGING = 'ringing';  // ~ 180 (Ringing)
const DECLINE = 'decline';  // ~ 603 (Decline)
const BUSY = 'busy';  // ~ 600 (Busy Everywhere)
const UPDATE_FLAG_SHARESCREEN = 'updateShareScreen';
const STOP_SHARE_SCREEN = 'stopShareScreen';
// -----------------------------------------------------------------------

// ------------ Modules --------------------------------------------------
//var https = require('https');
var http = require('http');
var util = require('util');
var registrar = require('./registrar.js');
var fs = require('fs');
//------------------------------------------------------------------------

/**
 * 
 * @param s
 */
function parseConfig(s) {
	res = {};
	var lines = s.split('\n');
	for (var i=0; i<lines.length; i++) {
		var l = lines[i].trim();
		if (l.length > 0 && l.charAt(0) != '#') {
			var attr = parseConfigLine(l);
			if (attr.length == 2)
				res[attr[0]] = attr[1];
		} 
	}	
	return res;
}


/**
 * 
 * @param s
 * @returns {Array}
 */
function parseConfigLine(s) {
	var index = s.indexOf(':');
	var attr = s.substring(0, index).trim();
	var value = s.substring(index+1, s.length).trim();
	return [attr, value];
}


//
//Read configuration options from config.conf file
var config_text = fs.readFileSync(CONFIG_FILE, 'utf8');
//console.log('config_text: ' + config_text);  // Debug
var configurationOptions = parseConfig(config_text);

//console.log('Configuration file ' + CONFIG_FILE + ' exists: ' + fs.existsSync(CONFIG_FILE));  // Debug
console.log('Read configuration information: ' + util.inspect(configurationOptions));


/**
 * Get current room's name from its URL path.
 * 
 * @param urlPath
 * @returns {String}
 */
function getGroupName(urlPath) {
	// TODO
	return 'roomName';
}

/*var https_options= {
		key: fs.readFileSync('/etc/ssl/private/wildcard/hi-iberia.es.key'),
		cert: fs.readFileSync('/etc/ssl/private/wildcard/hi-iberia.es.crt')
};*/

var httpd = http.createServer(function(req, res){//https.createServer(https_options, function (req, res) {
	var url = require('url').parse(req.url);
	if ('/' === url.path) {
		// Redirection to default location from root path.
		console.log('Redirecting to ' + configurationOptions.location + ' from ' + req.url);  // Debug
		res.writeHead(307, {'Location': configurationOptions.location});  // Moved temporarily
		res.end();
	}
	else if (GROUP_URL_PATTERN.test(url.path)) {
		var group_name = getGroupName(url.path);
		console.log('Entering into group ' + group_name);
		fs.createReadStream(MAIN_INDEX).pipe(res);
	}
	else if (GET_REGISTERED_USERS_URL_PATTERN.test(url.path)) {
		console.log('Listing registered users: ' + url.path);  // Debug
		list_registered_users(res);
	}
	else if (url.path=='/webrtc_multi') {
		console.log('Getting login page for: ' + url.path);  // Debug
		res.writeHead(200, {'Content-Type': 'text/html'});
		fs.createReadStream(LOGIN_PAGE).pipe(res);
	}
	else {
		console.log('Getting resource file ' + url.path);  // Debug
		var file_path = HTML_CONTENT_DIR + url.path;
		console.log('Getting resource file ' + file_path);  // Debug
		try {
			fs.exists(file_path, function(exists) {
				if (exists) {
					fs.stat(file_path, function(err, stats) {
						if (stats.isDirectory()) {
							// No directory inspection is allowed
							console.log('Requested path is a directory ' + url.path + '. Sending 404 response');  // Debug
							res.writeHead(404, {'Content-Type': 'text/html'});
							res.end('<html><body><h1>404 Resource does not exist</h1></body></html>');
						}
						else {
							content_type = getContentType(file_path);
							res.writeHead(200, {'Content-Type': content_type, 'Transfer-Encoding': 'chunked'});
							fs.createReadStream(file_path).pipe(res);
						}
					});
				}
				else {
					res.writeHead(404, {'Content-Type': 'text/html'});
					res.end('<html><body><h1>404 Resource does not exist</h1></body></html>');
				}
			});
		} catch (e) {
			console.log('Error geting resource file: ' + file_path);  // Debug
			res.writeHead(404, {'Content-Type': 'text/html'});
			res.end('<html><body><h1>404 Resource does not exist</h1></body></html>');
		}
	}
	return;
}).listen(configurationOptions.server_port, configurationOptions.server_ip);;
    console.log("aqui en wrtc_multi.js");


/**
 * 
 * 
 * @param res
 */
function list_registered_users(res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('Registered users:\n' + util.inspect(registrar.groups) + 
			'\n--------------------------------------------\nRegistered signalling sockets:\n' + util.inspect(registrar.signallingSockets) + 
			'\n--------------------------------------------\nUser sockets:\n' + util.inspect(registrar.registeredUsersSignallingSockets) + 
			'\n--------------------------------------------\nSession states:\n' + util.inspect(registrar.sessionStates));
}


	
function getContentType(filePath) {
	splits = filePath.split('.');
	if (splits.length < 2)
		return "text/plain";
	ext = splits[splits.length-1];
	ext = ext.toLowerCase();
	if (ext == "js") {
		return "text/javascript";
	}
	else if (ext == "css") {
		return "text/css";
	}
	else if (ext == "html" || ext == "htm") {
		return "text/html";
	}
	else if (ext == "jpg" || ext == "jpeg") {
		return "image/jpeg";
	}
	else if (ext == "gif") {
		return "image/gif";
	}
	else if (ext == "png") {
		return "image/png";
	}
	else if (ext == "mp3") {
		return "audio/mpeg";
	}
	else if (ext == "wav") {
		return "audio/wav";
	}
	return "text/plain";
}

//console.log('Server running at ' + SERVER_IP + ':' + SERVER_PORT);
console.log('Server running at ' + configurationOptions.server_ip + ':' + configurationOptions.server_port);

// Socket.io
var io = require('socket.io').listen(httpd, {log: SOCKET_IO_DEBUG_MODE});
console.log("Servidor socket.io escuchando en el puerto 1339");
io.sockets.on('connection', function(socket) {
	console.log('***** socket.io connection established');  // Debug
	// Registration
	// 
	socket.on('register', function(registerInformation) {
		// Register userid and its associated information to the signaling socket.
		// 'content' is expected to be a JSON string, containing the following fields:
		//     - room
		//     - userid
		//     - name
        //     - comments
        //     - etc.
		console.log('Registering user ' + registerInformation.userid + ' into group ' + registerInformation.groupid);
		// Comprobar si el usuario está registrado
		// TODO
		// En caso contrario registrarlo 
		registrar.registerUser(registerInformation.groupid, registerInformation.userid, registerInformation, socket);
		
		//socket.username = registerInformation.userid;
		//socket.room = registerInformation.groupid;
		socket.join(registerInformation.groupid);
		var registeredUsers = registrar.getRegisteredUsers(registerInformation.groupid);
		socket.broadcast.to(registerInformation.groupid).emit('usersInformationUpdate',registeredUsers);
		
		socket.on('close', function() {
			console.log('Signalling connection is closed');
			deregisterUser(registerInformation.groupId, registerInformation.userid);
			deregisterScreen(deregisterInformation.groupId, deregisterInformation.userid);
			// Clean up
			// TODO
		});
	});
	
	// Deregistration
	socket.on('deregister', function(deregisterInformation) {
		// Deregister userid.
		// 'content' is expected to be a JSON string, containing at least the following
		// field;
		//     - userid
		deregisterUser(deregisterInformation.groupId, deregisterInformation.userid);
	});
	
	// Invite
	socket.on(INVITE, function(message) {
		console.log('<- Received invite: ' + util.inspect(message));
		// 1. Create session state
		registrar.addSessionState(message.callId, message.group, message.transactionId, [message.from, message.to], STATE_INITIATING);
		// 2. Send invite to destination
		var destination_socket = registrar.getSignallingSocket(message.group, message.to);
		console.log('destination_socket for group ' + message.group + ' and destination ' + message.to + ': ' + destination_socket);  // Debug
		if (destination_socket) {
			destination_socket.emit(INVITE, message);
			console.log('-> Sending invite to ' + message.to + ' in group ' + message.grou + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
		}
	});

	// IceCandidate
	socket.on(ICE_CANDIDATE, function(message) {
		console.log('<- Received iceCandidate: ' + util.inspect(message));
		// 1. Send to destination
		var destination_socket = registrar.getSignallingSocket(message.group, message.to);
		if (destination_socket) {
			destination_socket.emit(ICE_CANDIDATE, message);
			console.log('-> Sending iceCandidate to ' + message.to + ' in group ' + message.group + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
		}
	});
	
	// SessionProgress
	socket.on(SESSION_PROGRESS, function(message) {
		console.log('<-- Received sessionProgress: ' + util.inspect(message));
		// 1. Send to caller
		var destination_socket = registrar.getSignallingSocket(message.group, message.from);
		if (destination_socket) {
			destination_socket.emit(SESSION_PROGRESS, message);
			console.log('-> Sending sessionProgress to ' + message.from + ' in group ' + message.group + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
		}
	});

	// Ringing
	socket.on(RINGING, function(message) {
		console.log('<-- Received ringing: ' + util.inspect(message));
		// 1. Send to caller
		var destination_socket = registrar.getSignallingSocket(message.group, message.from);
		if (destination_socket) {
			destination_socket.emit(RINGING, message);
			console.log('-> Sending ringing to ' + message.from + ' in group ' + message.group + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
		}
		
		// 2. Update call state
		registrar.updateSessionState(message.callId, {state: STATE_RINGING});
	});
	
	// Bye
	socket.on(BYE, function(message) {
		console.log('<-- Received bye: ' + util.inspect(message));
		// 1. Send to destination
		var destination_socket = registrar.getSignallingSocket(message.group, message.to);
		if (destination_socket) {
			destination_socket.emit(BYE, message);
			console.log('-> Sending bye to ' + message.to + ' in group ' + message.group + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
			// 2. Update call state
			registrar.updateSessionState(message.callId, {state: STATE_TERMINATING});
		}
		else {
			// 2. If no destination_socket is found, then the calls is supposed to be already finished.
			// Therefore, remove the corresponding session information.
			console.log('Removing session information for callId: ' + message.callId + ' since no signalling socket was found for destination user; therefore, the corresponding call should habe been already ended.');
			registrar.removeSessionState(message.callId);
		}
	});

	// Ok
	socket.on(OK, function(message) {
		console.log('<-- Received ok: ' + util.inspect(message));
		// 1. Send to destination
		var destination_socket = registrar.getSignallingSocket(message.group, message.from);
		if (destination_socket) {
			destination_socket.emit(OK, message);
			console.log('-> Sending ok to ' + message.from + ' in group ' + message.group + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
			// 2. Update call state
			var call_state = registrar.getSessionState(message.callId);
			if (call_state) {
				if (call_state.state === STATE_RINGING) {
					// Call established
					registrar.updateSessionState(message.callId, {state: STATE_ESTABLISHED});
				}
				else if (call_state.state === STATE_TERMINATING) {
					// Call terminated
					registrar.updateSessionState(message.callId, {state: STATE_TERMINATED});
					// Remove call state information for sending user
					registrar.removeUserFromCall(message.from, message.callId);
				}
			}
		}
		else {
			// 2. If no destination_socket is found, then the calls is supposed to be already finished.
			// Therefore, remove the corresponding session information.
			console.log('Removing session information for callId: ' + message.callId + ' since no signalling socket was found for destination user; therefore, the corresponding call should habe been already ended.');
			registrar.removeSessionState(message.callId);
		}
		
	});

	// Busy
	socket.on(BUSY, function(message) {
		console.log('<- Received busy: ' + util.inspect(message));
		// 1. Send to destination
		var destination_socket = registrar.getSignallingSocket(message.from);
		if (destination_socket) {
			destination_socket.emit(BUSY, message);
			console.log('-> Sending busy to ' + message.to + ' through signalling socket ' + destination_socket.id + ': ' + util.inspect(message));
		}
		
		// 2. Update call state
		registrar.updateSessionState(message.callId, {state: STATE_TERMINATED});
		// Remove call state information for busy user
		registrar.removeUserFromCall(message.group, message.to, message.callId);
		
		// 
	});

	// Client send getRegisteredUsers request.
	// Structure of request is
	//    {groupid : currentGroupId, userid: currentUserId}
	socket.on('getRegisteredUsers', function(request) {
		var registeredUsers = registrar.getRegisteredUsers(request.groupid);
		socket.emit('getRegisteredUsersResult', registeredUsers);
	});
	
	// 
	socket.on('disconnect', function() {
		// Get group for current signalling socket.
		var groupid = registrar.getGroupidFromSocketid(socket.id);
		// Get user for current signalling socket.
		var userid = registrar.getUseridFromSocketid(socket.id);
		
//		// Deregister user for current socket.
//		registrar.deregisterSocket(socket.id);
		
		deregisterScreen(groupid, userid);
		
		// Finalize all calls for current user.
		finalizeAllCallsForUser(groupid, userid);
		
		registrar.deregisterUser(groupid, userid);
		var registeredUsers = registrar.getRegisteredUsers(groupid);
		socket.broadcast.to(groupid).emit('usersInformationUpdate',registeredUsers);
	});
	
	socket.on(UPDATE_FLAG_SHARESCREEN, function(flagInformation){
		var groupid = flagInformation.groupid;
		var userid = flagInformation.userid;
		var data = {shareScreen:flagInformation.shareScreen};
		registrar.updateUserInformation(groupid, userid, data);
		
		console.log("flag user update: "+userid);//debug
		//BROADCAST PARA AVISAR DE QUE ESTÁ COMPARTIENDO EL ESCRITORIO
		var msg = {
			userid: userid
		};
		socket.broadcast.to(groupid).emit(UPDATE_FLAG_SHARESCREEN, msg);
		console.log("after broadcast");//debug
	});
	
	socket.on(STOP_SHARE_SCREEN, function(stopShareInformation){
		//deregisterScreen(stopShareInformation.groupid, stopShareInformation.userid, socket);
		//check if user is sharing desktop
		var userid = stopShareInformation.userid;
		var groupid = stopShareInformation.groupid;
		console.log("stop share screen from "+userid+" in group "+groupid);
		var userInformation = registrar.getUserInformation(groupid, userid);
		if(userInformation){
			if(userInformation.shareScreen == 1){
				//change option
				var newData = {shareScreen:0}
				registrar.updateUserInformation(groupid,userid,newData);
			
				var sessions = registrar.getCallScreenSessionsId(groupid, userid);
				console.log("Sessions in stop share screen:");
				console.log(sessions);
				var sessionOrigin = "";
				for(var k in sessions){
					sessionOrigin = sessions[k].callId.split("-")[0];
					console.log("Session origin = "+sessionOrigin);
					if(sessionOrigin == userid){		
						registrar.removeSessionState(sessions[k].callId);
						sendBye(userid, sessions[k].dest_user, groupid, sessions[k].callId, sessions[k].transactionId, true);
					}
				}
			
			}
		}
	});
		
	
});


/**
 * Finalizes all calls in which userid, belonging to groupid, participates.
 * 
 * @param groupid
 * @param userid
 */
function finalizeAllCallsForUser(groupid, userid) {
	// 1. Get all currently established calls where userid takes part in groupid.
	current_sessions = registrar.getSessionStatesForUserid(groupid, userid);
	console.log('Finalizing calls after user ' + userid + ' has been unregistered: ' + util.inspect(current_sessions));
	
	// 2. Send BYE for every established call got in 1.
	for (var position in current_sessions) {
		var dest_userid = current_sessions[position].dest_userid;
		console.log('Trying to send BYE from:' + userid + ', to:' + dest_userid + ', callId:' + current_sessions[position].callId);
		if((current_sessions[position].callId).indexOf("-screen-") != -1){
			//sendBye(userid, dest_userid, groupid, current_sessions[position].callId, generateTransactionId(BYE), true);
		}else{
			sendBye(userid, dest_userid, groupid, current_sessions[position].callId, generateTransactionId(BYE), false);
		}
	}
}




/**
 * @param content json containing the following fields:
 * <ul>
 * 	<li>userid</li>
 *  <li>name</li>
 *  <li>comments</li>
 *  etc.
 * </ul>
 */
var registerHandler = function(content) {
	var register_information = {};
	register_information.socket = socket;
	registrar.registerUser(content.userid, register_information);
};


///**
// * 
// */
//function deregisterUser(groupId, userid) {
//	// Check wether user is currently involved in a call
//	var user_information = registrar.getUserInformation(groupId, userid);
//	if (user_information) {
//		var current_call_ids = user_information.currentCalls;
//		if (current_call_ids) {
//			for (var i=0; current_call_ids.length; i++) {
//				var current_call_id = current_call_ids[i];
//				// If user is involved in a call, send bye to the other participants
//				var session_state = registrar.getSessionState(current_call_id);
//				if (session_state) {
//					var call_participants = session_state.callParticipants;
//					if (call_participants) {
//						for (var j=0; j<call_participants.length; j++) {
//							if (current_call_id != call_participants[j]) {
//								sendBye(userid, call_participants[j], current_call_id, generateTransactionId(BYE));
//							}
//						}
//						registrar.removeUserFromCall(userid, current_call_id);
//					}
//				}
//			}
//		}
//	}
//	// Deregister user
//	console.log('Deregistering user ' + userid);
//	registrar.deregisterUser(userid);
//
//}


/**
 * 
 */
function deregisterUser(groupid, userid) {
	// Check wether user is currently involved in a call
	var user_information = registrar.getUserInformation(groupid, userid);
	if (user_information) {
		var current_call_id = user_information.currentCall;
		if (current_call_id) {
			console.log("User involved in a call "+current_call_id);
			// If user is involved in a call, send bye to the other participants
			var session_state = registrar.getSessionState(current_call_id);
			if (session_state) {
				console.log("Session state of call: "+session_state);
				var call_participants = session_state.callParticipants;
				if (call_participants) {
					for (var i=0; i<call_participants.length; i++) {
						if (current_call_id != call_participants[i]) {
							console.log("Send bye");
							sendBye(userid, call_participants[i], groupid, current_call_id, generateTransactionId(BYE), false);
						}
					}
					registrar.removeUserFromCall(groupid, userid, current_call_id);
				}
			}
		}
	}
	// Deregister user
	console.log('Deregistering user ' + userid + ' from group ' + groupid);
	registrar.deregisterUser(groupId, userid);

}

/**
*
*/
function deregisterScreen(groupid, userid, socket){
	//check if user is sharing desktop
	console.log("deregisterScreen from "+userid+" in group "+groupid);
	var userInformation = registrar.getUserInformation(groupid, userid);
	if(userInformation){
		if(userInformation.shareScreen == 1){
			//change option
			var newData = {shareScreen:0}
			registrar.updateUserInformation(groupid,userid,newData);
			
			var current_call_id = userInformation.currentCall;
			
			var sessions = registrar.getCallScreenSessionsId(groupid, userid);
			//console.log("sessions with screen word");
			//console.log(sessions);
			for(var k in sessions){
				//removeSessionState
				registrar.removeSessionState(sessions[k].callId);
				
				sendBye(userid, sessions[k].dest_user, groupid, sessions[k].callId, sessions[k].transactionId, true);
			}
			
		}
	}
}


/**
 * 
 * @param from
 * @param to
 * @param group
 * @param callId
 * @param transactionId
 */
function sendBye(from, to, group, callId, transactionId, screen) {
	var destination_socket = registrar.getSignallingSocket(group, to);
	if (destination_socket) {
		var bye_msg = {from: from,
						to: to,
						callId: callId,
						transactionId: transactionId,
						screen: screen};
		destination_socket.emit(BYE, bye_msg);
		console.log('-> Sending bye: ' + JSON.stringify(bye_msg));
	}
}


function getRandomInteger() {
	return Math.floor((Math.random()*10000000000)+1);
}


function getTimestamp() {
	return new Date().getTime();
}


function generateTransactionId(operation) {
	return operation + '-' + getTimestamp() + '-' + getRandomInteger();
}

/**
 * Get groupId from current request
 * 
 */
function getCurrentGroupId(urlPath) {
	console.log('getCurrentGroupId: urlPath: ' + urlPath); // Debug
	if (GROUP_NAME_URL_PATTERN.test(urlPath)) {
		var res = GROUP_NAME_URL_PATTERN.exec(urlPath)[1];
		console.log('getCurrentGroupId(): ' + res); // Debug
		return res;
	}
	return null;
}


