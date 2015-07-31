/**
 * This module manages user registration information. At a first approach all
 * information is kept in memory. Further development should lead to database
 * storing.
 */

var util = require('util');

/**
 * Object containing registration information for groups:
 *   - key: groupId
 *   - value: registeredUsers
 *   
 * Format of registeredUsers;
 * 	 - key: userid
 *	 - value: object {
 *		  - userid
 *		  - name
 *		  - state TODO
 *		  - location TODO
 *        - registerTime
 *		  - etc.
 *		  }
 *    
 */
var groups = {};

///**
// * Object containing registration information for users:
// * 	  - key: userid
// *	  - value: object {
// *		  - userid
// *		  - name
// *		  - state
// *		  - location
// *        - currentCall (array of references to sessionState object; callId[] or null)
// *		  - etc.
// *		  }
// * 
// */
//var registeredUsers = {};

// Object containing signalling sockets for users:
//  - key : groupId
//  - value: dict 
//	  - key: userid
//    - value: socket
//
var registeredUsersSignallingSockets = {};

// Object containing references to currently open signalling websockets:
//	- key: socketid
//	- value: obj 
//     - groupId: groupId
//     - userId: userId
var signallingSockets = {};


/**
 * Object containing session state for each call in progress.
 * 	- key: callId
 *  - value: {
 *      groupid:
 *  	callId:
 *  	transactionId:
 *  	callParticipants: (array)
 *  	state: (INITIATING | ESTABLISHED | TERMINATING | TERMINATED)
 *  }
 */
var sessionStates = {};


/**
 * 
 * @param groupId
 * @returns
 */
function getGroupRegister(groupid) {
	return groups[groupid];
}


/**
 * 
 * @param groupId
 * @param userid
 * @param registerInformation
 *            object containing user information to be stored in register.
 * @param socket signaling socket
 */
function registerUser(groupid, userid, registerInformation, socket) {
	console.log('Registering userid: ' + userid + ', into groupid: ' + groupid + ', with the following information: ' + util.inspect(registerInformation));  // Debug
	
	// Add user to the corresponding group.
	var reg = groups[groupid];
	if (!reg) {
		reg = {};
		groups[groupid] = reg;
	}
	reg[userid] = registerInformation;
	reg[userid].currentCall = [];
	reg[userid].registerTime = new Date().getTime();
	
	// Add the user to the signalling sockets register (registeredUsersSignallingSockets)
	// for the corresponding group.
	var reg_sig = registeredUsersSignallingSockets[groupid];
	if (!reg_sig) {
		reg_sig = {};
		registeredUsersSignallingSockets[groupid] = reg_sig;
	}	
	reg_sig[userid] = socket;

	// Add user to the register of sockets 
	signallingSockets[socket.id] = {groupid: groupid, userid: userid};	
	
	//sendUsersInformationUpdates();  // TODO	
};


/**
 * @param groupid
 * @param userid
 */
function deregisterUser(groupid, userid) {
	var reg = registeredUsersSignallingSockets[groupid];
	if (reg) {
		var socket = reg[userid];
		var user_information = getUserInformation(groupid, userid);
		delete groups[groupid][userid];
		delete reg[userid];
		if (socket) {
			delete signallingSockets[socket.id];
		}
		
		// Trim session states for current userid
		if (typeof user_information != undefined){
			if(user_information.currentCall) {
				for (var i=0; i<user_information.currentCall.length; i++) {
					trimSessionStateForUserid(user_information.currentCall[i], groupid, userid);
				}
			}
		}
		//sendUsersInformationUpdates();  // TODO
	}
	
};


/**
 * Trim session state information for a (groupid, userid) pair and callId.
 * 
 * @param callId
 * @param groupid
 * @param userId
 */
function trimSessionStateForUserid(callId, groupid, userId) {
	var current_call_state = getSessionState(callId);
	if (current_call_state) {
		removeElementFromArray(current_call_state.callParticipants, userId);
//		if (current_call_state.callParticipants.length == 0) {
		if (current_call_state.callParticipants.length == 1) {
			removeSessionState(current_call_state.callId);
		}
	}
}


/**
 * 
 * @param groupid
 * @param userid
 */
function getUserInformation(groupid, userid) {
	console.log('getUserInformation():');  // Debug
	console.log('getUserInformation(' + groupid + ', ' + userid + ' from ' + util.inspect(groups));  // Debug
	if(!groups[groupid]){
		console.log('Warning: groups[' + groupid + '] is null or is not defined in getUserInformation(groupid, userid)');
		return null;
	}
	return groups[groupid][userid];
};


/**
 * Update one user's information with the content of a given object.
 * 
 * @param groupid
 * @param userid
 * @param data
 */
function updateUserInformation(groupid, userid, data) {
	var info = getUserInformation(groupid, userid);
	if (info) {
		for (var attr_name in data) {
			info[attr_name] = data[attr_name];
		}
	}
}


/**
 * @param socketid
 */
function getUseridFromSocketid(socketid) {
	if (signallingSockets[socketid]) {
		return signallingSockets[socketid].userid; 
	}
	return null;
//	return signallingSockets[socketid][userid];
};


/**
 * @param socketid
 */
function getGroupidFromSocketid(socketid) {
	if (signallingSockets[socketid]) {
		return signallingSockets[socketid].groupid;
	}
	return null;
//	return signallingSockets[socketid][groupid];
};


/**
 * @param socketid
 * @return {groupid: <groupid>, userid:<userid>}
 */
function geGroupidAndUsertUseridFromSocketid(socketid) {
	return signallingSockets[socketid];
};


/**
 * @param socketid
 */
function deregisterSocket(socketid) {
	var userid = getUseridFromSocketid(socketid);
	var groupid = getGroupidFromSocketid(socketid);
	console.log('deregisterSocket(' + socketid + '): userid: ' + userid + ', groupid: ' + groupid);
	if (userid && groupid) {
		deregisterUser(groupid, userid);
	}
	else {
		delete signallingSockets[socketid];
	}
};


/**
 * 
 * @param groupid
 * @param userid
 */
function getSignallingSocket(groupid, userid) {
	var reg = registeredUsersSignallingSockets[groupid];
	if (reg) {
		return reg[userid];
	}
	return null;
}


/**
 * Send current user information to all users currently registered to a given group.
 * 
 * @param groupid
 * 
 * TODO Allow contact list filtering (in user registration information)
 */
function sendUsersInformationUpdates(groupid) {
	var reg = groups[groupid];
	if (reg) {
		for (var userid in reg) {
			console.log('Sending update users information to user ' + userid);
			reg[userid].emit('usersInformationUpdate', reg);
		}
	}
};


/**
 * 
 * @param callId
 * @param groupid
 * @param transactionId
 * @param callParticipants
 * @param state
 */
function addSessionState(callId, groupid, transactionId, callParticipants, state) {
	var session_state = {
			callId: callId,
			groupid: groupid,
			transactionId: transactionId,
			callParticipants: callParticipants,
			state: state
	};
	sessionStates[callId] = session_state;
	console.log('Adding session state: ' + JSON.stringify(session_state));
	// Add to call participants
	for (var i=0; i<callParticipants.length; i++) {
		console.log('callParticipants[' + i + ']: ' + callParticipants[i]);  // Debug
//		addCurrentCallToUserInformation(groupid, callParticipants[i], callId);
	}
}


/**
 * Add a callId to the list of current calls for a userId.
 * 
 * @param groupid
 * @param userId
 * @param callId
 */
function addCurrentCallToUserInformation(groupid, userId, callId) {
	console.log('addCurrentCallToUserInformation(' + groupid + ', ' + userId + ', ' + callId);
	var user_information = getUserInformation(groupid, userId);
	if (userId) {
		user_information.currentCall[user_information.currentCall.length] = callId;
	}
}


/**
 * 
 * @param callId
 */
function removeSessionState(callId) {
	console.log('Removing session state ' + callId);
	state = getSessionState(callId);
	if (state) {
		// Update currentCall in call participants
		for (var i=0; i<state.callParticipants.length; i++) {
			console.log('Removing call ' + callId + ' in user ' + state.callParticipants[i]);
			removeCurrentCallFromUserInformation(state.groupid, state.callParticipants[i], callId);
		}
	}
	delete sessionStates[callId];
}


/**
 * Remove a callId from the list of current calls for a userId.
 * 
 * @param groupid
 * @param userId
 * @param callId
 */
function removeCurrentCallFromUserInformation(groupid, userId, callId) {
	var user_information = getUserInformation(groupid, userId);
	if (user_information) {
		removeElementFromArray(user_information.currentCall, callId);
	}
}



/**
 * 
 * @param callId
 * @returns
 */
function getSessionState(callId) {
	return sessionStates[callId];
}


/**
 * Update one session's information with the content of a given object.
 *  
 * @param callId
 * @param data
 */
function updateSessionState(callId, data) {
	var session_state = getSessionState(callId);
	console.log('Updating session state for ' + callId + ': ' + JSON.stringify(session_state) + ' to ' + JSON.stringify(data));
	if (session_state) {
		for (var attr_name in data) {
			session_state[attr_name] = data[attr_name];
		}
	}
	console.log('Updated session state: ' + JSON.stringify(session_state));
}


/**
 * 
 * @param groupid
 * @param userid
 * @param callId
 */
function removeUserFromCall(groupid, userid, callId) {
	console.log('Removing user ' + userid + ' in group ' + groupid + ' from call ' + callId);
	var call_state = getSessionState(callId);
	if (call_state) {
		// Update currentCall in call participants
		var user_information = getUserInformation(groupid, userid);
		if (user_information) {
			removeElementFromArray(user_information.currentCall, callId);
		}
		removeElementFromArray(call_state.callParticipants, userid);
		if (call_state.callParticipants.length <= 1)
			removeSessionState(callId);
	}
}


/**
 * Remove an element from an array.
 * 
 * @param array
 * @param value
 */
function removeElementFromArray(array, value) {
	for (var index = 0; index<array.length; index++)
		if (value == array[index])
			array.splice(index, 1);
}


/**
 * Returns the users currently registered for a given group.
 * @param groupid
 * @return object with the following structure:
 *        {<userid>: {userid: <userid>,
 *        			  groupid: <groupid>,
 *                    name: <name>,
 *                    registerTime: <registerTime>
 *                   }
 *        }
 */
function getRegisteredUsers(groupid) {
	var reg = groups[groupid];
	if (!reg) {
		return {};
	}
	var res = {};
	for (var userid in reg) {
		var user_reg = {};
		user_reg.userid = userid;
		user_reg.groupid = groupid;
		user_reg.name = reg[userid].name;
		user_reg.registerTime = reg[userid].registerTime;
		user_reg.shareScreen = reg[userid].shareScreen;
		res[userid] = user_reg;
	}
	console.log('getRegisteredUsers(' + groupid + '): ' + util.inspect(res));  // Debug
	return res;
}


/**
 * Returns all the current session states in which userid participates, within groupid.
 * 
 * @param groupid
 * @param userid
 * @return Dictionary with the following structure:
 *         key: user_id
 *         value: object {
 *                   callId: call id,
 *                   transactionId: transaction id,
 *                   state: state
 *                }
 */
function getSessionStatesForUserid(groupid, userid) {
	var res = {};
	util.inspect(sessionStates);
	var position = 0;
	for (var call_id in sessionStates) {
		var session_state = sessionStates[call_id];
		if (session_state.groupid === groupid) {
			for (var k in session_state.callParticipants) {
				console.log("--> Call participant in position("+k+"): "+session_state.callParticipants[k]);
				if (session_state.callParticipants[k] == userid) {
					var data = {};
					data.callId = call_id;
					data.transactionId = session_state.transactionId;
					data.state = session_state.state;
					if(k==0){
						var posDestUser = parseInt(k)+1;
						data.dest_userid = session_state.callParticipants[posDestUser];//[userid, dest_userid]
						console.log("----> Dest_userid call in position("+posDestUser+"): "+data.dest_userid);
					}
					else{
						var posDestUser = parseInt(k)-1;
						data.dest_userid = session_state.callParticipants[posDestUser];//[dest_userid, userid]
						console.log("----> Dest_userid call in position("+posDestUser+"): "+data.dest_userid);
					}
					res[position++] = data;
					console.log("new position: "+position);
				}
			}
		}
	}
	console.log('getSessionStatesForUserid(groupid=' + groupid + ', userid=' + userid + '): ' + util.inspect(res));
	return res;
}

/**
*	Get call screen sessions id
*/
function getCallScreenSessionsId(groupid, userid){
	var res = {};
	var position = 0;
	for (var call_id in sessionStates) {
		var session_state = sessionStates[call_id];
		if (session_state.groupid === groupid) {
			for (var k in session_state.callParticipants) {
				if(session_state.callId.indexOf("-screen-") != -1 && session_state.callParticipants[k] == userid ){
					var data = {};
					data.callId = call_id;
					for (var j in session_state.callParticipants) {
						if(session_state.callParticipants[j] != userid){
							data.dest_user = session_state.callParticipants[j];
						}
					}
					data.transactionId = session_state.transactionId;
					res[position++] = data;
				}
			}
		}
	}
	
	return res;
}


// User information
exports.groups = groups;
exports.registerUser = registerUser;
exports.deregisterUser = deregisterUser;
exports.getUserInformation = getUserInformation;
exports.sendUsersInformationUpdates = sendUsersInformationUpdates;
exports.updateUserInformation = updateUserInformation;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getGroupidFromSocketid = getGroupidFromSocketid;
exports.getUseridFromSocketid = getUseridFromSocketid;
exports.getCallScreenSessionsId = getCallScreenSessionsId;

// Signalling sockets
exports.signallingSockets = signallingSockets;
exports.registeredUsersSignallingSockets = registeredUsersSignallingSockets;
exports.getUseridFromSocketid = getUseridFromSocketid;
exports.deregisterSocket = deregisterSocket;
exports.getSignallingSocket = getSignallingSocket;

// Session state
exports.sessionStates = sessionStates;
exports.addSessionState = addSessionState;
exports.removeSessionState = removeSessionState;
exports.getSessionState = getSessionState;
exports.updateSessionState = updateSessionState;
exports.removeUserFromCall = removeUserFromCall;
exports.getSessionStatesForUserid = getSessionStatesForUserid;

