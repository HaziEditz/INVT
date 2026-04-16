$(function () {
    GetDetails();
    $("#form1").submit(function () { return false; });
    $("#btnMessage").click(function () { PushMessageNotification(); });
    $("#btnBroadcast").click(function () { BroadcastMessage(); });
    $("#btnGroupMessage").click(function () { FnGroupMessage(); });

    // Start Firebase driver→dispatcher listener as soon as companyId is known
    var _listenerPollCount = 0;
    var _listenerPoll = setInterval(function () {
        var cid = localStorage.getItem('TT_CId') || '';
        if (cid) {
            clearInterval(_listenerPoll);
            initDriverMessageListener(cid);
        }
        if (++_listenerPollCount > 40) clearInterval(_listenerPoll); // give up after 20 s
    }, 500);

    // Poll for new messages every 500 ms
    setInterval(function () {
        if ($("#lblRequest").text() == "True") {
            GetDetails();
            if ($("#UserId").text() != "0") {
                DriverNewMessages($("#UserId").text());
            }
            $("#lblRequest").text("False");
        }
    }, 500);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function _getLiveDrivers() {
    try {
        var sc = angular.element(document.getElementById('myangular')).scope();
        if (sc && sc.driverdatarealx && sc.driverdatarealx.length > 0) {
            return sc.driverdatarealx.map(function (d) {
                return {
                    Id:        d.driverid  || d.DriverId  || d.VehicleId || 0,
                    UserFName: d.drivername || d.DriverName || 'Driver',
                    UserLName: '',
                    Count: 0,
                    _live: true
                };
            });
        }
    } catch (e) {}
    return [];
}

// ── Driver list (sidebar) ─────────────────────────────────────────────────────

function GetDetails() {
    var liveDrivers = _getLiveDrivers();

    var param = [];
    var proc = '[RetrieveMessages]';
    Selector1(param, proc).then(function (result) {
        var $res = JSON.parse(result.d);
        var combined = Array.isArray($res) ? $res.slice() : [];

        // Merge live Firebase drivers that aren't already in SQL list
        var sqlIds = {};
        combined.forEach(function (d) { sqlIds[String(d.Id)] = true; });
        liveDrivers.forEach(function (d) {
            if (!sqlIds[String(d.Id)]) combined.push(d);
        });

        $(".friend-list").empty();
        if (combined.length > 0) {
            combined.forEach(function (d) {
                var badge = d.Count > 0
                    ? '<small class="chat-alert label label-danger">' + d.Count + '</small>'
                    : '';
                $(".friend-list").append(
                    '<li class="active bounceInDown">' +
                        '<a onclick="GetConversation(' + d.Id + ')" class="clearfix">' +
                            '<div class="friend-name"><strong>' + d.UserFName + ' ' + (d.UserLName || '') + '</strong></div>' +
                            badge +
                        '</a>' +
                    '</li>'
                );
            });
        } else {
            $(".friend-list").empty().append('<li><div class="friend-name"><strong>No drivers online</strong></div></li>');
        }
    });
}

function ReloadConversation() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var date  = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') + month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;
    var hours   = d.getHours();
    var minutes = d.getMinutes();
    var ampm    = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12; hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;

    $(".chat").append(
        '<li class="left clearfix">' +
            '<span class="chat-img pull-left"><img src="images/stph.png" alt="Dispatcher"></span>' +
            '<div class="chat-body clearfix">' +
                '<div class="header">' +
                    '<strong class="primary-font">You (Dispatcher)</strong>' +
                    '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + output + ' ' + strTime + '</small>' +
                '</div>' +
                '<p>' + $("#TxtMessage").val() + '</p>' +
            '</div>' +
        '</li>'
    );
    $("#TxtMessage").val("");
    var d2 = $('#DivChat');
    d2.scrollTop(d2.prop("scrollHeight"));
}

function DriverNewMessages(UserId) {
    var param = [{ "name": "Id", "Value": UserId }];
    var proc  = '[DispatcherUnReadMessages]';
    Selector1(param, proc).then(function (result) {
        var $res = JSON.parse(result.d);
        if ($res.length > 0) {
            for (var i = 0; i < $res.length; i++) {
                var isDriver = ($res[i].SenderID == UserId);
                var side     = isDriver ? 'right' : 'left';
                $(".chat").append(
                    '<li class="' + side + ' clearfix">' +
                        '<span class="chat-img pull-' + (isDriver ? 'right' : 'left') + '"><img src="images/stph.png" alt="Avatar"></span>' +
                        '<div class="chat-body clearfix">' +
                            '<div class="header">' +
                                '<strong class="primary-font">' + $res[i].User + '</strong>' +
                                '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + $res[i].Date + ' ' + $res[i].Time + '</small>' +
                            '</div>' +
                            '<p>' + $res[i].Message + '</p>' +
                        '</div>' +
                    '</li>'
                );
            }
            var d = $('#DivChat');
            d.scrollTop(d.prop("scrollHeight"));
            GetDetails();
        }
    });
}

function GetConversation(ele) {
    $("#UserId").text(ele);
    var param = [{ "name": "Id", "Value": ele }];
    var proc  = '[DispatcherConversation]';
    Selector(param, proc).then(function (result) {
        var $res = JSON.parse(result.d);
        if ($res["dt1"] && $res["dt1"].length > 0) {
            $("#PlayerId").text($res["dt1"][0].PlayerId || '');
        }
        $(".chat").empty();
        if ($res["dt2"] && $res["dt2"].length > 0) {
            for (var i = 0; i < $res["dt2"].length; i++) {
                var isDriver = ($res["dt2"][i].SenderID == ele);
                var side     = isDriver ? 'right' : 'left';
                $(".chat").append(
                    '<li id="msg-' + $res["dt2"][i].Id + '" class="' + side + ' clearfix">' +
                        '<span class="chat-img pull-' + (isDriver ? 'right' : 'left') + '"><img src="images/stph.png" alt="Avatar"></span>' +
                        '<div class="chat-body clearfix">' +
                            '<div class="header">' +
                                '<strong class="primary-font">' + $res["dt2"][i].User + '</strong>' +
                                '<small class="pull-right text-muted">' +
                                    '<i class="fa fa-clock-o"></i> ' + $res["dt2"][i].Date + ' ' + $res["dt2"][i].Time +
                                    ' <a onclick="DeleteMessage(' + $res["dt2"][i].Id + ')" title="Delete"><i class="fa fa-trash-o"></i></a>' +
                                '</small>' +
                            '</div>' +
                            '<p>' + $res["dt2"][i].Message + '</p>' +
                        '</div>' +
                    '</li>'
                );
            }
        } else {
            $(".chat").append('<li class="text-muted" style="padding:10px;">No messages yet. Send a message below.</li>');
        }
        var d = $('#DivChat');
        d.scrollTop(d.prop("scrollHeight"));
    });
    GetDetails();
}

function DeleteMessage(ele) {
    Action([{ "name": "Id", "Value": ele }], "[DeleteMessage]", ele);
    $("#msg-" + ele).remove();
    GetDetails();
}

// ── Send: Dispatcher → Driver (1:1) ──────────────────────────────────────────

function PushMessageNotification() {
    var msg = $("#TxtMessage").val().trim();
    if (!msg) return;

    var driverId = $("#UserId").text();
    if (!driverId || driverId === '0') {
        toastr["warning"]("Select a driver first.", "No Driver Selected");
        return;
    }

    var d = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h    = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m    = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var MessageDateTime = date + " " + h + ':' + m;

    // Push Firebase notification so driver app wakes up
    FnNewMessage(driverId, msg, MessageDateTime);

    // Persist in SQL backend
    Action([
        { "name": "RecieverId", "Value": driverId },
        { "name": "Message",    "Value": msg },
        { "name": "DateTime",   "Value": MessageDateTime }
    ], "[MessageInsert]");

    ReloadConversation();
    GetDetails();
}

// ── Send: Broadcast → all live drivers ───────────────────────────────────────

function BroadcastMessage() {
    var msg = $("#TxtBroadcast").val().trim();
    if (!msg) { toastr["warning"]("Please enter a message to broadcast.", "Broadcast"); return; }

    var d = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var MessageDateTime = date + " " + h + ':' + m;

    // SQL backend (persists for offline drivers too)
    Action([
        { "name": "Message",  "Value": msg },
        { "name": "DateTime", "Value": MessageDateTime }
    ], "[BroadcastMessage]");

    // Firebase instant notification to all live Firebase drivers
    var liveDrivers = _getLiveDrivers();
    if (liveDrivers.length > 0) {
        try {
            var updates = {};
            liveDrivers.forEach(function (d) {
                if (d.Id) {
                    updates['/chat/' + d.Id] = {
                        bookingid: '0,Broadcast,0,0,Dispatcher',
                        content: msg
                    };
                }
            });
            firebase.database().ref().update(updates);
        } catch (e) {}
    }

    toastr["success"]("Broadcast sent to all drivers.", "Broadcast");
    $("#TxtBroadcast").val("");
    GetDetails();
}

// ── Send: Group message (by zone/vehicle type) ────────────────────────────────

function FnGroupMessage() {
    var msg   = $("#TxtGroupMsg").val().trim();
    var zone  = $("#ddlGroupZone").val()  || '';
    var vtype = $("#ddlGroupVType").val() || '';
    if (!msg) { toastr["warning"]("Please enter a group message.", "Group Message"); return; }

    var d = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var MessageDateTime = date + " " + h + ':' + m;

    // SQL backend
    Action([
        { "name": "Message",     "Value": msg },
        { "name": "Zone",        "Value": zone },
        { "name": "VehicleType", "Value": vtype },
        { "name": "DateTime",    "Value": MessageDateTime }
    ], "[GroupMessage]");

    // Firebase notification to matching live drivers
    var liveDrivers = _getLiveDrivers();
    var targets = liveDrivers.filter(function (d) {
        var zoneMatch  = !zone  || (d.zonename  || '').toLowerCase().includes(zone.toLowerCase());
        var vtypeMatch = !vtype || (d.vehicletype || '').toLowerCase().includes(vtype.toLowerCase());
        return zoneMatch && vtypeMatch;
    });
    if (targets.length > 0) {
        try {
            var updates = {};
            targets.forEach(function (d) {
                if (d.Id) {
                    updates['/chat/' + d.Id] = {
                        bookingid: '0,GroupMessage,0,0,Dispatcher',
                        content: msg
                    };
                }
            });
            firebase.database().ref().update(updates);
        } catch (e) {}
    }

    toastr["success"]("Group message sent to " + targets.length + " live driver(s).", "Group Message");
    $("#TxtGroupMsg").val("");
    GetDetails();
}

// ── Firebase: Driver → Dispatcher real-time listener ─────────────────────────
// Driver app writes to /driverMsg/{companyId}/{pushKey}:
//   { driverId, driverName, vehicleNumber, message, timestamp }
// Console listens and shows the message in the chat panel instantly.

function initDriverMessageListener(companyId) {
    if (!companyId || window._driverMsgListenerActive) return;
    window._driverMsgListenerActive = true;

    try {
        firebase.database().ref('/driverMsg/' + companyId).on('child_added', function (snapshot) {
            var msg = snapshot.val();
            var key = snapshot.key;
            if (!msg || !msg.message) return;

            var driverId   = String(msg.driverId   || msg.DriverId   || '');
            var driverName = msg.driverName || msg.DriverName || ('Driver ' + driverId);
            var text       = msg.message || msg.Message || '';
            var now        = new Date();
            var timeStr    = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
            var dateStr    = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

            // Toast notification
            if (typeof toastr !== 'undefined') {
                toastr['info'](
                    '<b>' + driverName + ':</b> ' + text,
                    'Driver Message',
                    { timeOut: 8000, extendedTimeOut: 3000 }
                );
            }

            // If this driver's conversation is currently open, append message live
            var openDriverId = $("#UserId").text();
            if (driverId && openDriverId && String(driverId) === String(openDriverId)) {
                $(".chat").append(
                    '<li class="right clearfix">' +
                        '<span class="chat-img pull-right"><img src="images/stph.png" alt="Driver"></span>' +
                        '<div class="chat-body clearfix">' +
                            '<div class="header">' +
                                '<strong class="primary-font">' + driverName + '</strong>' +
                                '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + dateStr + ' ' + timeStr + '</small>' +
                            '</div>' +
                            '<p>' + text + '</p>' +
                        '</div>' +
                    '</li>'
                );
                var dv = $('#DivChat');
                dv.scrollTop(dv.prop("scrollHeight"));
            }

            // Store in SQL backend so conversation history persists
            Action([
                { "name": "SenderId",  "Value": driverId },
                { "name": "Message",   "Value": text },
                { "name": "DateTime",  "Value": dateStr + ' ' + timeStr }
            ], "[DriverMessageInsert]");

            // Refresh driver list (unread badge update)
            GetDetails();

            // Remove from Firebase after processing (prevents re-showing on page refresh)
            firebase.database().ref('/driverMsg/' + companyId + '/' + key).remove();
        });
    } catch (e) {
        console.error('[ChatRoom] driverMsg listener error:', e);
    }
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function Result(txt) {
    if (txt == "Message sent successfully") {
        ReloadConversation();
        GetDetails();
    }
}

function successFn()    {}
function errorFunction() {}
function FnRowDelete(ele) {}

function Logout() {
    $.ajax({
        url: "DispatcherLogin.aspx/Logout",
        type: "POST",
        datatype: "json",
        contentType: "application/json;charset=utf-8",
        success: FnSuccessLogout,
        error:   errorfn
    });
}

function FnSuccessLogout(result) {
    if (result.d == "Error") {
        toastr["error"]("Logout failed. Please try again.", 'Error');
    } else {
        try { firebase.auth().signOut(); } catch (e) {}
        localStorage.removeItem('TT_Name');
        localStorage.removeItem('TT_DId');
        localStorage.removeItem('TT_Country');
        localStorage.removeItem('TT_CId');
        localStorage.removeItem('Country');
        window.location.href = result.d;
    }
}

function errorfn() {
    toastr["error"]("Server or network error.", 'Connection Error');
}
