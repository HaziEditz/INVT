$(function () {
    GetDetails();
    $("#form1").submit(function () {

        return false;

    });
    $("#btnMessage").click(function () {
        PushMessageNotification();

    });
    setInterval(function () {
        if ($("#lblRequest").text() == "True")
        {
            GetDetails();
            if ($("#UserId").text() != "0") {
                DriverNewMessages($("#UserId").text());
            }
           $("#lblRequest").text("False");
        }
        
    }, 500);

});

function GetDetails()
{
    var param = [];
    var proc = '[RetrieveMessages]';
    Selector1(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
       
        if ($res.length != []) {
            $(".friend-list").empty();
            for ($i = 0; $i < $res.length; $i++) {

                $(".friend-list").append('<li class="active bounceInDown">' +
                            '<a  onclick="GetConversation(' + $res[$i].Id + ')" class="clearfix">' +
                               
                                '<div class="friend-name">' +
                                    '<strong>' + $res[$i].UserFName + ' ' + $res[$i].UserLName + '</strong>' +
                                '</div>' +
                                //'<div class="last-message text-muted">Hello, Are you there?</div>' +
                                '<small class="chat-alert label label-success">' + $res[$i].Count + '</small>' +
                            '</a>' +
                        '</li>');
            }
        }
        else {
            $(".friend-list").append('<div class="friend-name"><strong>Contact List is empty</strong>' + '</div>');
        }
    });
    //var Pageurl = window.location.href;
    //var str = Pageurl.lastIndexOf("?");
    //var UserId = Pageurl.substring(str + 1);
    //if (UserId != null)
    //{
    //    GetConversation(UserId);
    //}

}
function ReloadConversation()
{
    var d = new Date();

    var month = d.getMonth() + 1;
    var date = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') +
        month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;

    var hours = d.getHours();
    var minutes = d.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;
    
                        $(".chat").append('<li class="left clearfix">' +
                               '<span class="chat-img pull-left">' +
                                   '<img src="images/stph.png" alt="User Avatar">' +
                               '</span>' +
                               '<div class="chat-body clearfix">' +
                                   '<div class="header">' +
                                       '<strong class="primary-font">' + $("#lblName1").text() + '</strong>' +
                                       '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i>' + output + '  ' + strTime+ ' " <a onclick="DeleteMessage()">Delete</a>"</small>' +
                                   '</div>' +
                                   '<p>' + $("#TxtMessage").val() + '</p>' +
                               '</div>' +
                           '</li>');
                        $("#TxtMessage").val("");
    //var param = [{ "name": "Id", "Value": $("#UserId").text() }];
    //var proc = '[ReloadConversation]';
    //Selector(param, proc).then(function (result) {
    //    $res = JSON.parse(result.d);
        
    //    if ($res.length != []) {
    //        $(".chat").empty();
    //        for ($i = 0; $i < $res.length; $i++) {
    //            if ($res["dt2"][$i].SenderID == ele) {
    //                $(".chat").append('<li id=' + [$i] + ' class="right clearfix">' +
    //                           '<span class="chat-img pull-right">' +
    //                               '<img src="images/stph.png" alt="User Avatar">' +
    //                           '</span>' +
    //                           '<div class="chat-body clearfix">' +
    //                               '<div class="header">' +
    //                                   '<strong class="primary-font">' + $res[$i].User + '</strong>' +
    //                                   '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + $res[$i].DateTime + '  " <a onclick="DeleteMessage(' + $res[$i].Id + ')">Delete</a>"</small>' +
    //                               '</div>' +
    //                              '<p>' + $res[$i].Message + '</p>' +
    //                           '</div>' +
    //                       '</li>');

    //            }
    //            else {
    //                $(".chat").append('<li id=' + [$i] + ' class="left clearfix">' +
    //                             '<span class="chat-img pull-left">' +
    //                                 '<img src="images/stph.png" alt="User Avatar">' +
    //                             '</span>' +
    //                             '<div class="chat-body clearfix">' +
    //                                 '<div class="header">' +
    //                                     '<strong class="primary-font">' + $res[$i].User + '</strong>' +
    //                                     '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i>' + $res[$i].DateTime + ' " <a onclick="DeleteMessage(' + $res[$i].Id + ')">Delete</a>"</small>' +
    //                                 '</div>' +
    //                                 '<p>' + $res[$i].Message + '</p>' +
    //                             '</div>' +
    //                         '</li>');
    //            }
    //        }

    //    }
    //});
    
}
function DriverNewMessages(UserId)
{
    var param = [{ "name": "Id", "Value": UserId }];
    var proc = '[DispatcherUnReadMessages]';
    Selector1(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
        console.log(result.d);
        if ($res.length != []) {
            
            for ($i = 0; $i < $res.length; $i++) {
                if ($res[$i].SenderID == UserId) {
                    $(".chat").append('<li id=' + [$i] + ' class="right clearfix">' +
                               '<span class="chat-img pull-right">' +
                                   '<img src="images/stph.png" alt="User Avatar">' +
                               '</span>' +
                               '<div class="chat-body clearfix">' +
                                   '<div class="header">' +
                                       '<strong class="primary-font">' + $res[$i].User + '</strong>' +
                                       '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + $res[$i].Date + '  ' + $res[$i].Time + '  " <a onclick="DeleteMessage(' + $res[$i].Id + ')">Delete</a>"</small>' +
                                   '</div>' +
                                  '<p>' + $res[$i].Message + '</p>' +
                               '</div>' +
                           '</li>');

                }
                else {
                    $(".chat").append('<li id=' + [$i] + ' class="left clearfix">' +
                                 '<span class="chat-img pull-left">' +
                                     '<img src="images/stph.png" alt="User Avatar">' +
                                 '</span>' +
                                 '<div class="chat-body clearfix">' +
                                     '<div class="header">' +
                                         '<strong class="primary-font">' + $res[$i].User + '</strong>' +
                                         '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i>' + $res[$i].Date + '  ' + $res[$i].Time + ' " <a onclick="DeleteMessage(' + $res[$i].Id + ')">Delete</a>"</small>' +
                                     '</div>' +
                                     '<p>' + $res[$i].Message + '</p>' +
                                 '</div>' +
                             '</li>');
                }
                var d = $('#DivChat');
                d.scrollTop(d.prop("scrollHeight"));
            }

        }
    });

}
function GetConversation(ele)
{
    $("#UserId").text(ele);
    
    var param = [{ "name": "Id", "Value": ele }];
    var proc = '[DispatcherConversation]';
    Selector(param, proc).then(function (result) {
        $res = JSON.parse(result.d);
       
        $("#PlayerId").text($res["dt1"][0].PlayerId);
        if ($res["dt2"].length != [])
        {
            $(".chat").empty();
            $(".chat").append('See More');
            
            for ($i = $res["dt2"].length-1; $i > -1; $i--) {
                if ($res["dt2"][$i].SenderID == ele) {
                    $(".chat").append('<li id=' + ["dt2"][$i] + ' class="right clearfix">' +
                               '<span class="chat-img pull-right">' +
                                   '<img src="images/stph.png" alt="User Avatar">' +
                               '</span>' +
                               '<div class="chat-body clearfix">' +
                                   '<div class="header">' +
                                       '<strong class="primary-font">' + $res["dt2"][$i].User + '</strong>' +
                                       '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i> ' + $res["dt2"][$i].Date + '  ' + $res["dt2"][$i].Time + '  " <a onclick="DeleteMessage(' + $res["dt2"][$i].Id + ')">Delete</a>"</small>' +
                                   '</div>' +
                                  '<p>' + $res["dt2"][$i].Message + '</p>' +
                               '</div>' +
                           '</li>');
                    
                }
                else {
                    $(".chat").append('<li id=' + ["dt2"][$i] + ' class="left clearfix">' +
                                 '<span class="chat-img pull-left">' +
                                     '<img src="images/stph.png" alt="User Avatar">' +
                                 '</span>' +
                                 '<div class="chat-body clearfix">' +
                                     '<div class="header">' +
                                         '<strong class="primary-font">' + $res["dt2"][$i].User + '</strong>' +
                                         '<small class="pull-right text-muted"><i class="fa fa-clock-o"></i>' + $res["dt2"][$i].Date + '  ' + $res["dt2"][$i].Time + ' " <a onclick="DeleteMessage(' + $res["dt2"][$i].Id + ')">Delete</a>"</small>' +
                                     '</div>' +
                                     '<p>' + $res["dt2"][$i].Message + '</p>' +
                                 '</div>' +
                             '</li>');
                }
            }

           
            var d = $('#DivChat');
            d.scrollTop(d.prop("scrollHeight"));
        }
    });
    GetDetails();
}
function DeleteMessage(ele)
{
    Action([
              { "name": "Id", "Value": ele }], "[DeleteMessage]",ele);
    $("#" + ele + "").remove();
    GetDetails();
    GetConversation($("#UserId").text());
}
function FnRowDelete(ele)
{
   
}
function Result(txt) {
    if (txt == "Message sent successfully") {

        ReloadConversation();
        
        //$.ajax({
        //    url: "Default.aspx/SendMessageNotification",
        //    type: "POST",
        //    datatype: "json",
        //    data: JSON.stringify({
        //        "Message": "You have New Message",
        //        "PlayerId": $("#PlayerId").text(),
        //        "UserName": "360Taxi"

        //    }),
        //    contentType: "application/json; charset=utf-8",
        //    success: successFn,
        //    error: errorFunction,
        //});
    }
}
function PushMessageNotification() {
   
        var d = new Date();

        var month = d.getMonth() + 1;
        var date = d.getDate();
        var output = d.getFullYear() + '-' +
            (('' + month).length < 2 ? '0' : '') +
            month + '-' +
            (('' + date).length < 2 ? '0' : '') + date;

        h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
        m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        var MessageDateTime = output + " " + h + ':' + m;
        FnNewMessage($("#UserId").text(), $("#TxtMessage").val(), MessageDateTime);
        Action([
          { "name": "RecieverId", "Value": $("#UserId").text() },
          { "name": "Message", "Value": $("#TxtMessage").val() },
         { "name": "DateTime", "Value": MessageDateTime }], "[MessageInsert]");
        
    }
    function successFn()
    {

    }
    function errorFunction()
    {

    }
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
            toastr["error"]("Logout Failed", 'Error!');
        }
        else {
            firebase.auth().signOut();
            window.location.href = result.d;
        }
    }
    function errorfn() {
        alert("Sorry Server is down or internet is not working");
    }
