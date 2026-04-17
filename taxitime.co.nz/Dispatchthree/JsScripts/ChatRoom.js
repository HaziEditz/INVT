// ── Avatar helpers ────────────────────────────────────────────────────────────
var _avatarColors = ['#e74c3c','#3498db','#2ecc71','#9b59b6','#1abc9c','#e67e22','#16a085','#8e44ad','#2980b9','#c0392b'];

function _avatarColor(name) {
    var h = 0;
    for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
    return _avatarColors[h % _avatarColors.length];
}

function _initials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Init ──────────────────────────────────────────────────────────────────────
$(function () {
    GetDetails();
    $("#form1").submit(function () { return false; });

    // Custom tab switching (replaced Bootstrap tabs)
    $(document).on('click', '.tt-tab-btn', function () {
        var target = $(this).data('panel');
        $('.tt-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.tt-tab-panel').removeClass('active');
        $('#' + target).addClass('active');
        if (target === 'ttDirect') GetDetails();
    });

    // Message send
    $("#btnMessage").click(function () { PushMessageNotification(); });
    $("#TxtMessage").on('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); PushMessageNotification(); }
    });

    // Broadcast / group buttons
    $("#btnBroadcast").click(function ()    { BroadcastMessage(); });
    $("#btnGroupMessage").click(function () { FnGroupMessage(); });

    // Start Firebase driver→dispatcher listener as soon as companyId is known
    var _listenerPoll = setInterval(function () {
        var cid = localStorage.getItem('TT_CId') || '';
        if (cid) { clearInterval(_listenerPoll); initDriverMessageListener(cid); }
    }, 500);

    // Poll for new unread messages every 500 ms
    setInterval(function () {
        if ($("#lblRequest").text() === "True") {
            GetDetails();
            var uid = $("#UserId").text();
            if (uid && uid !== '0') DriverNewMessages(uid);
            $("#lblRequest").text("False");
        }
    }, 500);

    // Refresh driver list every 30 s so Firebase drivers appear even if chat
    // panel was opened before Firebase finished loading.
    setInterval(function () { GetDetails(); }, 30000);
});

// ── Live driver helper ────────────────────────────────────────────────────────
function _getLiveDrivers() {
    try {
        var sc = angular.element(document.getElementById('myangular')).scope();
        if (sc && sc.driverdatarealx && sc.driverdatarealx.length > 0) {
            return sc.driverdatarealx.map(function (d) {
                // Prefer numeric SQL driverid; fall back to VehicleId string key
                var numId = parseInt(d.driverid || d.DriverId || '0') || 0;
                var id = (numId > 0) ? numId : (d.VehicleId || d.vehicleid || d.vehiclenumber || 0);
                // Show real driver name; fall back to vehicle number then VehicleId
                var name = (d.drivername || d.DriverName || '').trim();
                if (!name) name = (d.vehiclenumber || d.VehicleId || 'Driver').toString();
                return {
                    Id:        id || 0,
                    UserFName: name.split(' ')[0] || 'Driver',
                    UserLName: name.split(' ').slice(1).join(' '),
                    Count:     0,
                    _live:     true
                };
            });
        }
    } catch (e) {}
    return [];
}

// ── Driver list (sidebar) ─────────────────────────────────────────────────────
function GetDetails() {
    var liveDrivers = _getLiveDrivers();

    Selector1([], '[RetrieveMessages]').then(function (result) {
        var $res = JSON.parse(result.d);
        var combined = Array.isArray($res) ? $res.slice() : [];

        // Merge Firebase live drivers not already in SQL list
        var sqlIds = {};
        combined.forEach(function (d) { sqlIds[String(d.Id)] = true; });
        liveDrivers.forEach(function (d) {
            if (!sqlIds[String(d.Id)]) combined.push(d);
        });

        var $list = $(".friend-list").empty();

        if (combined.length === 0) {
            $list.append(
                '<li><div class="tt-empty-sidebar">' +
                    '<i class="fa fa-car"></i>' +
                    'No drivers online' +
                '</div></li>'
            );
            // Firebase may still be loading — retry once after 3 s
            clearTimeout(window._chatRetryTimer);
            window._chatRetryTimer = setTimeout(GetDetails, 3000);
            return;
        }
        clearTimeout(window._chatRetryTimer);

        combined.forEach(function (d) {
            var fullName  = ((d.UserFName || '') + ' ' + (d.UserLName || '')).trim();
            var initials  = _initials(fullName);
            var color     = _avatarColor(fullName);
            var badge     = d.Count > 0
                ? '<span class="tt-unread-badge">' + d.Count + '</span>'
                : '';
            var selectedId = $("#UserId").text();
            var selClass   = (selectedId && String(d.Id) === String(selectedId)) ? ' tt-sel' : '';

            $list.append(
                '<li class="' + selClass + '" id="drv-li-' + d.Id + '">' +
                    '<a onclick="GetConversation(\'' + d.Id + '\',\'' + fullName + '\',\'' + color + '\')" class="clearfix">' +
                        '<div class="tt-avatar" style="background:' + color + '">' +
                            initials +
                            '<span class="tt-avatar-dot"></span>' +
                        '</div>' +
                        '<div class="tt-driver-info">' +
                            '<div class="tt-driver-name">' + fullName + '</div>' +
                            '<div class="tt-driver-sub">Online</div>' +
                        '</div>' +
                        badge +
                    '</a>' +
                '</li>'
            );
        });
    });
}

// ── Conversation view ─────────────────────────────────────────────────────────
function GetConversation(id, name, color) {
    $("#UserId").text(id);
    // Highlight selected driver
    $(".friend-list li").removeClass('tt-sel');
    $("#drv-li-" + id).addClass('tt-sel');

    // Update chat header
    var n   = name  || 'Driver ' + id;
    var col = color || _avatarColor(n);
    $("#ttChatHeader").html(
        '<div class="tt-chat-header-avatar" style="background:' + col + '">' + _initials(n) + '</div>' +
        '<div class="tt-chat-header-name">' + n + '</div>'
    );

    // Load conversation
    Selector([{ "name": "Id", "Value": id }], '[DispatcherConversation]').then(function (result) {
        var $res = JSON.parse(result.d);
        if ($res["dt1"] && $res["dt1"].length > 0) {
            $("#PlayerId").text($res["dt1"][0].PlayerId || '');
        }
        var $ul = $(".chat").empty();
        var msgs = $res["dt2"] || [];
        if (msgs.length === 0) {
            $ul.append(_emptyState());
        } else {
            msgs.forEach(function (m) {
                var isOut = (m.SenderID !== id && m.SenderID !== String(id));
                $ul.append(_buildBubble(m.Id, isOut, isOut ? 'You' : n, col, isOut, m.Message, m.Date + ' ' + m.Time, true));
            });
        }
        var dv = $('#DivChat');
        dv.scrollTop(dv.prop("scrollHeight"));
    });
    GetDetails();
}

function _emptyState() {
    return '<li><div class="tt-empty-chat">' +
        '<i class="fa fa-comment-o"></i>' +
        '<span>No messages yet.<br>Send one below!</span>' +
    '</div></li>';
}

// ── Build a message bubble ────────────────────────────────────────────────────
// isOut = sent by dispatcher (right side, dark bg)
function _buildBubble(msgId, isOut, senderLabel, color, showDelete, text, timeStr, withSender) {
    var dir     = isOut ? 'tt-out' : 'tt-in';
    var initAvt = isOut ? 'D' : _initials(senderLabel);
    var avtCol  = isOut ? '#1a2535' : color;
    var delBtn  = (showDelete && msgId)
        ? '<button class="tt-del-btn" onclick="DeleteMessage(' + msgId + ')" title="Delete"><i class="fa fa-trash-o"></i></button>'
        : '';
    var senderHtml = withSender
        ? '<div class="tt-msg-sender">' + senderLabel + '</div>'
        : '';

    return '<li class="tt-msg ' + dir + '">' +
        '<div class="tt-msg-avt" style="background:' + avtCol + '">' + initAvt + '</div>' +
        '<div class="tt-msg-body">' +
            senderHtml +
            '<div class="tt-bubble">' +
                '<p>' + text + '</p>' +
                '<div class="tt-bubble-meta">' +
                    '<span>' + (timeStr || '') + '</span>' +
                    delBtn +
                '</div>' +
            '</div>' +
        '</div>' +
    '</li>';
}

// ── Unread poll ───────────────────────────────────────────────────────────────
function DriverNewMessages(UserId) {
    Selector1([{ "name": "Id", "Value": UserId }], '[DispatcherUnReadMessages]').then(function (result) {
        var $res = JSON.parse(result.d);
        if ($res.length > 0) {
            var $ul = $(".chat");
            // Remove empty state if present
            $ul.find('.tt-empty-chat').closest('li').remove();
            var driverId = $("#UserId").text();
            $res.forEach(function (m) {
                var isOut = (m.SenderID != UserId);
                var now   = new Date();
                var h = (now.getHours() < 10 ? '0' : '') + now.getHours();
                var mn = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
                $ul.append(_buildBubble(m.Id, isOut, m.User, _avatarColor(m.User), false, m.Message, m.Date + ' ' + m.Time, false));
            });
            var dv = $('#DivChat');
            dv.scrollTop(dv.prop("scrollHeight"));
            GetDetails();
        }
    });
}

function DeleteMessage(id) {
    Action([{ "name": "Id", "Value": id }], "[DeleteMessage]", id);
    $("#msg-" + id).remove();
    GetDetails();
}

// ── Send: Dispatcher → Driver (1:1) ──────────────────────────────────────────
function PushMessageNotification() {
    var msg = $("#TxtMessage").val().trim();
    if (!msg) return;

    var driverId = ($("#UserId").text() || '').trim();
    if (!driverId || driverId === '0' || driverId === '00') {
        toastr["warning"]("Select a driver first.", "No Driver Selected");
        return;
    }

    var d = new Date();
    var date    = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h       = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m       = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var strTime = h + ':' + m;

    // Clear input immediately before any async callbacks
    $("#TxtMessage").val("");

    // Append sent message to chat right away
    var $ul = $(".chat");
    $ul.find('.tt-empty-chat').closest('li').remove();
    $ul.append(_buildBubble(null, true, 'You', '#1a2535', false, msg, date + ' ' + strTime, false));
    var dv = $('#DivChat');
    dv.scrollTop(dv.prop("scrollHeight"));

    // Firebase notification to driver app
    FnNewMessage(driverId, msg, date + ' ' + strTime);

    // Persist (response "Message Saved" — won't retrigger AjaxHandler's ReloadConversation)
    Action([
        { "name": "RecieverId", "Value": driverId },
        { "name": "Message",    "Value": msg },
        { "name": "DateTime",   "Value": date + ' ' + strTime }
    ], "[MessageInsert]");

    GetDetails();
}

// ── Send: Broadcast → all live drivers ───────────────────────────────────────
function BroadcastMessage() {
    var msg = $("#TxtBroadcast").val().trim();
    if (!msg) { toastr["warning"]("Please enter a broadcast message.", "Broadcast"); return; }

    var d    = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h    = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m    = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var dt   = date + " " + h + ':' + m;

    Action([{ "name": "Message", "Value": msg }, { "name": "DateTime", "Value": dt }], "[BroadcastMessage]");

    // Firebase instant notification to all live Firebase drivers
    // Writes to both /chat/ (in-app display) and /notification/ (push alert so driver
    // sees it regardless of which screen they are on — same path used for job offers)
    var live = _getLiveDrivers();
    if (live.length > 0) {
        try {
            var updates = {};
            live.forEach(function (drv) {
                if (drv.Id) {
                    var chatPayload = { bookingid: '0,Broadcast,0,0,Dispatcher', content: msg };
                    updates['/chat/' + drv.Id]         = chatPayload;
                    updates['/notification/' + drv.Id] = { bookingid: chatPayload.bookingid, content: msg };
                }
            });
            firebase.database().ref().update(updates);
        } catch (e) {}
    }

    toastr["success"]("Broadcast sent to all online drivers.", "Broadcast");
    $("#TxtBroadcast").val("");
    GetDetails();
}

// ── Send: Group message (by zone / vehicle type) ──────────────────────────────
function FnGroupMessage() {
    var msg   = $("#TxtGroupMsg").val().trim();
    var zone  = $("#ddlGroupZone").val()  || '';
    var vtype = $("#ddlGroupVType").val() || '';
    if (!msg) { toastr["warning"]("Please enter a group message.", "Group Message"); return; }

    var d    = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h    = (d.getHours()   < 10 ? '0' : '') + d.getHours();
    var m    = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var dt   = date + " " + h + ':' + m;

    Action([
        { "name": "Message",     "Value": msg },
        { "name": "Zone",        "Value": zone },
        { "name": "VehicleType", "Value": vtype },
        { "name": "DateTime",    "Value": dt }
    ], "[GroupMessage]");

    // Firebase notification to matching live drivers
    // Writes to both /chat/ (in-app display) and /notification/ (push alert so driver
    // sees it regardless of which screen they are on — same path used for job offers)
    var targets = _getLiveDrivers().filter(function (drv) {
        var zm = !zone  || (drv.zonename  || '').toLowerCase().includes(zone.toLowerCase());
        var vm = !vtype || (drv.vehicletype || '').toLowerCase().includes(vtype.toLowerCase());
        return zm && vm;
    });
    if (targets.length > 0) {
        try {
            var updates = {};
            targets.forEach(function (drv) {
                if (drv.Id) {
                    var chatPayload = { bookingid: '0,GroupMessage,0,0,Dispatcher', content: msg };
                    updates['/chat/' + drv.Id]         = chatPayload;
                    updates['/notification/' + drv.Id] = { bookingid: chatPayload.bookingid, content: msg };
                }
            });
            firebase.database().ref().update(updates);
        } catch (e) {}
    }

    toastr["success"]("Group message sent to " + targets.length + " live driver(s).", "Group Message");
    $("#TxtGroupMsg").val("");
    GetDetails();
}

// ── Firebase: Driver → Dispatcher listener ────────────────────────────────────
// Driver app writes: firebase.database().ref('/driverMsg/1216').push({
//   driverId, driverName, vehicleNumber, message, timestamp: Date.now()
// })
// Keys we just wrote ourselves so we can skip them in the /chat listener
window._ownChatWrites = {};

function initDriverMessageListener(companyId) {
    if (!companyId || window._driverMsgListenerActive) return;
    window._driverMsgListenerActive = true;

    // ── Path 1: /driverMsg/{companyId} ──────────────────────────────────────
    // Some driver apps push replies here explicitly.
    try {
        console.log('[ChatRoom] attaching driverMsg listener on /driverMsg/' + companyId);
        firebase.database().ref('/driverMsg/' + companyId).on('child_added', function (snapshot) {
            var msg = snapshot.val();
            var key = snapshot.key;
            console.log('[ChatRoom] /driverMsg child_added key=' + key + ' val=' + JSON.stringify(msg));
            if (!msg) return;
            var driverId   = String(msg.driverId   || msg.DriverId   || msg.driver_id   || msg.PlayerId || '');
            var driverName = msg.driverName || msg.DriverName || msg.driver_name || msg.Name || ('Driver ' + driverId);
            var text       = msg.message || msg.Message || msg.body || msg.Body || msg.text || msg.Text || msg.content || msg.Content || '';
            if (!text) { console.warn('[ChatRoom] /driverMsg: no text field found in', msg); return; }
            _showDriverMessage(driverId, driverName, text);
            firebase.database().ref('/driverMsg/' + companyId + '/' + key).remove();
        });
    } catch (e) {
        console.error('[ChatRoom] driverMsg listener error:', e);
    }

    // ── Path 2: /chat/{driverId} changes ───────────────────────────────────
    // Some driver apps write their reply back to the same /chat node the
    // dispatcher used.  We ignore entries we wrote ourselves (they end with
    // ",Dispatcher") and process anything else as an incoming driver message.
    try {
        console.log('[ChatRoom] attaching /chat change listener');
        var chatRef = firebase.database().ref('/chat');
        var _chatFirstLoad = true;
        chatRef.on('child_added', function(snapshot) {
            if (_chatFirstLoad) return;
            _handleChatNode(snapshot);
        });
        setTimeout(function() { _chatFirstLoad = false; }, 3000);
        chatRef.on('child_changed', function(snapshot) {
            _handleChatNode(snapshot);
        });
    } catch (e) {
        console.error('[ChatRoom] /chat listener error:', e);
    }

    // ── Path 3: /notification/{companyId} ──────────────────────────────────
    // Some driver apps reply by writing to /notification/{companyId} (the
    // symmetrical path of the dispatcher's /notification/{driverId} sends).
    try {
        console.log('[ChatRoom] attaching /notification/' + companyId + ' listener');
        var _notifFirstLoad = true;
        firebase.database().ref('/notification/' + companyId).on('child_added', function(snapshot) {
            if (_notifFirstLoad) return;
            var msg = snapshot.val();
            var key = snapshot.key;
            console.log('[ChatRoom] /notification/' + companyId + ' child_added key=' + key + ' val=' + JSON.stringify(msg));
            if (!msg) return;
            var bookingid = msg.bookingid || '';
            // Extract the same comma-delimited format drivers use
            var parts = bookingid ? bookingid.split(',') : [];
            var driverId   = String(msg.driverId || msg.DriverId || msg.driver_id || (parts[3]) || key || '');
            var driverName = msg.driverName || msg.DriverName || (parts[0]) || ('Driver ' + driverId);
            var text       = msg.message || msg.Message || msg.body || msg.text || msg.content ||
                             (parts.length >= 2 ? parts.slice(1, Math.max(2, parts.length - 2)).join(',') : '') || '';
            if (!text) { console.warn('[ChatRoom] /notification/' + companyId + ': no text in', msg); return; }
            _showDriverMessage(driverId, driverName, text);
            firebase.database().ref('/notification/' + companyId + '/' + key).remove();
        });
        setTimeout(function() { _notifFirstLoad = false; }, 3000);
    } catch (e) {
        console.error('[ChatRoom] /notification listener error:', e);
    }
}

function _handleChatNode(snapshot) {
    var driverId = snapshot.key;
    var msg      = snapshot.val();
    if (!msg) return;

    // If we flagged this key as our own write, skip it
    if (window._ownChatWrites[driverId]) {
        delete window._ownChatWrites[driverId];
        return;
    }

    var bookingid = msg.bookingid || '';
    var content   = msg.content   || '';
    console.log('[ChatRoom] /chat changed driverId=' + driverId + ' bookingid=' + bookingid);

    // Ignore messages we sent (they end with ",Dispatcher")
    if (bookingid.slice(-11) === ',Dispatcher') return;
    // Also ignore plain "You have New Message" content we write
    if (content === 'You have New Message' || content === 'You have a new message from Dispatcher') return;

    // Try to extract text from bookingid format: "name,message,datetime,companyId,Driver"
    var driverName = 'Driver ' + driverId;
    var text       = '';
    if (bookingid) {
        var parts = bookingid.split(',');
        if (parts.length >= 2) {
            driverName = parts[0] || driverName;
            // message is everything between parts[0] and the last two parts (companyId,source)
            text = parts.slice(1, Math.max(2, parts.length - 2)).join(',');
        }
    }
    // Fallback: use any obvious text field on the object
    if (!text) text = msg.message || msg.Message || msg.body || msg.Body || msg.text || msg.Text || content || '';
    if (!text) { console.warn('[ChatRoom] /chat: could not extract text from', msg); return; }

    _showDriverMessage(driverId, driverName, text);
}

function _showDriverMessage(driverId, driverName, text) {
    var now  = new Date();
    var h    = (now.getHours()   < 10 ? '0' : '') + now.getHours();
    var mn   = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var date = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    var ts   = date + ' ' + h + ':' + mn;

    // Toast notification
    if (typeof toastr !== 'undefined') {
        toastr['info']('<b>' + driverName + '</b><br>' + text, 'Message from Driver',
            { timeOut: 8000, extendedTimeOut: 3000 });
    }

    // Show live in open conversation
    var openId = $("#UserId").text();
    if (driverId && openId && String(driverId) === String(openId)) {
        var $ul = $(".chat");
        $ul.find('.tt-empty-chat').closest('li').remove();
        $ul.append(_buildBubble(null, false, driverName, _avatarColor(driverName), false, text, ts, false));
        $('#DivChat').scrollTop($('#DivChat').prop("scrollHeight"));
    }

    // Persist to backend
    Action([
        { "name": "SenderId",  "Value": driverId },
        { "name": "Message",   "Value": text },
        { "name": "DateTime",  "Value": ts }
    ], "[DriverMessageInsert]");

    GetDetails();
}

// ── Misc stubs ────────────────────────────────────────────────────────────────
function ReloadConversation() {}
function Result(txt)          {}
function successFn()          {}
function errorFunction()      {}
function FnRowDelete(ele)     {}

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
    if (result.d === "Error") {
        toastr["error"]("Logout failed. Please try again.", 'Error');
    } else {
        try { firebase.auth().signOut(); } catch (e) {}
        ['TT_Name','TT_DId','TT_Country','TT_CId','Country'].forEach(function (k) { localStorage.removeItem(k); });
        window.location.href = result.d;
    }
}

function errorfn() {
    toastr["error"]("Server or network error.", 'Connection Error');
}
