function KickFn(element,col)
{
    var column = col - 1;
    $(".uni-delete-form").empty();
    $(".uni-delete-form").append('<div class="delete-dialog">' +
            '<div class="row">' +
                '<div class="col-sm-12 has-feedback" style="padding:2px">' +
                    '<input type="text" name="Id" id="KickedDateTime" hidden="hidden"/>' +
                    '<h5 style="display:inline">Do You wanna Kick this User?</h5>' +
                       '<div class="col-md-12 col-lg-12 col-sm-12 col-xs-12" style="display:none">'+
                            '<h5>Reason:</h5>' +
                            '<textarea class="form-control" id="TxtKickReason" value="Kicked"></textarea>'+
                        '</div>'+
                        '<div class="col-md-12 col-lg-12 col-sm-12 col-xs-12" style="display:none">' +
                            '<h5>To Date:</h5>' +
                            '<input type="date" class="form-control" id="TxtKickdate" />' +
                        '</div>'+
                        '<div class="form-group col-md-12 col-lg-12 col-sm-12 col-xs-12" style="display:none">' +
                            '<h5>To TIme:</h5>' +
                           '<input type="text" class="form-control" id="TxtKickTime" value="12:00:00"/>' +
                        '</div>'+
                        '<div class="form-group col-md-6 col-lg-6 col-sm-12 col-xs-12">' +
                        '<div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">' +
                    '<button type="button" class="btn btn-main pull-right close-del-dialog">No</button>' +
                    '</div>' +
                    '<div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">' +
                    '<input type="submit" class="btn btn-main pull-right" id="Submit3" onclick="FnFreeVehicle(this)" value="Yes"/>' +
                         '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
    '</div>');
    if ($(window).width() <= 350) {
        $(".delete-dialog").css({
            top: $(element).closest("tr").offset().top - 300,
            left: $(element).closest("tr").offset().left - 150
        });
    

    } else {
        $ww = $(window).width();
        $eleOff = $(element).closest("tr").find(".clsdelete").offset().left;
       
        $dia_box = $(".delete-dialog").width();
        $total = $eleOff + $dia_box;
      
        $left = $total > $ww ? ($total - $ww)  : 0;
        console.log(($eleOff - $left));
        $(".delete-dialog").css({
            top: $(element).closest("tr").offset().top -300,
            left: ($eleOff - ( $left + 100 ))
        });
    }
    var d = new Date();
    var month = d.getMonth() + 1;
    var date = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') +
        month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;
    var h1 = d.getHours();
    var m1 = d.getMinutes();

    $("input[type=date]").val(output);
    $("#KickedDateTime").text(output + " " + d.toLocaleTimeString());
    $(".delete-dialog").removeClass("animated fadeOutOutDown").addClass("animated bounceIn").show();
}


$(function () {
    $(document).on("click", ".close-del-dialog", function () {
        $(".delete-dialog").removeClass("animated bounceIn").fadeOut();
    });
});
function SuspendFn(element, col) {
    var column = col - 1;
    $(".uni-suspend-form").empty();
    $(".uni-suspend-form").append('<div class="suspend-dialog">' +

            '<div class="row">' +
                '<div class="col-sm-12 has-feedback" style="padding:2px">' +
                    '<input type="text" name="Id" id="SuspendedDateTime" hidden="hidden">' +
                    '<h5 style="display:inline">Do You wanna Suspend this User?</h5>' +
                       '<div class="col-md-12 col-lg-12 col-sm-12 col-xs-12">' +
                            '<h5>Reason:</h5>' +
                            '<textarea class="form-control" id="TxtSuspendReason"></textarea>' +
                        '</div>' +
                       
                        '<div class="form-group col-md-6 col-lg-6 col-sm-12 col-xs-12">' +
                        '<div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">' +
                    '<button type="button" class="btn btn-main pull-right close-suspend-dialog">No</button>' +
                    '</div>' +
                    '<div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">' +
                    '<input type="submit" class="btn btn-main pull-right" id="Submit4" onclick="DispatcherKicksUser(this)" value="Yes"/>' +
                         '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
    '</div>');
    if ($(window).width() <= 350) {
        $(".suspend-dialog").css({
            top: $(element).closest("tr").offset().top - 200,
            left: $(element).closest("tr").offset().left - 120
        });


    } else {
        $ww = $(window).width();
        $eleOff = $(element).closest("tr").find(".clsSuspend").offset().left;

        $dia_box = $(".suspend-dialog").width();
        $total = $eleOff + $dia_box;

        $left = $total > $ww ? ($total - $ww) : 0;
        console.log(($eleOff - $left));
        $(".suspend-dialog").css({
            top: $(element).closest("tr").offset().top - 200,
            left: ($eleOff - ($left + 100))
        });
    }
    var d = new Date();
    var month = d.getMonth() + 1;
    var date = d.getDate();
    var output = d.getFullYear() + '-' +
        (('' + month).length < 2 ? '0' : '') +
        month + '-' +
        (('' + date).length < 2 ? '0' : '') + date;
    var h1 = d.getHours();
    var m1 = d.getMinutes();

    $("input[type=date]").val(output);
    $("#SuspendedDateTime").text(output + " " + d.toLocaleTimeString());
    $(".suspend-dialog").removeClass("animated fadeOutOutDown").addClass("animated bounceIn").show();
}
$(function () {
    $(document).on("click", ".close-suspend-dialog", function () {
        $(".suspend-dialog").removeClass("animated bounceIn").fadeOut();
    });
});

function FnMessageViewBox(SenderName,Message,MsgDatetime,DriverId) {
    //var column = col - 1;
    $(".uni-Message-form").empty();
    $(".uni-Message-form").append('<div class="MsgNotification-dialog col-lg-6 col-md-6">' +
            '<div class="row" style="background:#66ff99">' +
                '<div class="col-sm-12 has-feedback" style="padding:1px">' +
                   
                   '<div class="col-md-6 col-lg-6 col-sm-12 col-xs-12" >' +
                          '<h5 style="color:#fff">Sender:</h5>' +
                             '<h5 style="display:inline">' + SenderName + '</h5>' +
                           
                        '</div>' +
                        '<div class="col-md-6 col-lg-6 col-sm-12 col-xs-12" >' +
                         '<h5 style="color:#fff">DateTime:</h5>' +
                             '<h5 style="display:inline">' + MsgDatetime + '</h5>' +

                        '</div>' +
                       '<div class="form-group col-md-12 col-lg-12 col-sm-12 col-xs-12" >' +
                        '<h5 style="color:#fff">Message:</h5>' +
                             '<h5 style="display:inline">' + Message.split(0,20) + '</h5>' +
                        '</div>' +
                       
                          '<div class="col-md-12 col-lg-12 col-sm-6 col-xs-6">' +
                    '<input type="text" id="TxtBoxMessage" class="form-control" placeholder="Type Reply Here" />' +
                     '<h5 ><label id="MsgDriverId">' + DriverId + '</label></h5>' +
                    '</div>' +
                     '<div class="col-md-3 col-lg-3 col-sm-6 col-xs-6">' +
                    '<button type="button" class="btn btn-main pull-right close-Not-dialog">Close</button>' +
                    '</div>' +
                    '<div class="col-md-3 col-lg-3 col-sm-6 col-xs-6">' +
                    '<input type="submit" class="btn btn-main pull-right" id="Submit3" onclick="FnShowConversation(this)" value="Reply"/>' +
                         '</div>' +   
                '</div>' +
            '</div>' +
    '</div>');
    if ($(window).width() <= 350) {
        $(".MsgNotification-dialog").css({
            top: $("#clssNotification").offset().top - 300,
            left: $("#clssNotification").offset().left - 150
        });


    } else {
        $ww = $(window).width();
        $eleOff = $("#clssNotification").offset().left;

        $dia_box = $(".MsgNotification-dialog").width();
        $total = $eleOff + $dia_box;

        $left = $total > $ww ? ($total - $ww) : 0;
        console.log(($eleOff - $left));
        $(".MsgNotification-dialog").css({
            top: $("#clssNotification").offset().top - 300,
            left: ($eleOff - ($left + 100))
        });
    }
  
    $(".MsgNotification-dialog").removeClass("animated fadeOutOutDown").addClass("animated bounceIn").show();
}


$(function () {
    $(document).on("click", ".close-Not-dialog", function () {
        $(".MsgNotification-dialog").removeClass("animated bounceIn").fadeOut();
    });
});