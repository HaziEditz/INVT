var  ret;
function Selector(param, proc) {
    var url = "DataManager/Data.aspx/DataSelector";
   
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;
        },
        async:true,
        error: errorFn
    });
    
}

function ErrMessage(data) {
    console.log(data);
}
function Selector1(param, proc) {
    var url = "DataManager/Data.aspx/DataSelectorLess";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;

            
        },
        async: true,
        error: errorFn
    });

}
function FnLogin(param, proc) {
    var url = "DataManager/Data.aspx/LoginSelector";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;


        },
        async: true,
        error: errorFn
    });

}
function FnGeneral(param, proc) {
    var url = "DataManager/Data.aspx/GeneralSelector";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;

        },
        async: true,
        error: errorFn
    });

}
function Action(param,proc) {
    var url = "DataManager/Data.aspx/DataProcessor";
   return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            console.log(data.d);

            if (data.d == "Message sent successfully") {

                ReloadConversation();


            } else if (data.d = 'Vehicle Successfully Moved') {
                //toastr["succes"]('Vehicle Que Number Change Successfully', ' warning! ');
            }else {
                SuccMessage(data.d);
            }
           
           
        },
        error: errorFn
       
   });
}

        
function ActionCheck(param, proc) {
    var url = "DataManager/Data.aspx/DataProcessor";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
           
            Result(data.d);

        },
        error: errorFn

    });
}

function ActionDelete(param, proc,ele)
{
    var url = "DataManager/Data.aspx/DataProcessor";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            SuccMessage(data.d);
            if (data.d == "Operation Successfully Performed") {
                FnRowDelete(ele);

            }
        },
        error: errorFn

    });
}

function getmanager(param, proc) {

    var url = "DataManager/Data.aspx/DataSelectorLess";

    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;
 
        },
        async: true,
        error: errorFn
    });
}

function Addmanager(param, proc) {
 
    var url = "DataManager/Data.aspx/DataProcessor";

    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;
        
        },
        async: true,
        error: errorFn
    });
}

function ActionBooking(param, proc)
{
    var url = "DataManager/Data.aspx/DataSelectorRide";
    
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            ret = data;
        },
        async: true,
        error: errorFn
    });
}
function ActionNewRecord(param, proc, Status) {
    var url = "DataManager/Data.aspx/DataProcessor";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            console.log(data);
           
            if (data.d == "Booking Information Successfully Submitted" && Status == "Job1") {
            

                Swal.fire(
                 'succes!',
                  "Booking Information Successfully Submitted",
                  'succes'
             );
                //if (NewStopsLatLngArray.length != 0) {
                //    FnNewStopInsert();
                //    ClearControls();
                //}
            }
            else if (data.d == "Booking Information Successfully Submitted" && Status == "Job2") {
               
                //if (NewStopsLatLngArrayJob2.length != 0) {
                //    FnNewStopInsert2();
                //    ClearControls();
                //}
                Swal.fire(
                                'succes!',
                                 "Booking Information Successfully Submitted",
                                 'succes'
                            );
            }
            else if (data.d == "Booking Details Update Successfully" && Status == "Job1") {
                

                //if (NewStopsLatLngArray.length != 0) {
                //    FnNewStopInsert();
                //    ClearControls();
                //}
                Swal.fire(
                'succes!',
                 "Booking Information Successfully Submitted",
                 'succes'
            );
            }
            else {
                ErrMessage(data.d);
            }
        },
        error: errorFn

    });
}

function Action1(param,col,arry,proc,FnName) {
    var url = "DataManager/Data.aspx/DataProcessor1";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "colms": col,
            "Details":arry,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
     
            if (data.d == "Booking Information Successfully Submitted" && FnName == "Job1") {
                SuccMessage(data.d);

                if (NewStopsLatLngArray.length != 0) {
                    FnNewStopInsert();
                    //ClearControls();
                }
            }
            else if (data.d == "Booking Information Successfully Submitted" && FnName == "Job2") {
                SuccMessage(data.d);
                if (NewStopsLatLngArrayJob2.length != 0) {
                    FnNewStopInsert2();
                    ClearControls();
                }
            }
            else if (data.d == "Notification Flag Updated" && FnName == "Job3") {
                UpdateNotificationValue();
            }
            
           
            //else {
            //    ErrMessage(data.d);
            //}
           

        },
        error: errorFn
    });
}
function ActionUpdateZones(param, col, arry, proc) {
   
    var url = "DataManager/Data.aspx/DataProcessor1";
    return $.ajax({
        url: url,
        type: "POST",
        datatype: "json",
        data: JSON.stringify({
            "data": param,
            "colms": col,
            "Details": arry,
            "action": proc
        }),
        contentType: "application/json; charset=utf-8",
        success: function (data) {
            if (data.d == "Zone Updated")
            {
                FnZonesList();
            }
 
        },
        error: errorFn
    });
}
function errorFn(err, status, xhr) {
    //ErrMessage(status.toUpperCase() + "! " + xhr);
    ErrMessage("Error, Server is down OR internet connection problem");
}

//function Once(fn, context) {
//    var result;
//    return function () {
//        if (fn) {
//            result = fn.apply(context || this, arguments);
//            fn = null;
//        }
//        return result;
//    };
//}

//var toast = Once(function (cl1, cl2, text) {
//    $toast = "<div class='container " + cl1 + "'>" +
//         "<button type='button' class='close cl-toast' style='margin-top:5px'>&times;</button>" +
//        "<h4 class='" + cl2 + "'>" + text + "</h4>" +
//    "</div>";

//    return $toast;
//});
