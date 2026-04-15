$(function () {
    GetDetails();
    $("#form1").submit(function () {
        return false;
    });
    $("#btnMessage").click(function () {
        PushMessageNotification();
    });
    $("#btnBroadcast").click(function () {
        BroadcastMessage();
    });
    $("#btnGroupMessage").click(function () {
        FnGroupMessage();
    });
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

function GetDetails() {
    var param = [];
    var proc = '[RetrieveMessages]';
    Selector1(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
        if ($res.length > 0) {
            $(".friend-list").empty();
            for ($i = 0; $i < $res.length; $i++) {
                var unreadBadge = $res[$i].Count > 0
                    ? '<small class="chat-alert label label-danger">' + $res[$i].Count + '</small>'
                    : '';
                $(".friend-list").append(
                    '<li class="active bounceInDown">' +
                        '<a onclick="GetConversation(' + $res[$i].Id + ')" class="clearfix">' +
                            '<div class="friend-name">' +
                                '<strong>' + $res[$i].UserFName + ' ' + $res[$i].UserLName + '</strong>' +
                            '</div>' +
                            unreadBadge +
                        '</a>' +
                    '</li>'
                );
            }
        } else {
            $(".friend-list").empty();
            $(".friend-list").append('<li><div class="friend-name"><strong>No drivers online</strong></div></li>');
        }
    });
}

function ReloadConversation() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var date = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') + month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;

    $(".chat").append(
        '<li class="left clearfix">' +
            '<span class="chat-img pull-left">' +
                '<img src="images/stph.png" alt="User Avatar">' +
            '</span>' +
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
    var proc = '[DispatcherUnReadMessages]';
    Selector1(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
        if ($res.length > 0) {
            for ($i = 0; $i < $res.length; $i++) {
                var isDriver = ($res[$i].SenderID == UserId);
                var side = isDriver ? 'right' : 'left';
                $(".chat").append(
                    '<li class="' + side + ' clearfix">' +
                        '<span class="chat-img pull-' + (isDriver ? 'right' : 'left') + '">' +
                            '<img src="images/stph.png" alt="User Avatar">' +
                        '</span>' +
                        '<div class="chat-body clearfix">' +
                            '<div class="header">' +
                                '<strong class="primary-font">' + $res[$i].User + '</strong>' +
                                '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + $res[$i].Date + ' ' + $res[$i].Time + '</small>' +
                            '</div>' +
                            '<p>' + $res[$i].Message + '</p>' +
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
    var proc = '[DispatcherConversation]';
    Selector(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
        if ($res["dt1"] && $res["dt1"].length > 0) {
            $("#PlayerId").text($res["dt1"][0].PlayerId || '');
        }
        $(".chat").empty();
        if ($res["dt2"] && $res["dt2"].length > 0) {
            for ($i = 0; $i < $res["dt2"].length; $i++) {
                var isDriver = ($res["dt2"][$i].SenderID == ele);
                var side = isDriver ? 'right' : 'left';
                $(".chat").append(
                    '<li id="msg-' + $res["dt2"][$i].Id + '" class="' + side + ' clearfix">' +
                        '<span class="chat-img pull-' + (isDriver ? 'right' : 'left') + '">' +
                            '<img src="images/stph.png" alt="User Avatar">' +
                        '</span>' +
                        '<div class="chat-body clearfix">' +
                            '<div class="header">' +
                                '<strong class="primary-font">' + $res["dt2"][$i].User + '</strong>' +
                                '<small class="pull-right text-muted">' +
                                    '<i class="fa fa-clock-o"></i> ' + $res["dt2"][$i].Date + ' ' + $res["dt2"][$i].Time +
                                    ' <a onclick="DeleteMessage(' + $res["dt2"][$i].Id + ')" title="Delete"><i class="fa fa-trash-o"></i></a>' +
                                '</small>' +
                            '</div>' +
                            '<p>' + $res["dt2"][$i].Message + '</p>' +
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

function FnRowDelete(ele) {}

function Result(txt) {
    if (txt == "Message sent successfully") {
        ReloadConversation();
        GetDetails();
    }
}

function PushMessageNotification() {
    var msg = $("#TxtMessage").val().trim();
    if (!msg) return;
    var d = new Date();
    var month = d.getMonth() + 1;
    var date = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') + month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;
    var h = (d.getHours() < 10 ? '0' : '') + d.getHours();
    var m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var MessageDateTime = output + " " + h + ':' + m;

    FnNewMessage($("#UserId").text(), msg, MessageDateTime);

    Action([
        { "name": "RecieverId", "Value": $("#UserId").text() },
        { "name": "Message",    "Value": msg },
        { "name": "DateTime",   "Value": MessageDateTime }
    ], "[MessageInsert]");

    ReloadConversation();
    GetDetails();
}

function BroadcastMessage() {
    var msg = $("#TxtBroadcast").val().trim();
    if (!msg) {
        toastr["warning"]("Please enter a message to broadcast.", "Broadcast");
        return;
    }
    var d = new Date();
    var h = (d.getHours() < 10 ? '0' : '') + d.getHours();
    var m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var MessageDateTime = date + " " + h + ':' + m;

    Action([
        { "name": "Message",  "Value": msg },
        { "name": "DateTime", "Value": MessageDateTime }
    ], "[BroadcastMessage]");

    toastr["success"]("Broadcast sent to all drivers.", "Broadcast");
    $("#TxtBroadcast").val("");
    GetDetails();
}

function FnGroupMessage() {
    var msg   = $("#TxtGroupMsg").val().trim();
    var zone  = $("#ddlGroupZone").val()  || '';
    var vtype = $("#ddlGroupVType").val() || '';
    if (!msg) {
        toastr["warning"]("Please enter a group message.", "Group Message");
        return;
    }
    var d = new Date();
    var date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var h = (d.getHours() < 10 ? '0' : '') + d.getHours();
    var m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var MessageDateTime = date + " " + h + ':' + m;

    Action([
        { "name": "Message",     "Value": msg },
        { "name": "Zone",        "Value": zone },
        { "name": "VehicleType", "Value": vtype },
        { "name": "DateTime",    "Value": MessageDateTime }
    ], "[GroupMessage]");

    toastr["success"]("Group message sent.", "Group Message");
    $("#TxtGroupMsg").val("");
    GetDetails();
}

function successFn() {}
function errorFunction() {}

function Logout() {
    $.ajax({
        url: "DispatcherLogin.aspx/Logout",
        type: "POST",
        datatype: "json",
        contentType: "application/json;charset=utf-8",
        success: FnSuccessLogout,
        error: errorfn
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
