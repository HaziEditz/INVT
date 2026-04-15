

<!doctype html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
     <script src="https://code.jquery.com/jquery-1.11.0.min.js"></script>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <script src="DataManager/AjaxHandler.js"></script>
     <link href="toast/toastr.min.css" rel="stylesheet" />
 <script src="toast/toastr.min.js"></script>
       <script src="js/jspdf.debug.js"></script>
    <script src="js/jspdf.min.js"></script> 
    <script src="js/jquery-ui.js" type="text/javascript"></script>
     <link href="https://cdn.datatables.net/1.10.21/css/jquery.dataTables.min.css" />
    <link href="DataManager/Validate.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@9"></script>
   <script src="DataManager/Validate.js"></script> 
 <script src="https://code.jquery.com/jquery-3.5.1.js"></script>
  
    <meta name="msapplication-TileColor" content="#0f75ff">
    <meta name="theme-color" content="#9d37f6">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="HandheldFriendly" content="True">
    <meta name="MobileOptimized" content="320">
    <link rel="icon" href="favicon.ico" type="image/x-icon" />
    <link rel="shortcut icon" type="image/x-icon" href="favicon.ico" />
    <!-- Accordion Css -->
    
     <script src="JsScripts/ChatRoom.js"></script>
        <script src="JsScripts/StripeTokenCreation.js"></script>
    <script type="text/javascript" src="https://js.stripe.com/v2/"></script>
    
      <script src="DeletePopup/Delete.js"></script>
    <link href="DeletePopup/style2.css" rel="stylesheet" />
    <!-- Title -->
    <title>360 Taxi Dispatch</title>
    <link rel="stylesheet" href="assets/fonts/fonts/font-awesome.min.css">
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script>
    <!-- Sidemenu Css -->
    <link href="assets/plugins/toggle-sidebar/sidemenu.css" rel="stylesheet" />

    <link href="assets/plugins/tabs/style.css" rel="stylesheet" />
    <!-- Bootstrap Css -->
    <link href="assets/plugins/bootstrap-4.1.3/css/bootstrap.min.css" rel="stylesheet" />

    <!-- Dashboard Css -->
    <link href="assets/css/dashboard.css" rel="stylesheet" />
    <link href="assets/css/admin-custom.css" rel="stylesheet" />

    <!-- Custom scroll bar css-->
    <link href="assets/plugins/scroll-bar/jquery.mCustomScrollbar.css" rel="stylesheet" />
         <link href="css/ChatCss.css" rel="stylesheet" 

    <!---Font icons-->
    <link href="assets/plugins/iconfonts/plugin.css" rel="stylesheet" />
    <link href="assets/plugins/iconfonts/icons.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/7.33.1/sweetalert2.all.js"></script>
</head>
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/4.12.1/firebase.js"></script>
    <script src="https://my-firebase-project.web.app/geofire-5.0.1.min.js"></script>
<style type="text/css">
    a#tbleClosedJobs_previous {
        color: red;
        padding: 10px !important;
    }

    a#tbleClosedJobs_next {
        color: red;
        padding: 10px !important;
    }
    .mLabel {
        color: #fff;
        font-weight: bold;
        text-align: center;
        width: auto;
        white-space: nowrap;
        text-align: center !important;
        padding: 2px 6px;
        border-radius: 3px !important;
    }
    .labels1 {
        background-color: #b3ffb3;
    }

    button.label.label-danger {
        color: black;
    }

    table th {
        font-weight: bold;
        color: red;
    }

    div#singlediv {
        /* border: 1px solid grey; */
        box-shadow: 1px 1px 1px 1px #3693c575;
        margin-bottom: 7px;
    }

    a#example_previous {
        padding: 5px !important;
        color: red;
        margin: 4px !important;
    }

    ul.nav.nav-tabs li {
        padding: 5px;
        background: #81d58d;
        margin: 1px;
        border-radius: 4px;
    }

        ul.nav.nav-tabs li a {
            color: black;
            font-weight: 500;
        }


    .label {
        background: #2d54e038 !important;
        font-weight: bold;
    }

    span.label {
        font-weight: bold !important;
        color: black !important;
    }

    @keyframes glowing {
        /*0% { box-shadow: 0 0 -10px green; }
              40% { box-shadow: 0 0 20px blue; }
              60% { box-shadow: 0 0 20px red; }
              100% { box-shadow: 0 0 -10px green; }*/
        10% {
            box-shadow: 0 0 20px red;
        }

        100% {
            box-shadow: 0 0 10px blue;
        }
    }

    .page-main {
        -ms-flex: 1 1 auto;
        flex: 1 1 auto;
        background: #b0e6e6a1;
    }

    td {
        border: 2px solid #0000ff3d !important;
    }

    th {
        border: 2px solid #0000ff3d !important;
    }

    .card-body {
        background: #efecec73;
    }

    .button-glow {
        margin: 0px;
        animation: glowing 2000ms infinite;
    }

    .button-glow2 {
        animation: glowing2 2000ms infinite;
    }

    input.form-control {
        height: 29px;
    }

    .label-primary {
        background-color: #14d05287;
        color: black;
        font-weight: 600;
    }

    table#example th {
        font-weight: bold;
        color: red;
    }

    .form-control {
        display: block;
        width: 100%;
        margin-top: 1px;
        padding: 0.375rem 0.75rem;
        font-size: 0.9375rem;
        line-height: 1.6;
        color: #605e7e;
        height: 39px;
        background-color: #a0a59f4f;
        background-clip: padding-box;
        border: 1px solid #b2b6c1;
        border-radius: 3px;
        transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .nopad {
        padding: 0px;
        margin: 0px;
    }

    body {
        color: black;
    }

    select.custom-select.custom-select-sm.form-control.form-control-sm {
        display: none;
    }

    div#example_filter input {
        /*margin-left: 109%;*/
    }

    div#example_length {
        display: none;
    }

    div#example_filter label {
        display: none;
    }

    .modal-backdrop.fade.show {
        display: none;
    }

    ul.nav.panel-tabs li {
        width: 25%;
        font-weight: bold;
    }

    /*button.btn.btn-danger {
        padding: 7px 11px;
        height: 36px;
        margin-top: 5px;
        margin-left: 6px;
    }*/

    a.active.show {
        color: white !important;
        background: #2727d696;
    }

    .topnav {
        background: #ffa500b0;
        overflow: hidden;
    }

    label.label.label-success {
        font-weight: 600;
        color: black;
    }

    .topnav a {
        font-weight: 500;
    }

    .topnav a {
        float: left;
        color: black;
        text-align: center;
        padding: 14px 16px;
        text-decoration: none;
        font-size: 12px;
    }

        .topnav a:hover {
            background-color: #ddd;
            color: black;
        }

    .chat-message {
        padding: 0px !important;
    }
</style>

    
   
     <div class="modal fade" id="Filter-jobs">
        <div class="modal-dialog dialog-Filter-jobs">
            <div class="modal-content" style="width:1100px; margin-left:-300px;">
                <div class="modal-header">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Search Jobs</h5>
                </div>
                <div class="modal-body" style="padding-bottom: 0;">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12" style="padding: 0px 33px; height: 450px;
    overflow: scroll;">
                               <label>Filter</label>
                             <p><input type="text" ng-model="test" placeholder="Search Here.."></p>
                    <div id="Divox{{value.Id}}"  ng-if="value.BookingStatus!='Offered'"  ng-style="{ background: getTheValue(value.BookingDateTime)  }" style="margin-bottom: 13px;" class="nopad bottomspave col-sm-12 col-md-12 col-xl-12  {{ alerting(value.DispatchTimebefore, value.BookingDateTime) }}" id="singlediv" ng-repeat="(key ,  value) in  unassignedjob_list  | filter : test" >
                                                         
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" ">
                                                            <div class="nopad row col-sm-12  col-md-12 col-xl-12" style="margin: -8px 1px;">

                                                                <span   class="label label-pill label-primary mt-2"><i style="color: black;" class="glyphicon glyphicon-tag"></i>

                                                                    {{value.Id}}
                                                                </span>

                                                                 <span class="label label-pill label-primary mt-2"> {{  datecreate(value.Pickingtime) }} 
                                                                </span>
                                                               
                                                                <div ng-if="value.Passengers > 4" style="padding: 6px;">
                                                                    <span class="label label-pill label-danger mt-2">V.Job</span>
                                                                </div>
                                                                <div ng-if="value.Passengers < 4" style="padding: 6px;">
                                                                    <span ng-if="value.VehicleType == 'Not Specified'" class="label label-pill label-primary mt-2">Any Vehicle
                                                                    </span>
                                                                    <span ng-if="value.VehicleType != 'Not Specified'" class="label label-pill label-primary mt-2">{{value.VehicleType}}
                                                                    </span>

                                                                </div>
                                                                <span  ng-if="value.WheelChairs > 0" class="label label-pill label-danger mt-2">Wheel Chair</span>

                                                                <div  ng-if="value.EntitiesDetails" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 100px; white-space: nowrap; overflow: hidden;">
                                                                    <span><i style="color: black;" title="{{value.EntitiesDetails}}" class="glyphicon glyphicon-info-sign"></i>
                                                                        {{value.EntitiesDetails}}
                                                                    </span>
                                                                </div>


                                                                <span ng-if="value.PhoneNo" class="label label-pill label-primary mt-2"><i class="fa fa-phone"></i>
                                                                    {{value.PhoneNo}}
                                                                </span>
                                                                <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="position: absolute; left:-25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(value.Id,value.PickLatLng)" ng-mouseleave="markerremove1(value.Id,value.PickLatLng )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng !=  '0,0' && value.Nextstop != 0" ng-mouseover="showmakert3(value.Id,value.PickAddress,value.DropAddress,value.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                
                                                                  <span class="label label-pill label-danger mt-2"  ng-if="value.usertype == 1" ><i class="fa fa-user">Senior</i></span> 
                                                                  <span class="label label-pill label-danger mt-2" ng-if="value.usertype == 2" > <i  class="fa fa-user">Disable</i></span> 
                                                                  
                                                                <div ng-if="value.useremail != null">
                                                                    {{playAudio()}}{{checkconter(value.Id , value.Id ,value.useremail )}}
                                                                  <span  ng-show="value.webstatus == 0  "  class="btn btn-success" style="padding: 0px 4px;  font-size: 13px;" ng-click="sendemail(  1  ,  value.useremail  ,  value.Id  ,value.JobMins ,   value.Id )" title="Accept"><i class="fa fa-thumbs-up"></i> </span>
                                                                    <span ng-show="value.webstatus == 0 " id="close'+$res["dt1"][$i].Id+'" style="padding: 0px 4px;" class="btn btn-warning" ng-click="sendemail(   0  , value.useremail   , value.Id  ,value.JobMins )" title="Reject" > <i class="fa fa-thumbs-down"></i>  </span> 
                                                                    <img ng-if="value.useremail != ''" style="width:20px;  float: right; padding: 2px; " src="img/alert.gif" style="width:25px;"  /> 
                                                                    <span ng-show="value.webstatus != 0  "  class="label label-pill label-primary mt-2" >Accepted</span>
 
                                                                </div>
                                                                <div style="position: absolute; right:  0px;">
                                                                       <select id="sp{{value.Id}}" class="form-control  " onclick="showwxx()" style="width: 100px; height:30px; font-size:14px;">
                                                                    <option value="0"  data-zoneq="0"   >Select Driver</option>
                                                                    <option value="0"  data-zoneq="0"  >No One</option>
                                                                    <option ng-repeat ="driwq in driverdatarealx  " ng-show="{{checkofferjob(driwq.driverid)}}" ng-if="driwq.vehiclestatus == 'Available' && true == checkjobvehile(value.VehicleType, driwq.vehicletype)"  data-zoneq="{{driwq.zonequeue}}"  data-foo="{{driwq.VehicleId}}" ng-value="{{driwq.driverid}}">{{driwq.vehiclenumber }}  {{driwq.vehicletype}} </option>

                                                                    
                                                                </select>

                                                             
                                                                
                                                                </div><span class=" label label-pill label-success mt-2" style="position: absolute; top:0px; right: -25px; display: {{asssigned(value.DispatchTimebefore, value.BookingDateTime)}}" ng-click="AssignPendingJobFromJobList(value.Id,value.VehicleId,value.DriverId,value.U_id,value.BookingStatus,'sp')">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>

                                                                
                                                             </div>
                                                        </div>
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;">
                                                           
                                                            <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                 <div data-toggle="collapse" style="position:absolute; left : -25px;" class="label label-pill label-primary mt-2" data-target="#datass{{key}}">
                                                                    <i class=" fa fa-eye" aria-hidden="true" style="color:red; font-size:16px;"></i>
                                                                </div>
                                                                <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: green;"></i>
                                                                        {{value.PickAddress}}
								 								
                                                                    </span>
                                                                </div>
                                                                <div  ng-if="value.DropAddress" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: red;"></i>
                                                                        {{value.DropAddress}}
								 								
                                                                    </span>
                                                                </div>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="fa fa-users "></i>{{value.passengername}}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2" id="Divoo{{value.Id}}" style="background:red!important; color:white!important;">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag" style="color:white!important;"></i>
                                                                    {{value.BookingStatus}} {{value.CallSign}} {{value.VehicleNo}}
								 							 
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                    <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-if="value.Nextstop > 0">M-Stops </span>
                                                            </div>
                                                        </div>
                                                        <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="datass{{key}}">
                                                            <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                    <li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                            {{value.Passengers}}                                  
                                                                        </span>
                                                                    </li>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                        {{value.Bags}}</span>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                        {{value.WheelChairs}}
                                                                    </span>
                            
                                                                </ul>
                                                            </div>
                                                            <div class="row nopad col-sm-9  col-md-9 col-xl-9">
 

                                                                <span class="label label-pill label-primary mt-2" style="background: {{latealert(value.DispatchTimebefore, value.BookingDateTime )}}"><i style="color: black;" class="fa fa-hourglass-half"></i>

                                                                    {{ checklateornow(value.JobMins , value.DispatchTimebefore) }}
                                                                </span>
                                                                 <span class="label label-pill label-warning mt-2" ng-click="EditJobunassignedng(value.Id,value.JobMins)">
                                                                    <i class="  glyphicon glyphicon-edit "></i>
                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)">
                                                                    <i class="  glyphicon glyphicon-trash "></i>
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  fa fa-headphones "></i>{{value.DispatcherName}}
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  glyphicon glyphicon-tag "></i>{{value.BookingSource}}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                    <div class="nopad   col-sm-12 col-md-12 col-xl-12" style="background: rgba(95, 158, 160, 0.19); box-shadow: 1px 1px 1px 1px #00800070; border-radius: 6px;"
                                                        ng-repeat="(key  , avalue ) in  assignedjob_list | filter : test">
                                                        <div onclick="showwxx()" class=" row nopad    col-sm-12 col-md-12 col-xl-12" data-toggle="collapse" data-target="#datassass{{key}}">
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-tag"></i>
                                                                {{avalue.Id}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.BookingDateTime}}  </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-users "></i>
                                                                {{avalue.passengername}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-phone"></i>
                                                              <span id="phne{{avalue.drivername}}">  {{avalue.PhoneNo}} </span>


                                                            </span>
                                                          
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.drivername}} {{avalue.VehicleNo}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.TarriffType}}
                                                            </span>
                                                             <i ng-if="avalue.DropLatLng != '0,0'" ng-mouseover="showmakert(avalue.Id,avalue.PickLatLng,avalue.DropLatLng)" ng-mouseleave="markerremove(avalue.Id,avalue.PickLatLng,avalue.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="avalue.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(avalue.Id,avalue.PickLatLng)" ng-mouseleave="markerremove1(avalue.Id,avalue.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="avalue.DropLatLng !=  '0,0' && avalue.Nextstop != 0" ng-mouseover="showmakert3(avalue.Id,avalue.PickAddress,avalue.DropAddress,avalue.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>

                                                        </div>
                                                        <div class="nopad   col-sm-12 col-md-12 col-xl-12">
                                                            <div  onclick="showwxx()"   class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                                data-toggle="collapse" data-target="#datassass{{key}}">
                                                                <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: green;"></i>
                                                                            <span id="p{{avalue.drivername}}">{{avalue.PickAddress}}</span> 
								 								
                                                                        </span>
                                                                    </div>
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: red;"></i>
                                                                           
								 								            <span id="d{{avalue.drivername}}">{{avalue.DropAddress}}</span> 
                                                                        </span>
                                                                    </div>


                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        {{avalue.BookingStatus}} {{avalue.CallSign}} {{avalue.VehicleNo}}
								 							 
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                    </span>
                                                                    <span class="label label-pill label-danger mt-2">{{avalue.BookingSource}} </span>

                                                                </div>
                                                            </div>

                                                        </div>
                                                        <div class="nopad bottomspave col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="datassass{{key}}">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                    <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                        <li>
                                                                            <span style="padding: 0px 2px;">
                                                                                <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                                {{avalue.Passengers}}                                  
                                                                            </span>
                                                                        </li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                            {{avalue.Bags}}</span>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                            {{avalue.WheelChairs}}
                                                                        </span> </span> 
                                                                    </ul>
                                                                </div>
                                                                <div class="row nopad col-sm-9  col-md-9 col-xl-9">
                                                                   

                                                                    <select id="sxgg{{avalue.Id}}" class="form-control  JobsListVehicles" style="width: 160px;">
                                                                        <option value="0"  data-zoneq="0"  >Select Driver</option>
                                                                         <option value="0"  data-zoneq="0"  >No One</option>
                                                                     <option ng-repeat ="dri in driverdatarealx " ng-show="{{checkofferjob(drivi.driverid)}}" ng-if="dri.vehiclestatus == 'Available' && true == checkjobvehile(avalue.VehicleType, dri.vehicletype)"  data-zoneq="{{dri.zonequeue}}"    data-foo="{{dri.VehicleId}}" ng-value="{{dri.driverid}}">{{dri.vehiclenumber }}  {{dri.vehicletype}} </option>

                                                                     </select>

                                                                 
                                                                    <span class=" label label-pill label-success mt-2" ng-click="AssignJobFromJobList(avalue.Id,avalue.VehicleId,avalue.DriverId,avalue.U_id , avalue.quenumber,'sxgg')">
                                                                        <i style="color: black" class="fa fa-paper-plane"></i>
                                                                    </span>

                                                                    <span class="label label-pill label-warning mt-2" ng-click="EditJob(avalue.Id , avalue.quenumber)">
                                                                        <i class="  glyphicon glyphicon-edit "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-danger mt-2" ng-click="CancelJob(avalue.Id,avalue.U_id , avalue.ZoneId , avalue.quenumber)">
                                                                        <i class="  glyphicon glyphicon-trash "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  fa fa-headphones "></i>{{avalue.DispatcherName}}
                                                                    </span>

                                                                   
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                       <div style="background: #ce184a3d; box-shadow: 1px 1px 1px 1px #00800070; border-radius: 6px;"
                                                        class="nopad   col-sm-12 col-md-12 col-xl-12" ng-repeat="(key , acvalue) in ActiveJob | filter : test">
                                                        <div onclick="showwxx()" class=" row nopad    col-sm-12 col-md-12 col-xl-12" data-toggle="collapse" data-target="#dataactive{{key}}">
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-tag"></i>
                                                                {{acvalue.Id}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.BookingDateTime}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-users "></i>
                                                                {{acvalue.passengername}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-phone"></i>
                                                               


                                                                 <span id="phne{{acvalue.drivername}}">  {{acvalue.PhoneNo}}</span>
                                                            </span>

                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.drivername}} {{acvalue.VehicleNo}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.TarriffType}}
                                                            </span>
                                                            <i ng-if="acvalue.DropLatLng != '0,0'" ng-mouseover="showmakert(acvalue.Id,acvalue.PickLatLng,acvalue.DropLatLng)" ng-mouseleave="markerremove(acvalue.Id,acvalue.PickLatLng,acvalue.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="acvalue.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(acvalue.Id,acvalue.PickLatLng)" ng-mouseleave="markerremove1(acvalue.Id,acvalue.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="acvalue.DropLatLng !=  '0,0' && acvalue.Nextstop != 0" ng-mouseover="showmakert3(acvalue.Id,acvalue.PickAddress,acvalue.DropAddress,acvalue.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>

                                                        </div>
                                                        <div  onclick="showwxx()"  class="nopad   col-sm-12 col-md-12 col-xl-12">
                                                            <div  class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                                data-toggle="collapse" data-target="#dataactive{{key}}">
                                                                <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: green;"></i>
                                                                           <span id="p{{acvalue.drivername}}">{{acvalue.PickAddress}}</span> 
								 								
                                                                        </span>
                                                                    </div>
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: red;"></i>
                                                                           
								 								          <span id="d{{acvalue.drivername}}">{{acvalue.DropAddress}}</span> 
                                                                        </span>
                                                                    </div>

                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="fa fa-users "></i>{{acvalue.passengername}}
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        {{acvalue.BookingStatus}} {{acvalue.CallSign}} {{acvalue.VehicleNo}}
								 							 
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                       <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                    </span>

                                                                </div>
                                                            </div>

                                                        </div>
                                                        <div class="nopad bottomspave col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="dataactive{{key}}">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                    <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                        <li>
                                                                          <span style="padding: 0px 2px;">
                                                                                <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                                {{acvalue.Passengers}}                                  
                                                                         </span>
                                                                        </li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                            {{acvalue.Bags}}</span>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                            {{acvalue.WheelChairs}}
                                                                        </span>
                                                                                  
				</span>--%>
                                                                    </ul>
                                                                </div>
                                                                <div class="row nopad col-sm-9  col-md-9 col-xl-9">

                                                                    <span class="label label-pill label-danger mt-2"
                                                                        ng-click="cancelactivejob(acvalue.Id )">
                                                                        <i class="  glyphicon glyphicon-trash "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  fa fa-headphones "></i>{{acvalue.DispatcherName}}
                                                                    </span>

                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  glyphicon glyphicon-tag"></i>{{acvalue.BookingSource}}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                    <div id="Divo{{value.Id}}" ng-style="{ background: asssignedcolor(value.BookingStatus)  }" style="margin-bottom: 13px;" class="nopad bottomspave col-sm-12 col-md-12 col-xl-12  {{ alerting(value.DispatchTimebefore, value.BookingDateTime) }}" id="singlediv" ng-repeat="(key ,  value) in  deliveryjobs | filter : test">
                                                           
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" data-toggle="collapse" data-target="#datass{{key}}">
                                                            <div class="nopad row col-sm-12  col-md-12 col-xl-12" style="margin: -8px 1px;">

                                                                <span   class="label label-pill label-primary mt-2"><i style="color: black;" class="glyphicon glyphicon-tag"></i>

                                                                    {{value.Id}}  
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2" style="background: {{latealert(value.DispatchTimebefore, value.BookingDateTime )}}"><i style="color: black;" class="fa fa-hourglass-half"></i>

                                                                    {{ checklateornow(value.JobMins , value.DispatchTimebefore) }}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2"> {{  datecreate(value.Pickingtime) }} 
                                                                </span>
                                                                <div ng-if="value.Passengers > 4" style="padding: 6px;">
                                                                    <span class="label label-pill label-danger mt-2">V.Job</span>
                                                                </div>
                                                                <div ng-if="value.Passengers < 4" style="padding: 6px;">
                                                                    <span ng-if="value.VehicleType == 'Not Specified'" class="label label-pill label-primary mt-2">Any Vehicle
                                                                    </span>
                                                                    <span ng-if="value.VehicleType != 'Not Specified'" class="label label-pill label-primary mt-2">{{value.VehicleType}}
                                                                    </span>

                                                                </div>
                                                                <span  ng-if="value.WheelChairs > 0" class="label label-pill label-danger mt-2">Wheel Chair</span>

                                                                <div  ng-if="value.EntitiesDetails" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 100px; white-space: nowrap; overflow: hidden;">
                                                                    <span><i style="color: black;" title="Dispatched Time" class="glyphicon glyphicon-info-sign"></i>
                                                                        {{value.EntitiesDetails}}
                                                                    </span>
                                                                </div>


                                                                <span ng-if="value.PhoneNo" class="label label-pill label-primary mt-2"><i class="fa fa-phone"></i>
                                                                 

                                                               <span id="phne{{value.drivername}}">  {{value.PhoneNo}}</span>

                                                                </span>
                                                                <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(value.Id,value.PickLatLng)" ng-mouseleave="markerremove1(value.Id,value.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng !=  '0,0' && value.Nextstop != 0" ng-mouseover="showmakert3(value.Id,value.PickAddress,value.DropAddress,value.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                            </div>
                                                        </div>
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                            data-toggle="collapse" data-target="#datass{{key}}">
                                                            <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: green;"></i>
                                                                      
								 								    <span id="p{{value.drivername}}">  {{value.PickAddress}}</span>
                                                                    </span>
                                                                </div>
                                                                <div  ng-if="value.DropAddress" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: red;"></i>
                                                                       
								 								 <span id="d{{value.drivername}}">   {{value.DropAddress}}</span>
                                                                    </span>
                                                                </div>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="fa fa-users "></i>{{value.passengername}}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2" id="Divoo{{value.Id}}">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                    {{value.BookingStatus}} {{value.CallSign}} {{value.VehicleNo}}
								 							 
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                   
                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-if="value.Nextstop > 0">M-Stops </span>
                                                            </div>
                                                        </div>
                                                        <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="datass{{key}}">
                                                            <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                    <li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                            {{value.Passengers}}                                  
                                                                        </span>
                                                                    </li>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                        {{value.Bags}}</span>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                        {{value.WheelChairs}}
                                                                    </span>
                            
                                                                </ul>
                                                            </div>
                                                            <div class="row nopad col-sm-9  col-md-9 col-xl-9">
                                                              

                                                                <select id="sa{{value.Id}}" class="form-control UnAssignJobsList2" style="width: 160px;">
                                                                    <option value="0"  >Select Driver</option>
                                                                    <option value="0"  >No One</option>
                                                                    <option ng-repeat="drivi in driverlistx" value="{{drivi.Id}}">  {{drivi.VehicleNo}} {{"/" +  drivi.VehicleName}}  </option>
                                                                </select>

                                                             
                                                                <span class=" label label-pill label-success mt-2" style="display: {{asssigned11( value.BookingStatus)}}" ng-click="AssignPendingJobFromJobList2(value.Id,value.VehicleId,value.DriverId,value.U_id ,'sa' )">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>
                                                                <span class=" label label-pill label-success mt-2" style="display: {{asssigned1( value.BookingStatus)}}" ng-click="AssignJobFromJobList2(value.Id,value.VehicleId,value.DriverId,value.U_id ,'sa')">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>
                                                                
                                                                <span class="label label-pill label-danger mt-2" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)">
                                                                    <i class="  glyphicon glyphicon-trash "></i>
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  fa fa-headphones "></i>{{value.DispatcherName}}
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  glyphicon glyphicon-tag "></i>{{value.BookingSource}}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                 
                        </div>
                         
                    </div>
                </div>
            </div>
        </div>
    </div>
      <div class="modal fade" id="search-jobs" style="    overflow: scroll;">
        <div class="modal-dialog dialog-search-jobs">
            <div class="modal-content" style="width:1100px; margin-left:-300px;">
                <div class="modal-header">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Search Jobs</h5>
                </div>
                <div class="modal-body" style="padding-bottom: 0;">

                    <div class="row" style="    padding: 15px;
    box-shadow: 1px 1px 1px 1px #80808054;
    margin: 5px;">
                        <div class="col-6">
                                                            <div class="row">
                                    <ul class="list-inline list-status">
                                        <li>
                                            <p>Status</p>
                                        </li>
                                        <li>
                                            <div class="form-group">

                                                <select class="selectBox6 form-control" id="ddlSearchBy">
                                                    <option value="All">Select Search Type</option>
                                                    <option value="Number">Booking Id</option>
                                                    <option value="Name">Name</option>
                                                    <option value="PhoneNo">Phone</option>
                                                    <option value="Between">Between Date</option>
                                                    <option value="Before">Before Date</option>
                                                    <option value="After">After Date</option>
                                                </select>
                                            </div>
                                        </li>

                                        <li>
                                            <p>Job Type</p>
                                        </li>
                                        <li>
                                            <div class="form-group">

                                                <select class="selectBox6 form-control" id="ddlStatus">
                                                    <option class="default-text6" value="All">All</option>
                                                    <option   value="Closed">Closed</option>
                                                    <option value="Open">Open</option>
                                                </select>
                                            </div>

                                        </li>
                                    </ul>
                                </div>


                                <div class="row" id="SearchFields">
                                    <div class="col-lg-8 col-md-8">
                                        <div class="form-group" id="SearchField">
                                            <input type="hidden" class="form-control" id="TxtSearch" value="All" placeholder="Search By Booking Id">
                                        </div>

                                    </div>

                                </div>

                                <div class="row">
                                    <div class="col-lg-12">
                                        <button type="button" id="btnSearchJob" class="btn btn-success" style="padding-right: 25px; padding-left: 25px;">Search</button>
                                    </div>
                                </div>
                        </div>
                        <div class="col-6" style="    height: 200px;
    overflow: scroll;">
                                <div class="col-lg-12" id="SearchedJobsDetails" ng-repeat="searh in searchitem" >
                                        <div style="border-bottom: 1px solid grey;"  >
                                                 <div style="cursor:pointer;background:#e5e5e5;" class="row" ng-click="JobDetails(searh.Id)"> <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4"> 
                                                <p  > <font style="color:red">Booking Date:</font> <br/> {{searh.BookingDate}}  </p> 
                                                  </div> 
                                                  <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4"> 
                                           
                                              <p  ><font style="color:red">Booking Time:</font> <br/>  {{searh.BookingTime}} </p> 
                                                 </div> 
                                                 <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4"> 
                                         
                                               <p  ><font style="color:red">Passenger Phone:</font>  <br/>{{searh.PassengerId}} </p> 
                                                </div> 
                                                <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12"> 
                                                  
                                                        <div class="col-lg-6 col-md-6 col-sm-6 col-xs-6"> 
                                                             <p  ><font style="color:red">From:</font>  <br/>   {{searh.PickAddress }} </p> 
                                                          </div> 
                                                          <div class="col-lg-6 col-md-6 col-sm-6 col-xs-6"> 
                                                               <p  ><font style="color:red">To :</font>  <br/> {{searh.DropAddress}} </p> 
                                                             </div> 
                                                         </div> 
                                                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12"> 
                                                           <p><font style="color:red">Tarrif Type:</font> {{searh.TarriffType}} </p> 
                                                      </div> 
                                                       </div> 
                                                     <div> 
                                                
                                                 </div>
                                        </div>
                                       
                                    </div>
                        </div>
                    </div>

                    <div class="row" style="    padding: 15px;
    box-shadow: 1px 1px 1px 1px #80808054;
    margin: 5px;">
                       
                                 
                        <div class="col-lg-6 col-md-6 col-sm-6">
                              
                               
                     <div class="section-left" id="JobsDetailsSection"  ng-repeat="showi in jobdetailshowing"  >
                                  
                                <button ng-click="jobsectionempty()"; class="btn btn-warning">Clear</button>
                                <button onclick="GeneratePDF()" class="btn btn-primary">Make PDF</button>
                              
                                
                                <div class="row" style="overflow: scroll; height: 600px;">
                                    <div class="col-12">
                                      </div>
                                <div class="col-4">
                                    <label class="label label-pill label-primary mt-2 ng-binding">Booking Id:</label>
                                    <h6>{{showi.bookingidx}}</h6>
                                     </div>
                                 <div class="col-12">
                                   <label  class="label label-pill label-primary mt-2 ng-binding">Booking Time:</label>
                                     <h6> {{showi.BookingDateTime}}</h6>
                                     </div>
                                 <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Booking Source:</label>
                                     <h6>{{showi.BookingSource}}</h6>
                                     </div>
                                 <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Booking Status:</label>
                                    <h6>{{showi.BookingStatus}}</h6>
                                     </div>
                                 <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Booking Type:</label>
                                   <h6>  {{showi.BookingType}}</h6>
                                     </div>
                                  <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Created By:</label>
                                    <h6> {{showi.DispatcherName}}</h6>
                                     </div>
                                  <div class="col-12">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Dispatch Time:</label>
                                    <h6> {{showi.DispatchTime}}</h6>
                                     </div>
                                     <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Driver Name:</label>
                                    <h6> {{showi.UserFName}} {{showi.UserLName}}</h6>
                                     </div>
                                     <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Vehicle No:</label>
                                    <h6> {{showi.CallSign}} / {{showi.VehicleNo}}</h6>
                                     </div>
                                       <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Passenger Name:</label>
                                    <h6> {{showi.ppname}}  </h6>
                                     </div>
                                       <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Passenger Phone :</label>
                                    <h6> {{showi.AccountId}}</h6>
                                     </div>
                                         <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Job Complete Time:</label>
                                    <h6> {{showi.JobCompleteTime}}</h6>
                                     </div>
                                
                                     <div class="col-4" ng-if="showi.Account_id">
                                    <label  class="label label-pill label-danger mt-2 ng-binding">Account Company Id:</label>
                                    <h6> {{showi.Account_id}}</h6>
                                     </div>
                                    <div class="col-4" ng-if="showi.Recieve_payment">
                                    <label  class="label label-pill label-danger mt-2 ng-binding">Paid Ammount:</label>
                                     <h6>{{showi.Recieve_payment}}</h6>
                                     </div>
                                
                                      <div class="col-4" ng-if="showi.Acc_claim_id">
                                    <label  class="label label-pill label-danger mt-2 ng-binding">Acc Claim Id:</label>
                                     <h6>{{showi.Acc_claim_id}}</h6>
                                     </div>
                                   <div class="col-4" ng-if="showi.Acc_claim_id">
                                    <label  class="label label-pill label-danger mt-2 ng-binding">Acc Claim Id:</label>
                                     <h6>{{showi.Acc_claim_id}}</h6>
                                     </div>
                                     <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Total Passengers:</label>
                                     <h6>{{showi.Passengers}}</h6>
                                     </div>
                                  <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Total Bags:</label>
                                     <h6>{{showi.Bags}}</h6>
                                     </div>
                                  <div class="col-4">
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Wheel Chairs:</label>
                                     <h6>{{showi.WheelChairs}}</h6>
                                     </div>
                                

                                 <div class="col-4"  >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Tariff:</label>
                                    <h6> {{showi.TarriffType}}</h6>
                                     </div>
                                  <div class="col-12"  >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Pick Address:</label>
                                    <h6     > {{showi.PickAddress}}</h6>
                                     </div>
                                  <div class="col-12"  >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Drop Address:</label>
                                   <h6>  {{showi.DropAddress}}</h6>
                                     </div>
                                
                                 <div class="col-4"   >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Vehicle Type:</label>
                                   <h6>  {{showi.VehicleType}}</h6>
                                     </div>
                                
                                <div class="col-4"   >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Estimated Distance:</label>
                                   <h6>  {{showi.EstimatedDistance}}</h6>
                                     </div>
                  
                                <div class="col-12" ng-if="showi.BookingSource == 'Dispatch Console'" >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">job accpet time:</label>
                                   <h6>  {{showi.jobaccpettime}}</h6>
                                     </div>
                                <div class="col-12"   ng-if="showi.BookingSource == 'Dispatch Console'" >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Arrived time:</label>
                                   <h6>  {{showi.arrivedtime}}</h6>
                                     </div>
                                <div class="col-12"  ng-if="showi.BookingSource == 'Dispatch Console'" >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">pickup time :</label>
                                   <h6>  {{showi.pickuptime}}</h6>
                                     </div>
                                <div class="col-12"    ng-if="showi.BookingSource == 'Dispatch Console'">
                                    <label  class="label label-pill label-warning mt-2 ng-binding">On the way time:</label>
                                   <h6>  {{showi.onthewaytime}}</h6>
                                     </div>
                                <div class="col-12"   >
                                    <label  class="label label-pill label-warning mt-2 ng-binding">Job Complete Time:</label>
                                   <h6>  {{showi.newcompelete}}</h6>
                                     </div>
                                      <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Tarrif Change Counter:</label>
                                  <h6>   Not Avalible Yet</h6>
                                     </div>  <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Meter Change Counter:</label>
                                   <h6>   Not Avalible Yet</h6>
                                     </div>

                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Waiting Time:</label>
                                   <h6>  {{format(showi.WaitingTime)}}</h6>
                                     </div>
                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Waiting Cost:</label>
                                   <h6>  {{showi.WaitingCost}}</h6>
                                     </div>
                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding"> Estimated Cost:</label>
                                   <h6>  {{showi.esti}}</h6>
                                     </div>
                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Payment:</label>
                                   <h6>  {{showi.Payment}}</h6>
                                     </div>
                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Ride Cost:</label>
                                   <h6>  {{showi.RideCost}}</h6>
                                     </div>
                                    <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Driver Cost:</label>
                                   <h6>  {{showi.DriverCost}}</h6>
                                     </div>
                                     <div class="col-4"   >
                                    <label  class="label label-pill label-primary mt-2 ng-binding">Total Ride Time:</label>
                                   <h6>  {{showi.TotalTime}}</h6>
                                     </div>
                                
                            </div>


                            </div>
                            <div id="editor"></div>
                        </div>
                        <div class="col-lg-6 col-md-6 col-sm-6">
                             <div class="col-12" id="shiftnew">
                                       
                            </div>
                          
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
     <div class="modal fade" id="closed-jobs">
        <div class="modal-dialog dialog-search-jobs">
            <div class="modal-content" style="    width: 1300px;
    margin-left: -396px;">
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Closed Jobs</h5>

                </div>
                <div class="modal-body" style="padding: 0;">
                    <div class="row">
                        <div class="col-lg-12  col-md-12  row text-center">
                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12 media-col1">
                                <ul class="list-inline">
                                    <li>
                                        <p>Booking Status</p>
                                    </li>
                                    <li>
                                        <div class="form-group">

                                            <select id="SearchJobsStatus" class="form-control">
                                                <option selected="selected" value="" >All</option>
                                                <option value="Dispatched" >Complete</option>
                                                <option value="Active">Active</option>
                                                <option value="Assigned">Assigned</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Offered">Offered</option>
                                                <option value="Cancel">Cancel</option>
                                                <option value="No Show">No Shown</option>
                                            </select>

                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12">
                                <ul class="list-inline">
                                    <li>
                                        <p>Vehicle</p>
                                    </li>
                                    <li>
                                        <div class="form-group">
                                            <select id="JobsSearchVehicle" class="form-control">
                                                <option selected="selected" value="">All</option>

                                            </select>

                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12">
                                <ul class="list-inline">
                                    <li>
                                        <p>Driver</p>
                                    </li>
                                    <li>
                                        <div class="form-group">


                                            <select id="JobsSearchDriver" class="form-control">
                                                <option selected="" value="">All</option>
                                           </select>

                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12 media-col1">
                                <ul class="list-inline">
                                    <li>
                                        <p>From Date</p>
                                    </li>
                                    <li>
                                        <div class="form-group">

                                            <input type="date" class="form-control" id="DateFrom"  />
                                                <script>

                                                    $(document).ready( function() {
                                                        var now = new Date();
 
                                                        var day = ("0" + now.getDate()).slice(-2);
                                                        var month = ("0" + (now.getMonth() + 1)).slice(-2);

                                                        var today = now.getFullYear()+"-"+(month)+"-"+(day) ;


                                                        $('#DateFrom').val(today);
                                                    });
                                                </script>
                                                     <script>

                                                        
                                                </script>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12 media-col1">
                                <ul class="list-inline">
                                    <li>
                                        <p>To Date</p>
                                    </li>
                                    <li>
                                        <div class="form-group">

                                            <input type="date" class="form-control" id="DateTo"   />
                                                         <script>

                                                             $(document).ready( function() {
                                                                 var now = new Date();
 
                                                                 var day = ("0" + now.getDate()).slice(-2);
                                                                 var month = ("0" + (now.getMonth() + 1)).slice(-2);

                                                                 var today = now.getFullYear()+"-"+(month)+"-"+(day) ;


                                                                 $('#DateTo').val(today);
                                                             });
                                                </script>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            <div class="col-lg-2 col-md-2 col-sm-6 col-xs-12" style="margin-top: 20px">
                                <button class="btn btn-success btn-chk " id="JobsSearch">Search Jobs</button>
                            </div>
                        </div>
                    </div>
                    <div class="table-closed-jobs">
                    
                        <table id="tbleClosedJobs" class="table table-striped table-bordered dt-responsive nowrap" style="border-collapse: collapse; border-spacing: 0; width: 100%;" width="100%" width="100%"></table>
                    </div>

                </div>
            </div>
        </div>
    </div>

     <div id="updateapproval" class="modal fade" role="dialog">
            <div class="modal-dialog">
             <div class="modal-content" style="width: 1120px; margin-left: -350px;">
              <div class="modal-header">
                 <h4 class="modal-title">Approval Update</h4>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
             
              </div>
              <div class="modal-body">
                <form class="form-group" id="updateapproval">
                        <div class="col-lg-12 col-md-8 col-sm-12" style=" padding: 20px;">
                            <div class="col-lg-12" style="box-shadow: 1px 1px 1px 1px #80808063;">
                                <div class="row">
                              <div class="col-lg-4">
                              <label >Manager Name</label>
                                <h4 id="upmanagername">asdasd</span>
                              </div>
                             <div class="col-lg-4">
                              <label>Manager Email</label>
                                <h4 id="upemail">asdasd</h4>
                              </div>
                             <div class="col-lg-4">
                              <label>Manager Phone</label>
                                <h4 id="upphone">asdasd</h4>
                              </div>
                            </div>
                               <div class="row">
                              <div class="col-lg-4">
                              <label>Client Name</label>
                                <h4 id="upclientname">asdas</h4>
                              </div>
                             <div class="col-lg-4">
                              <label>Registration Date</label>
                                <h4 id="upcemail">adasd</h4>
                              </div>
                             <div class="col-lg-4">
                              <label>Client Phone</label>
                                <h4 id="upcphone">asdasd</h4>
                              </div>
                            </div> 
                            </div>
                           
                            <h4 align="Center" style="font-family:sans-serif; font-size:15px; padding:5px;">Approval Details</h4> 
                            <div class="row" style="box-shadow: 1px 1px 1px 1px #80808063;">
                                <div class="col-lg-12 row">
                                   <div class="col-lg-4">
                                        
                                     <input type="hidden" id="approvalupid" class="form-control" />
                                     <label>Acc Id
                                    </label>
                                    <input type="text" id="upacc_id" name="upacc_id" value="" class="form-control" />
                                   </div>
                                    <div class="col-lg-4">
                                        <label>Claim Number</label>
                                        <input type="text" id="upclaimnum" class="form-control" readonly name="upclaimnum" value="" />
                                    </div>
                                      <div class="col-lg-4">
                                        <label>Purchase order number</label>
                                        <input type="text" id="uppurhcase" class="form-control" name="uppurhcase" value="" />
                                    </div>
                                </div>
                                  <div class="col-lg-12 row">
                                   <div class="col-lg-4">
                                     <label>Client Service Code
                                    </label>
                                    <input type="text" id="upClient_Code" class="form-control" name="upClient_Code" value=""  />
                                   </div>
                                    <div class="col-lg-4">
                                        <label>From</label>
                                        <input type="date" id="upfrom" class="form-control" name="upfrom" value="" />
                                    </div>
                                      <div class="col-lg-4">
                                        <label>To</label>
                                        <input type="date" id="upto" class="form-control" name="upto" value="" />
                                    </div>
                                </div>  
                                   <div class="col-lg-12 row">
                                   <div class="col-lg-4">
                                     <label>Route Status
                                    </label>
                                    <select id="uprotestatus" name="uprotestatus"  class="form-control" >
                                                    <option>One Way</option>
                                                    <option>Round Trip</option>
                                    </select>
                                   </div>
                                    <div class="col-lg-4">
                                        <label>Qty. Approved</label>
                                        <input type="number" id="upqty" class="form-control" name="upqty" value="" />
                                    </div>
                                      <div class="col-lg-12">
                                        <label>Service description</label>
                                        <input type="text" id="servicedisp" class="form-control" name="servicedisp" value="" />
                                    </div>
                                       <div class="col-sm-4">
                                           <input type="submit" style="margin: 4px;" class="btn btn-success"  value="Update Approval"/>
                                       </div>
                                </div> 
                            </div> 
                        </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
              </div>
            </div>

          </div>
        </div>

            <div class="modal fade" id="acc">
        <div class="modal-dialog dialog-search-jobs">
            <div class="modal-content " style="width: 1200px!important;
    margin-left: -350px!important; height: 600px;
    overflow: scroll;
">
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>ACC</h5>
                </div>
                <div class="modal-body" style="background: #e5e5e5;">
                                 <ul class="nav nav-tabs">
                              <li class="active"><a data-toggle="tab" href="#manager">Create Manager</a></li>
                              <li><a data-toggle="tab" href="#client">Create Client</a></li>
                              <li><a data-toggle="tab" href="#clientride">Create ACC Against Client</a></li>
                              <li><a data-toggle="tab" href="#approvaldetails" onclick="getapprovalall()">Approval Details</a></li>
                              </ul>

                            <div class="tab-content">
                              <div id="manager" class="tab-pane fade in active">
                              <div class="col-lg-12">
                                <div class="col-lg-4">
                               
                                <select class="form-control" style="display:none;" id="allmanager_list">
                                </select>
                             </div>
                           </div>
                                    <button data-toggle="collapse" style="margin-left:45%;" class="btn btn-success" data-target="#add_manager"><i class="fa fa-arrow-down"></i>Create New Manager</button>
                                    <form id="add_manager" class="form-group collapse"   style="padding: 10px;  box-shadow: 1px 1px 1px 1px #8080802b;">
                                    <div class="row">
                                        <div class="col-lg-12">
                                            <h5 style="    font-size: 18px;  color: green;  border-bottom: 1px solid #8080804a;">Add New Manager</h5>
                                        </div>
                                       <div  class=" col-lg-12 row">
                                            <div class="col-lg-4 col-md-4 col-sm-4">
                                                <label class="" for="manager_name">Manager Name</label>
                                                <input type="text" id="manager_name" name="manager_name" placeholder="Enter Manager Name"  class="form-control"/>
                                                <label class="" for="po_box">PO BOX </label>
                                                <input type="text" id="mananger_po_box" placeholder="Enter PoBox Number" name="mananger_po_box"  class="form-control"/>
                                              <label class="" for="manager_registration_date">Registration Date </label>
                                                <input type="Date" id="manager_registration_date" placeholder="Manager Registration date" name="manager_registration_date"  class="form-control"/>
                                        </div>  
                                        <div class="col-lg-4 col-md-4 col-sm-4">
                                            <label class="" for="manager_branch_code">Manager Brance Code</label>
                                               <input type="text" id="manager_branch_code" Placeholder="Enter Manager Brance Code" name="manager_branch_code"  class="form-control"/>
                                                 <label class="" for="manager_country">Country </label>
                                                <input type="text" id="manager_country" name="manager_country" placeholder="Enter Manager Country"  class="form-control"/>
                                             <label class="" for="manager_email">Manager Email </label>
                                                <input type="text" id="manager_email" name="manager_email"  placeholder="Enter Manager Email"  class="form-control"/>
                                        </div>
                                       <div class="col-lg-4 col-md-4 col-sm-4">
                                           <label class="" for="manager_address">Manager Address</label>
                                            <input type="text" id="manager_address" name="manager_address" placeholder="Enter Manager Address"   class="form-control"/>
                                           <label class="" for="manager_phone">Manager Phone</label>
                                            <input type="text" id="manager_phone" name="manager_phone"  class="form-control" placeholder="Enter Manager Phone"/>
                                           
                                        </div>
                                        <div class="col-lg-12" style="margin-top: 6px;">
                                            <input type="submit" class="btn btn-success" value="Add Manager"></input> 
                                        </div>
                                       </div>
                                    </div>

                                </form>
                              </div>
                            <div id="client" class="tab-pane fade">
                            <div class="col-lg-12">
                                    <div class="col-lg-4">
                                    
                                    <select class="form-control" style="display:none;"  id="added_client_list">
                                    </select>
                            </div>
                            </div>
                              <button data-toggle="collapse" style="margin-left:45%;" class="btn btn-success" data-target="#add_Client"><i class="fa fa-arrow-down"></i>Create New Client</button>
                              <form id="add_Client" class="form-group collapse" style="padding: 10px; box-shadow: 1px 1px 1px 1px #8080802b;">
                                    <div class="row">
                                        <div class="col-lg-12">
                                            <h5 style="font-size: 18px; color: green; border-bottom: 1px solid #8080804a;">Add New Client</h5>
                                        </div>
                                        <div class="col-lg-12">
                                         <p> <font style="color:red;"> Note: </font> For Creating New Client You Need to Select Manager First:</p>
                                            <label>Select Manager</label>
                                              <select class="form-control" style="width: 32%;" name="selectmanager" id="selectmanager" onchange="selectemc()">
                                              </select>
                                        </div>
                                        <div class="col-sm-12" id="clientadding" style="display:none;">
                                            <p> <font style="color:red;"> Note: </font> Now Fill the Client Details and Add Client:</p>

                                            <div class="col-lg-4 col-md-4 col-sm-4">
                                            <label class="" for="client_name">Client Name</label>
                                            <input type="text" id="client_name" name="client_name" placeholder="Enter Client Name"  class="form-control"/> 
                                            <label class="" for="client_registration_Date">Registration Date</label>
                                            <input type="date" id="client_registration_Date" name="client_registration_Date"  class="form-control"/> 
                                        </div>  
                                        <div class="col-lg-4 col-md-4 col-sm-4">
                                            <label class="" for="client_address">Client Address</label>
                                            <input type="text" id="client_address" placeholder="Enter Client Address" name="client_address"  class="form-control"/> 
                                        </div>
                                       <div class="col-lg-4 col-md-4 col-sm-4">
                                            <label class="" for="client_Phone">Client Phone</label>
                                            <input type="text" id="client_phone" name="client_phone"  placeholder="Enter Client Phone Number" class="form-control"/> 
                                        </div>
                                        <div class="col-lg-12" style="    margin-top: 6px;">
                                            <input type="submit" class="btn btn-success" value="Add Client"></input> 
                                        </div>
                                        </div>
                                        
                                    </div>

                                </form>
                              </div>
                              <div id="clientride" class="tab-pane fade">
                                  <div class="">
                                <form id="add_approval_acc">
                                        <div class="row">
                                            <div class="col-lg-12">
                                               <div class="row">
                                                 <div class="col-lg-4">
                                <p> <font style="color:red;"> Note: </font>Please Select Manager Name:</p>

                                               <label>Select Manager</label>
                                              <select class="form-control" id="approvealmanager" onchange="getclient();">
                                                <option>Select Manager</option>
                                              </select>
                                        </div>
                                        </div>
                                        <div class="col-lg-4" id="selected_clientsz" style="display : none;">
                                    <p> <font style="color:red;"> Note: </font>Please Select Client To Create a ACC Approval:</p>
                                                <label>Select Client</label>
                                        <select class="form-control" id="selected_clients" onchange="selectedclientok()" >
                                            <option>Choose Client</option>
                                        </select>
                                        </div>
                                        </div>
                                            <div class="col-lg-12" class="" id="addapprovesz" style="display:none;">
                                                 <p> <font style="color:red;"> Note: </font>Please Enter ACC Approval Details To Create Approval:</p>
                                    <div class="col-lg-4" >
                                        <input type="hidden" id="approvalid" />
                                             <label class="" for="client_ACCID">ACCID</label>
                                            <input type="text" id="client_ACCID"  name="client_ACCID" placeholder="Enter ACC ID" class="form-control"/>
                                              <label class="" for="client_Service_code ">Client Service Code</label>
                                            <input type="text" id="client_Service_code" name="client_Service_code" placeholder="Enter Client Service Code" class="form-control"/>  
                                             <label class="" for="client_Route_Status ">Route Status</label>
                                              <select id="client_Route_Status" name="client_Route_Status"  class="form-control" >
                                                    <option>One Way</option>
                                                    <option>Round Trip</option>
                                                </select>
                                            </div>
                                            <div class="col-lg-4">
                                              <label class="" for="client_Claim">Claim Number</label>
                                            <input type="text" id="client_Claim" name="client_Claim"  placeholder="Enter Claim Number" class="form-control"/> 
                                              
                                             <label class="" for="client_trip_from_Date">From</label>
                                            <input type="date" id="client_trip_from_Date" name="client_trip_from_Date" class="form-control"/> 
                                             <label class="" for="client_trip_allowed">Qty. Approved</label>
                                            <input type="number" id="client_trip_allowed"   name="client_trip_allowed" class="form-control"/> 
                                            </div>
                                            <div class="col-lg-4">
                                              <label class="" for="client_purchase_order_number">Purchase order number</label>
                                            <input type="text" id="client_purchase_order_number" placeholder="Enter Purchase order number" name="client_purchase_order_number"  class="form-control"/>
                                             
                                             <label class="" for="client_trip_to_Date">To</label>
                                            <input type="date" id="client_trip_to_Date" name="client_trip_to_Date" class="form-control"/> 
                                            </div> 
                                            <div class="col-lg-6">
                                                <label class="" for="client_Service_description">Service description</label>
                                             <textarea id="client_Service_description"  name="client_Service_description" class="form-control"></textarea>
                                            </div> 
                                            <div class="col-lg-4" style="    padding: 46px;">
                                                <input class="btn btn-success" type="submit" value="Add Approval"></input>
                                           <button class="btn btn-warning" onclick="clearapproval()">Clear</button>
                                                 </div>
                                            </div>
                                   


                                        </div>
                                           

                                    </form>
                                  </div>
                                    
                               </div>
                               <div id="approvaldetails" class="tab-pane fade">
                                   <button class="btn btn-success" onclick="refresshapprove()">Refresh</button>
                                <table id="approvaltable" class="table table-striped table-bordered dt-responsive nowrap" style="border-collapse: collapse; border-spacing: 0; width: 100%;" width="100%" width="100%"></table>

                               </div>    
                             </div>
                            </div>
                </div>
            </div>
        </div>
    </div>

      <div class="modal fade" id="Emergency">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Emergency</h5>
                </div>
                <div class="modal-body modal-alert-box" id="EmergencyBody">
                </div>
            </div>
        </div>
    </div>
    <div class="modal fade" id="alarms">
        <div class="modal-dialog dialog-alarm">
            <div class="modal-content">
                <audio id="myAudio">
           
                    <source src="css/AlertTone.mp3" type="audio/mpeg">
                </audio>
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5 id="alrmHeader">Show All Alarms
                        <input type="checkbox" id="showAllArlams" /></h5>
                    <label id="lblUserId" hidden="hidden"></label>
                </div>
                <div class="modal-body modal-alarm-box" style="height: 370px; overflow-y: scroll">
                </div>
                <div class="modal-footer">
                    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                        <div class="row">
                             
                            <div class="col-lg-5">Date
                                <div class="form-group">
                                    <input type="date" class="form-control" id="AlarmDate" />
                                </div>
                            </div>
 
                            <div class="col-lg-5">Time
                                <div class="form-group">
                                    <input type="time" class="form-control" id="AlarmTime" />
                                </div>
                            </div>
                        </div>
                        <div class="row">

                            <div class="col-lg-11">
                                <div class="form-group">
                                    <textarea rows="4" class="form-control" id="AlarmText"></textarea>
                                </div>
                            </div>
                            <button class="btn btn-danger submit" id="btnNewAlarm">Save Alarm</button>
                        </div>



                    </div>
                </div>
            </div>
        </div>
    </div>
     <div class="modal fade" id="alerts">
        <div class="modal-dialog dialog-alarm">
            <div class="modal-content">
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Alerts</h5>
                </div>
                <div class="modal-body modal-alert-box" id="alertbox">
                </div>
            </div>
        </div>
    </div>
      <div class="modal fade" id="messages">
        <div class="modal-dialog dialog-messages">
            <div class="modal-content" style="margin-left: -117px!important; width: 800px!important;">
                <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                    <button class="close" data-dismiss="modal">&times;</button>
                    <h5>Messages</h5>
                </div>
                <div class="modal-body">
                     <hr>
                    <div class="container bootstrap snippet">
                <div class="row">
               <div class="col-md-4 bg-white " style="height: 400px; overflow-y:scroll">
                <div class=" row border-bottom padding-sm" style="height: 40px;">
            	    Member
                </div>
              <ul class="friend-list" style="cursor:pointer">
            
                
             </ul>
		        </div>
                <div class="col-md-8 bg-white " id="DivChat" style="height: 400px; overflow-y:scroll">
                <div class="chat-message">
                <label id="PlayerId" hidden="hidden"></label>
                <label id="lblRequest" hidden="hidden">False</label>
                 <label id="UserId" hidden="hidden">0</label>
                <ul class="chat" style="cursor:pointer">
                </ul>
                    
                </div>
                  <input class="form-control border no-shadow no-rounded" id="TxtMessage" placeholder="Type your message here">
            	  <button class=" " type="button" id="btnMessage">Send</button>
            	  </div>
               </div>
              </div>
                </div>
            </div>
        </div>
    </div>
    

        <div class="modal fade" id="DivSettings">
        <div class="modal-dialog">
            <div class="modal-content">

                <div class="modal-body">
                    <label id="DirectBookingIsAllowed"></label>
                    <label id="AllowDirectAssignment"></label>
                    <label id="EditZoneQueue"></label>
                    <label id="DispatcherKickUsers"></label>
                    <label id="DispatchShows"></label>
                    <label id="ColorJobs"></label>
                    <label id="DispatchAlerts"></label>
                    <label id="DispatchSounds"></label>
                    <label id="AutoDispatch">1</label>
                    <label id="RespectShiftEnd"></label>
                    <label id="CompanyRadius">0</label>
                    <label id="StripePublicKey">{{publickey}}</label>
                    <label id="lblClosedJobFlag"></label>
                    <label id="PickupZoneId"></label>
                     <input type="hidden" id="transection" />
                    <input type="hidden" id="percentagevalue" />
                    <input type="hidden" id="coords" />
                    <button id="plot"></button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="VehicleDetails">
        <div class="modal-dialog">
            <div class="modal-content" style="    width: 800px;
    margin-left: -205px;">
                <div class="modal-header">
                    <button class="close" data-dismiss="modal"><i class="fa fa-times"></i></button>
                    <h4 class="txt-theme modal-title">Vehicle Details</h4>
                </div>
                <div class="modal-body" style="padding-bottom: 75px;">
                    <div class="row">
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <img id="VehicleImage" src="{{VehicleImage}}" style="width: 70px; height: 70px" />
                               <div class="row">

                         <table>
                            <tr>
                                <td ng-click="ShowSuspendDetails(selectedone)">
                                    <button class="btn btn-danger pull-left clsSuspend" id="DriverSuspends">Suspend Driver</button>
                                </td>
                                 <td ng-click="ShowKickDetails(selectedone)">
                                        <input type="button" class="btn btn-danger pull-left clsdelete" id="btnKick" value="Kick" />
                                    </td>
                                <td>
                                 <input type="button" class="btn btn-primary pull-left" onclick="FnFindMyVehicle()" id="FindMyVehicle" value="Find Vehicle" />

                                </td>
                            </tr>
                             
                        </table>
                    </div>
                        </div>
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">

                        </div>
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label>Vehicle Name:</label>
                            <label id="lblVehicleName"> </label>
                        </div>

                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label>Vehicle No:</label>
                            <label id="lblVehicleNo"> </label>
                        </div>
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label>Call Sign:</label>
                            <label id="lblVehicleSign"> </label>
                        </div>



                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label>Driver:</label>
                            <label id="lblDriverName"> </label>
                        </div>
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label>Driver Phone:</label>
                            <label id="lblDriverPhone"> </label>
                        </div>
                        <div class="col-md-6 col-lg-6 col-sm-6 col-xs-6">
                            <label id="VehicleLat" hidden="hidden"> </label>
                            <label id="VehicleLng" hidden="hidden"> </label>
                            
                            <label id="lblDriverId" hidden="hidden"> </label>
                            <label id="lblDriverPlayerId" hidden="hidden"> </label>
                            <label id="lblBookingHeadId" hidden="hidden"> </label>
                        </div>
                    </div>
                 
                    <div id="VehicleJobs" style=" overflow-y: scroll">
                     
                 </div>
                </div>
                <div class="modal-footer">
                    <div class="col-sm-12 row">
                        <div class="col-sm-6">
                              <div class="row">
                       
                        <div class="col-md-3 col-lg- col-sm-6 col-xs-6">
                            <select class="form-control" id="ddlQueueNo">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                               
                            </select>
                        </div>
                        <div class="col-md-3 col-lg-3 col-sm-6 col-xs-6">
                            <input type="button" class="btn btn-success pull-left" id="MoveToFront" value="Move to front" />
                        </div>
                    </div>
                  
                        </div>
                        <div class="col-sm-6">
                      <div class="row">
                        <div class="col-md-10  col-lg-10 col-sm-10 col-xs-10">
                            <input type="text" id="TxtTypeMessage" class="form-control" placeholder="Type Message Here" />
                        </div>
                        <div class="col-md-1 col-lg-1 col-sm-1 col-xs-1">
                            <input type="button" class="btn btn-success" id="PushMessage" value="Send" />
                        </div>
                    </div>
                        </div>
                    </div>
                  
                </div>
            </div>
        </div>
    </div>


    <div class="modal fade" id="paymentmodel" tabindex="-1" role="dialog" style="  padding-right: 6px;">
				<div class="modal-dialog" role="document">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title" id="example-Modal3">Pay With Stripe</h5>
							<button type="button" class="close" data-dismiss="modal" aria-label="Close">
								<span aria-hidden="true">×</span>
							</button>
						</div>
						<div class="modal-body">
						   <form id="formStripe">

                                        <div class="row">
                                            <div class="col-lg-12 text-center">

                                                <h3 class="txt-dark">Pay With Stripe</h3>
                                                <img src="images/line-mini.png" />
                                            </div>
                                        </div>


                                       

                                            <div class="row">
                                                <div class="col-lg-4">
                                                    <span class="label label-success" >Card Holder Name</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <div class="form-group field-container">
                                                        <input type="text" class="form-control field required" name="name" id="TxtName" placeholder="Enter Your  Name Here" required="required" />

                                                    </div>
                                                </div>
                                            </div>
                                            <div class="row">
                                                <div class="col-lg-4">
                                                    <span class="label label-success">Email</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <div class="form-group field-container">
                                                        <input type="email" class="form-control field required" name="email" autocomplete="off" id="Email" placeholder="Enter Email Here"   />
                                                        <div class="result"></div>
                                                    </div>
                                                </div>
                                                </div>
                                          
                                            <div class="row">
                                                <div class="col-lg-4">
                                                    <span class="label label-success">Card Number</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <div class="form-group field-container">
                                                        <input type="text" maxlength="20" autocomplete="off" class="card-number stripe-sensitive required form-control" placeholder="Enter Card Number Here" />
                                                        <div class="CardError"></div>
                                                    </div>

                                                </div>
                                            </div>
                                            <div class="row">

                                                <div class="col-lg-4">
                                                    <span class="label label-success">CVC</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <div class="form-group field-container">
                                                        <input type="text" maxlength="4" autocomplete="off" class="card-cvc stripe-sensitive required form-control " required="required" placeholder="Enter CVC Here" />

                                                    </div>
                                                </div>
                                            </div>
                                            <div class="row">

                                                <div class="col-lg-4">
                                                    <span class="label label-success">Expiration</span>
                                                </div>

                                                <div class="col-lg-8">
                                                    <div class="col-lg-6">
                                                        <div class="form-group field-container">
                                                            <select id="card-expiry-month" class="card-expiry-month stripe-sensitive required form-control">
                                                            </select>
                                                            <script type="text/javascript">
                                                                var    month = new Date().getMonth() + 1;
                                                                for (var i = 1; i <= 12; i++) {
                                                                    $('#card-expiry-month').append("<option value='" + i + "' " + (month === i ? "selected" : "") + ">" + i + "</option>"); 
                                                                     
                                                                }
                                                            </script>

                                                        </div>

                                                    </div>

                                                    <div class="col-lg-6">
                                                        <div class="form-group field-container">
                                                            <select id="card-expiry-year" class="card-expiry-year stripe-sensitive required form-control"></select>
                                                            <script type="text/javascript">
                                                                var  year = new Date().getFullYear();
                                                    
                                                                for (var i = 0; i < 72; i++) {
                                                                    $('#card-expiry-year').append("<option value='" + (i + year) + "' " + (i === 0 ? "selected" : "") + ">" + (i + year) + "</option>")
                                                                }
                                                            </script>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="row">

                                                <div class="col-lg-4">
                                                    <span class="label label-success">Phone No</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <input type="text" id="TxMobileNo" class="form-control" placeholder="Enter Passenger Phone" required="required" />
                                                </div>
                                            </div>
                                            <div class="row">

                                                <div class="col-lg-4">
                                                    <span class="label label-success">Amount</span>
                                                </div>
                                                <div class="col-lg-8">
                                                    <input type="number" id="TxAmount"  ng-model="AmmountAddedvalue" class="form-control" placeholder="Enter Amount" required="required" />
                                                </div>
                                            </div>
                                            <div class="row">
                                                     <button type="submit" id="btnPay" class="btn btn-warning pull-right btn-contact">
                                                    Pay Payment</button>
                                                       <span class="payment-errors" style="color: red;"></span>
                                            </div>
                                    <div class="row">
                                             <span  id="paymentvalueshow"  style="color: red; font-size: 16px;"></span>
                                           <input type="hidden" id="TxAmountfinal"  />
                                             <label id="textforpayment" style="color: red; font-size: 16px;"> </label>
                                  </div>

                                        
                                      </form>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
					    </div>
					</div>
				</div>
			</div>
 <style>
     [ng\:cloak], [ng-cloak], [data-ng-cloak], [x-ng-cloak], .ng-cloak, .x-ng-cloak {
         display: none !important;
     }
 </style>
    <style type="text/css">
    
  
 
.dot {
  height: 15px;
  width: 15px;
  border-radius: 50%;
  display: inline-block;
}
.onlinez {
  background-color: #20962e;
}
.offlinez {
  background-color: #f44336;
}
</style>
    <script type="text/javascript">
    
    function findIp() {
  var findIP = new Promise(r => {
    var w = window,
      a = new (w.RTCPeerConnection ||
        w.mozRTCPeerConnection ||
        w.webkitRTCPeerConnection)({ iceServers: [] }),
      b = () => {};
    a.createDataChannel("");
    a.createOffer(c => a.setLocalDescription(c, b, b), b);
    a.onicecandidate = c => {
      try {
        c.candidate.candidate
          .match(
            /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g
          )
          .forEach(r);
      } catch (e) {}
    };
  });
  findIP
    .then(ip => $("#ipchk").html("your IP: " + ip))
    .catch(e => console.error(e));
}

//gets the network status from the browser navigator api once page is loaded
    function chkstatus() {
           //if($('#checkitt').is(":checked")){
           // angular.element(document.getElementById('myangular')).scope().FnZonewiseJobtwo();
                        
           // }
          angular.element(document.getElementById('myangular')).scope().getjobs();
            
       
          if (navigator.onLine) {
 
            //$("#netchk").html("online");
            $(".dot").removeClass("offlinez");
            $(".dot").addClass("onlinez");
            //print ip if there is connection
            findIp();
          } else {
  
            //$("#netchk").html("offline");
            $(".dot").removeClass("onlinez");
            $(".dot").addClass("offlinez");
          }
        }

//check status every 5 seconds
setInterval(
    
    chkstatus, 
    
    
    25000);

$(document).ready(function() {
  chkstatus();

  //event listener for changes in the netwrok
  window.addEventListener("offline", function(e) {
    //$("#netchk").html("offline");
    $(".dot").removeClass("online");
    $(".dot").addClass("offline");
    $("#ipchk").html("your ip: ");
  });

  window.addEventListener("online", function(e) {
   
    //$("#netchk").html("online");
    $(".dot").removeClass("offline");
    $(".dot").addClass("online");
    findIp();
  });
});
</script>
<body ng-app="myApp" ng-cloak  ng-controller="myCtrl" id="myangular">

    <div class="page" style="background:#0bcffb2b;">
        <div class="page-main" style="background:#0bcffb2b;">
            <!-- header area -->
            <div class="app-header1 header py-1 d-flex">
                <div class="container-fluid">
                    <div class="d-flex">
                            <a  href="#">
                            <img src="images/logo3.png" class="header-brand-img" alt="360 TAXI">
                             </a>
                           <button class="btn btn-danger" data-toggle="modal" ng-click="showfirst();"  >Create Job</button>
                        <p class="label label-success  "  style="padding: 10px;
    margin: 4px; position: absolute; left: 202px;   height: 31px;  color: black;">
                           Dispatcher: <label id="lblName1" ></label> ,
                            Company: <label id="CompanyName" ngclick="testemailing()"></label>
                             <span class="dot"></span> 
                             
                                 
                              
                           </p>
                        
                           
                            
                                 
                               
                              
                           <div class="d-flex order-lg-10 ml-auto">
                        <div class="topnav">
                            <a data-toggle="modal" data-target="#Filter-jobs">Filter</a>
                            <a data-toggle="modal" data-target="#search-jobs">Search Jobs</a>
                              
                            <a data-toggle="modal" data-target="#closed-jobs">Closed Jobs</a>
                            <a data-toggle="modal" data-target="#acc">Acc</a>
                           <a  data-toggle="modal" data-target="#alarms">Alarms</a>
                            <a  data-toggle="modal" data-target="#messages">Message</a>
                            <a  onclick="Logout()">Log Out</a>
                           
                         
                        </div>  
                         <div class="dropdown"    >
                           <input type="hidden"  id="totalnoti" value=""   />
                          <i class="fa fa-bell   dropdown-toggle"  onclick="shownotiii();" style="color:red; margin-top: 13px;
                             margin-right: 11px;" data-toggle="dropdown">
                              <span id="total_notification"  onclick="shownotiii();">0</span></i>
                      
                          <div class="dropdown-menu" id="alertshow" style="margin-left: -141px;  width: 350px;  margin-top: 27px;">
                          
                          </div>
                        </div>
                              <script>
                                  function shownotiii(){ 

                                      console.log(document.getElementById('alertshow').style.display);
                                      if(document.getElementById('alertshow').style.display == 'none'){
                                          document.getElementById('alertshow').style.display = 'block';
                                      }else{
                                          document.getElementById('alertshow').style.display = 'none';
                                      }
                                  }

                              </script>
                        </div>
                           <div class="modal fade" id="Emergency">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                                <button class="close" data-dismiss="modal">&times;</button>
                                <h5>Emergency</h5>
                            </div>
                            <div class="modal-body modal-alert-box" id="EmergencyBody">
                            </div>
                        </div>
                    </div>
                </div>

                        <!-- Large Modal -->
                        <div id="largeModal" class="modal fade"   >
                            <div class="modal-dialog modal-lg"  >
                                <div class="modal-content " id="largeModalcontet" style="margin-top: 0; margin-left: -242px; width: 606px;">

                                    <div class="modal-body pd-20">


                                        <!-- Accordion begin -->
                                        <ul class="demo-accordion accordionjs m-0"  >
                                         <!-- Section 1 -->
                                            <li class="acc_active" id="firss">
                                                <div>
                                                    <h4>Pick And Drop off Address</h4>
                                                </div>
                                                <div class="col-sm-12 col-md-12 col-xl-12" id="firss1">
                                                    <div class="row">
                                                       
                                                            <input id="LocalPickLat" hidden type="text"   value="0"  ng-model="LocalPickLat" >
                                                            <input id="LocalPickLng" hidden type="text"  value="0" ng-model="LocalPickLng"  >
                                                            <input id="LocalDropLat" hidden type="text" value="0" ng-model="LocalDropLat" >
                                                            <input id="LocalDropLng" hidden type="text" value="0" ng-model="LocalDropLng" >
                                                        
                                                        <div class="col-sm-6">
                                                            <label class="label label-success">Pick up</label>
                                                            <div class="col-sm-12 row" >
                                                                <input type="text" name="" class="form-control" id="pac-input" ng-model="pickupaddress" placeholder="Search Pick Up Location">
                                                              <button class="label label-success" ng-show="showstopshow" ng-click="createnewstop()">New Stop</button>
                                                            </div>

                                                              <div id="newstopdiv" ng-show="stoplstshow">
                                                                <div ng-repeat=" stops   in stoplistarray">
                                                                    <input id="lat{{stops.id}}" type="text"  hidden value="{{stops.lat}}"   />
                                                                    <input id="lng{{stops.id}}" type="text" hidden  value="{{stops.lng}}" />
                                                                    <div class="input-group">
                                                                        <span class="input-group-addon"><i class="fa fa-minus-circle" ng-click="deletestopz(stops.id)"></i></span>
                                                                        <input id="pac-input{{stops.id}}" class="form-control" value="{{stops.path}}" placeholder="Enter New Stop" ng-keydown="createnewstoplat(stops.id)"  />
                                                                      </div>
                                                                    
                                                                     
                                                                </div>
                                                          
                                                            </div>
                                                            <button class="label label-danger" ng-click="btnReverse()">Reverse</button>
                                                            <label class="label label-primary">Cornor</label>
                                                            <input type="checkbox" name="corner"    ng-model="cornershow"   > 
                                                            <label class="label label-primary">Urgent </label>
                                                            <input type="checkbox" name="Urgent" ng-model="urgentdata"  > 
                                                            <input type="text" class="form-control" placeholder="Corner"  ng-show="cornershow" ng-model="cornerdata" />
                                                            <span class="label label-primary">
                                                                <span>Details Estimated:</span>
                                                                <span>Time: {{Time}}</br> Distance: {{distance}}</span>
                                                                <span>Cost:{{currencyprice}}</span> 
                                                                <span>{{currency}}</span>
                                                                 </span>
                                                            <label class="label label-primary">  
                                                                <label>now</label>
                                                                <input type="radio"  id="nowcheck" name="time" ng-checked="bookingtime_select == 0" ng-value="0" ng-model="bookingtime_select">
                                                                <label>later</label>
                                                                <input type="radio" id="latecheck" name="time" ng-value="1"  ng-checked="bookingtime_select == 1"  ng-model="bookingtime_select">
                                                            
                                                            </label>
                                                            </br>
                                                             
                                                            <input class="label label-primary" type="date" id="laterDate"  ng-model="datetimemain"  ng-show="bookingtime_select == 1"  />
                                                            
                                                         <select onchange="checktime_now(this.value) " class="label label-primary"  ng-show="bookingtime_select == 1"   id="ddlLaterHrs" ng-model="ddlLaterHrs"  >
                                                                                            <option value="00">00</option>
                                                                                            <option value="01">01</option>
                                                                                            <option value="02">02</option>
                                                                                            <option value="03">03</option>
                                                                                            <option value="04">04</option>
                                                                                            <option value="05">05</option>
                                                                                            <option value="06">06</option>
                                                                                            <option value="07">07</option>
                                                                                            <option value="08">08</option>
                                                                                            <option value="09">09</option>
                                                                                            <option value="10">10</option>
                                                                                            <option value="11">11</option>
                                                                                            <option value="12">12</option>
                                                                                            <option value="13">13</option>
                                                                                            <option value="14">14</option>
                                                                                            <option value="15">15</option>
                                                                                            <option value="16">16</option>
                                                                                            <option value="17">17</option>
                                                                                            <option value="18">18</option>
                                                                                            <option value="19">19</option>
                                                                                            <option value="20">20</option>
                                                                                            <option value="21">21</option>
                                                                                            <option value="22">22</option>
                                                                                            <option value="23">23</option>
                                                                                        </select>
                                                           
                                                         
                                                           <select   ng-model="ddlLaterMins"  onchange="minutechecks_now(this.value)" class="label label-primary" id="ddlLaterMins" ng-show="bookingtime_select == 1"  >
                                                                <option value="00">00</option>
                                                            <option value="01">01</option>
                                                            <option value="02">02</option>
                                                            <option value="03">03</option>
                                                            <option value="04">04</option>
                                                            <option value="05">05</option>
                                                            <option value="06">06</option>
                                                            <option value="07">07</option>
                                                            <option value="08">08</option>
                                                            <option value="09">09</option>
                                                            <option value="10">10</option>
                                                            <option value="11">11</option>
                                                            <option value="12">12</option>
                                                            <option value="13">13</option>
                                                            <option value="14">14</option>

                                                            <option value="15">15</option>
                                                            <option value="16">16</option>
                                                            <option value="17">17</option>
                                                            <option value="18">18</option>
                                                            <option value="19">19</option>
                                                            <option value="20">20</option>
                                                            <option value="21">21</option>
                                                            <option value="22">22</option>
                                                            <option value="23">23</option>
                                                            <option value="24">24</option>
                                                            <option value="25">25</option>
                                                            <option value="26">26</option>
                                                            <option value="27">27</option>
                                                            <option value="28">28</option>
                                                            <option value="29">29</option>
                                                            <option value="30">30</option>
                                                            <option value="31">31</option>
                                                            <option value="32">32</option>
                                                            <option value="33">33</option>
                                                            <option value="34">34</option>
                                                            <option value="35">35</option>
                                                             <option value="36">36</option>
                                                             <option value="37">37</option>
                                                             <option value="38">38</option>
                                                             <option value="39">39</option>
                                                            <option value="40">40</option>
                                                            <option value="41">41</option>
                                                            <option value="42">42</option>
                                                            <option value="43">43</option>
                                                            <option value="44">44</option>
                                                            <option value="45">45</option>
                                                            <option value="46">46</option>
                                                            <option value="47">47</option>
                                                            <option value="48">48</option>
                                                            <option value="49">49</option>
                                                            <option value="50">50</option>
                                                            <option value="51">51</option>
                                                            <option value="52">52</option>
                                                            <option value="53">53</option>
                                                            <option value="54">54</option>
                                                            <option value="55">55</option>
                                                            <option value="56">56</option>
                                                            <option value="57">57</option>
                                                            <option value="58">58</option>
                                                            <option value="59">59</option>
                                                            <option value="60">60</option>
                                                           </select>
 
                                                            <select id="assign_notice"  ng-model="assign_notice" class="label label-primary" ng-show="bookingtime_select == 1" >
                                                                 <option value="0">0min</option>
                                                                <option value="5">5min</option>
                                                                <option value="10">10min</option>
                                                                <option value="15">15min</option>
                                                                <option value="20">20min</option>
                                                                <option value="30">30min</option>
                                                                <option value="45">45min</option>
                                                                <option value="60">1h0min</option>
                                                                <option value="75">1h15min</option>
                                                                <option value="90">1h30min</option>
                                                                <option value="120">2h0min</option>                                                             
                                                            </select>
                                                     
         
                                                        </div>
                                                        <script>
                                                            function minutechecks_now(currentminute) {
                                                                $('#ddlLaterMins').css("color", "black");
                                                                var  current_hour = document.getElementById('ddlLaterHrs').value;
                                                                var today = new Date();
                                                                var hh = today.getHours();
                                                                var minute = today.getMinutes();

                                                                var valueofdate = document.getElementById("laterDate").value;
        
                                                                var today = new Date();
                                                                var dd = String(today.getDate()).padStart(2, '0');
                                                                var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
                                                                var yyyy = today.getFullYear();
                                                                var hh = today.getHours();
                                                                today =  yyyy + '-' +  mm + '-' +  dd;
                                                                if (valueofdate > today) {
             
                                                                } else if (valueofdate < today) {
                                                                    //alert("This Date is Already Passed , Current Date is :" + today);
                                                                    Swal.fire(
                                                                      'Warning!',
                                                                      "This Date is Already Passed , Current Date is :" + today,
                                                                      'warning'
                                                                    );
                                                                    document.getElementById('ddlLaterHrs').value = "00";
                                                                } else {
                                                                    if (current_hour > hh) {


                                                                    } else {
                                                                        if (currentminute < minute) {
                                                                            Swal.fire(
                                                                       'Warning!',
                                                                       "This Minute is Already Passed , Current Minute is :" + minute,
                                                                       'warning'
                                                                     );
                                                                            document.getElementById('ddlLaterMins').value = minute;
                                                                        }
                                                                    }
                                                                }

     



                                                            }
                                                            function checktime_now(currenthour) {
                                                               
                                                                var valueofdate = document.getElementById("laterDate").value;
        
                                                                var today = new Date();
                                                                var dd = String(today.getDate()).padStart(2, '0');
                                                                var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
                                                                var yyyy = today.getFullYear();
                                                                var hh = today.getHours();
                                                                today =  yyyy + '-' +  mm + '-' +  dd;
                                                                if (valueofdate > today) {
             
                                                                } else if (valueofdate < today) {
                                                                    //alert("This Date is Already Passed , Current Date is :" + today);
                                                                    Swal.fire(
                                                                      'Warning!',
                                                                      "This Date is Already Passed , Current Date is :" + today,
                                                                      'warning'
                                                                    );
                                                                    document.getElementById('ddlLaterHrs').value = "00";
                                                                } else {
                                                                    if (currenthour < hh) {
                                                                        //alert("This Hour is Already Passed , Current Hour is : " + hh);
                                                                        Swal.fire(
                                                                         'Warning!',
                                                                         "This Hour is Already Passed , Current Hour is : " + hh,
                                                                         'warning'
                                                                       );
                                                                        document.getElementById('ddlLaterHrs').value = hh;

                                                                    }
                                                                }
                                                            }
                                                        </script>
                                                        <div class="col-sm-6">
                                                            <label class="label label-success">Drop off</label>
                                                            <input type="text" name="slng" class="form-control" ng-model="dropupaddress"
                                                                  
                                                                
                                                                  id="pac-inputx" placeholder="Search Drop off Location">

                                                            <label class="label label-success">Info: </label>
                                                            <input type="text" name="info" ng-model="rideinfo" class="form-control" placeholder="Enter Job Related Info">
                                                            <label class="label label-success">Tariff: </label>
                                                           
                                                              <select class="form-control" ng-change="unitChanged()" ng-model="selectedtarrif" id="ddlTariff">
                                                                    <option ng-value='0'>Automatic</option>
                                                                    <option ng-value='-1'  >Custom</option> 
                                                                    <option  ng-repeat="item in tarriflist" ng-value="item.Id">{{item.TariffName}}</option>
                                                            </select>   
                                                            <input type="number"  class="form-control"  ng-show="customeshow" ng-model="CustomeRate"/>
                                                                

                                                            <div>
                                                               <span class="label label-primary" id="timesuggested" ng-show="bookingtime_select == 1">

                                                                </span>

                                                            </div>
                                                        </div>
                                                    </div>

                                                
                                            

                                            <!-- Section 2 -->
                                            
                                               
                                                
                                                    <div class="row">
                                                        <div class="col-xl-12 col-md-12 col-sm-12">
                                                           <div  class="col-xl-12 col-md-12 col-sm-12 row">
                                                             <input type="Search" id="searchdatasx" class="form-control" autocomplete="off" style="width: 80%;" name="searchaap" ng-model="searchtext" ng-keydown="Searchmulti( )" placeholder="Search Acc ID/ Account ID/ Customer">
                                                              <button class="btn btn-success" ng-click="clearseacch()"  style="    padding: 0px 10px;
 
    margin-left: 3px;">Clear</button>

                                                           </div>
                                                            <div id="searchdatas" style="   position: absolute;
                                                                z-index: 3;   background: #efe3e3;
                                                                width: 100%;   color: grey;     
                                                                ">
                                                <h5 ng-click="accselect(acc)" id="testingss" style="      cursor: pointer;  margin-bottom: 8px;" ng-repeat="acc in acc_record_search"><label class="label label-success">Calim No: {{acc.claim_number}}</label> | <label class="label label-success">Claim: {{acc.client_name}}</label> | <label class="label label-success">Phone: {{acc.client_phone}}</label> | <label class="label label-success"> ACC</label></h5>
                                                <h5  id="testingss" ng-click="accountselect(account)"  style ="     cursor: pointer; 
                                                  margin-bottom: 8px;"  ng-repeat="account in account_record_search"><label class="label label-success">Id: {{account.Id}}</label> | <label class="label label-success">Account: {{account.Type}}</label> | <label class="label label-success">Phone: {{account.PhoneNo}}</label></h5>
                                                <h5 id="testingss" ng-click="customerselect(passenger)"  style="     cursor: pointer;  
                                                 margin-bottom: 8px;"  ng-repeat="passenger in passenger_record_search">  <label class="label label-success">Phone: {{passenger.PhoneNo}}</label> | <label class="label label-success">Name: {{passenger.Name}}</label></h5>
                                                                
                                                        


                                                            </div>
                                                        </div>
                                                        <div class="col-sm-4 col-md-4">
                                                            <label class="label label-success">Passenger Name: </label>
                                                            <input type="text" class="form-control" name="passengerphone" ng-model="account_Name" value="{{account_Name}}">
                                                            <label class="label label-success">Phone:   </label>
                                                            <input type="text" class="form-control" id="phonenumbers" name="phone" ng-model="account_PhoneNo"  value="{{account_PhoneNo}}">
                                                            <label class="label label-success">Account ID: </label>
                                                            <input type="text" class="form-control" name="accountid" value="{{account_AccountId}}">
                                                            <label class="label label-success">Email: </label>
                                                            <input type="text" class="form-control" name="Email" " ng-model="account_Email" value="{{}}">
                                                        </div>
                                                        <div class="col-sm-4 col-md-4">
                                                            <label class="label label-success">Claim Number: </label>
                                                            <input type="text" class="form-control" ng-readonly="true" name="passengerphone" value="{{claim_number}}">
                                                            <label class="label label-success">Remain Ride:   </label>
                                                            <input type="text" class="form-control" ng-readonly="true" name="passengerRemain" value="{{trip_days_left}}">
                                                            <label class="label label-success">Client Name: </label>
                                                            <input type="text" class="form-control" ng-readonly="true" name="passengerClientName" value="{{client_name}}">
                                                            <label class="label label-success">Number: </label>
                                                            <input type="text" class="form-control" ng-readonly="true" name="passengerNumber" value="{{client_phone}}">
                                                        </div>
                                                    </div>
                                                
                                            

                                            <!-- Section 3 -->
                                            
                                                
                                                    <div class="col-lg-12 col-sm-12 col-md-12">
                                                        <div class="row">
                                                            <div class="col-sm-12 col-md-8 col-xl-8">
                                                                <div class="row">
                                                                    <div class="col-sm-3">
                                                                        <!--  <img src="images/icon-user.png" title="No Of Passenger"> -->
                                                                        <label class="label label-primary"><i class="fa fa-users"></i></label>
                                                                         <select class="form-control"  ng-change="changeperson()"  ng-model="selectedcustomer">
                                                                           <option ng-value="1">1</option>
                                                                            <option ng-value="2">2</option>
                                                                            <option ng-value="3">3</option>
                                                                            <option ng-value="4">4</option>
                                                                            <option ng-value="5">5</option>
                                                                            <option ng-value="6">6</option>
                                                                            <option ng-value="7">7</option>
                                                                            <option ng-value="8">8</option>
                                                                            <option ng-value="9">9</option>
                                                                            <option ng-value="10">10</option>
                                                                            <option ng-value="11">11</option>
                                                                            <option ng-value="12">12</option>
                                                                            <option ng-value="13">13</option>
                                                                            <option ng-value="14">14</option>
                                                                            <option ng-value="15">15</option>
                                                                            <option ng-value="16">16</option>
                                                                            <option ng-value="17">17</option>
                                                                            <option ng-value="18">18</option>
                                                                            <option ng-value="19">19</option>
                                                                            <option ng-value="20">20</option>
                                                                             </select>   
                                                                       
                                                                    </div>
                                                                    <div class="col-sm-3">
                                                                        <!--  <img src="images/icon-user.png" title="No Of Passenger"> -->
                                                                        <label class="label label-primary"><i class="fa fa-shopping-bag"></i></label>
                                                                        <select class="selectBox form-control" ng-model="selectedbeg">
                                                                             <option   ng-value="0">0</option>
                                                                             <option   ng-value="1">1</option>
                                                                            <option  ng-value="2">2</option>
                                                                            <option ng-value="3">3</option>
                                                                            <option ng-value="4">4</option>
                                                                            <option ng-value="5">5</option>

                                                                        </select>
                                                                    </div>
                                                                    <div class="col-sm-3">
                                                                        <!--  <img src="images/icon-user.png" title="No Of Passenger"> -->
                                                                        <label class="label label-primary"><i class="fa fa-wheelchair"></i></label>
                                                                        <select class="selectBox form-control" ng-change="changewheelch()"  ng-model="selectedwheelchair">
                                                                            <option  ng-value="0">0</option>
                                                                             <option  ng-value="1">1</option>
                                                                            <option ng-value="2">2</option>
                                                                            <option ng-value="3">3</option>
                                                                            <option ng-value="4">4</option>
                                                                            <option ng-value="5">5</option>


                                                                        </select>   
                                                                    </div>
                                                                    <div class="col-sm-3">
                                                                        <!--  <img src="images/icon-user.png" title="No Of Passenger"> -->
                                                                        <label class="label label-primary"><i class="fa fa-car"></i></label>
                                                                        <select class="selectBox form-control" ng-model="selectedcar">
                                                                            <option ng-value="1">1</option>
                                                                            <option ng-value="2">2</option>
                                                                            <option ng-value="3">3</option>
                                                                            <option ng-value="4">4</option>
                                                                            <option ng-value="5">5</option>
                                                                            <option ng-value="6">6</option>
                                                                            <option ng-value="7">7</option>
                                                                            <option ng-value="8">8</option>
                                                                            <option ng-value="9">9</option>
                                                                            <option ng-value="10">10</option>


                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div class="col-sm-12 col-md-4 col-xl-4">
                                                                <label class="label label-primary"><i class="fa fa-car"></i></label>
                                                                <select class="form-control VehicleType"  
                                                                      ng-model="selectedcartype" id="VehicleType">
 
                                                                    <option ng-repeat=" (key  , carr )  in carlist" ng-value="{{key}}">{{carr}}</option>    
                                                                </select>
                                                               
                                                            </div>
                                                        </div>
                                                        <div class="col-sm-12 col-md-12 col-xs-12 col-xl-12">
                                                            <div class="row">
                                                                <div class="col-sm-12 col-md-6 col-xl-6" style="padding:0px;">
                                                                    <label class="label label-primary"><i class="fa fa-users">Select Driver</i></label>
                                                                    <select class="form-control ddlDriver required"  id="ddlDriver" ng-model="selecteddriver" ng-change="getddlvehicle()">
                                                                    <option ng-value="0" data-foo="0"  data-zoneq="0" selected="selected">Automatic</option>
                                                                    <option ng-value="-1" data-foo="0"  data-zoneq="0">No One</option>
                                                                         
                                                                   <option ng-repeat ="driz in LoginDriverdata" data-zoneq="{{driz.zonequeue}}"   data-foo="{{driz.VehicleId}}" ng-value="{{driz.Id}}">  {{driz.UserFName}} / {{driz.VehicleNo }} </option>

                                                                 <option ng-repeat ="driwqq in driverdatarealx" ng-show="{{checkofferjob(driwqq.driverid)}}" ng-if="driwqq.vehiclestatus == 'Available'  &&   true == checkjobvehile1(driwqq.vehicletype )" data-zoneq="{{driwqq.zonequeue}}"   data-foo="{{driwqq.VehicleId}}" ng-value="{{driwqq.driverid}}">{{driwqq.vehiclenumber }}  {{driwqq.vehicletype}} </option>
                                                                </select> 
                                                                </div>
                                                               <div class="col-sm-12 col-md-6 col-xl-6" >
											 			        <label class="label label-primary" ><i class="fa fa-car"></i></label>
											 			        <select class="form-control ddlVehicleType required" id="ddlVehicleType"><option value="0" selected="selected">Automatic</option></select>
											 			        </div>  
                                                            </div>
                                                        </div>
                                                    </div>
                                              </div> 
                                            </li>


                                        </ul>

                                        <div class="row col-sm-12">
                                                  <p class="label label-primary"  ng-show="bookingtime_select == 1 && updatex == 0"  >  <input name="repeat" type="checkbox" ng-show="bookingtime_select == 1"  ng-model="showdays" />Repeat</p></br>
                                                 <div id="DivRepeatList" class=" row col-sm-12"  ng-show="showdays" > 
                                                 <div class="col-lg-6 col-md-12 col-sm-12 col-xs-12"> 
                                                 <div class="col-lg-8 col-md-12 col-sm-12 col-xs-12"> 
                                                    <span class="label label-primary">until:</span> 
                                                  </div> 
                                                  <div class="col-sm-12 col-xs-12"> 
                                                  <input type="date" id="MultipleDate" ng-model="datetimesecond" /> 
                                                  </div> 
                                                      <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12"> 
                                                 <span class="label label-primary">Weeks:</span> 
                                                  </div> 
                                                  <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12"> 
                                                 <select name="recur_weeks" ng-model="weekselect" ng-change="changeweekday()"> 
                                                 <option ng-value="0">All</option> 
                                                 <option ng-value="1">Odd</option> 
                                                 <option ng-value="2">Even</option> 
                                                  </select> 
                                                </div> 
                                                 </div> 
                                                 <div class="col-lg-6 col-md-12 col-sm-12 col-xs-12"> 
                                                 <table id="tblDays"> 
                                                <tbody> 
                                                <tr> 
                                                 <td><input name="mon" ng-value="0" ng-model="mon"  type="checkbox">Monday</td></tr> 
                                                 <td><input name="tue" ng-value="1" ng-model="tue"   type="checkbox">Tuesday</td></tr> 
                                                 <td><input name="wed" ng-value="2" ng-model="wed"  type="checkbox">Wednesday</td></tr> 
                                                 <td><input name="thu" ng-value="3" ng-model="thu"  type="checkbox">Thursday</td></tr> 
                                                 <td><input name="fri" ng-value="4" ng-model="fri"  type="checkbox">Friday</td></tr> 
                                                 <td><input name="sat" ng-value="5" ng-model="sat"  type="checkbox">Saturday</td></tr> 
                                                 <td><input name="sun" ng-value="6" ng-model="sun"  type="checkbox">Sunday</td></tr> 

                                                </tbody> 
                                                 </table> 
                                                 </div> 
                                             </div> 
                                             
                                            <button class="btn btn-success" ng-show="updatex == 0" ng-click="bookingridebefore();" >Book
                                            </button>
                                             
                                            <button class="btn btn-warning" ng-show="updatex == 0 && AmmountAddedvalue != ''" ng-click="carbooking();" >Card Booking
                                            </button>
                                            
                                            <button class="btn btn-danger" ng-show="updatex == 1" ng-click="updateride(selecteddriverpre ,vehicleidpre);" >Update
                                            </button>
                                            
                                            <button class="btn btn-danger" ng-show="updatex == 2" ng-click="updateride2(selecteddriverpre , vehicleidpre);" >Update
                                            </button>
                                            
                                            <button class="btn btn-danger"  ng-show="updatex == 0"  ng-click="clearsection();" style="position: absolute;
    right: 0;
    margin: 0;" >Clear
                                             <button class="btn btn-danger"   ng-show="updatex == 1 || updatex == 2 "  ng-click="clearsectionuupdate();" style="position: absolute;
    right: 0;
    margin: 0;" >Clear

                                                 </button>
                                                 <input type="hidden" id="updatecancel" ng-modal="updatex" ng-value="updatex" />
                                            <button class="btn btn-success" ng-show="updatex > 0" ng-click="copything();" >Copy
                                            </button>

                                            <label ng-if="AmmountAddedvaluesend != ''" class="label label-success" style="float: right;
                                            padding: 10px 10px;
                                            margin: 1px; background-color: #6b6092;"> {{AmmountAddedvaluesend}} Paid  </label>
                                       
                                         </div>

                                    </div>
                                    <!-- modal-body -->

                                </div>
                            </div>
                            <!-- modal-dialog -->
                        </div>
                        <!-- modal -->
                    </div>
                </div>
            </div>

            <!-- contentarea -->
            <div class="app-content">



                <div class="col-sm-12 col-md-12 col-lg-12 col-xs-12 row">
                    <div class="col-sm-12 col-md-6 col-lg-6 col-xs-12">
                        <div class="col-sm-12 col-md-12  col-xl-12">
                            <div class="card" style="height: calc(100vh - 300px);">
                                <div class="card-header">
                                    <div class=" tab-menu-heading" style="width:100%;     background: #ffa500b0; ">
                                        <div class="tabs-menu1 ">
                                            <!-- Tabs -->
                                            <ul class="nav panel-tabs">
                                                <li class="" ng-click="getjobs(0)"><a href="#tab5" class="active show" data-toggle="tab">U-A<span>({{UnAssignedCount}})</span></a></li>
                                               <li class="" ng-click="getjobs(0)"><a href="#tab9" class=" " data-toggle="tab">Offer<span>({{UnAssignedCountoffer}})</span></a></li>

                                                 <li ng-click="AssignedJobs(0)"><a ng-click="AssignedJobs()" href="#tab6" data-toggle="tab" class="">Assign<span ng-click="AssignedJobs()">({{AssignedCount}})</span></a></li>
                                                <li><a ng-click="ActiveJobsdata(0)" href="#tab7" data-toggle="tab" class="">Active <span>({{ActiveCount}})</span></a></li>
                                               <li><a href="#tab8"  ng-click="GetJobsdelivery()" data-toggle="tab" id="deliv" class=" "    >DY<span>({{deliverycount}})</span> </a></li> 
                                            </ul>
                                        </div>
                                    </div>
                                     
                                </div>
                                <style>
                                    ul.nav.panel-tabs li {
                                        padding: 12px;
                                        margin: -20px;
                                    }

                                    .bottomspave {
                                        margin-bottom: 13px;
                                        border-radius: 1px;
                                    }
                                </style>
                                <div class="card-body" style="overflow: scroll;">
                                    <div class="panel panel-primary">

                                        <div class=" nopad panel-body tabs-menu-body">
                                            <div class="tab-content">
                                                <div class="tab-pane active show" id="tab5">
                                                    <!-- startdiv -->
                                                    <div id="Divo{{value.Id}}" ng-if="value.BookingStatus!='Offered'"   ng-style="{ background: getTheValue(value.BookingDateTime)  }" style="margin-bottom: 13px;" class="nopad bottomspave col-sm-12 col-md-12 col-xl-12  {{ alerting(value.DispatchTimebefore, value.BookingDateTime) }}" id="singlediv" ng-repeat="(key ,  value) in  unassignedjob_list">
                                                         
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" ">
                                                            <div class="nopad row col-sm-12  col-md-12 col-xl-12" style="margin: -8px 1px;">

                                                                <span   class="label label-pill label-primary mt-2"><i style="color: black;" class="glyphicon glyphicon-tag"></i>

                                                                    {{value.Id}}
                                                                </span>

                                                                 <span class="label label-pill label-primary mt-2"> {{  datecreate(value.Pickingtime) }} 
                                                                </span>
                                                               
                                                                <div ng-if="value.Passengers > 4" style="padding: 6px;">
                                                                    <span class="label label-pill label-danger mt-2">V.Job</span>
                                                                </div>
                                                                <div ng-if="value.Passengers < 4" style="padding: 6px;">
                                                                    <span ng-if="value.VehicleType == 'Not Specified'" class="label label-pill label-primary mt-2">Any Vehicle
                                                                    </span>
                                                                    <span ng-if="value.VehicleType != 'Not Specified'" class="label label-pill label-primary mt-2">{{value.VehicleType}}
                                                                    </span>

                                                                </div>
                                                                <span  ng-if="value.WheelChairs > 0" class="label label-pill label-danger mt-2">Wheel Chair</span>

                                                                <div  ng-if="value.EntitiesDetails" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 100px; white-space: nowrap; overflow: hidden;">
                                                                    <span><i style="color: black;" title="{{value.EntitiesDetails}}" class="glyphicon glyphicon-info-sign"></i>
                                                                        {{value.EntitiesDetails}}
                                                                    </span>
                                                                </div>


                                                                <span ng-if="value.PhoneNo" class="label label-pill label-primary mt-2"><i class="fa fa-phone"></i>
                                                                    {{value.PhoneNo}}
                                                                </span>
                                                                <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="position: absolute; left:-25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(value.Id,value.PickLatLng)" ng-mouseleave="markerremove1(value.Id,value.PickLatLng )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng !=  '0,0' && value.Nextstop != 0" ng-mouseover="showmakert3(value.Id,value.PickAddress,value.DropAddress,value.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                
                                                                  <span class="label label-pill label-danger mt-2"  ng-if="value.usertype == 1" ><i class="fa fa-user">Senior</i></span> 
                                                                  <span class="label label-pill label-danger mt-2" ng-if="value.usertype == 2" > <i  class="fa fa-user">Disable</i></span> 
                                                                  
                                                                <div ng-if="value.useremail != null">
                                                                    {{playAudio()}}{{checkconter(value.Id , value.Id ,value.useremail ) }}
                                                                  <span  ng-show="value.webstatus == 0  "  class="btn btn-success" style="padding: 0px 4px;  font-size: 13px;" ng-click="sendemail(  1  ,  value.useremail  ,  value.Id  ,value.JobMins ,   value.Id )" title="Accept"><i class="fa fa-thumbs-up"></i> </span>
                                                                    <span ng-show="value.webstatus == 0 " id="close'+$res["dt1"][$i].Id+'" style="padding: 0px 4px;" class="btn btn-warning" ng-click="sendemail(   0  , value.useremail   , value.Id  ,value.JobMins )" title="Reject" > <i class="fa fa-thumbs-down"></i>  </span> 
                                                                    <img ng-if="value.useremail != ''" style="width:20px;  float: right; padding: 2px; " src="img/alert.gif" style="width:25px;"  /> 
                                                                    <span ng-show="value.webstatus != 0  "  class="label label-pill label-primary mt-2" >Accepted</span>
 
                                                                </div>
                                                                
                                                                <div id="spxa{{value.Id}}" style="position: absolute; right:  0px; top:7px;  z-index:1;">
                                                                 <select  id="spx{{value.Id}}" class="form-control"      onclick="showwxx()" style="width: 100px; height:30px; font-size:14px;">
                                                                    <option value="0"  ng-selected="0 == checkvalue('spx' , value.Id,'spxa')" data-zoneq="0"  data-doo="0">No One </option>
                                                                     <option value="0" ng-selected="0 == checkvalue('spx' , value.Id,'0')" data-zoneq="0"  data-doo="0">Select Driver</option>

                                                                    <option ng-repeat="drivi in driverdatarealx" ng-show="{{checkofferjob(drivi.driverid)}}" ng-if="drivi.vehiclestatus == 'Available' && true == checkjobvehile(value.VehicleType, drivi.vehicletype)"  ng-selected="drivi.driverid ==  checkvalue('spx' , value.Id,'0')" value="{{drivi.driverid}}" data-zoneq="{{drivi.zonequeue}}"  data-doo="{{drivi.VehicleId}}"> {{drivi.vehiclenumber}}/{{drivi.vehicletype}}  </option>
                                                                </select>
 
                                                                 
                                                                </div><span class=" label label-pill label-success mt-2" style="position: absolute; top:0px; right: -25px; display: {{asssigned(value.DispatchTimebefore, value.BookingDateTime)}}" ng-click="AssignPendingJobFromJobList(value.Id,value.VehicleId,value.DriverId,value.U_id,value.BookingStatus,'spx')">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>

                                                                
                                                             </div>
                                                        </div>
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                             >
                                                           
                                                            <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                 <div   style="position:absolute; left : -25px;" class="label label-pill label-primary mt-2"  >
                                                                    <i class=" fa fa-eye"   aria-hidden="true" style="color:red; font-size:16px;" ng-click="showdiv(value.Id)" ></i>
                                                                </div>
                                                                <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: green;"></i>
                                                                        {{value.PickAddress}}
								 								
                                                                    </span>
                                                                </div>
                                                                <div  ng-if="value.DropAddress" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: red;"></i>
                                                                        {{value.DropAddress}}
								 								
                                                                    </span>
                                                                </div>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="fa fa-users "></i>{{value.passengername}}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2" id="Divoo{{value.Id}}" style="background:red!important; color:white!important;">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag" style="color:white!important;"></i>
                                                                    {{value.BookingStatus}} {{value.CallSign}} {{value.VehicleNo}}
								 							 
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                    <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-if="value.Nextstop > 0">M-Stops </span>
                                                            </div>
                                                        </div>
                                                        <div class="nopad  col-sm-12 col-md-12 col-xl-12 row" style="display:{{checkdata(value.Id)}}" id="datassun{{value.Id}}">
                                                           <div class="row col-12">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                    <li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                            {{value.Passengers}}                                  
                                                                        </span>
                                                                    </li>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                        {{value.Bags}}</span>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                        {{value.WheelChairs}}
                                                                    </span>
                            
                                                                </ul>
                                                            </div>
                                                            <div class="row nopad col-sm-9  col-md-9 col-xl-9">
 

                                                                <span class="label label-pill label-primary mt-2" style="background: {{latealert(value.DispatchTimebefore, value.BookingDateTime )}}"><i style="color: black;" class="fa fa-hourglass-half"></i>

                                                                    {{ checklateornow(value.JobMins , value.DispatchTimebefore) }}
                                                                </span>
                                                                 <span class="label label-pill label-warning mt-2" ng-click="EditJobunassignedng(value.Id,value.JobMins)">
                                                                    <i class="  glyphicon glyphicon-edit "></i>
                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)">
                                                                    <i class="  glyphicon glyphicon-trash "></i>
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  fa fa-headphones "></i>{{value.DispatcherName}}
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  glyphicon glyphicon-tag "></i>{{value.BookingSource}}
                                                                </span>
                                                            </div>
                                                           </div>
                                                        </div>
                                                    </div>

                                                    <!-- enddiv -->
                                                </div>
                                                <div class="tab-pane vowali " id="tab9">
                                                    <!-- startdiv -->
                                                    <div id="Divo{{value.Id}}" ng-style="{ background: getTheValue(value.BookingDateTime)  }" style="margin-bottom: 13px;" class="nopad bottomspave col-sm-12 col-md-12 col-xl-12  {{ alerting(value.DispatchTimebefore, value.BookingDateTime) }}" id="singlediv" ng-repeat="(key ,  value) in  oferunassignedjob_list">
                                                         
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" ">
                                                            <div class="nopad row col-sm-12  col-md-12 col-xl-12" style="margin: -8px 1px;">

                                                                <span   class="label label-pill label-primary mt-2"><i style="color: black;" class="glyphicon glyphicon-tag"></i>

                                                                    {{value.Id}}
                                                                </span>

                                                                 <span class="label label-pill label-primary mt-2"> {{  datecreate(value.Pickingtime) }} 
                                                                </span>
                                                               
                                                                <div ng-if="value.Passengers > 4" style="padding: 6px;">
                                                                    <span class="label label-pill label-danger mt-2">V.Job</span>
                                                                </div>
                                                                <div ng-if="value.Passengers < 4" style="padding: 6px;">
                                                                    <span ng-if="value.VehicleType == 'Not Specified'" class="label label-pill label-primary mt-2">Any Vehicle
                                                                    </span>
                                                                    <span ng-if="value.VehicleType != 'Not Specified'" class="label label-pill label-primary mt-2">{{value.VehicleType}}
                                                                    </span>

                                                                </div>
                                                                <span  ng-if="value.WheelChairs > 0" class="label label-pill label-danger mt-2">Wheel Chair</span>

                                                                <div  ng-if="value.EntitiesDetails" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 100px; white-space: nowrap; overflow: hidden;">
                                                                    <span><i style="color: black;" title="{{value.EntitiesDetails}}" class="glyphicon glyphicon-info-sign"></i>
                                                                        {{value.EntitiesDetails}}
                                                                    </span>
                                                                </div>


                                                                <span ng-if="value.PhoneNo" class="label label-pill label-primary mt-2"><i class="fa fa-phone"></i>
                                                                    {{value.PhoneNo}}
                                                                </span>
                                                                <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="position: absolute; left:-25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(value.Id,value.PickLatLng)" ng-mouseleave="markerremove1(value.Id,value.PickLatLng )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng !=  '0,0' && value.Nextstop != 0" ng-mouseover="showmakert3(value.Id,value.PickAddress,value.DropAddress,value.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; left: -25px; color: #f5002d; font-size: 27px;"></i>
                                                                
                                                                  <span class="label label-pill label-danger mt-2"  ng-if="value.usertype == 1" ><i class="fa fa-user">Senior</i></span> 
                                                                  <span class="label label-pill label-danger mt-2" ng-if="value.usertype == 2" > <i  class="fa fa-user">Disable</i></span> 
                                                                  
                                                                <div ng-if="value.useremail != null">
                                                                    {{playAudio()}}{{checkconter(value.Id , value.Id ,value.useremail ) }}
                                                                  <span  ng-show="value.webstatus == 0  "  class="btn btn-success" style="padding: 0px 4px;  font-size: 13px;" ng-click="sendemail(  1  ,  value.useremail  ,  value.Id  ,value.JobMins ,   value.Id )" title="Accept"><i class="fa fa-thumbs-up"></i> </span>
                                                                    <span ng-show="value.webstatus == 0 " id="close'+$res["dt1"][$i].Id+'" style="padding: 0px 4px;" class="btn btn-warning" ng-click="sendemail(   0  , value.useremail   , value.Id  ,value.JobMins )" title="Reject" > <i class="fa fa-thumbs-down"></i>  </span> 
                                                                    <img ng-if="value.useremail != ''" style="width:20px;  float: right; padding: 2px; " src="img/alert.gif" style="width:25px;"  /> 
                                                                    <span ng-show="value.webstatus != 0  "  class="label label-pill label-primary mt-2" >Accepted</span>
 
                                                                </div>
                                                                
                                                                <div id="spxa{{value.Id}}" style="position: absolute; right:  0px;">
                                                                 <select id="spx{{value.Id}}" class="form-control"      onclick="showwxx()" style="width: 100px; height:30px; font-size:14px;">
                                                                    <option value="0"  ng-selected="0 == checkvalue('spx' , value.Id,'spxa')" data-zoneq="0"  data-doo="0">No One </option>
                                                                     <option value="0" ng-selected="0 == checkvalue('spx' , value.Id,'0')" data-zoneq="0"  data-doo="0" >Select Driver</option>
                                                                      
                                                                    <option ng-repeat="drivia in driverdatarealx  " ng-show="{{checkofferjob(drivia.driverid)}}"  ng-if="drivia.vehiclestatus == 'Available'  && true == checkjobvehile(value.VehicleType, drivia.vehicletype)" ng-selected="drivia.driverid ==  checkvalue('spx' , value.Id,'0')" value="{{drivia.driverid}}" data-zoneq="{{drivia.zonequeue}}"  data-doo="{{drivia.VehicleId}}">  {{drivia.vehiclenumber}}/{{drivia.vehicletype}}  </option>
                                                                </select>


                                                                
                                                                </div><span class=" label label-pill label-success mt-2" style="position: absolute; top:0px; right: -25px; display: {{asssigned(value.DispatchTimebefore, value.BookingDateTime)}}" ng-click="AssignPendingJobFromJobList(value.Id,value.VehicleId,value.DriverId,value.U_id,value.BookingStatus,'spx')">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>

                                                                
                                                             </div>
                                                        </div>
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                             >
                                                           
                                                            <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                 <div   style="position:absolute; left : -25px;" class="label label-pill label-primary mt-2"  >
                                                                    <i class=" fa fa-eye"   aria-hidden="true" style="color:red; font-size:16px;" ng-click="showdiv(value.Id)" ></i>
                                                                </div>
                                                                <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: green;"></i>
                                                                        {{value.PickAddress}}
								 								
                                                                    </span>
                                                                </div>
                                                                <div  ng-if="value.DropAddress" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: red;"></i>
                                                                        {{value.DropAddress}}
								 								
                                                                    </span>
                                                                </div>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="fa fa-users "></i>{{value.Name}}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2" id="Divoo{{value.Id}}" style="background:red!important; color:white!important;">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag" style="color:white!important;"></i>
                                                                    {{value.BookingStatus}} {{value.CallSign}} {{value.VehicleNo}}
								 							 
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                    <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-if="value.Nextstop > 0">M-Stops </span>
                                                            </div>
                                                        </div>
                                                        <div class="nopad  col-sm-12 col-md-12 col-xl-12 row" style="display:{{checkdata(value.Id)}}" id="datassun{{value.Id}}">
                                                           <div class="row col-12">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                    <li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                            {{value.Passengers}}                                  
                                                                        </span>
                                                                    </li>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                        {{value.Bags}}</span>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                        {{value.WheelChairs}}
                                                                    </span>
                            
                                                                </ul>
                                                            </div>
                                                            <div class="row nopad col-sm-9  col-md-9 col-xl-9">
 

                                                                <span class="label label-pill label-primary mt-2" style="background: {{latealert(value.DispatchTimebefore, value.BookingDateTime )}}"><i style="color: black;" class="fa fa-hourglass-half"></i>

                                                                    {{ checklateornow(value.JobMins , value.DispatchTimebefore) }}
                                                                </span>
                                                                 <span class="label label-pill label-warning mt-2" ng-click="EditJobunassignedng(value.Id,value.JobMins)">
                                                                    <i class="  glyphicon glyphicon-edit "></i>
                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)">
                                                                    <i class="  glyphicon glyphicon-trash "></i>
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  fa fa-headphones "></i>{{value.DispatcherName}}
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  glyphicon glyphicon-tag "></i>{{value.BookingSource}}
                                                                </span>
                                                                 <span class="label label-pill label-primary mt-2">
                                                                    <i class="fa fa-clock-o" id="timer{{value.id}}"></i>{{value.BookingSource}}
                                                                </span>
                                                            </div>
                                                           </div>
                                                        </div>
                                                    </div>

                                                    <!-- enddiv -->
                                                </div>
                                                <div class="tab-pane" id="tab6">
                                                    

                                                    <div class="nopad   col-sm-12 col-md-12 col-xl-12" style="background: rgba(95, 158, 160, 0.19); box-shadow: 1px 1px 1px 1px #00800070; border-radius: 6px;"
                                                        ng-repeat="(key  , avalue ) in  assignedjob_list">
                                                        <div class=" row nopad    col-sm-12 col-md-12 col-xl-12" data-toggle="collapse" data-target="#datassass{{key}}">
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-tag"></i>
                                                                {{avalue.Id}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.BookingDateTime}}                                                    </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-users "></i>
                                                                {{avalue.passengername}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-phone"></i>
                                                                {{avalue.PhoneNo}}</span>
                                                          
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.drivername}} {{avalue.VehicleNo}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{avalue.TarriffType}}
                                                            </span>
                                                             <i ng-if="avalue.DropLatLng != '0,0'" ng-mouseover="showmakert(avalue.Id,avalue.PickLatLng,avalue.DropLatLng)" ng-mouseleave="markerremove(avalue.Id,avalue.PickLatLng,avalue.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="avalue.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(avalue.Id,avalue.PickLatLng)" ng-mouseleave="markerremove1(avalue.Id,avalue.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="avalue.DropLatLng !=  '0,0' && avalue.Nextstop != 0" ng-mouseover="showmakert3(avalue.Id,avalue.PickAddress,avalue.DropAddress,avalue.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>

                                                        </div>
                                                        <div class="nopad   col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                                data-toggle="collapse" data-target="#datassass{{key}}">
                                                                <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: green;"></i>
                                                                            {{avalue.PickAddress}} 
								 								
                                                                        </span>
                                                                    </div>
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: red;"></i>
                                                                            {{avalue.DropAddress}}
								 								
                                                                        </span>
                                                                    </div>


                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        {{avalue.BookingStatus}} {{avalue.CallSign}} {{avalue.VehicleNo}}
								 							 
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                    </span>
                                                                    <span class="label label-pill label-danger mt-2">{{avalue.BookingSource}} </span>

                                                                </div>
                                                            </div>

                                                        </div>
                                                        <div class="nopad bottomspave col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="datassass{{key}}">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                    <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                        <li>
                                                                            <span style="padding: 0px 2px;">
                                                                                <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                                {{avalue.Passengers}}                                  
                                                                            </span>
                                                                        </li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                            {{avalue.Bags}}</span>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                            {{avalue.WheelChairs}}
                                                                        </span>
                                                             
                                                                    </ul>
                                                                </div>
                                                                <div class="row nopad col-sm-9  col-md-9 col-xl-9">
                                                                   

                                                                    <select id="sxq{{avalue.Id}}" class="form-control JobsListVehicles" style="width: 160px;">
                                                                        <option value="0" data-zoneq="0" >Select Driver</option>
                                                                         <option value="0" data-zoneq="0" >No One</option>
                                                                       <option ng-repeat="drivi in driverdatarealx  " ng-show="{{checkofferjob(drivi.driverid)}}" ng-if="drivi.vehiclestatus == 'Available'  && true == checkjobvehile(avalue.VehicleType, drivi.vehicletype)"   value="{{drivi.driverid}}" data-zoneq="{{drivi.zonequeue}}"  data-doo="{{drivi.VehicleId}}"> {{drivi.vehiclenumber}}/{{drivi.vehicletype}}  </option>

                                                                         
                                                                    </select>

                                                                 
                                                                    <span class=" label label-pill label-success mt-2" ng-click="AssignJobFromJobList(avalue.Id,avalue.VehicleId,avalue.DriverId,avalue.U_id, avalue.quenumber, 'sxq')">
                                                                        <i style="color: black" class="fa fa-paper-plane"></i>
                                                                    </span>

                                                                    <span class="label label-pill label-warning mt-2" ng-click="EditJob(avalue.Id , avalue.quenumber)">
                                                                        <i class="  glyphicon glyphicon-edit "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-danger mt-2" ng-click="CancelJob(avalue.Id,avalue.U_id , avalue.ZoneId , avalue.quenumber)">
                                                                        <i class="  glyphicon glyphicon-trash "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  fa fa-headphones "></i>{{avalue.DispatcherName}}
                                                                    </span>

                                                                    
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                    
                                                </div>
                                                <div class="tab-pane" id="tab7">
                                                    

                                                    <div style="background: #ce184a3d; box-shadow: 1px 1px 1px 1px #00800070; border-radius: 6px;"
                                                        class="nopad   col-sm-12 col-md-12 col-xl-12" ng-repeat="(key , acvalue) in ActiveJob">
                                                        <div class=" row nopad    col-sm-12 col-md-12 col-xl-12" data-toggle="collapse" data-target="#dataactive{{key}}">
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-tag"></i>
                                                                {{acvalue.Id}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.BookingDateTime}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-users "></i>
                                                                {{acvalue.passengername}}</span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="fa fa-phone"></i>
                                                                {{acvalue.PhoneNo}}</span>

                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.drivername}} {{acvalue.VehicleNo}}
                                                            </span>
                                                            <span class="label label-pill label-primary mt-2">
                                                                <i class="glyphicon glyphicon-time"></i>
                                                                {{acvalue.TarriffType}}
                                                            </span>
                                                            <i ng-if="acvalue.DropLatLng != '0,0'" ng-mouseover="showmakert(acvalue.Id,acvalue.PickLatLng,acvalue.DropLatLng)" ng-mouseleave="markerremove(acvalue.Id,acvalue.PickLatLng,acvalue.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="acvalue.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(acvalue.Id,acvalue.PickLatLng)" ng-mouseleave="markerremove1(acvalue.Id,acvalue.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="acvalue.DropLatLng !=  '0,0' && acvalue.Nextstop != 0" ng-mouseover="showmakert3(acvalue.Id,acvalue.PickAddress,acvalue.DropAddress,acvalue.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>

                                                        </div>
                                                        <div class="nopad   col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                                data-toggle="collapse" data-target="#dataactive{{key}}">
                                                                <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: green;"></i>
                                                                            {{acvalue.PickAddress}}
								 								
                                                                        </span>
                                                                    </div>
                                                                    <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                        <span>
                                                                            <i class="fa fa-circle" style="color: red;"></i>
                                                                            {{acvalue.DropAddress}}
								 								
                                                                        </span>
                                                                    </div>

                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="fa fa-users "></i>{{acvalue.passengername}}
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                        {{acvalue.BookingStatus}} {{acvalue.CallSign}} {{acvalue.VehicleNo}}
								 							 
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                       <span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id ">Account</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                    </span>

                                                                </div>
                                                            </div>

                                                        </div>
                                                        <div class="nopad bottomspave col-sm-12 col-md-12 col-xl-12">
                                                            <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="dataactive{{key}}">
                                                                <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                    <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                        <li>
                                                                            <span style="padding: 0px 2px;">
                                                                                <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                                {{acvalue.Passengers}}                                  
                                                                            </span>
                                                                        </li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                            {{acvalue.Bags}}</span>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                            {{acvalue.WheelChairs}}
                                                                        </span>
                                                                     
                                                                    </ul>
                                                                </div>
                                                                <div class="row nopad col-sm-9  col-md-9 col-xl-9">

                                                                    <span class="label label-pill label-danger mt-2"
                                                                        ng-click="cancelactivejob(acvalue.Id )">
                                                                        <i class="  glyphicon glyphicon-trash "></i>
                                                                    </span>
                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  fa fa-headphones "></i>{{acvalue.DispatcherName}}
                                                                    </span>

                                                                    <span class="label label-pill label-primary mt-2">
                                                                        <i class="  glyphicon glyphicon-tag "></i>{{acvalue.BookingSource}}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                    
                                                </div>
                                                <div class="tab-pane " id="tab8">
                                                          <div id="Divo{{value.Id}}" ng-style="{ background: asssignedcolor(value.BookingStatus)  }" style="margin-bottom: 13px;" class="nopad bottomspave col-sm-12 col-md-12 col-xl-12  {{ alerting(value.DispatchTimebefore, value.BookingDateTime) }}" id="singlediv" ng-repeat="(key ,  value) in  deliveryjobs">
                                                           
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" data-toggle="collapse" data-target="#datass{{key}}">
                                                            <div class="nopad row col-sm-12  col-md-12 col-xl-12" style="margin: -8px 1px;">

                                                                <span   class="label label-pill label-primary mt-2"><i style="color: black;" class="glyphicon glyphicon-tag"></i>

                                                                    {{value.Id}}  
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2" style="background: {{latealert(value.DispatchTimebefore, value.BookingDateTime )}}"><i style="color: black;" class="fa fa-hourglass-half"></i>

                                                                    {{ checklateornow(value.JobMins , value.DispatchTimebefore) }}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2"> {{  datecreate(value.Pickingtime) }} 
                                                                </span>
                                                                <div ng-if="value.Passengers > 4" style="padding: 6px;">
                                                                    <span class="label label-pill label-danger mt-2">V.Job</span>
                                                                </div>
                                                                <div ng-if="value.Passengers < 4" style="padding: 6px;">
                                                                    <span ng-if="value.VehicleType == 'Not Specified'" class="label label-pill label-primary mt-2">Any Vehicle
                                                                    </span>
                                                                    <span ng-if="value.VehicleType != 'Not Specified'" class="label label-pill label-primary mt-2">{{value.VehicleType}}
                                                                    </span>

                                                                </div>
                                                                <span  ng-if="value.WheelChairs > 0" class="label label-pill label-danger mt-2">Wheel Chair</span>

                                                                <div  ng-if="value.EntitiesDetails" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 100px; white-space: nowrap; overflow: hidden;">
                                                                    <span><i style="color: black;" title="Dispatched Time" class="glyphicon glyphicon-info-sign"></i>
                                                                        {{value.EntitiesDetails}}
                                                                    </span>
                                                                </div>


                                                                <span ng-if="value.PhoneNo" class="label label-pill label-primary mt-2"><i class="fa fa-phone"></i>
                                                                    {{value.PhoneNo}}
                                                                </span>
                                                                <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng ==  '0,0'" ng-mouseover="showmakert1(value.Id,value.PickLatLng)" ng-mouseleave="markerremove1(value.Id,value.PickLatLng )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                                <i ng-if="value.DropLatLng !=  '0,0' && value.Nextstop != 0" ng-mouseover="showmakert3(value.Id,value.PickAddress,value.DropAddress,value.nextstopdata)" ng-mouseleave="markerremove3( )" class="fa fa-compass" style="position: absolute; right: 10px; color: #f5002d; font-size: 27px;"></i>
                                                            </div>
                                                        </div>
                                                        <div class="nopad col-sm-12 col-md-12 col-xl-12 row" style="margin-top: -7px; margin-bottom: -7px;"
                                                            data-toggle="collapse" data-target="#datass{{key}}">
                                                            <div class="row nopad col-sm-12 col-md-12 col-xl-12">
                                                                <div class="label label-pill label-primary mt-2" style="overflow: hidden; width: 30%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: green;"></i>
                                                                        {{value.PickAddress}}
								 								
                                                                    </span>
                                                                </div>
                                                                <div  ng-if="value.DropAddress" class="label label-pill label-primary mt-2" style="overflow: hidden; width: 25%; white-space: nowrap; overflow: hidden;">
                                                                    <span>
                                                                        <i class="fa fa-circle" style="color: red;"></i>
                                                                        {{value.DropAddress}}
								 								
                                                                    </span>
                                                                </div>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="fa fa-users "></i>{{value.passengername}}
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2" id="Divoo{{value.Id}}">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                    {{value.BookingStatus}} {{value.CallSign}} {{value.VehicleNo}}
								 							 
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i style="color: black" class="glyphicon glyphicon-tag"></i>
                                                                   
                                                                    <span ng-if="value.Recieve_payment  ">Paid</span>

                                                                </span>
                                                                <span class="label label-pill label-danger mt-2" ng-if="value.Nextstop > 0">M-Stops </span>
                                                            </div>
                                                        </div>
                                                        <div class="nopad collapse  col-sm-12 col-md-12 col-xl-12 row" id="datass{{key}}">
                                                            <div class="row nopad col-sm-4  col-md-2 col-xl-3">
                                                                <ul style="padding: 0px; margin: 0px; list-style: none; display: inline-flex;">
                                                                    <li>
                                                                        <span style="padding: 0px 2px;">
                                                                            <i class="fa fa-users" title="No of Passenger" style="padding: 1px;"></i>
                                                                            {{value.Passengers}}                                  
                                                                        </span>
                                                                    </li>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-shopping-bag" title="No of Bag" style="padding: 1px;"></i>
                                                                        {{value.Bags}}</span>
                                                                    <span style="padding: 0px 2px;">
                                                                        <i class="fa fa-wheelchair" title="No of Wheelchair" style="padding: 1px;"></i>
                                                                        {{value.WheelChairs}}
                                                                    </span>
                            
                                                                </ul>
                                                            </div>
                                                            <div class="row nopad col-sm-9  col-md-9 col-xl-9">
                                                              

                                                                <select id="sax{{value.Id}}" class="form-control UnAssignJobsList2" style="width: 160px;">
                                                                    <option value="0"  >Select Driver</option>
                                                                    <option value="0"  >No One</option>
                                                                    <option ng-repeat="drivi in driverlistx" value="{{drivi.Id}}">   {{drivi.VehicleNo}} {{"/" +  drivi.VehicleName}}  </option>
                                                                </select>

                                                             
                                                                <span class=" label label-pill label-success mt-2" style="display: {{asssigned11( value.BookingStatus)}}" ng-click="AssignPendingJobFromJobList2(value.Id,value.VehicleId,value.DriverId,value.U_id ,'sax' )">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>
                                                                <span class=" label label-pill label-success mt-2" style="display: {{asssigned1( value.BookingStatus)}}" ng-click="AssignJobFromJobList2(value.Id,value.VehicleId,value.DriverId,value.U_id ,'sax' )">
                                                                    <i style="color: black" class="fa fa-paper-plane"></i>
                                                                </span>
                                                                
                                                                <span class="label label-pill label-danger mt-2" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)">
                                                                    <i class="  glyphicon glyphicon-trash "></i>
                                                                </span>
                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  fa fa-headphones "></i>{{value.DispatcherName}}
                                                                </span>

                                                                <span class="label label-pill label-primary mt-2">
                                                                    <i class="  glyphicon glyphicon-tag "></i>{{value.BookingSource}}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                        
                    <div style="padding: 0px;" class="row col-sm-12 col-md-6 col-lg-6 col-xs-12">
                        <div class="col" style=" padding: 0px;">
                               <div class="container-stats-top" style="padding: 7px; background: #2d271dbf; color: #cddc39;  z-index: 1;  height: 93%;  font-weight: 600; width: 57px;">
                                    <ul class="list-inline" style="width: 10px;">
                                        <li> 
                                            <select  class="form-control" id="zoomlabel" style="color:red;"  onchange="selectmapzoom(this.value)">
                                          <option value="1">1</option>
                                          <option  value="2">2</option>
                                          <option  value="3">3</option>
                                          <option  value="4">4</option>
                                          <option  value="5">5</option>
                                          <option  value="6">6</option>
                                          <option  value="7">7</option>
                                          <option  value="8">8</option>
                                          <option  value="9">9</option>
                                          <option  value="10">10</option>
                                          <option  value="11">11</option>
                                          <option  value="12">12</option>
                                          <option  value="13" selected>13</option>
                                          <option  value="14">14</option>
                                          <option  value="15">15</option>
                                          <option  value="16">16</option>
                                          <option  value="17">17</option>
                                          <option  value="18">18</option>
                                          <option  value="19">19</option>
                                          <option  value="20">20</option>
                                          <option  value="21">21</option>
                                          <option  value="22">22</option>
                                          <option  value="23">23</option>
                                          <option  value="24">24</option>
                                         </select>
                                        </li>
                                        <li><span onclick="changerefresh()">
                                            <i class="fa fa-refresh" style="color:red;"></i></span></li>
                                               </ul>
                                            <ul class="list-inline">
                                                <li>All</li>
                                                <li class=" AllVehicles">0</li>
                                            </ul>
                                            <ul class="list-inline">
                                                <li>Free</li>
                                                <li class=" text-success" id="FreeVehicles">0</li>
                                            </ul>
                                            <ul class="list-inline">
                                                <li>Picking</li>
                                                <li class=" text-success" id="PickingVehicles">0</li>
                                            </ul>
                                            <ul class="list-inline">
                                                <li>Busy</li>
                                                <li class=" text-warning" id="BusyVehicles">0</li>
                                            </ul>
                                            <ul class="list-inline">
                                                <li>Away</li>
                                                <li class="text-danger" id="AwayVehicles">0</li>
                                            </ul>
                     
                                        </div>

                        </div>
                        <div class="col-md-11 col-lg-11" style="padding: 0px;" >
                            <div class="card" style="height: calc(100vh - 300px);">

                                <div class="card-body">
                                    <div class="map-header">
                                        <div class="container-stats-bottom" style="position: absolute;">
                                            <ul class="list-inline" style="display: inline-flex;
                                                left: -24px;
                                                top: -50px;
                                                background: #aeebfb;
                                                position: absolute;
                                                color: #f90303;
    
                                                width: 483px; 
                                                font-weight: 600;" >
                                                <li style="padding: 3px;">Cancelled:</li>
                                                <li style="padding: 3px;" id="CancelledJobs">0</li>
                                                <li style="padding: 3px;">No Show:</li>
                                                <li style="padding: 3px;" id="NoShownJobs">0</li>
                                                <li style="padding: 3px;">No Cars:</li>
                                                <li style="padding: 3px;" class="AllVehicles">0</li>
                                                <li style="padding: 3px;">Dispatched:</li>
                                                <li style="padding: 3px;" id="DispatchedJobs">0</li>
                                                <li style="padding: 3px;">Inputted:</li>
                                                <li style="padding: 3px;" id="AllJobs">0</li>
                                               
                                            </ul>
                                            
                                        </div>
                                        
                                        <div id="map" style="width: 100%; height: calc(100vh - 343px  );">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-sm-12 col-md-12 col-lg-12 col-xs-12 row">
                    <div class="col-sm-12 col-md-8 col-lg-8 col-xs-12" style="zoom: 90%; height: calc(100vh - 400px; );">
                        <div class="col-md-12 col-lg-12">

                            <div class="container">
                                  <!-- Tab panes -->
                                  <div class="tab-content">
                                    <div id="home" class="container tab-pane active"><br>
                                        <div   style="">
                                <div>
                                   
                                      <div class="table-responsive">

                                     
 
                                        <table id="example" style="width:100%;" >
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">Zone/Cabs </th>
                                                    <th class="wd-15p">Driver</th>
                                                    <th class="wd-15p">status</th>
                                                    <th class="wd-15p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>
                                               <tr ng-repeat="driverz in driverdatarealx  " ng-if="driverz.drivername"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="    font-weight: 600; background:{{showcolor(driverz.vehiclestatus)}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">
                                                         {{driverz.zonename}}/{{driverz.vehiclenumber}}/{{driverz.vehicletype}}
                                                      <i class='fa fa-circle'  ' style='float:right; color:{{timercheck(driverz.time ,driverz)}}' aria-hidden='true'>

                                                      </i>

                                                    </div>
                                                   </td>
                                                <td style="overflow: hidden; width: 60px; white-space: nowrap; overflow: hidden;">{{driverz.drivername}}</td>
                                                <td ng-if="driverz.vehiclestatus != 'manualreject'"> 
                                                    <span ng-if="driverz.vehiclestatus == 'Picking'" > Roger</span>    
                                                   
                                                    <span  ng-if="driverz.vehiclestatus != 'Picking' " >  {{driverz.vehiclestatus}}</span> 
                                                </td>
                                              
                                                <td>
                                                    <div> <span>{{ driverz.jobCount }}   </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div>     
                                                        <span ng-if="driverz.vehiclestatus != 'Available' " >{{ driverz.JobphoneNo }}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div  style=" height: 20px!important; overflow: hidden;">
                                                        <span ng-if="driverz.vehiclestatus != 'Available'  " >{{ driverz.jobpickup }}
                                                        </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div   style="height: 20px!important; overflow: hidden;">
                                                        <span  ng-if="driverz.vehiclestatus != 'Available' " >{{ driverz.jobdropoff }}
                                                        </span>
                                                    </div>
                                                </td>


                                            </tr>

                                        


                                        </table>
                                    </div>


                                </div>
                                <!-- table-wrapper -->
                            </div>
                                          </div>
                                    <div id="menu1" class="container tab-pane fade"><br>
                                         <div   style="">
                                <div>
                                    <div class="table-responsive">
                                        
                                        <table id="example111" style="width:100%;" >
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">Zone/Cabs</th>
                                                    <th class="wd-15p">Driver</th>
                                                    <th class="wd-15p">status</th>
                                                    <th class="wd-15p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>

                                             <tr ng-repeat="driverz in driverdatarealx " ng-if="driverz.vehiclestatus == 'Picking'"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="    font-weight: 600;background:{{showcolor(driverz.vehiclestatus)}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">
                                                       {{driverz.zonename}}/{{driverz.vehiclenumber}}/{{driverz.vehicletype}} 
                                                      <i class='fa fa-circle' id='online{{driverz.Id}}' style='float:right; ' aria-hidden='true'>

                                                      </i>

                                                    </div>
                                                   </td>
                                                <td style="overflow: hidden; width: 60px; white-space: nowrap; overflow: hidden;">{{driverz.drivername}}</td>
                                                <td ng-if="driverz.vehiclestatus != 'manualreject'"> 
                                                    <span ng-if="driverz.vehiclestatus == 'Picking'" > Roger</span>    
                                                   
                                                    <span  ng-if="driverz.vehiclestatus != 'Picking'   "  >  {{driverz.vehiclestatus}}</span> 
                                                </td>
                                               
                                                <td>
                                                    <div  >  <span  >{{ driverz.jobCount }}   </span>
                                                    </div>

                                                </td>
                                                   <td>
                                                    <div>     
                                                        <span >{{ driverz.JobphoneNo }}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div  style=" height: 20px!important; overflow: hidden;">
                                                        <span >{{ driverz.jobpickup }}
                                                        </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div   style="height: 20px!important; overflow: hidden;">
                                                        <span  >{{ driverz.jobdropoff }}
                                                        </span>
                                                    </div>
                                                </td>


                                            </tr>

                                        
                                        </table>
                                    </div>
                                </div>
                                <!-- table-wrapper -->
                            </div>
                            </div>
                                    <div id="menu2" class="container tab-pane fade"><br>
                                          <div   style="">
                                <div>
                                    <div class="table-responsive">
                                        
                                        <table id="example2222" style="width:100%;" >
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">Zone/Cabs</th>
                                                    <th class="wd-15p">Driver</th>
                                                    <th class="wd-15p">status</th>
                                                    <th class="wd-15p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>

                                            
                                             <tr ng-repeat="driverz in driverdatarealx " ng-if="driverz.vehiclestatus == 'Busy'"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="    font-weight: 600;background:{{showcolor(driverz.vehiclestatus)}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">
                                                        {{driverz.zonename}}/{{driverz.vehiclenumber}} /{{driverz.vehicletype}}
                                                      <i class='fa fa-circle' id='online{{driverz.Id}}' style='float:right; ' aria-hidden='true'>

                                                      </i>

                                                    </div>
                                                   </td>
                                                <td style="overflow: hidden; width: 60px; white-space: nowrap; overflow: hidden;">{{driverz.drivername}}</td>
                                                <td ng-if="driverz.vehiclestatus != 'manualreject'"> 
                                                    <span ng-if="driverz.vehiclestatus == 'Picking'" > Roger</span>    
                                                   
                                                    <span  ng-if="driverz.vehiclestatus != 'Picking'   "  >  {{driverz.vehiclestatus}}</span> 
                                                </td>
                                              
                                                <td>
                                                    <div  >  <span  >{{ driverz.jobCount }}   </span>
                                                    </div>

                                                </td>
                                             <td>
                                                    <div>     
                                                        <span >{{ driverz.JobphoneNo }}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div  style=" height: 20px!important; overflow: hidden;">
                                                        <span >{{ driverz.jobpickup }}
                                                        </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div   style="height: 20px!important; overflow: hidden;">
                                                        <span  >{{ driverz.jobdropoff }}
                                                        </span>
                                                    </div>
                                                </td>

                                            </tr>
                                       


                                        </table>
                                    </div>
                                </div>
                                <!-- table-wrapper -->
                            </div>
                          </div>
                                       <div id="menu3" class="container tab-pane fade"><br>
                                          <div   style="">
                                <div>
                                    <div class="table-responsive">
                                       
                                        <table id="example3333" style="width:100%;" >
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">Zone/Cabs</th>
                                                    <th class="wd-15p">Driver</th>
                                                    <th class="wd-15p">status</th>
                                                    <th class="wd-15p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>

                                               <tr ng-repeat="driverz in driverdatarealx  "  ng-if="driverz.vehiclestatus == 'Away'"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="    font-weight: 600;background:{{showcolor(driverz.vehiclestatus)}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">
                                                      {{driverz.zonename}}/{{driverz.vehiclenumber}} /{{driverz.vehicletype}}
                                                      <i class='fa fa-circle' id='online{{driverz.Id}}' style='float:right; ' aria-hidden='true'>

                                                      </i>

                                                    </div>
                                                   </td>
                                                <td style="overflow: hidden; width: 60px; white-space: nowrap; overflow: hidden;">{{driverz.drivername}}</td>
                                                <td ng-if="driverz.vehiclestatus != 'manualreject'"> 
                                                    <span ng-if="driverz.vehiclestatus == 'Picking'" > Roger</span>    
                                                   
                                                    <span  ng-if="driverz.vehiclestatus != 'Picking'   "   >  {{driverz.vehiclestatus}}</span> 
                                                </td>
                                                 
                                                <td>
                                                    <div  >  <span  >{{ driverz.jobCount }}   </span>
                                                    </div>

                                                </td>
                                                   <td>
                                                    <div>     
                                                        <span >{{ driverz.JobphoneNo }}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div  style=" height: 20px!important; overflow: hidden;">
                                                        <span >{{ driverz.jobpickup }}
                                                        </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div   style="height: 20px!important; overflow: hidden;">
                                                        <span  >{{ driverz.jobdropoff }}
                                                        </span>
                                                    </div>
                                                </td>

                                            </tr>
                                           


                                        </table>
                                    </div>
                                </div>
                                <!-- table-wrapper -->
                            </div>
                          </div>
                                  </div>
                                  <ul class="nav nav-tabs" role="tablist" style=" margin-left: 13px; margin-top: 6px; ">
                                    <li class=" ">
                                      <a class="  active" data-toggle="tab" href="#home">All</a>
                                    </li>
                                    <li class=" ">
                                      <a class=" " data-toggle="tab" href="#menu1">Picking</a>
                                    </li>
                                    <li   >
                                      <a  data-toggle="tab" href="#menu2">Active</a>
                                    </li>
                                      <li  >
                                      <a   data-toggle="tab" href="#menu3">Away</a>
                                    </li>
                                  </ul>

 
                                </div>
                     
                    
                        </div>
                    </div>
                    <style>
                        .away {
                            background: orangered !important;
                        }

                        .avaliable {
                            background: lightgreen !important;
                        }

                        .busy {
                            background: red !important;
                        }
                    </style>

                    <div class="col-sm-12 col-md-4 col-lg-4 col-xs-12" style="height: calc(100vh - 400px; );">
                        <div class="col-md-12 col-lg-12">
                            <div  >
                                <div  >
                                    <div>
                                      
                                        <table id="example" style="width:100%;" >
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">ID</th>
                                                    <th class="wd-15p">Zone Ques   <input type="text" placeholder="search"  style="float: right;
    padding: 0px;" ng-model="test1"/></th>

                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr ng-repeat=" (key, value)  in zonelist  | filter : test1"  >
                                                    <td>{{value[0]}} </td>
                                                    <td>
                                                        <div class="row">
                                                            <div class="col" style="margin-bottom:3px;" id="divofzone" ng-repeat=" (key1, value1)  in value[1] |  orderBy:'zonequeue'"   ng-click='VehicleDetailschng(  value1.VehicleId  )' >
                                                                <span ng-if="value1.vehiclestatus == 'Available'" style="background: lightgreen; padding: 3px; color: black;     font-weight: 600; ">{{value1.vehiclenumber }}/{{value1.vehicletype }}
                                                                </span>
                                                                <span ng-if="value1.vehiclestatus == 'Away'" style="background: orange; padding: 3px; color: black;   font-weight: 600;">{{value1.vehiclenumber }}/{{value1.vehicletype }}
                                                                </span>
                                                                <span ng-if="value1.vehiclestatus == 'Busy'" style="background: #ff000099; padding: 3px; color: black;   font-weight: 600;">{{value1.vehiclenumber }}/{{value1.vehicletype }}
                                                                </span>
                                                                <span ng-if="value1.vehiclestatus == 'Picking'" style="background: #0000f57a; padding: 3px; color: black;   font-weight: 600;">{{value1.vehiclenumber }}/{{value1.vehicletype }}
                                                                </span>
                                                                <span ng-if="value1.vehiclestatus == 'Clearing'" style="background: lightgreen; padding: 3px; color: black;   font-weight: 600;">{{value1.vehiclenumber }}/{{value1.vehicletype }}
                                                                </span>
                                                            </div>


                                                          
                                                        </div>

                                                    </td>
                                                </tr>

                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <!-- table-wrapper -->
                            </div>
                            <!-- section-wrapper -->
                        </div>
                    </div>
                </div>

            </div>

        </div>
    </div>







    <!-- Back to top -->

    <!-- Dashboard Core -->
    <script src="assets/js/vendors/jquery-3.2.1.min.js"></script>
    <script src="assets/plugins/bootstrap-4.1.3/popper.min.js"></script>
    <script src="assets/plugins/bootstrap-4.1.3/js/bootstrap.min.js"></script>
    <script src="assets/js/vendors/jquery.sparkline.min.js"></script>
    <script src="assets/js/vendors/selectize.min.js"></script>
    <script src="assets/js/vendors/jquery.tablesorter.min.js"></script>
    <script src="assets/js/vendors/circle-progress.min.js"></script>
    <script src="assets/plugins/rating/jquery.rating-stars.js"></script>
    <script src="assets/plugins/tabs/jquery.multipurpose_tabcontent.js"></script>
    

    <!-- Fullside-menu Js-->
    <script src="assets/plugins/toggle-sidebar/sidemenu.js"></script>


    <!-- Charts Plugin -->
    <!-- Data tables -->
    <script src="assets/plugins/datatable/jquery.dataTables.min.js"></script>
    <script src="assets/plugins/datatable/dataTables.bootstrap4.min.js"></script>
    <script src="assets/js/datatable.js"></script>


    <!-- Input Mask Plugin -->
    

    <!--Morris.js Charts Plugin -->
    
    


    <!-- Index Scripts -->
    

    <!-- Custom scroll bar Js-->
    <!-- <script src="../assets/plugins/scroll-bar/jquery.mCustomScrollbar.concat.min.js"></script> -->
    <!--Counters -->

    <!-- Custom Js-->
    <!--<script src="assets/js/admin-custom.js"></script>--!>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516" integrity="sha512-8DS7rgIrAmghBFwoOTujcf6D9rXvH8xm8JQ1Ja01h9QX8EzXldiszufYa4IFfKdLUKTTrnSFXLDkUEOTrZQ8Qg==" data-cf-beacon='{"version":"2024.11.0","token":"6855be97295b455e994f24411d610193","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>
</body>
</html>


<style type="text/css">
    @media (min-width: 768px) .app-content {
        margin-left: 0px;
    }

    div#example_info {
        display: none;
    }

    td.dataTables_empty {
        display: none;
    }

    .app-content {
        margin-top: 83px !important;
    }
</style>

<script>
  
    

    var dispatcher_lat;
    var dispatcher_lng ;
    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition);
        } else {
            x.innerHTML = "Geolocation is not supported by this browser.";
        }
    }

    function showPosition(position) {
        dispatcher_lat =  position.coords.latitude  
        dispatcher_lng = position.coords.longitude; 
      
    }
    getLocation();
    function openDropdown(elementId,elementId1) {
        function down() {
            var pos = $(this).offset(); // remember position
            var len = $(this).find("option").length;
            if (len > 20) {
                len = 20;
            }

            $(this).css("position", "absolute");
            $(this).css("zIndex", 9999);
            $(this).offset(pos); // reset position
            $(this).attr("size", len); 
            $(this).height(130) ;// open dropdown
            $(this).unbind("focus", down);
            $(this).focus();
        }

        function up() {
            $(this).css("position", "static");
            $(this).attr("size", "1"); // close dropdown
            $(this).unbind("change", up);
            $(this).height(20) ;
            $(this).unbind('click keyup', onDropdownEvent);

        }

        function onDropdownEvent() {
            if (event.type !== 'keyup' || event.which == 13) {
                event.preventDefault();
                $(element).blur(); $(element1).blur();
            }
        }
        var element1 = $("#" + elementId1);
        var element = $("#" + elementId);
        $(element).focus(down).blur(up).focus();
        $(element).bind('click keyup', onDropdownEvent);
        $(element1).focus(down).blur(up).focus();
        $(element1).bind('click keyup', onDropdownEvent);
    }

    function distance(lat1, lon1, lat2, lon2, unit) {
        if ((lat1 == lat2) && (lon1 == lon2)) {
            return 0;
        }
        else {
            var radlat1 = Math.PI * lat1/180;
            var radlat2 = Math.PI * lat2/180;
            var theta = lon1-lon2;
            var radtheta = Math.PI * theta/180;
            var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
            if (dist > 1) {
                dist = 1;
            }
            dist = Math.acos(dist);
            dist = dist * 180/Math.PI;
            dist = dist * 60 * 1.1515;
            if (unit=="K") { dist = dist * 1.609344 }
            if (unit=="N") { dist = dist * 0.8684 }
            return dist;
        }
    }

     
    var someSession = 'safinah mohammed';
    var SomeSession2 = '1051';
    var someSession3 = 'NZ';
    var someSession4 = '1216';

    localStorage.setItem("Country", someSession3);
    $("#lblName1").text(someSession);
    $("#lblName2").text(someSession);


    function IntervalTimer(callback, interval) {
        var timerId, startTime, remaining = 0;
        var state = 0; //  0 = idle, 1 = running, 2 = paused, 3= resumed

        this.pause = function () {
            if (state != 1) return;

            remaining = interval - (new Date() - startTime);
            window.clearInterval(timerId);
            state = 2;
        };

        this.resume = function () {
            if (state != 2) return;

            state = 3;
            window.setTimeout(this.timeoutCallback, remaining);
        };

        this.timeoutCallback = function ( ) {
            if (state != 3) return;

            callback();
            startTime = new Date();
            timerId = window.setInterval(callback, interval);
            state = 1;
        };
        this.newone = function (val){
            window.clearInterval(timerId);
            timerId = window.setInterval(callback, val);
            state = 1;
        }

        startTime = new Date();
        timerId = window.setInterval(callback, interval);
        state = 1;
    }
    var timerozjob = new IntervalTimer(function () {
         
        VehiclesStatus();
       
    },30000);

    var config = {
        apiKey: "AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA",
        authDomain: "taxilatest.firebaseapp.com",
        databaseURL: "https://taxilatest.firebaseio.com",
        projectId: "taxilatest",
        storageBucket: "taxilatest.appspot.com",
        messagingSenderId: "986098722414"
    };
    firebase.initializeApp(config);
    var DbRef = firebase.database();
    var ref = DbRef.ref("online/" + SomeSession2 + "");
    var ref44 = DbRef.ref("Emergency/" + SomeSession2 + "");
    ref44.on("value", function (snapshot) {

        snapshot.forEach(function (childsnapshot) {
            var EmergencyVehicle = childsnapshot.key;
            childsnapshot.forEach(function (childsnapshot1) {
                var EmergencyData = childsnapshot1.val();


                FnEmergency(EmergencyVehicle, EmergencyData.driverName, EmergencyData.lat, EmergencyData.lng, EmergencyData.vehiclenumber, EmergencyData.time);
            });
        });
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
    function VehiclesStatus() {
        var param = [];
        var proc = 'VehiclesStatus';
        Selector(param, proc).then(function (result) {
            if (result.d == "Session is experied, please login again") {
                window.location.href = "DispatcherLogin.aspx?";
            }
            else {
                $res = JSON.parse(result.d);
                if ($res["dt1"].length != []) {
                    $(".AllVehicles").text($res["dt1"][0].All);
                }
                if ($res["dt3"].length != []) {
                    $("#FreeVehicles").text($res["dt3"][0].Free);
                }
                if ($res["dt4"].length != []) {
                    $("#PickingVehicles").text($res["dt5"][0].Picking);
                }
                if ($res["dt2"].length != []) {
                    $("#BusyVehicles").text($res["dt2"][0].Busy);
                }
                if ($res["dt5"].length != []) {
                    $("#AwayVehicles").text($res["dt4"][0].Away);
                }

            }
        });
        JobsCount();
    }
    function JobsCount() {
        var param = [];
        var proc = 'JobsCount';
        Selector(param, proc).then(function (result) {
            $res = JSON.parse(result.d);

            if ($res["dt2"].length != []) {
                $("#CancelledJobs").text($res["dt2"][0].CancelledCount);
            }
            if ($res["dt3"].length != []) {
                $("#NoShownJobs").text($res["dt3"][0].NoShownCount);
            }
            if ($res["dt1"].length != []) {
                $("#DispatchedJobs").text($res["dt1"][0].ClosedCount);
            }
            if ($res["dt4"].length != []) {
                $("#AllJobs").text($res["dt4"][0].AllCount);
            }


        });

    }

</script>


<script>
  
    var map;
    var directionsRenderer;
    var directionsService;
    
     
    var timeroz = new IntervalTimer(function () {

        if ($("#DispatchAlerts").text() == "1") {
            Alerts();
        }
        if ($("#showAllArlams").is(":checked")) {
           
            AllAlarm();
        }
        else {
         
            Alarms();
        }
        //angular.element(document.getElementById('myangular')).scope().LoginDrivers( );
    },15000);
    markers = [];
    var cars_count = 0;
    if(markers.length > 0){
        markers.length = 0;
    }        
 
    
   
    var genericlat , genericlng;
    function initMap() {  
        directionsRenderer = new google.maps.DirectionsRenderer;
        directionsService = new google.maps.DirectionsService;
        var arr = new Array();
        var bounds = new google.maps.LatLngBounds();
        infowindow = new google.maps.InfoWindow();
        geocoder = new google.maps.Geocoder;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (p) {
                var LatLng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Picklatlng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Droplatlng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Picklatlng2 = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Droplatlng2 = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                DispatcherLatLng = LatLng;
                originInput3 = LatLng;
                destinationInput3 = LatLng;
                genericlat =  p.coords.latitude;
                genericlng =  p.coords.longitude;
                showmap(p.coords.latitude, p.coords.longitude);
            });


        }

        else {
            var LatLng = new google.maps.LatLng(34.0150, 71.5805);
            Picklatlng = new google.maps.LatLng(34.0150, 71.5805);
            Droplatlng = new google.maps.LatLng(34.0150, 71.5805);
            Picklatlng2 = new google.maps.LatLng(34.0150, 71.5805);
            Droplatlng2 = new google.maps.LatLng(34.0150, 71.5805);
            genericlat =  34.0150;
            genericlng =  71.5805;
            showmap(34.0150, 71.5805 )
            alert('Your Location service is disabled  Or Geo Current Location feature is not supported in this browser');
        }

           

    }
    $("#pac-inputx").keyup(function() {

        if (!this.value) {
            angular.element(document.getElementById('myangular')).scope().setvalue(0);
        }

    });
    $("#pac-input").keyup(function() {

        if (!this.value) {
            angular.element(document.getElementById('myangular')).scope().setvalue(1);
        }

    });
    var rectangle;
    var lineSymbol ;
    var marker;
    var zoomLevel = 13;

    function selectmapzoom( value){
         
        zoomlevel = parseInt(value);
        map.setZoom(parseInt(value));
    }

    function changerefresh(){
       
        var VehicleLocation1x = new google.maps.LatLng(rectangle.bounds.getCenter().lat(),  rectangle.bounds.getCenter().lng());
        map.setCenter(VehicleLocation1x);
        map.setZoom(parseInt($('#zoomlabel').val()));

        clearMap();
    }

    function showmap(one , two){

        lineSymbol = {

            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: 'green',
            strokeWidth: 'red'
        };


        if(markers[1]){
            markers[1].setMap(null);
        }

        map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: parseFloat( one) , lng:  parseFloat(two)},
            zoom: zoomLevel,
            //disableDefaultUI: true
        });

 
        var countxxx = 0; 

        google.maps.event.addListener(map, 'bounds_changed', function() {
 
            var  aNorth  =   map.getBounds().getNorthEast().lat();   
            var  aEast   =   map.getBounds().getNorthEast().lng();
            var  aSouth  =   map.getBounds().getSouthWest().lat();   
            var aWest   =   map.getBounds().getSouthWest().lng();  
            if (countxxx == 0) {
                rectangle = new google.maps.Rectangle({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#ff000000",
                    fillOpacity: 0.35,
                    map,
                    bounds: {
                        north: aNorth ,
                        south: aSouth,
                        east: aEast,
                        west: aWest
                    },
                    editable: true
                });
            }else{
            
            }

            countxxx = 1;
        });

 


        var trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        var input = document.getElementById('pac-input');
        var autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.bindTo('bounds', map);
        autocomplete.setFields(
        ['address_components', 'geometry', 'icon', 'name']);

        var input1 = document.getElementById('pac-inputx');
        var autocomplete1 = new google.maps.places.Autocomplete(input1);
        autocomplete1.bindTo('bounds', map);
        autocomplete1.setFields(
        ['address_components', 'geometry', 'icon', 'name']);
        var infowindow = new google.maps.InfoWindow();
        var infowindowContent = document.getElementById('infowindow-content');
        infowindow.setContent(infowindowContent);
       
        marker = new google.maps.Marker({
            map: map,
            anchorPoint: new google.maps.Point(0, -29)
        });

        autocomplete.setComponentRestrictions(
           {'country': ['nz','pk' ]});
        autocomplete1.setComponentRestrictions(
          {'country': ['nz','pk' ]});

        autocomplete.addListener('place_changed', function() {
            infowindow.close();
            marker.setVisible(false);
            var place = autocomplete.getPlace();
           
            $('#LocalPickLat').val( place.geometry.location.lat());
            $('#LocalPickLng').val( place.geometry.location.lng());
            
            angular.element(document.getElementById('myangular')).scope().setvalue(3);
            console.log($('#LocalDropLat').val());

            if( $('#LocalDropLat').val() != 0){
                marker.setVisible(false);
                var resp =  angular.element(document.getElementById('myangular')).scope().FnBookingZone(place.geometry.location.lat() ,  place.geometry.location.lng());
                console.log(resp);
                if(resp == true){
                    angular.element(document.getElementById('myangular')).scope().changedroplat();
                }else{
               
                    $('#pac-input').val('');
                    $('#LocalPickLat').val(0);
                    $('#LocalPickLng').val(0);

                    Swal.fire(
                        'Warning!',
                         "Sorry Pickup Address is Out of Zone!" + place.name ,
                         'warning'
                    );
                 
                }

              
            }else{
                console.log(place.geometry.location.lat());
                console.log(place.geometry.location.lng());
                var resp =  angular.element(document.getElementById('myangular')).scope().FnBookingZone(place.geometry.location.lat() ,  place.geometry.location.lng());
                console.log(resp);
                if(resp == true){
                    if (!place.geometry) {
                        window.alert("No details available for input: '" + place.name + "'");
                        return;
                    } 
                    if (place.geometry.viewport) {
                        map.fitBounds(place.geometry.viewport);
                    } else {
                        map.setCenter(place.geometry.location);
                        map.setZoom(17);   
                    }
                    marker.setPosition(place.geometry.location);
                    marker.setVisible(true);
                }else{
                    Swal.fire(
                            'Warning!',
                             "Sorry Pickup Address is Out of Zone!" + place.name ,
                             'warning'
                        );
                }
            }

                

       
        

   
        });


        autocomplete1.addListener('place_changed', function() {
        

            infowindow.close();
            marker.setVisible(false);
            var place1 = autocomplete1.getPlace();
            $('#LocalDropLat').val( place1.geometry.location.lat());
            $('#LocalDropLng').val( place1.geometry.location.lng());
            marker.setVisible(false);
            
            angular.element(document.getElementById('myangular')).scope().changedroplat();
          
   
        });




    }
    function initMap1() {  
       
        var arr = new Array();
        var bounds = new google.maps.LatLngBounds();
        infowindow = new google.maps.InfoWindow();
        geocoder = new google.maps.Geocoder;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (p) {
                var LatLng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Picklatlng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Droplatlng = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Picklatlng2 = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                Droplatlng2 = new google.maps.LatLng(p.coords.latitude, p.coords.longitude);
                DispatcherLatLng = LatLng;
                originInput3 = LatLng;
                destinationInput3 = LatLng;
                map = new google.maps.Map(document.getElementById('map'), {
                    mapTypeControl: false,
                    center: LatLng,
                    zoom: 13,
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                });
                overlay = new google.maps.OverlayView();
                overlay.draw = function () { };
                overlay.setMap(map);
                //new AutocompleteDirectionsHandler(map);
            });


        }

        else {
            var LatLng = new google.maps.LatLng(34.0150, 71.5805);
            Picklatlng = new google.maps.LatLng(34.0150, 71.5805);
            Droplatlng = new google.maps.LatLng(34.0150, 71.5805);
            Picklatlng2 = new google.maps.LatLng(34.0150, 71.5805);
            Droplatlng2 = new google.maps.LatLng(34.0150, 71.5805);
            map = new google.maps.Map(document.getElementById('map'), {
                mapTypeControl: false,
                center: LatLng,
                zoom: 0,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            });

            //new AutocompleteDirectionsHandler(map);
            alert('Your Location service is disabled  Or Geo Current Location feature is not supported in this browser');
        }

           

    }
   
    var numDeltas = 100;
    var delay = 10; //milliseconds
    var i = 0;
    var deltaLat;
    var deltaLng;
    function transition(marker, result){
        i = 0;
        deltaLat = (result[0] - marker.position[0])/numDeltas;
        deltaLng = (result[1] - marker.position[1])/numDeltas;
        moveMarker(marker , deltaLng , deltaLat);
    }
    
    function moveMarker(marker , deltaLat , deltaLng ){
         position[0] += deltaLat;
          position[1] += deltaLng;
        var latlng = new google.maps.LatLng(marker.position[0], marker.position[1]);
        marker.setPosition(latlng);
        if(i!=numDeltas){
            i++;
            setTimeout(moveMarker, delay);
        }
    }
    
    let  icon = [];
    var car8500 = '';
    var car8600 = '';
    // This Function will create a car icon with angle and add/display that marker on the map
    function AddCar(data,olddata) {
      




        var date1 = new Date(data.time ); 
        var date2 = new Date( ); 
    
        var Difference_In_Time = date2.getTime() - date1.getTime(); 
        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24); 
        var  Difference_In_Timez = 	Difference_In_Time / (1000) ; 
       
        //if(Difference_In_Timez > 500 ){
        //      firebase.database().ref("online/" + SomeSession2 + "/"+data.VehicleId).remove();
             
        //    }
         var colorselected = '#80ff80';
        var ImageUrl;
        if (data.vehiclestatus == 'Available') {
            colorselected = '#00e600';  
            ImageUrl = 'img/green.png';
        }
        else if (data.vehiclestatus == 'Picking') {
            colorselected = '#3333ff';
            ImageUrl = 'img/blue.png';
        } else if (data.vehiclestatus == 'Away') {
            colorselected = '#ffaf1a';
            ImageUrl = 'img/yellow.png';
        } else if (data.vehiclestatus == 'Busy') {
            colorselected = '#ff3333';
            ImageUrl = 'img/red.png';  
        }
        var bearing = 270;
          car8500 = '<svg width="479px"    height="1077px" viewBox="0 0 479 1077" version="1.1" id="car8500'+data.vehiclenumber+'" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
             '    <!-- Generator: Sketch 48.1 (47250) - http://www.bohemiancoding.com/sketch -->\n' +
             '    <title>8851</title>\n' +
             '    <desc>Created with Sketch.</desc>\n' +
             '    <defs>\n' +
             '        <linearGradient x1="116.889801%" y1="79.3129284%" x2="-101.602921%" y2="8.5929469%" id="linearGradient-1">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#666666" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="48.4035551%" y1="46.3104921%" x2="230.770532%" y2="105.387505%" id="linearGradient-2">\n' +
             '            <stop stop-color="#1B1B1B" offset="0%"></stop>\n' +
             '            <stop stop-color="#999999" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="100.015769%" y1="38.2124928%" x2="68.8037214%" y2="38.3500287%" id="linearGradient-3">\n' +
             '            <stop stop-color="#333333" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="78.7830836%" y1="59.1637822%" x2="65.4330326%" y2="49.9947278%" id="linearGradient-4">\n' +
             '            <stop stop-color="#333333" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="84.7680978%" y1="61.9658847%" x2="68.6765137%" y2="49.9982976%" id="linearGradient-5">\n' +
             '            <stop stop-color="#1A1A1A" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="65.0302038%" y1="78.3936536%" x2="60.1764273%" y2="49.9982976%" id="linearGradient-6">\n' +
             '            <stop stop-color="#1A1A1A" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="91.3856021%" y1="62.7934859%" x2="7.14535974%" y2="50.0138211%" id="linearGradient-7">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#B3B3B3" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="102.108719%" y1="68.3750211%" x2="7.19888703%" y2="49.9893914%" id="linearGradient-8">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#CCCCCC" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="91.3856021%" y1="37.4078595%" x2="7.14535974%" y2="50.1875243%" id="linearGradient-9">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#B3B3B3" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="102.108719%" y1="31.5368345%" x2="7.19888703%" y2="49.9224642%" id="linearGradient-10">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#CCCCCC" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="92.8070247%" y1="12.5874107%" x2="16.0330775%" y2="43.8923185%" id="linearGradient-11">\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0.59523809" offset="0%"></stop>\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="93.1666803%" y1="89.5805416%" x2="17.3363841%" y2="61.3479231%" id="linearGradient-12">\n' +
             '            <stop stop-color="#000000" stop-opacity="0.48809522" offset="0%"></stop>\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0.10714286" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="46.0612785%" y1="57.9411442%" x2="43.5448504%" y2="33.2353005%" id="linearGradient-13">\n' +
             '            <stop stop-color="#AC8701" offset="0%"></stop>\n' +
             '            <stop stop-color="#EFBB01" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="95.5175667%" y1="90.8010012%" x2="46.0945729%" y2="100%" id="linearGradient-14">\n' +
             '            <stop stop-color="#FEFFFF" stop-opacity="0" offset="0%"></stop>\n' +
             '            <stop stop-color="#4D9BEB" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '    </defs>\n' +
             '    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
             '        <g id="8851" transform="translate(239.500000, 517.500000) rotate(-90.000000) translate(-239.500000, -517.500000) translate(-319.500000, 229.500000)">\n' +
             '            <path d="M650.682608,110.979523 C630.347678,110.979523 613.522909,113.336012 595.623233,120.852106 C595.623233,120.852106 514.888685,116.668883 421.563846,118.074282 C328.276724,119.479164 245.76438,108.279389 175.886899,110.228527 C106.009418,112.177492 35.737634,133.373894 35.737634,133.373894 L22.9056187,139.789563 C7.95122069,147.273631 0,224.919766 0,286.354734 C0,346.500923 5.54133908,426.299051 22.0458651,430.891352 L33.7746871,434.152749 C33.7746871,434.152749 107.278048,456.649842 164.21208,458.385766 C221.148683,460.121949 297.058154,450.039087 363.892638,450.182381 L587.591437,450.662017 C608.081517,461.010231 626.601792,459.970921 650.676608,459.970921 C764.913259,459.970921 811.535391,384.929105 810.995366,285.4635 C810.473685,189.120142 739.217513,110.990607 650.676608,110.990607 L650.682608,110.979523 Z" id="path3855" fill="#E1E1E1" fill-rule="nonzero" opacity="0.628702192"></path>\n' +
             '            <path d="M647.008325,121.940342 C627.47576,121.940342 611.314853,124.202572 594.121453,131.418022 C594.121453,131.418022 516.572485,127.402128 426.930008,128.751311 C337.323758,130.099997 258.067142,119.348213 190.946849,121.219386 C123.826556,123.090393 56.3275177,143.438939 56.3275177,143.438939 L44.0018212,149.59798 C29.6374857,156.782686 22,231.322975 22,290.300545 C22,348.040886 27.3226919,424.647089 43.1759913,429.055698 L54.4420237,432.186639 C54.4420237,432.186639 125.045129,453.783848 179.732688,455.450336 C234.422718,457.117071 307.336993,447.437524 371.534359,447.575086 L586.406572,448.035537 C606.088165,457.969822 623.877677,456.972084 647.002561,456.972084 C756.731725,456.972084 801.514266,384.93194 800.995549,289.44496 C800.494452,196.955336 732.049868,121.950983 647.002561,121.950983 L647.008325,121.940342 Z" id="path2853" fill="'+colorselected+'" fill-rule="nonzero"></path>\n' +
             '            <path d="M647.008325,121.940342 C627.47576,121.940342 611.314853,124.202572 594.121453,131.418022 C594.121453,131.418022 516.572485,127.402128 426.930008,128.751311 C337.323758,130.099997 258.067142,119.348213 190.946849,121.219386 C123.826556,123.090393 56.3275177,143.438939 56.3275177,143.438939 L44.0018212,149.59798 C29.6374857,156.782686 22,231.322975 22,290.300545 C22,348.040886 27.3226919,424.647089 43.1759913,429.055698 L54.4420237,432.186639 C54.4420237,432.186639 125.045129,453.783848 179.732688,455.450336 C234.422718,457.117071 307.336993,447.437524 371.534359,447.575086 L586.406572,448.035537 C606.088165,457.969822 623.877677,456.972084 647.002561,456.972084 C756.731725,456.972084 801.514266,384.93194 800.995549,289.44496 C800.494452,196.955336 732.049868,121.950983 647.002561,121.950983 L647.008325,121.940342 Z" id="path2853" stroke="#979797" stroke-width="5" fill="'+colorselected+'" fill-rule="nonzero"></path>\n' +
             '            <path d="M422.271693,207.531623 C424.757231,242.326018 426,268.878238 426,287.188285 C426,304.977639 424.826909,327.474954 422.480726,354.680231 C421.831071,362.213348 415.476312,368 407.853285,368 L371.680851,368 C363.572841,368 357,361.480966 357,353.439331 L357,208.56067 C357,200.519034 363.572841,194.000001 371.680851,194.000001 L407.627551,194 C415.332945,194 421.727129,199.908416 422.271693,207.531623 Z" id="Path-6" stroke="#000000" fill="#2D2D2D"></path>\n' +
             '            <path d="M474.660466,476.999405 C473.356474,476.991884 470.537439,476.740508 469.026803,476.210888 L466,474.95225 L474.726408,440 L498,440.363929 L485.657538,471.11626 C484.014325,474.8224 478.572441,477.02272 474.660725,476.999823 L474.660466,476.999405 Z" id="path3733" fill-opacity="0.99607999" fill="#AA0000" fill-rule="nonzero"></path>\n' +
             '            <path d="M541.748766,144 C538.80025,144.057257 535.856628,144.50919 532.936406,145.352958 C532.892895,145.298831 532.848721,145.241038 532.805243,145.18706 L532.810102,145.177396 L481.530992,155.337469 C465.569284,161.20303 455,167.10702 455,181.726597 L455,388.69217 C455,403.311748 466.832822,409.634418 481.530992,415.0813 L534.46343,425.233322 C534.485443,425.21212 534.506195,425.188518 534.528199,425.167283 C536.92624,425.70827 539.336478,425.986232 541.748766,426 C579.443164,425.999276 610.000254,362.871124 610,284.999194 C609.999823,207.127894 579.442859,144.000724 541.748766,144 Z" id="path3703" stroke="#000000" stroke-width="1.96000004" fill="url(#linearGradient-1)" fill-rule="nonzero"></path>\n' +
             '            <path d="M187.380103,176 C165.033857,177.830794 142.703144,179.893198 122.59929,188.085557 C106.351562,194.706736 82,230.877982 82,280.987915 C82,331.07868 100.491753,371.790031 123.819811,375.607137 L187.380103,386 C198.249526,386 207,377.078973 207,365.997698 L207,196.003135 C207,184.92186 198.249526,176.000833 187.380103,176.000833 L187.380103,176 Z" id="rect2864" stroke="#1A1A1A" stroke-width="5" fill="url(#linearGradient-2)" fill-rule="nonzero"></path>\n' +
             '            <g id="g3672" transform="translate(222.000000, 392.000000)" fill-opacity="0.99607999" fill-rule="nonzero">\n' +
             '                <path d="M79.9652564,0.199048345 C52.5565774,0.199048345 26.3144349,1.69191093 2.07676359,4.39772437 C23.1565713,44.7995622 82.572712,29.4985501 170.945246,30.5485301 C211.763345,31.0334699 244.506053,32.1071616 270.782699,32.5182793 C232.040542,13.165804 161.087191,0.198633661 79.9636134,0.198633661 L79.9652564,0.199048345 Z" id="path3643" fill="#0E232E"></path>\n' +
             '                <path d="M2.85062091,5.79728305 C2.05054938,5.88349587 1.23324268,5.96762697 0.437451192,6.05646058 C21.5172589,46.4582984 80.9333996,31.1572863 169.305934,32.2072663 C210.124032,32.6922061 242.866741,33.7658978 269.143386,34.1770155 C267.949576,33.5806667 266.726684,32.9986493 265.472247,32.4146083 C240.086933,31.9555614 209.177002,31.0026921 170.949929,30.5485301 C83.6075613,29.5109076 24.5660267,44.4445927 2.85366048,5.79686837 L2.85062091,5.79728305 Z" id="path3649" fill="#0E232E" opacity="0.5"></path>\n' +
             '                <path d="M79.9652564,0.199048345 C77.331102,0.199048345 74.7214283,0.223514704 72.1096188,0.250883852 C72.7818232,13.6625955 77.3903324,25.3450746 84.0986567,32.4668585 C87.9363154,32.4041583 91.8990071,32.3038462 95.95954,32.1817632 C88.922696,25.3873309 83.9713235,13.746569 83.0463094,0.199670371 C82.0183607,0.195523531 80.9969019,0.199670371 79.9656672,0.199670371 L79.9652564,0.199048345 Z" id="path3658" fill="#000000" opacity="0.5"></path>\n' +
             '            </g>\n' +
             '            <g id="g3678" transform="translate(357.500000, 151.500000) scale(-1, 1) rotate(-180.000000) translate(-357.500000, -151.500000) translate(222.000000, 134.000000)" fill-opacity="0.99607999" fill-rule="nonzero">\n' +
             '                <g id="g3680">\n' +
             '                    <path d="M79.9652564,0.199048345 C52.5565774,0.199048345 26.3144349,1.69191093 2.07676359,4.39772437 C23.1565713,44.7995622 82.572712,29.4985501 170.945246,30.5485301 C211.763345,31.0334699 244.506053,32.1071616 270.782699,32.5182793 C232.040542,13.165804 161.087191,0.198633661 79.9636134,0.198633661 L79.9652564,0.199048345 Z" id="path3682" fill="#0E232E"></path>\n' +
             '                    <path d="M2.85062091,5.79728305 C2.05054938,5.88349587 1.23324268,5.96762697 0.437451192,6.05646058 C21.5172589,46.4582984 80.9333996,31.1572863 169.305934,32.2072663 C210.124032,32.6922061 242.866741,33.7658978 269.143386,34.1770155 C267.949576,33.5806667 266.726684,32.9986493 265.472247,32.4146083 C240.086933,31.9555614 209.177002,31.0026921 170.949929,30.5485301 C83.6075613,29.5109076 24.5660267,44.4445927 2.85366048,5.79686837 L2.85062091,5.79728305 Z" id="path3684" fill="#000000" opacity="0.5"></path>\n' +
             '                </g>\n' +
             '                <path d="M79.9652564,0.199048345 C77.331102,0.199048345 74.7214283,0.223514704 72.1096188,0.250883852 C72.7818232,13.6625955 77.3903324,25.3450746 84.0986567,32.4668585 C87.9363154,32.4041583 91.8990071,32.3038462 95.95954,32.1817632 C88.922696,25.3873309 83.9713235,13.746569 83.0463094,0.199670371 C82.0183607,0.195523531 80.9969019,0.199670371 79.9656672,0.199670371 L79.9652564,0.199048345 Z" id="path3686" fill="#000000" opacity="0.5"></path>\n' +
             '            </g>\n' +
             '            <path d="M749,166 C752.046883,185.24761 764.020539,200.168095 779,203 C770.754599,189.261839 760.632434,176.804461 749,166 Z" id="path3705" stroke="#000000" stroke-width="5.79449987" fill-opacity="0.99607999" fill="#000000" fill-rule="nonzero"></path>\n' +
             '            <path d="M783,374 C765.920668,375.896873 752.33947,394.135606 751,417 C764.580326,405.05159 775.191508,390.536227 783,374 Z" id="path3707" stroke="#000000" stroke-width="5.79449987" fill="#D0021B" fill-rule="nonzero"></path>\n' +
             '            <path d="M622.593363,383.272356 C622.593363,383.272356 688.29207,365.078028 709.484723,357.520409 C731.615717,349.627987 791,326 791,326 C791,326 783.792585,360.196898 765.865161,372.635647 C702.189905,416.817041 574,415.998957 574,415.998957" id="path3715" stroke="#4D4D4D" stroke-width="2"></path>\n' +
             '            <path d="M632.458307,197.727644 C632.458307,197.727644 693.918388,215.921972 713.743773,223.479591 C734.446961,231.372013 790,255 790,255 C790,255 783.25758,220.803102 766.486763,208.364353 C706.919589,164.182959 587,165.001043 587,165.001043" id="path3717" stroke="#4D4D4D" stroke-width="2"></path>\n' +
             '            <path d="M481.660466,95.0005948 C480.356474,95.0081155 477.537439,95.2594923 476.026803,95.7891116 L473,97.0477502 L481.726408,132 L505,131.636071 L492.657538,100.88374 C491.014325,97.1776001 485.572441,94.9772805 481.660725,95.000177 L481.660466,95.0005948 Z" id="rect3724" fill-opacity="0.99607999" fill="#AA0000" fill-rule="nonzero"></path>\n' +
             '            <g id="g3815" transform="translate(672.000000, 356.000000)">\n' +
             '                <path d="M32.1163606,10.8782966 L28.5238133,12.8290657 C29.3246093,13.7918824 29.9774288,14.8504147 30.4465851,16.0283003 C34.3309889,25.780481 21.7548471,40.3617266 8.68890446,45.809198 C8.27054171,45.9836336 7.22120217,46.508888 5.93128542,47.1876704 L16.9619235,43.9624677 C30.9726555,36.9231195 39.2021187,24.7510796 35.5824502,15.6639149 C34.840738,13.8017868 33.6595165,12.1964266 32.1164416,10.8781302 L32.1163606,10.8782966 Z" id="path3757"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3787" fill="url(#linearGradient-3)" fill-rule="nonzero"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3752" fill="url(#linearGradient-4)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3735" fill="url(#linearGradient-5)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3783" fill="url(#linearGradient-6)" fill-rule="nonzero"></path>\n' +
             '                <g id="g3807" transform="translate(3.444247, 11.802694)" fill-rule="nonzero">\n' +
             '                    <path d="M24.9945266,0.713778727 L21.7852323,2.45643975 C22.5005994,3.31654311 23.0837761,4.26215122 23.5028828,5.31438003 C26.9728984,14.0261981 15.7383794,27.0519163 4.06631152,31.9182515 C3.6925797,32.0740783 2.7551837,32.5432986 1.60287527,33.1496685 L11.4567649,30.2685304 C23.972832,23.9801398 31.324376,13.1066132 28.0908538,4.98886719 C27.4282674,3.325391 26.3730587,1.89129057 24.994599,0.713630023 L24.9945266,0.713778727 Z" id="path3799" fill="url(#linearGradient-3)"></path>\n' +
             '                    <path d="M23.5480841,3.68785676 L20.3387898,5.43051778 C21.0541569,6.29062114 21.6373336,7.23622925 22.0564403,8.28845806 C25.5264559,17.0002761 14.2919369,30.0259944 2.619869,34.8923295 C2.24613719,35.0481564 1.30874119,35.5173767 0.156432758,36.1237465 L10.0103224,33.2426085 C22.5263894,26.9542179 29.8779335,16.0806912 26.6444113,7.96294522 C25.9818249,6.29946902 24.9266162,4.8653686 23.5481564,3.68770805 L23.5480841,3.68785676 Z" id="path3803" fill="url(#linearGradient-4)"></path>\n' +
             '                </g>\n' +
             '            </g>\n' +
             '            <g id="g3825" transform="translate(706.000000, 203.000000) scale(-1, 1) rotate(-180.000000) translate(-706.000000, -203.000000) translate(672.000000, 178.000000)">\n' +
             '                <path d="M32.1163606,10.8782966 L28.5238133,12.8290657 C29.3246093,13.7918824 29.9774288,14.8504147 30.4465851,16.0283003 C34.3309889,25.780481 21.7548471,40.3617266 8.68890446,45.809198 C8.27054171,45.9836336 7.22120217,46.508888 5.93128542,47.1876704 L16.9619235,43.9624677 C30.9726555,36.9231195 39.2021187,24.7510796 35.5824502,15.6639149 C34.840738,13.8017868 33.6595165,12.1964266 32.1164416,10.8781302 L32.1163606,10.8782966 Z" id="path3827"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3829" fill="url(#linearGradient-3)" fill-rule="nonzero"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3831" fill="url(#linearGradient-4)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3833" fill="url(#linearGradient-5)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3835" fill="url(#linearGradient-6)" fill-rule="nonzero"></path>\n' +
             '                <g id="g3837" transform="translate(3.444247, 11.802694)" fill-rule="nonzero">\n' +
             '                    <path d="M24.9945266,0.713778727 L21.7852323,2.45643975 C22.5005994,3.31654311 23.0837761,4.26215122 23.5028828,5.31438003 C26.9728984,14.0261981 15.7383794,27.0519163 4.06631152,31.9182515 C3.6925797,32.0740783 2.7551837,32.5432986 1.60287527,33.1496685 L11.4567649,30.2685304 C23.972832,23.9801398 31.324376,13.1066132 28.0908538,4.98886719 C27.4282674,3.325391 26.3730587,1.89129057 24.994599,0.713630023 L24.9945266,0.713778727 Z" id="path3839" fill="url(#linearGradient-3)"></path>\n' +
             '                    <path d="M23.5480841,3.68785676 L20.3387898,5.43051778 C21.0541569,6.29062114 21.6373336,7.23622925 22.0564403,8.28845806 C25.5264559,17.0002761 14.2919369,30.0259944 2.619869,34.8923295 C2.24613719,35.0481564 1.30874119,35.5173767 0.156432758,36.1237465 L10.0103224,33.2426085 C22.5263894,26.9542179 29.8779335,16.0806912 26.6444113,7.96294522 C25.9818249,6.29946902 24.9266162,4.8653686 23.5481564,3.68770805 L23.5480841,3.68785676 Z" id="path3841" fill="url(#linearGradient-4)"></path>\n' +
             '                </g>\n' +
             '            </g>\n' +
             '            <polygon id="rect3861" fill="url(#linearGradient-7)" fill-rule="nonzero" points="163.873258 388 181 392.855109 178.843024 407.869604 161 408 163.873171 388.000529"></polygon>\n' +
             '            <polygon id="path3864" fill="url(#linearGradient-8)" fill-rule="nonzero" points="181.585873 390 197 394.855084 195.058735 409.869608 179 410 181.585873 390.000026"></polygon>\n' +
             '            <polygon id="path3882" fill="url(#linearGradient-9)" fill-rule="nonzero" points="163.873258 174 181 169.144891 178.843024 154.130396 161 154 163.873171 173.999471"></polygon>\n' +
             '            <polygon id="path3884" fill="url(#linearGradient-10)" fill-rule="nonzero" points="181.585873 174 197 169.144916 195.058735 154.130392 179 154 181.585873 173.999974"></polygon>\n' +
             '            <path d="M478.6169,471.999501 C477.470036,471.991956 474.990688,471.739763 473.66208,471.208425 L471,469.945701 L477.582617,440 L493,440.36511 L486.377363,463.386682 C484.932153,467.10485 482.057491,472.022891 478.617128,471.99992 L478.6169,471.999501 Z" id="path4291" fill-opacity="0.99607999" fill="#FF4141" fill-rule="nonzero"></path>\n' +
             '            <path d="M481.451084,100.00042 C480.178618,100.007973 477.427738,100.260444 475.953624,100.792367 L473,102.056482 L479.773315,130 L499,129.634488 L488.698048,105.909162 C487.094562,102.186897 486.32889,100.806148 481.451337,100 L481.451084,100.00042 Z" id="path4293" fill-opacity="0.99607999" fill="#FF4141" fill-rule="nonzero"></path>\n' +
             '            <path d="M194.238783,146 L47.9698071,158.776225 C47.9698071,158.776225 43.7906931,160.601402 39.6115798,187.979029 C35.4324658,215.356647 36.0294823,233 36.0294823,233 C36.0294823,233 79.0146493,188.587416 115.432644,180.069932 C151.850631,171.552449 202,169.118885 202,169.118885 L194.238783,146 Z" id="path4305" fill="url(#linearGradient-11)"></path>\n' +
             '            <path d="M194.238783,414 L47.969805,401.223775 C47.969805,401.223775 43.790691,399.398598 39.6115769,372.020971 C35.4324629,344.643353 36.0294827,327 36.0294827,327 C36.0294827,327 79.0146496,371.412584 115.432645,379.930068 C151.850631,388.447551 202,390.881115 202,390.881115 L194.238783,414 Z" id="path4307" fill="url(#linearGradient-12)"></path>\n' +
             '            <path d="M789,322.682352 C789,322.682352 733.413566,344.817648 709.172868,353.170586 C684.93217,361.523533 598,387 598,387 L609.702408,348.994117 C609.702408,348.994117 629.939877,354.313874 730.070025,331.452943 C774.597196,321.28685 788.582059,316 788.582059,316 L789,322.682352 Z" id="path4327" fill="url(#linearGradient-13)" opacity="0.6"></path>\n' +
             '            <path d="M789,198.682352 C789,198.682352 733.413566,220.817648 709.172868,229.170586 C684.93217,237.523533 598,263 598,263 L609.702408,224.994117 C609.702408,224.994117 629.939877,230.313874 730.070025,207.452943 C774.597196,197.28685 788.582059,192 788.582059,192 L789,198.682352 Z" id="path4327" fill="url(#linearGradient-13)" opacity="0.6" transform="translate(693.500000, 227.500000) scale(1, -1) translate(-693.500000, -227.500000) "></path>\n' +
             '            <rect id="rect4341" fill="#000000" fill-rule="nonzero" x="793" y="269" width="2" height="41" rx="1"></rect>\n' +
             '            <polygon id="Path" fill="url(#linearGradient-14)" opacity="0.685847496" transform="translate(927.500000, 153.500000) rotate(6.000000) translate(-927.500000, -153.500000) " points="751 177.967358 1091.33632 18 1104 289 780.478994 221.397776"></polygon>\n' +
             '            <polygon id="Path" fill="url(#linearGradient-14)" opacity="0.685847496" transform="translate(926.500000, 422.500000) scale(1, -1) rotate(6.000000) translate(-926.500000, -422.500000) " points="750 446.967358 1090.33632 287 1103 558 779.478994 490.397776"></polygon>\n' +
             '        </g>\n' +
             '    </g>\n' +
             '</svg>';
          car8600 =    '<svg xmlns="http://www.w3.org/2000/svg"   id="car8600'+data.vehiclenumber+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="533px" height="1177px" viewBox="0 0 533 1177" version="1.1">\n' +
            '    <!-- Generator: Sketch 48.1 (47250) - http://www.bohemiancoding.com/sketch -->\n' +
            '    <title>8880</title>\n' +
            '    <desc>Created with Sketch.</desc>\n' +
            '    <defs>\n' +
            '        <linearGradient x1="95.5175667%" y1="90.8010012%" x2="46.0945729%" y2="100%" id="linearGradient-1">\n' +
            '            <stop stop-color="#FEFFFF" stop-opacity="0" offset="0%"/>\n' +
            '            <stop stop-color="#4D9BEB" offset="100%"/>\n' +
            '        </linearGradient>\n' +
            '    </defs>\n' +
            '    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
            '        <g id="8880" transform="translate(266.500000, 582.000000) rotate(90.000000) translate(-266.500000, -582.000000) translate(-328.500000, 298.500000)">\n' +
            '            <polygon id="Path" fill="url(#linearGradient-1)" opacity="0.685847496" transform="translate(176.750974, 431.386959) scale(-1, -1) translate(-176.750974, -431.386959) " points="0.250974178 455.854317 340.587297 295.886959 353.250974 566.886959 29.7299679 499.284735"/>\n' +
            '            <polygon id="Path" fill="url(#linearGradient-1)" opacity="0.685847496" transform="translate(189.734052, 136.374938) scale(-1, 1) translate(-189.734052, -136.374938) " points="13.2340515 160.842297 353.570374 0.874938449 366.234052 271.874938 42.7130452 204.272714"/>\n' +
            '            <path d="M311.539357,285.460502 L311.548723,285.460502 L311.548723,285.670774 C311.487843,366.866526 321.640882,417.759106 342.017209,438.320885 C350.910485,447.863243 357.602687,452.54638 362.515297,452.326272 C364.529046,450.869817 365.86374,449.422728 367.198434,447.970956 C380.250335,454.429001 394.739959,458.999742 410.803117,461.66913 C410.053815,464.863029 410.114696,470.543673 411.248015,478.027325 C414.596458,490.952782 418.310185,497.836992 422.740432,498.853233 C425.072634,499.56507 426.927156,498.670591 427.943396,495.98247 C425.437918,485.150376 423.09635,474.322964 420.764148,463.481503 C452.492398,467.377873 486.693343,469.466552 523.830615,469.546165 C534.24591,475.339205 545.213816,475.409452 556.481442,469.775639 C580.173429,468.693834 743.909929,469.691342 1046.88544,469.813104 C1067.08381,469.82247 1121.95143,466.961074 1135.86503,459.795875 C1143.50323,454.644425 1149.0387,448.823286 1152.25601,443.882109 C1152.99595,442.747854 1160.86361,442.656532 1161.84239,441.805606 C1164.10903,439.848524 1165.0878,428.936348 1165.88394,419.522307 C1166.28669,414.713194 1166.73627,412.38989 1163.22392,411.08189 C1162.6994,410.889881 1163.45339,409.993529 1163.57047,409.444665 C1166.12278,397.259144 1168.23487,383.531935 1169.95358,369.262886 C1170.43126,369.281151 1170.91363,369.297542 1171.39131,369.297542 L1172.55272,369.297542 C1182.14847,369.297542 1189.98804,364.460798 1189.98804,358.542719 L1189.98804,286.310959 L1189.98804,285.24976 L1175.55461,285.24976 L1175.55461,281.682615 L1189.98804,281.682615 L1189.98804,280.896317 L1189.98804,208.664089 C1189.98804,202.753502 1182.14847,197.916759 1172.55272,197.916759 L1171.39131,197.916759 C1170.91363,197.916759 1170.43126,197.926125 1169.95358,197.951414 C1168.23487,183.684239 1166.12278,169.946258 1163.57047,157.771508 C1163.45339,157.223113 1162.6994,156.317395 1163.22392,156.125386 C1166.73627,154.817386 1166.28669,152.494082 1165.88394,147.682628 C1165.0878,138.279826 1164.10903,127.368118 1161.84239,125.401201 C1160.86361,124.550743 1152.99595,124.459422 1152.25601,123.325167 C1149.0387,118.394761 1143.50323,112.559104 1135.86503,107.418894 C1121.95143,100.247607 1067.08381,97.3829323 1046.88544,97.3941719 C743.909929,97.5220215 580.173429,98.509695 556.481442,97.4395983 C545.213816,91.7964189 534.24591,91.8783738 523.830615,97.6686037 C486.693343,97.7416606 452.492398,99.8270613 420.764148,103.723431 C423.09635,92.8936778 425.437918,82.0639247 427.943396,71.2341717 C426.927156,68.5362168 425.072634,67.6393962 422.740432,68.3620042 C418.310185,69.3773081 414.596458,76.2558989 411.248015,89.1874436 C410.114696,96.6603244 410.053815,102.35174 410.803117,105.5344 C394.739959,108.212685 380.250335,112.77687 367.198434,119.245686 C365.86374,117.791104 364.529046,116.33699 362.515297,114.891775 C357.602687,114.663237 350.910485,119.353399 342.017209,128.886391 C321.640882,149.44817 311.487843,200.34075 311.548723,281.536501 L311.548723,281.609558 L311.548723,281.682615 L311.539357,281.746774 L311.539357,282.03947 L311.539357,282.103629 L311.539357,282.112527 L311.539357,282.176686 L311.539357,282.185584 L311.539357,282.24787 L311.539357,282.259109 L311.539357,282.3228 L311.539357,282.396325 L311.539357,282.469382 L311.539357,282.533541 L311.539357,282.540566 L311.539357,282.606598 L311.539357,282.615496 L311.539357,282.677782 L311.539357,282.689021 L311.539357,282.752712 L311.539357,282.814998 L311.539357,282.826237 L311.539357,282.889928 L311.539357,282.899294 L311.539357,282.963453 L311.539357,282.970478 L311.539357,283.03651 L311.539357,283.045408 L311.539357,283.107694 L311.539357,283.118933 L311.539357,283.173726 L311.539357,283.182624 L311.539357,283.24491 L311.539357,283.256149 L311.539357,283.31984 L311.539357,283.329206 L311.539357,283.383999 L311.539357,283.40039 L311.539357,283.457056 L311.539357,283.47532 L311.539357,283.530581 L311.539357,283.537606 L311.539357,283.603638 L311.539357,283.612536 L311.539357,283.676695 L311.539357,283.686061 L311.539357,283.749752 L311.539357,283.759118 L311.539357,283.813911 L311.539357,283.830302 L311.539357,283.886968 L311.539357,283.905232 L311.539357,283.960493 L311.539357,283.969391 L311.539357,284.03355 L311.539357,284.042448 L311.539357,284.106607 L311.539357,284.115973 L311.539357,284.179664 L311.539357,284.18903 L311.539357,284.243823 L311.539357,284.253189 L311.539357,284.31688 L311.539357,284.326246 L311.539357,284.390405 L311.539357,284.399303 L311.539357,284.454095 L311.539357,284.47236 L311.539357,284.527152 L311.539357,284.545885 L311.539357,284.600678 L311.539357,284.609576 L311.539357,284.673735 L311.539357,284.683101 L311.539357,284.746792 L311.539357,284.756158 L311.539357,284.819848 L311.539357,284.829215 L311.539357,284.882134 L311.539357,284.893374 L311.539357,284.957064 L311.539357,284.966431 L311.539357,285.03059 L311.539357,285.039488 L311.539357,285.103647 L311.539357,285.112544 L311.539357,285.17483 L311.539357,285.460502" id="path14" fill="#231F20"/>\n' +
            '            <path d="M396.196414,283.658431 L396.196414,283.55587 L396.229196,281.591294 L396.238563,281.591294 L396.238563,281.316862 L396.238563,281.042431 L396.229196,281.042431 C395.344084,237.695788 400.851452,193.387229 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C368.509712,175.121124 360.969862,228.503728 361.939271,280.896317 L361.878391,280.896317 L361.911173,283.612536 L361.878391,286.310959 L361.939271,286.310959 C360.969862,338.703548 368.509712,392.08381 384.521355,429.037035 C388.155469,435.000541 392.300045,437.854444 397.357832,437.58891 C405.909239,436.299643 414.460647,435.000541 423.012054,433.701907 C427.062967,432.723132 427.320539,430.171291 423.569347,425.817379 C418.441313,419.862771 415.565867,412.664322 412.779401,405.310393 C400.851452,373.827071 395.344084,329.520386 396.229196,286.17187 L396.238563,286.17187 L396.238563,285.897438 L396.238563,285.62488 L396.229196,285.62488 L396.196414,283.658431" id="path1130" fill="#99DEF9"/>\n' +
            '            <path d="M358.609561,285.62488 L358.600195,285.897438 L358.609561,286.17187 L358.600195,286.17187 C357.77128,324.333812 362.168745,362.11923 371.801957,404.340515 C375.815405,424.847501 381.94563,437.323845 391.466447,441.767205 C390.403375,446.425521 388.080539,450.228227 384.488573,453.183286 C321.931237,435.119493 324.647456,338.529804 323.397059,285.897438 L323.504771,280.896317 L358.529948,280.896317 C358.539314,282.469382 358.56273,284.042448 358.600195,285.62488 L358.609561,285.62488" id="path1132" fill="#81EF00"/>\n' +
            '            <path d="M424.220303,497.865091 C425.035169,497.682449 425.70954,497.059592 426.234052,496.07145 L417.935534,459.852073 C417.031688,459.191751 416.160625,458.920129 415.345759,459.112137 C411.781893,459.927003 410.873364,469.260494 413.327328,479.966144 C415.776608,490.66711 420.651753,498.679957 424.220303,497.865091" id="path1134" fill="#393536"/>\n' +
            '            <path d="M548.285953,454.958195 C499.094288,452.93508 467.647027,450.743372 441.379315,444.284391 C440.718993,444.12891 438.719293,443.763158 437.84823,443.470461 C434.200067,442.253783 431.380818,442.272047 427.596844,442.857439 C423.124449,443.543518 421.995813,443.708365 427.788853,444.879149 C460.879895,451.59102 497.267865,455.206401 548.168875,456.559828 C549.943784,456.644124 550.847629,456.658174 550.65562,455.744962 C550.426147,454.686573 549.812656,455.023759 548.285953,454.958195" id="path1136" fill="#99DEF9"/>\n' +
            '            <path d="M396.660045,316.586968 C398.271044,349.549692 403.647285,381.190367 412.779401,405.310393 C415.565867,412.664322 418.441313,419.862771 423.569347,425.817379 C427.320539,430.171291 427.062967,432.723132 423.012054,433.701907 C414.460647,435.000541 405.909239,436.299643 397.357832,437.58891 C392.300045,437.854444 388.155469,435.000541 384.521355,429.037035 C371.591216,399.209202 364.19186,358.671037 362.332655,316.586968 L396.660045,316.586968" id="path1138" fill="#99DEF9"/>\n' +
            '            <path d="M396.660045,316.586968 C398.271044,349.549692 403.647285,381.190367 412.779401,405.310393 C415.565867,412.664322 418.441313,419.862771 423.569347,425.817379 C427.320539,430.171291 427.062967,432.723132 423.012054,433.701907 C414.460647,435.000541 405.909239,436.299643 397.357832,437.58891 C392.300045,437.854444 388.155469,435.000541 384.521355,429.037035 C371.591216,399.209202 364.19186,358.671037 362.332655,316.586968 L396.660045,316.586968" id="path1140" fill="#D1E4E9"/>\n' +
            '            <path d="M668.558263,456.466165 L846.882733,456.466165 C847.706965,456.466165 848.37197,456.203909 848.37197,455.86204 L848.37197,455.229817 C848.37197,454.901998 847.706965,454.639742 846.882733,454.639742 L668.558263,454.639742 C667.743398,454.639742 667.064343,454.901998 667.064343,455.229817 L667.064343,455.86204 C667.064343,456.203909 667.743398,456.466165 668.558263,456.466165" id="path1142" fill="#99DEF9"/>\n' +
            '            <path d="M877.177942,456.466165 L1055.82086,456.466165 C1056.6451,456.466165 1057.32415,456.203909 1057.32415,455.86204 L1057.32415,455.229817 C1057.32415,454.901998 1056.6451,454.639742 1055.82086,454.639742 L877.177942,454.639742 C876.35371,454.639742 875.674655,454.901998 875.674655,455.229817 L875.674655,455.86204 C875.674655,456.203909 876.35371,456.466165 877.177942,456.466165" id="path1144" fill="#99DEF9"/>\n' +
            '            <path d="M583.629584,456.377186 L650.977769,456.377186 C651.286856,456.377186 651.544429,456.110247 651.544429,455.773061 L651.544429,455.140837 C651.544429,454.813018 651.286856,454.546079 650.977769,454.546079 L583.629584,454.546079 C583.320497,454.546079 583.062925,454.813018 583.062925,455.140837 L583.062925,455.773061 C583.062925,456.110247 583.320497,456.377186 583.629584,456.377186" id="path1146" fill="#99DEF9"/>\n' +
            '            <path d="M1162.65726,412.772034 C1159.18237,427.418075 1156.0353,436.939828 1153.22542,441.319029 C1154.26039,441.474509 1156.17111,441.181813 1157.92729,440.945783 C1160.78868,440.561765 1161.35534,440.982779 1162.21704,437.763123 C1163.57983,432.613078 1164.4509,421.911643 1164.76935,415.99169 C1164.88643,413.871634 1164.87706,413.6061 1162.65726,412.772034" id="path1148" fill="#ED1C24"/>\n' +
            '            <path d="M1152.26538,391.818745 C1152.85077,391.818745 1153.43616,391.818745 1154.02155,391.818745 C1154.32127,392.376506 1154.70529,391.498418 1155.05653,389.275802 C1158.50331,358.616244 1161.65038,326.245937 1162.24514,295.220158 C1162.26387,293.902792 1161.66911,293.34503 1160.33442,293.390456 C1159.38843,293.125391 1159.02314,293.774942 1159.12617,295.192527 C1158.64849,326.08109 1155.23917,356.073301 1152.0921,388.726938 C1151.76896,390.364631 1151.87199,391.526049 1152.26538,391.818745" id="path1150" fill="#EAF1F3"/>\n' +
            '            <path d="M358.609561,281.591294 L358.600195,281.316862 L358.609561,281.042431 L358.600195,281.042431 C357.77128,242.871122 362.168745,205.088046 371.801957,162.875659 C375.815405,142.359306 381.94563,129.883431 391.466447,125.447096 C390.403375,120.79159 388.080539,116.986541 384.488573,114.022584 C321.931237,132.094808 324.647456,228.677472 323.397059,281.316862 L323.504771,286.310959 L358.529948,286.310959 C358.539314,284.737894 358.56273,283.16436 358.600195,281.591294 L358.609561,281.591294" id="path1152" fill="#81EF00"/>\n' +
            '            <path d="M424.220303,69.350146 C425.035169,69.5327883 425.70954,70.1551771 426.234052,71.1334843 L417.935534,107.364101 C417.031688,108.013184 416.160625,108.287616 415.345759,108.104973 C411.781893,107.290576 410.873364,97.9430355 413.327328,87.2411321 C415.776608,76.548595 420.651753,68.5268506 424.220303,69.350146" id="path1154" fill="#393536"/>\n' +
            '            <path d="M313.464126,281.799694 L313.464126,280.969374 C313.398562,243.60497 316.297424,206.624583 322.333987,178.269597 C326.394266,159.207826 335.479551,131.547818 358.39882,117.269871 C361.709798,115.202735 363.751645,117.342928 365.114438,120.837016 C332.852311,142.807483 321.036758,196.425648 321.008659,278.298581 L321.036758,278.298581 C321.027392,279.231462 321.018025,280.164343 321.018025,281.097223 L321.018025,281.152016 L321.018025,281.207277 L321.018025,281.26207 L321.018025,281.326229 L321.018025,281.381021 L321.018025,281.435814 L321.018025,281.488733 L321.018025,281.545399 L321.018025,281.600192 L321.018025,281.655453 L321.018025,281.662478 L321.018025,281.710246 L321.018025,281.719144 L321.018025,281.765039 L321.018025,281.774405 L321.018025,281.829198 L321.018025,281.838095 L321.018025,281.88399 L321.018025,281.892888 L321.018025,281.911621 L321.036758,281.911621 L321.018025,283.521215 L321.018025,283.548845 L321.018025,283.567109 L321.018025,283.594272 L321.018025,283.612536 L321.018025,283.640166 L321.018025,283.649064 L321.018025,283.686061 L321.036758,285.293782 L321.018025,285.293782 L321.018025,285.323286 L321.018025,285.332184 L321.018025,285.378078 L321.018025,285.386976 L321.018025,285.432871 L321.018025,285.442237 L321.018025,285.49703 L321.018025,285.551823 L321.018025,285.561189 L321.018025,285.604742 L321.018025,285.661408 L321.018025,285.725567 L321.018025,285.78036 L321.018025,285.835152 L321.018025,285.890413 L321.018025,285.945206 L321.018025,285.999999 L321.018025,286.064158 L321.018025,286.11895 C321.018025,287.049958 321.027392,287.975814 321.036758,288.908695 L321.008659,288.908695 C321.036758,370.779286 332.852311,424.399325 365.114438,446.369323 C363.751645,449.872309 361.709798,452.003136 358.39882,449.942556 C335.479551,435.65899 326.394266,407.999449 322.333987,388.937679 C316.297424,360.591591 313.398562,323.611672 313.464126,286.2468 L313.464126,286.17187 L313.464126,286.100686 L313.464126,286.027629 L313.464126,285.96347 L313.464126,285.890413 L313.464126,285.816888 L313.464126,285.753198 L313.464126,285.679672 L313.464126,285.604742 L313.464126,285.533558 L313.464126,285.467526 L313.464126,285.414607 L313.464126,285.396343 L313.464126,285.34155 L313.464126,285.323286 L313.464126,285.268493 L313.464126,285.24976 L313.464126,285.194968 L313.464126,285.18607 L313.464126,285.131277 L313.464126,285.112544 L313.464126,285.057752 L313.464126,285.039488 L313.464126,284.984695 L313.464126,284.966431 L313.464126,284.911638 L313.464126,284.902272 L313.464126,284.847479 L313.464126,284.829215 L313.464126,284.774422 L313.464126,284.756158 L313.464126,284.701365 L313.464126,284.683101 L313.464126,284.62784 L313.464126,284.618942 L313.464126,284.564149 L313.464126,284.545885 L313.464126,284.490624 L313.464126,284.47236 L313.464126,284.415694 L313.464126,284.399303 L313.464126,284.34451 L313.464126,284.335144 L313.464126,284.278478 L313.464126,284.262087 L313.464126,284.207294 L313.464126,284.197928 L313.464126,284.134237 L313.464126,284.122998 L313.464126,284.060712 L313.464126,283.997021 L313.464126,283.985782 L313.464126,283.923496 L313.464126,283.914598 L313.464126,283.848566 L313.464126,283.841541 L313.464126,283.78628 L313.464126,283.777382 L313.464126,283.71135 L313.464126,283.704325 L313.464126,283.640166 L313.464126,283.6308 L313.464126,283.576007 L313.464126,283.55587 L313.464126,283.50295 L313.464126,283.493584 L313.464126,283.429894 L313.464126,283.418654 L313.464126,283.356368 L313.464126,283.34747 L313.464126,283.292678 L313.464126,283.274413 L313.464126,283.219621 L313.464126,283.210254 L313.464126,283.137198 L313.464126,283.082405 L313.464126,283.063672 L313.464126,283.00888 L313.464126,282.999982 L313.464126,282.935823 L313.464126,282.926925 L313.464126,282.871664 L313.464126,282.853399 L313.464126,282.798607 L313.464126,282.780343 L313.464126,282.72555 L313.464126,282.716184 L313.464126,282.652493 L313.464126,282.643127 L313.464126,282.588334 L313.464126,282.57007 L313.464126,282.515277 L313.464126,282.505911 L313.464126,282.441752 L313.464126,282.432854 L313.464126,282.366822 L313.464126,282.359797 L313.464126,282.304536 L313.464126,282.286272 L313.464126,282.229606 L313.464126,282.222581 L313.464126,282.16732 L313.464126,282.149056 L313.464126,282.09239 L313.464126,282.074126 L313.464126,282.030104 L313.464126,282.01184 L313.464126,281.955174 L313.464126,281.93691 L313.464126,281.88399 L313.464126,281.865726 L313.464126,281.810933 L313.464126,281.799694" id="path1156" fill="#7B7979"/>\n' +
            '            <path d="M548.285953,112.25751 C499.094288,114.278752 467.647027,116.46484 441.379315,122.922417 C440.718993,123.087263 438.719293,123.451143 437.84823,123.743839 C434.200067,124.962391 431.380818,124.934761 427.596844,124.358735 C423.124449,123.672655 421.995813,123.507809 427.788853,122.337025 C460.879895,115.62328 497.267865,112.010709 548.168875,110.647448 C549.943784,110.572518 550.847629,110.554254 550.65562,111.470743 C550.426147,112.531942 549.812656,112.191478 548.285953,112.25751" id="path1158" fill="#99DEF9"/>\n' +
            '            <path d="M396.660045,250.629674 C398.271044,217.664609 403.647285,186.016909 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C371.591216,168.006971 364.19186,208.545137 362.332655,250.629674 L396.660045,250.629674" id="path1160" fill="#99DEF9"/>\n' +
            '            <path d="M396.660045,250.629674 C398.271044,217.664609 403.647285,186.016909 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C371.591216,168.006971 364.19186,208.545137 362.332655,250.629674 L396.660045,250.629674" id="path1162" fill="#80CEE9"/>\n' +
            '            <path d="M339.183911,164.970426 C339.586661,165.013979 339.989411,165.061747 340.392161,165.11654 L334.528874,217.188802 C334.126124,217.152273 333.723374,217.113872 333.320625,217.070319 C332.351215,216.958392 331.391172,216.832415 330.440496,216.68396 L330.412397,216.68396 C330.248487,216.658671 330.079894,216.63104 329.915984,216.60341 L329.433621,216.521455 L329.433621,216.484927 C323.120753,214.710018 319.318047,202.874327 320.863482,189.145244 C322.48853,174.711349 329.396156,163.643693 336.294416,164.421562 C336.861076,164.485253 337.409003,164.622469 337.938197,164.842108 C338.350313,164.876763 338.771795,164.924531 339.183911,164.970426" id="path1166" fill="#4F4C4C"/>\n' +
            '            <path d="M339.183911,164.970426 C339.586661,165.013979 339.989411,165.061747 340.392161,165.11654 L338.275383,183.849085 C331.803288,184.233102 325.921269,185.51394 321.074223,187.50802 C323.022408,173.888054 329.663095,163.671324 336.294416,164.421562 C336.861076,164.485253 337.409003,164.622469 337.938197,164.842108 C338.350313,164.876763 338.771795,164.924531 339.183911,164.970426" id="path1168" fill="#656263"/>\n' +
            '            <path d="M331.601914,166.76313 C326.928143,167.659483 322.287155,177.345614 320.90563,189.575156 C319.538154,201.80423 321.903138,212.286495 326.258455,214.198151 L331.601914,166.76313" id="path1170" fill="#E2ECED"/>\n' +
            '            <polyline id="path1172" fill="#E9E9E9" points="337.966296 165.363341 339.06215 165.482293 334.453944 206.404944 333.367456 206.284119 337.966296 165.363341 337.966296 165.363341"/>\n' +
            '            <path d="M668.558263,110.748135 L846.882733,110.748135 C847.706965,110.748135 848.37197,111.013669 848.37197,111.342894 L848.37197,111.973712 C848.37197,112.303405 847.706965,112.577837 846.882733,112.577837 L668.558263,112.577837 C667.743398,112.577837 667.064343,112.303405 667.064343,111.973712 L667.064343,111.342894 C667.064343,111.013669 667.743398,110.748135 668.558263,110.748135" id="path1174" fill="#99DEF9"/>\n' +
            '            <path d="M877.177942,110.748135 L1055.82086,110.748135 C1056.6451,110.748135 1057.32415,111.013669 1057.32415,111.342894 L1057.32415,111.973712 C1057.32415,112.303405 1056.6451,112.577837 1055.82086,112.577837 L877.177942,112.577837 C876.35371,112.577837 875.674655,112.303405 875.674655,111.973712 L875.674655,111.342894 C875.674655,111.013669 876.35371,110.748135 877.177942,110.748135" id="path1176" fill="#99DEF9"/>\n' +
            '            <path d="M583.629584,110.839925 L650.977769,110.839925 C651.286856,110.839925 651.544429,111.10499 651.544429,111.432342 L651.544429,112.065502 C651.544429,112.403624 651.286856,112.669158 650.977769,112.669158 L583.629584,112.669158 C583.320497,112.669158 583.062925,112.403624 583.062925,112.065502 L583.062925,111.432342 C583.062925,111.10499 583.320497,110.839925 583.629584,110.839925" id="path1178" fill="#99DEF9"/>\n' +
            '            <path d="M1162.65726,154.433369 C1159.18237,139.789201 1156.0353,130.276346 1153.22542,125.895272 C1154.26039,125.739792 1156.17111,126.023122 1157.92729,126.261025 C1160.78868,126.652535 1161.35534,126.233863 1162.21704,129.442279 C1163.57983,134.603096 1164.4509,145.304531 1164.76935,151.213712 C1164.88643,153.335642 1164.87706,153.610073 1162.65726,154.433369" id="path1180" fill="#ED1C24"/>\n' +
            '            <path d="M1152.26538,175.395556 C1152.85077,175.395556 1153.43616,175.395556 1154.02155,175.395556 C1154.32127,174.839667 1154.70529,175.717756 1155.05653,177.931006 C1158.50331,208.600398 1161.65038,240.970705 1162.24514,271.996484 C1162.26387,273.311509 1161.66911,273.871612 1160.33442,273.825717 C1159.38843,274.081885 1159.02314,273.4417 1159.12617,272.014748 C1158.64849,241.135083 1155.23917,211.142873 1152.0921,178.489236 C1151.76896,176.852011 1151.87199,175.688252 1152.26538,175.395556" id="path1182" fill="#EAF1F3"/>\n' +
            '            <path d="M572.717876,117.855263 C572.408789,117.763942 572.113752,117.718047 571.884278,117.734438 C503.57605,118.404127 438.48982,126.169704 428.613085,139.222073 C409.23894 ,443.97343 1124.98142,444.401469 1131.38327,436.875669 C1133.61713,434.250771 1135.49975,431.113069 1137.35427,427.68314 C1147.97562,408.088897 1151.44114,345.399028 1154.32127,308.665443 L1154.29786,283.603638 L1154.32127,258.539492 C1151.44114,221.817146 1147.97562,159.116505 1137.35427,139.524136 C1135.49975,136.103104 1133.61713,132.954632 1131.38327,130.338632 C1124.98142,122.812832 1115.97107,123.242743 1106.7968,122.309863 C1084.75328,120.059616 1051.3953,117.855263 1033.60407,117.855263 L572.717876,117.855263 Z M574.53025,286.310959 L574.53025,130.475848 C574.53025,128.968814 575.499659,127.724505 576.670443,127.724505 C577.841227,127.724505 578.80127,128.968814 578.80127,130.475848 L578.80127,280.896317 L578.80127,286.310959 L578.80127,436.729087 C578.80127,438.247828 577.841227,439.482302 576.670443,439.482302 C575.499659,439.482302 574.53025,438.247828 574.53025,436.729087 L574.53025,286.310959 Z M656.658414,286.310959 L656.658414,130.475848 C656.658414,128.968814 657.618457,127.724505 658.789241,127.724505 C659.969391,127.724505 660.929434,128.968814 660.929434,130.475848 L660.929434,280.896317 L660.929434,286.310959 L660.929434,436.729087 C660.929434,438.247828 659.969391,439.482302 658.789241,439.482302 C657.618457,439.482302 656.658414,438.247828 656.658414,436.729087 L656.658414,286.310959 Z M738.786577,286.310959 L738.786577,130.475848 C738.786577,128.968814 739.74662,127.724505 740.917404,127.724505 C742.097555,127.724505 743.048231,128.968814 743.048231,130.475848 L743.048231,280.896317 L743.048231,286.310959 L743.048231,436.729087 C743.048231,438.247828 742.097555,439.482302 740.917404,439.482302 C739.74662,439.482302 738.786577,438.247828 738.786577,436.729087 L738.786577,286.310959 Z M820.914741,286.310959 L820.914741,130.475848 C820.914741,128.968814 821.874784,127.724505 823.045568,127.724505 C824.225718,127.724505 825.176395,128.968814 825.176395,130.475848 L825.176395,280.896317 L825.176395,286.310959 L825.176395,436.729087 C825.176395,438.247828 824.225718,439.482302 823.045568,439.482302 C821.874784,439.482302 820.914741,438.247828 820.914741,436.729087 L820.914741,286.310959 Z M903.042905,286.310959 L903.042905,130.475848 C903.042905,128.968814 904.002948,127.724505 905.173732,127.724505 C906.353882,127.724505 907.304559,128.968814 907.304559,130.475848 L907.304559,280.896317 L907.304559,286.310959 L907.304559,436.729087 C907.304559,438.247828 906.353882,439.482302 905.173732,439.482302 C904.002948,439.482302 903.042905,438.247828 903.042905,436.729087 L903.042905,286.310959 Z M985.171068,286.310959 L985.171068,130.475848 C985.171068,128.968814 986.131111,127.724505 987.301895,127.724505 C988.482046,127.724505 989.432722,128.968814 989.432722,130.475848 L989.432722,280.896317 L989.432722,286.310959 L989.432722,436.729087 C989.432722,438.247828 988.482046,439.482302 987.301895,439.482302 C986.131111,439.482302 985.171068,438.247828 985.171068,436.729087 L985.171068,286.310959 Z M1067.29923,286.310959 L1067.29923,130.475848 C1067.29923,128.968814 1068.25927,127.724505 1069.43006,127.724505 C1070.61021,127.724505 1071.56557,128.968814 1071.56557,130.475848 L1071.56557,280.896317 L1071.56557,286.310959 L1071.56557,436.729087 C1071.56557,438.247828 1070.61021,439.482302 1069.43006,439.482302 C1068.25927,439.482302 1067.29923,438.247828 1067.29923,436.729087 L1067.29923,286.310959 Z" id="path1184" fill="'+colorselected+'"/>\n' +
            '            <path d="M339.183911,402.234977 C339.586661,402.200322 339.989411,402.145529 340.392161,402.097761 L334.528874,350.018006 C334.126124,350.0639 333.723374,350.100429 333.320625,350.146324 C332.351215,350.255909 331.391172,350.383759 330.440496,350.530341 L330.412397,350.530341 C330.248487,350.548605 330.079894,350.576235 329.915984,350.612764 L329.433621,350.685821 L329.433621,350.720476 C323.120753,352.506156 319.318047,364.332949 320.863482,378.071398 C322.48853,392.495458 329.396156,403.572481 336.294416,402.79508 C336.861076,402.730921 337.409003,402.584339 337.938197,402.372193 C338.350313,402.328171 338.771795,402.291643 339.183911,402.234977" id="path1186" fill="#4F4C4C"/>\n' +
            '            <path d="M339.183911,402.234977 C339.586661,402.200322 339.989411,402.145529 340.392161,402.097761 L338.275383,383.358191 C331.803288,382.973705 325.921269,381.693336 321.074223,379.697383 C323.022408,393.31688 329.663095,403.542977 336.294416,402.79508 C336.861076,402.730921 337.409003,402.584339 337.938197,402.372193 C338.350313,402.328171 338.771795,402.291643 339.183911,402.234977" id="path1188" fill="#656263"/>\n' +
            '            <path d="M331.601914,400.453512 C326.928143,399.556691 322.287155,389.861194 320.90563,377.63212 C319.538154,365.403045 321.903138,354.930147 326.258455,353.018023 L331.601914,400.453512" id="path1190" fill="#E2ECED"/>\n' +
            '            <polyline id="path1192" fill="#E9E9E9" points="337.966296 401.852833 339.06215 401.724515 334.453944 360.802332 333.367456 360.930182 337.966296 401.852833 337.966296 401.852833"/>\n' +
            '            <path d="M568.545202,105.836462 C488.430787,106.952453 428.795727,113.510718 394.24823,123.928823 C391.485179,120.416471 390.314395,116.007766 387.541978,112.870533 C394.290378,110.528965 401.516457,108.781686 411.725695,107.016612 C412.301721,108.827581 414.624556,109.705669 415.612698,109.934206 C416.591474,110.162743 418.413214,109.842885 419.307693,109.193334 L420.103826,105.71751 C453.738112,100.586198 502.77055,98.2994221 568.545202,99.3128529 L568.545202,99.1686123 L1041.12518,99.1686123 L1046.93227,99.1686123 C1072.50688,100.476612 1115.44187,101.290541 1131.84222,108.187396 C1138.41734,110.958408 1143.83105,115.230365 1148.26598,120.471263 C1154.03092,126.90121 1158.8967,140.328698 1162.85863,160.735465 L1155.64192,160.735465 C1151.90946,144.225536 1147.26379,131.657871 1141.70022,123.032471 C1134.32896,112.303405 1121.82499,109.33055 1081.05829,107.490077 L1053.25919,106.156788 L568.545202,106.156788 L568.545202,105.836462 Z M568.545202,461.378775 C488.430787,460.264189 428.795727,453.707798 394.24823,443.278453 C391.485179,446.800171 390.314395,451.197637 387.541978,454.344704 C394.290378,456.686273 401.516457,458.433082 411.725695,460.198625 C412.301721,458.381568 414.624556,457.501138 415.612698,457.271665 C416.591474,457.051557 418.413214,457.365327 419.307693,458.020966 L420.103826,461.49117 C453.738112,466.628571 502.77055,468.909259 568.545202,467.902384 L568.545202,468.038195 L1041.12518,468.038195 L1046.93227,468.038195 C1072.50688,466.7316 1115.44187,465.916734 1131.84222,459.018474 C1138.41734,456.255424 1143.83105,451.975037 1148.26598,446.734608 C1154.03092,440.314964 1158.8967,426.887475 1162.85863,406.481177 L1155.64192,406.481177 C1151.90946,422.991106 1147.26379,435.558302 1141.70022,444.183703 C1134.32896,454.911364 1121.82499,457.885155 1081.05829,459.725628 L1053.25919,461.060322 L568.545202,461.060322 L568.545202,461.378775 Z M1163.29416,404.185035 C1168.41751,376.726401 1171.98606,337.256459 1174.01386,285.835152 L1174.19182,285.844519 L1174.14499,284.618942 L1166.82525,284.618942 C1165.88394,335.76769 1162.32475,375.629142 1156.14301,404.185035 L1163.29416,404.185035 Z M1174.13562,282.734448 L1174.19182,281.362757 L1174.01386,281.369782 C1171.98606,229.948944 1168.41751,190.478533 1163.29416,163.021773 L1156.14301,163.021773 C1162.33412,191.614662 1165.8933,231.512643 1166.82525,282.734448 L1174.13562,282.734448 Z" id="path1194" fill="#81EF00"/>\n' +
            '            <path d="M395.966941,126.133175 C408.321055,127.916514 419.106318,130.98069 431.474481,132.773863 C449.668466,124.706224 486.76359,116.62032 572.160583,115.742232 C572.553966,115.760496 572.94735,115.797493 573.331367,115.861184 L573.331367,116.062559 L574.235212,116.062559 C574.53025,116.144982 574.820604,116.226937 575.106276,116.33699 L575.106276,116.062559 L1041.26099,116.062559 C1069.25678,116.382885 1089.0243,118.294541 1110.41687,120.489528 C1121.62361,121.632681 1128.06293,122.986576 1133.486,129.096664 C1141.00712,137.557218 1143.63904,149.548857 1145.77923,160.735465 L1153.68437,160.735465 C1149.54916,142.578945 1144.25253,129.460544 1137.81322,121.468303 C1132.7086,116.02603 1125.37481,112.806374 1115.81653,111.809334 C1115.80716,111.736277 1115.79779,111.662752 1115.79779,111.587822 C1095.55728,110.025527 1061.64669,107.290576 1039.44862,107.290576 L575.106276,107.290576 L575.106276,107.281678 C573.996372,107.208621 572.825588,107.226885 571.575191,107.334597 C483.67272,108.845845 422.801313,116.016664 395.966941,126.133175 Z M395.966941,441.082999 C408.321055,439.290294 419.106318,436.235484 431.474481,434.442779 C449.668466,442.501052 486.76359,450.588829 572.160583,451.473942 C572.553966,451.455209 572.94735,451.408378 573.331367,451.347497 L573.331367,451.155488 L574.235212,451.155488 C574.53025,451.071192 574.820604,450.977529 575.106276,450.879183 L575.106276,451.155488 L1041.26099,451.155488 C1069.25678,450.832352 1089.0243,448.912266 1110.41687,446.725241 C1121.62361,445.57319 1128.06293,444.227725 1133.486,438.11951 C1141.00712,429.658956 1143.63904,417.658418 1145.77923,406.481177 L1153.68437,406.481177 C1149.54916,424.62833 1144.25253,437.744391 1137.81322,445.7371 C1132.7086,451.18827 1125.37481,454.410268 1115.81653,455.39841 C1115.80716,455.47334 1115.79779,455.552953 1115.79779,455.627884 C1095.55728,457.182685 1061.64669,459.912954 1039.44862,459.912954 L575.106276,459.912954 L575.106276,459.936369 C573.996372,460.006616 572.825588,459.987884 571.575191,459.870805 C483.67272,458.372202 422.801313,451.197637 395.966941,441.082999 Z M1151.79706,392.61441 C1152.54168,392.61441 1153.29098,392.61441 1154.03092,392.61441 C1154.41494,393.17264 1154.8973,392.294551 1155.34688,390.07896 C1158.40965,368.593198 1160.57794,343.588059 1161.85176,315.059329 C1162.16084,308.025258 1162.33412,301.1654 1162.50271,294.296175 C1162.52613,292.988175 1161.75809,292.429945 1160.06748,292.466942 C1158.87797,292.210774 1158.40497,292.859857 1158.54078,294.277911 C1157.92729,325.166474 1155.56699,356.878332 1151.57696,389.531969 C1151.16952,391.160296 1151.30533,392.321714 1151.79706,392.61441 Z M582.140347,457.14522 L652.743312,457.14522 C653.071131,457.14522 653.33807,456.606659 653.33807,455.946337 L653.33807,454.667841 C653.33807,454.007518 653.071131,453.454908 652.743312,453.454908 L582.140347,453.454908 C581.807844,453.454908 581.545588,454.007518 581.545588,454.667841 L581.545588,455.946337 C581.545588,456.606659 581.807844,457.14522 582.140347,457.14522 Z M666.984729,457.337228 L849.121272,457.337228 C849.964236,457.337228 850.652657,456.789302 850.652657,456.128979 L850.652657,454.850483 C850.652657,454.190161 849.964236,453.642234 849.121272,453.642234 L666.984729,453.642234 C666.141765,453.642234 665.458027,454.190161 665.458027,454.850483 L665.458027,456.128979 C665.458027,456.789302 666.141765,457.337228 666.984729,457.337228 Z M875.4124,457.337228 L1057.54894,457.337228 C1058.39191,457.337228 1059.08033,456.789302 1059.08033,456.128979 L1059.08033,454.850483 C1059.08033,454.190161 1058.39191,453.642234 1057.54894,453.642234 L875.4124,453.642234 C874.578801,453.642234 873.895063,454.190161 873.895063,454.850483 L873.895063,456.128979 C873.895063,456.789302 874.578801,457.337228 875.4124,457.337228 Z M1154.19483,404.185035 C1160.26886,376.223432 1163.69691,336.837786 1164.40407,286.310959 L1164.46495,286.310959 L1164.4509,284.618942 L1156.30692,284.618942 L1156.29756,286.310959 L1156.31629,286.310959 C1156.38185,330.178835 1153.3706,368.092102 1147.03431,399.995969 C1146.75801,401.368128 1146.49575,402.767449 1146.21945,404.185035 L1154.19483,404.185035 Z M1164.4509,282.734448 L1164.46495,280.896317 L1164.40407,280.896317 C1163.69691,230.369489 1160.26886,190.992742 1154.19483,163.021773 L1146.21945,163.021773 C1146.49575,164.439826 1146.75801,165.839148 1147.03431,167.211306 C1153.3706,199.122198 1156.38185,237.028441 1156.31629,280.896317 L1156.29756,280.896317 L1156.30692,282.734448 L1164.4509,282.734448 Z M549.831388,454.555445 C500.630357,452.527647 462.893644,448.280043 436.616565,441.814973 C434.51852,441.300764 430.814159,441.156524 428.748896,441.474509 C427.395469,441.686655 426.032677,441.886156 424.67925,442.098303 C420.197489,442.793748 418.090077,443.744893 423.883117,444.924575 C456.974159,451.637851 498.850765,455.871407 549.742409,457.234199 C551.526684,457.318496 552.346233,457.346595 552.191689,455.890139 C552.018413,454.190161 551.358091,454.621009 549.831388,454.555445 Z M1151.79706,174.592398 C1152.54168,174.592398 1153.29098,174.592398 1154.03092,174.592398 C1154.41494,174.034636 1154.8973,174.912724 1155.34688,177.135341 C1158.40965,198.621103 1160.57794,223.628115 1161.85176,252.156845 C1162.16084,259.18155 1162.33412,266.050774 1162.50271,272.911101 C1162.52613,274.227999 1161.75809,274.786229 1160.06748,274.740334 C1158.87797,275.005399 1158.40497,274.356317 1158.54078,272.938263 C1157.92729,242.0497 1155.56699,210.33831 1151.57696,177.684205 C1151.16952,176.055878 1151.30533,174.89446 1151.79706,174.592398 Z M582.140347,110.062056 L652.743312,110.062056 C653.071131,110.062056 653.33807,110.602022 653.33807,111.269837 L653.33807,112.550206 C653.33807,113.206782 653.071131,113.748621 652.743312,113.748621 L582.140347,113.748621 C581.807844,113.748621 581.545588,113.206782 581.545588,112.550206 L581.545588,111.269837 C581.545588,110.602022 581.807844,110.062056 582.140347,110.062056 Z M666.984729,109.879414 L849.121272,109.879414 C849.964236,109.879414 850.652657,110.417038 850.652657,111.086726 L850.652657,112.358198 C850.652657,113.026013 849.964236,113.56551 849.121272,113.56551 L666.984729,113.56551 C666.141765,113.56551 665.458027,113.026013 665.458027,112.358198 L665.458027,111.086726 C665.458027,110.417038 666.141765,109.879414 666.984729,109.879414 Z M875.4124,109.879414 L1057.54894,109.879414 C1058.39191,109.879414 1059.08033,110.417038 1059.08033,111.086726 L1059.08033,112.358198 C1059.08033,113.026013 1058.39191,113.56551 1057.54894,113.56551 L875.4124,113.56551 C874.578801,113.56551 873.895063,113.026013 873.895063,112.358198 L873.895063,111.086726 C873.895063,110.417038 874.578801,109.879414 875.4124,109.879414 Z M549.831388,112.659792 C500.630357,114.6904 462.893644,118.934726 436.616565,125.392303 C434.51852,125.913536 430.814159,126.060118 428.748896,125.739792 C427.395469,125.529519 426.032677,125.319246 424.67925,125.108505 C420.197489,124.422425 418.090077,123.462383 423.883117,122.291598 C456.974159,115.568488 498.850765,111.333527 549.742409,109.968862 C551.526684,109.897678 552.346233,109.870047 552.191689,111.31339 C552.018413,113.026013 551.358091,112.596101 549.831388,112.659792 Z" id="path1196" fill="#000000"/>\n' +
            '        </g>\n' +
            '    </g>\n' +
            '</svg>';
        let car = '';
        if(data.vehicletype == 'Car'){
            car = car8500;
        }else if(data.vehicletype == 'wheelchair van' || data.vehicletype == 'Van' ){
            car = car8600;
        }else{
            car = car8500;
            left= 50;
            right = 50;
        }
            
        if(!icon[data.vehiclenumber]){
            icon[data.vehiclenumber] = {
                position : { lat:olddata.lat , lng: olddata.lng },
                //position: new google.maps.LatLng(olddata.lat, olddata.lng),
                url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(car),
                // size: new google.maps.Size(50, 50),
                scaledSize: new google.maps.Size(40, 40), // scaled size
                origin: new google.maps.Point(0,0), // origin
                anchor: new google.maps.Point(20, 20) ,// anchor
                labelOrigin: { x:20, y: 60}
                // rotation: 250,// orig 10,50 back of car, 10,0 front of car, 10,25 center of car
            };
        }
        //var symbol = {  
        //    path: "M62.1,36.5c-0.9-1.2-3.6-1.5-3.6-1.5c0.1-3.5,0.5-6.9,0.7-8.2c1.9-7.3-1.7-11.8-1.7-11.8c-4.8-4.8-9.1-5-12.5-5   c-3.4,0-7.8,0.3-12.5,5c0,0-3.6,4.5-1.7,11.8c0.2,1.2,0.5,4.6,0.7,8.2c0,0-2.7,0.3-3.6,1.5c-0.9,1.2-0.9,1.9,0,1.9   c0.9,0,2.9-2.3,3.6-2.3V35c0,1,0.1,2,0.1,3c0,4.4,0,33.7,0,33.7s-0.3,6.1,5,7.8c1.2,0,4.6,0.4,8.4,0.5c3.8-0.1,7.3-0.5,8.4-0.5   c5.3-1.7,5-7.8,5-7.8s0-29.3,0-33.7c0-1,0-2,0.1-3v1.2c0.7,0,2.7,2.3,3.6,2.3C63,38.5,63,37.7,62.1,36.5z M34.7,66.5   c-0.3,3.3-2.3,4.1-2.3,4.1V37.4c0.8,1.2,2.3,6.8,2.3,6.8S34.9,63.2,34.7,66.5z M54.8,75.2c0,0-4.2,2.3-9.8,2.2   c-5.6,0.1-9.8-2.2-9.8-2.2v-2.8c4.9,2.2,9.8,2.2,9.8,2.2s4.9,0,9.8-2.2V75.2z M35.2,41.1l-1.7-10.2c0,0,4.5-3.2,11.5-3.2   s11.5,3.2,11.5,3.2l-1.7,10.2C51.4,39.2,38.6,39.2,35.2,41.1z M57.7,70.6c0,0-2.1-0.8-2.3-4.1c-0.3-3.3,0-22.4,0-22.4   s1.5-5.6,2.3-6.8V70.6z",
        //    fillColor: colorselected,
        //    fillOpacity: .9,
        //    anchor: new google.maps.Point(45, 60),
        //    strokeWeight: .5,
        //    scale: .45,
        //    rotation: parseInt(0), 
        //    scaledSize: new google.maps.Size(50, 50), // scaled size
        //    origin: new google.maps.Point(45, 60), // origin
        //    anchor: new google.maps.Point(45, 60) // anchor
        //}
    
        //var marker = new google.maps.Marker({
        //    position: new google.maps.LatLng(olddata.lat, olddata.lng),
        //    icon: icon[data.vehiclenumber],
        //   // icon: symbol,
        //    draggable:true,
        //    label: {
        //        text: data.vehiclenumber,
        //        color: "red",
        //        fontSize: "12px",
        //        fontWeight: "bold",
        //        background: "black",
        //        draggable: true,
        //        fillColor: '#0084ff',
        //        fillOpacity: 1,
        //        strokeColor: '#ffffff',
        //    },
        //    map: map
        //});


        let  classdata =     data.vehiclenumber ?  'mLabel labels'+1 : '';
        var marker = new google.maps.Marker({
            position: new google.maps.LatLng(olddata.lat, olddata.lng),
            icon: icon[data.vehiclenumber],
            // icon: symbol,
            draggable:true,
       
            label: {
                text: data.vehiclenumber,
                color: "red",
                fontSize: "13px",
                fontWeight: "bold",
                background: "black",
                draggable: true,
                className : classdata,
                fillColor: '#0084ff',
                fillOpacity: 2,
                strokeColor: '#ffffff',
            },
            map: map
        });
        const contentString =
              '<div id="content">' +
              '<div id="siteNotice">' +
              "</div>" +
              '<h4 id="firstHeading" class="firstHeading">'+data.drivername +'/'+data.vehiclenumber+'</h4>' +
              '<div id="bodyContent">' +
              '<h6>App Version:'+data.appver+'</h6>'+
              '<h6>Vehicle Type:'+data.vehicletype+'</h6>'+
              '<h6>GPS Status:'+data.GPSstatus+'</h6>'+

              '<h6>Vehicle status:'+data.vehiclestatus+'</h6>'+
              '<h6>Vehicle Speed:'+data.speed+'</h6>'+
              '<h6>Zone name:'+data.zonename+'</h6>'+
    
    
    
              '<h6>Last Update Time:'+data.time+'</h6>'+
              "</div>" +
              "</div>";

            infowindow[data.vehiclenumber] = new google.maps.InfoWindow({
                content: contentString,
                disableAutoPan: true
            });

            markers[data.vehiclenumber] = marker;  
            if(data.Direction){

                if($('img[src="'+icon[data.vehiclenumber].url+'"]')){
                    try{
                        $('img[src="'+icon[data.vehiclenumber].url+'"]').css({
                            'transform': 'rotate(' +  parseInt(data.Direction)  + 'deg)',
                            'transform-origin': 'center center'
                        });
                    }catch (e){
                        console.log(e);
                    }
                }
            }
    }
 
 
    console.log(SomeSession2);
     
    var cars_Ref = firebase.database().ref("online/" + SomeSession2 + "");
    console.log(cars_Ref);
     //this event will be triggered when a new object will be added in the database...
    cars_Ref.on('child_added', function (data) {
        data.forEach(function (childsnapshot) {
            cars_count++;
      
     
       AddCar(childsnapshot.val() ,   childsnapshot.val());
          

            angular.element(document.getElementById('myangular')).scope().adddrivernew(childsnapshot.val());
              
           
        });


    });

    // this event will be triggered on location change of any car...
    cars_Ref.on('child_changed', function (data) {
   
    
        data.forEach(function (childsnapshot) {
        
               
            var   datax =    angular.element(document.getElementById('myangular')).scope().getcurrentchild(childsnapshot.val());
       
            if(datax == ''){
                datax == childsnapshot.val();
            }
              
            var totaldis =   distance(childsnapshot.val().lat, childsnapshot.val().lng, datax.lat, datax.lng, "K")
          
           
           
            
            var colorselected = '#80ff80';
            var ImageUrl;
            if (childsnapshot.val().vehiclestatus == 'Available') {
                colorselected = '#00e600';  
                ImageUrl = 'img/green.png';
            }
            else if (childsnapshot.val().vehiclestatus == 'Picking') {
                colorselected = '#3333ff';
                ImageUrl = 'img/blue.png';
            } else if (childsnapshot.val().vehiclestatus == 'Away') {
                colorselected = '#ffaf1a';
                ImageUrl = 'img/yellow.png';
            } else if (childsnapshot.val().vehiclestatus == 'Busy') {
                colorselected = '#ff3333';
                ImageUrl = 'img/red.png';  
            }
            var latlng = new google.maps.LatLng(parseFloat(childsnapshot.val().lat), parseFloat(childsnapshot.val().lng));
         
            if(markers[childsnapshot.val().vehiclenumber]){
                  car8500 = '<svg width="479px"    height="1077px" viewBox="0 0 479 1077" version="1.1" id="car8500'+childsnapshot.val().vehiclenumber+'" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
             '    <!-- Generator: Sketch 48.1 (47250) - http://www.bohemiancoding.com/sketch -->\n' +
             '    <title>8851</title>\n' +
             '    <desc>Created with Sketch.</desc>\n' +
             '    <defs>\n' +
             '        <linearGradient x1="116.889801%" y1="79.3129284%" x2="-101.602921%" y2="8.5929469%" id="linearGradient-1">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#666666" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="48.4035551%" y1="46.3104921%" x2="230.770532%" y2="105.387505%" id="linearGradient-2">\n' +
             '            <stop stop-color="#1B1B1B" offset="0%"></stop>\n' +
             '            <stop stop-color="#999999" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="100.015769%" y1="38.2124928%" x2="68.8037214%" y2="38.3500287%" id="linearGradient-3">\n' +
             '            <stop stop-color="#333333" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="78.7830836%" y1="59.1637822%" x2="65.4330326%" y2="49.9947278%" id="linearGradient-4">\n' +
             '            <stop stop-color="#333333" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="84.7680978%" y1="61.9658847%" x2="68.6765137%" y2="49.9982976%" id="linearGradient-5">\n' +
             '            <stop stop-color="#1A1A1A" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="65.0302038%" y1="78.3936536%" x2="60.1764273%" y2="49.9982976%" id="linearGradient-6">\n' +
             '            <stop stop-color="#1A1A1A" offset="0%"></stop>\n' +
             '            <stop stop-color="#808080" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="91.3856021%" y1="62.7934859%" x2="7.14535974%" y2="50.0138211%" id="linearGradient-7">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#B3B3B3" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="102.108719%" y1="68.3750211%" x2="7.19888703%" y2="49.9893914%" id="linearGradient-8">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#CCCCCC" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="91.3856021%" y1="37.4078595%" x2="7.14535974%" y2="50.1875243%" id="linearGradient-9">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#B3B3B3" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="102.108719%" y1="31.5368345%" x2="7.19888703%" y2="49.9224642%" id="linearGradient-10">\n' +
             '            <stop stop-color="#000000" offset="0%"></stop>\n' +
             '            <stop stop-color="#CCCCCC" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="92.8070247%" y1="12.5874107%" x2="16.0330775%" y2="43.8923185%" id="linearGradient-11">\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0.59523809" offset="0%"></stop>\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="93.1666803%" y1="89.5805416%" x2="17.3363841%" y2="61.3479231%" id="linearGradient-12">\n' +
             '            <stop stop-color="#000000" stop-opacity="0.48809522" offset="0%"></stop>\n' +
             '            <stop stop-color="#2D2D2D" stop-opacity="0.10714286" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="46.0612785%" y1="57.9411442%" x2="43.5448504%" y2="33.2353005%" id="linearGradient-13">\n' +
             '            <stop stop-color="#AC8701" offset="0%"></stop>\n' +
             '            <stop stop-color="#EFBB01" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '        <linearGradient x1="95.5175667%" y1="90.8010012%" x2="46.0945729%" y2="100%" id="linearGradient-14">\n' +
             '            <stop stop-color="#FEFFFF" stop-opacity="0" offset="0%"></stop>\n' +
             '            <stop stop-color="#4D9BEB" offset="100%"></stop>\n' +
             '        </linearGradient>\n' +
             '    </defs>\n' +
             '    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
             '        <g id="8851" transform="translate(239.500000, 517.500000) rotate(-90.000000) translate(-239.500000, -517.500000) translate(-319.500000, 229.500000)">\n' +
             '            <path d="M650.682608,110.979523 C630.347678,110.979523 613.522909,113.336012 595.623233,120.852106 C595.623233,120.852106 514.888685,116.668883 421.563846,118.074282 C328.276724,119.479164 245.76438,108.279389 175.886899,110.228527 C106.009418,112.177492 35.737634,133.373894 35.737634,133.373894 L22.9056187,139.789563 C7.95122069,147.273631 0,224.919766 0,286.354734 C0,346.500923 5.54133908,426.299051 22.0458651,430.891352 L33.7746871,434.152749 C33.7746871,434.152749 107.278048,456.649842 164.21208,458.385766 C221.148683,460.121949 297.058154,450.039087 363.892638,450.182381 L587.591437,450.662017 C608.081517,461.010231 626.601792,459.970921 650.676608,459.970921 C764.913259,459.970921 811.535391,384.929105 810.995366,285.4635 C810.473685,189.120142 739.217513,110.990607 650.676608,110.990607 L650.682608,110.979523 Z" id="path3855" fill="#E1E1E1" fill-rule="nonzero" opacity="0.628702192"></path>\n' +
             '            <path d="M647.008325,121.940342 C627.47576,121.940342 611.314853,124.202572 594.121453,131.418022 C594.121453,131.418022 516.572485,127.402128 426.930008,128.751311 C337.323758,130.099997 258.067142,119.348213 190.946849,121.219386 C123.826556,123.090393 56.3275177,143.438939 56.3275177,143.438939 L44.0018212,149.59798 C29.6374857,156.782686 22,231.322975 22,290.300545 C22,348.040886 27.3226919,424.647089 43.1759913,429.055698 L54.4420237,432.186639 C54.4420237,432.186639 125.045129,453.783848 179.732688,455.450336 C234.422718,457.117071 307.336993,447.437524 371.534359,447.575086 L586.406572,448.035537 C606.088165,457.969822 623.877677,456.972084 647.002561,456.972084 C756.731725,456.972084 801.514266,384.93194 800.995549,289.44496 C800.494452,196.955336 732.049868,121.950983 647.002561,121.950983 L647.008325,121.940342 Z" id="path2853" fill="'+colorselected+'" fill-rule="nonzero"></path>\n' +
             '            <path d="M647.008325,121.940342 C627.47576,121.940342 611.314853,124.202572 594.121453,131.418022 C594.121453,131.418022 516.572485,127.402128 426.930008,128.751311 C337.323758,130.099997 258.067142,119.348213 190.946849,121.219386 C123.826556,123.090393 56.3275177,143.438939 56.3275177,143.438939 L44.0018212,149.59798 C29.6374857,156.782686 22,231.322975 22,290.300545 C22,348.040886 27.3226919,424.647089 43.1759913,429.055698 L54.4420237,432.186639 C54.4420237,432.186639 125.045129,453.783848 179.732688,455.450336 C234.422718,457.117071 307.336993,447.437524 371.534359,447.575086 L586.406572,448.035537 C606.088165,457.969822 623.877677,456.972084 647.002561,456.972084 C756.731725,456.972084 801.514266,384.93194 800.995549,289.44496 C800.494452,196.955336 732.049868,121.950983 647.002561,121.950983 L647.008325,121.940342 Z" id="path2853" stroke="#979797" stroke-width="5" fill="'+colorselected+'" fill-rule="nonzero"></path>\n' +
             '            <path d="M422.271693,207.531623 C424.757231,242.326018 426,268.878238 426,287.188285 C426,304.977639 424.826909,327.474954 422.480726,354.680231 C421.831071,362.213348 415.476312,368 407.853285,368 L371.680851,368 C363.572841,368 357,361.480966 357,353.439331 L357,208.56067 C357,200.519034 363.572841,194.000001 371.680851,194.000001 L407.627551,194 C415.332945,194 421.727129,199.908416 422.271693,207.531623 Z" id="Path-6" stroke="#000000" fill="#2D2D2D"></path>\n' +
             '            <path d="M474.660466,476.999405 C473.356474,476.991884 470.537439,476.740508 469.026803,476.210888 L466,474.95225 L474.726408,440 L498,440.363929 L485.657538,471.11626 C484.014325,474.8224 478.572441,477.02272 474.660725,476.999823 L474.660466,476.999405 Z" id="path3733" fill-opacity="0.99607999" fill="#AA0000" fill-rule="nonzero"></path>\n' +
             '            <path d="M541.748766,144 C538.80025,144.057257 535.856628,144.50919 532.936406,145.352958 C532.892895,145.298831 532.848721,145.241038 532.805243,145.18706 L532.810102,145.177396 L481.530992,155.337469 C465.569284,161.20303 455,167.10702 455,181.726597 L455,388.69217 C455,403.311748 466.832822,409.634418 481.530992,415.0813 L534.46343,425.233322 C534.485443,425.21212 534.506195,425.188518 534.528199,425.167283 C536.92624,425.70827 539.336478,425.986232 541.748766,426 C579.443164,425.999276 610.000254,362.871124 610,284.999194 C609.999823,207.127894 579.442859,144.000724 541.748766,144 Z" id="path3703" stroke="#000000" stroke-width="1.96000004" fill="url(#linearGradient-1)" fill-rule="nonzero"></path>\n' +
             '            <path d="M187.380103,176 C165.033857,177.830794 142.703144,179.893198 122.59929,188.085557 C106.351562,194.706736 82,230.877982 82,280.987915 C82,331.07868 100.491753,371.790031 123.819811,375.607137 L187.380103,386 C198.249526,386 207,377.078973 207,365.997698 L207,196.003135 C207,184.92186 198.249526,176.000833 187.380103,176.000833 L187.380103,176 Z" id="rect2864" stroke="#1A1A1A" stroke-width="5" fill="url(#linearGradient-2)" fill-rule="nonzero"></path>\n' +
             '            <g id="g3672" transform="translate(222.000000, 392.000000)" fill-opacity="0.99607999" fill-rule="nonzero">\n' +
             '                <path d="M79.9652564,0.199048345 C52.5565774,0.199048345 26.3144349,1.69191093 2.07676359,4.39772437 C23.1565713,44.7995622 82.572712,29.4985501 170.945246,30.5485301 C211.763345,31.0334699 244.506053,32.1071616 270.782699,32.5182793 C232.040542,13.165804 161.087191,0.198633661 79.9636134,0.198633661 L79.9652564,0.199048345 Z" id="path3643" fill="#0E232E"></path>\n' +
             '                <path d="M2.85062091,5.79728305 C2.05054938,5.88349587 1.23324268,5.96762697 0.437451192,6.05646058 C21.5172589,46.4582984 80.9333996,31.1572863 169.305934,32.2072663 C210.124032,32.6922061 242.866741,33.7658978 269.143386,34.1770155 C267.949576,33.5806667 266.726684,32.9986493 265.472247,32.4146083 C240.086933,31.9555614 209.177002,31.0026921 170.949929,30.5485301 C83.6075613,29.5109076 24.5660267,44.4445927 2.85366048,5.79686837 L2.85062091,5.79728305 Z" id="path3649" fill="#0E232E" opacity="0.5"></path>\n' +
             '                <path d="M79.9652564,0.199048345 C77.331102,0.199048345 74.7214283,0.223514704 72.1096188,0.250883852 C72.7818232,13.6625955 77.3903324,25.3450746 84.0986567,32.4668585 C87.9363154,32.4041583 91.8990071,32.3038462 95.95954,32.1817632 C88.922696,25.3873309 83.9713235,13.746569 83.0463094,0.199670371 C82.0183607,0.195523531 80.9969019,0.199670371 79.9656672,0.199670371 L79.9652564,0.199048345 Z" id="path3658" fill="#000000" opacity="0.5"></path>\n' +
             '            </g>\n' +
             '            <g id="g3678" transform="translate(357.500000, 151.500000) scale(-1, 1) rotate(-180.000000) translate(-357.500000, -151.500000) translate(222.000000, 134.000000)" fill-opacity="0.99607999" fill-rule="nonzero">\n' +
             '                <g id="g3680">\n' +
             '                    <path d="M79.9652564,0.199048345 C52.5565774,0.199048345 26.3144349,1.69191093 2.07676359,4.39772437 C23.1565713,44.7995622 82.572712,29.4985501 170.945246,30.5485301 C211.763345,31.0334699 244.506053,32.1071616 270.782699,32.5182793 C232.040542,13.165804 161.087191,0.198633661 79.9636134,0.198633661 L79.9652564,0.199048345 Z" id="path3682" fill="#0E232E"></path>\n' +
             '                    <path d="M2.85062091,5.79728305 C2.05054938,5.88349587 1.23324268,5.96762697 0.437451192,6.05646058 C21.5172589,46.4582984 80.9333996,31.1572863 169.305934,32.2072663 C210.124032,32.6922061 242.866741,33.7658978 269.143386,34.1770155 C267.949576,33.5806667 266.726684,32.9986493 265.472247,32.4146083 C240.086933,31.9555614 209.177002,31.0026921 170.949929,30.5485301 C83.6075613,29.5109076 24.5660267,44.4445927 2.85366048,5.79686837 L2.85062091,5.79728305 Z" id="path3684" fill="#000000" opacity="0.5"></path>\n' +
             '                </g>\n' +
             '                <path d="M79.9652564,0.199048345 C77.331102,0.199048345 74.7214283,0.223514704 72.1096188,0.250883852 C72.7818232,13.6625955 77.3903324,25.3450746 84.0986567,32.4668585 C87.9363154,32.4041583 91.8990071,32.3038462 95.95954,32.1817632 C88.922696,25.3873309 83.9713235,13.746569 83.0463094,0.199670371 C82.0183607,0.195523531 80.9969019,0.199670371 79.9656672,0.199670371 L79.9652564,0.199048345 Z" id="path3686" fill="#000000" opacity="0.5"></path>\n' +
             '            </g>\n' +
             '            <path d="M749,166 C752.046883,185.24761 764.020539,200.168095 779,203 C770.754599,189.261839 760.632434,176.804461 749,166 Z" id="path3705" stroke="#000000" stroke-width="5.79449987" fill-opacity="0.99607999" fill="#000000" fill-rule="nonzero"></path>\n' +
             '            <path d="M783,374 C765.920668,375.896873 752.33947,394.135606 751,417 C764.580326,405.05159 775.191508,390.536227 783,374 Z" id="path3707" stroke="#000000" stroke-width="5.79449987" fill="#D0021B" fill-rule="nonzero"></path>\n' +
             '            <path d="M622.593363,383.272356 C622.593363,383.272356 688.29207,365.078028 709.484723,357.520409 C731.615717,349.627987 791,326 791,326 C791,326 783.792585,360.196898 765.865161,372.635647 C702.189905,416.817041 574,415.998957 574,415.998957" id="path3715" stroke="#4D4D4D" stroke-width="2"></path>\n' +
             '            <path d="M632.458307,197.727644 C632.458307,197.727644 693.918388,215.921972 713.743773,223.479591 C734.446961,231.372013 790,255 790,255 C790,255 783.25758,220.803102 766.486763,208.364353 C706.919589,164.182959 587,165.001043 587,165.001043" id="path3717" stroke="#4D4D4D" stroke-width="2"></path>\n' +
             '            <path d="M481.660466,95.0005948 C480.356474,95.0081155 477.537439,95.2594923 476.026803,95.7891116 L473,97.0477502 L481.726408,132 L505,131.636071 L492.657538,100.88374 C491.014325,97.1776001 485.572441,94.9772805 481.660725,95.000177 L481.660466,95.0005948 Z" id="rect3724" fill-opacity="0.99607999" fill="#AA0000" fill-rule="nonzero"></path>\n' +
             '            <g id="g3815" transform="translate(672.000000, 356.000000)">\n' +
             '                <path d="M32.1163606,10.8782966 L28.5238133,12.8290657 C29.3246093,13.7918824 29.9774288,14.8504147 30.4465851,16.0283003 C34.3309889,25.780481 21.7548471,40.3617266 8.68890446,45.809198 C8.27054171,45.9836336 7.22120217,46.508888 5.93128542,47.1876704 L16.9619235,43.9624677 C30.9726555,36.9231195 39.2021187,24.7510796 35.5824502,15.6639149 C34.840738,13.8017868 33.6595165,12.1964266 32.1164416,10.8781302 L32.1163606,10.8782966 Z" id="path3757"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3787" fill="url(#linearGradient-3)" fill-rule="nonzero"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3752" fill="url(#linearGradient-4)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3735" fill="url(#linearGradient-5)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3783" fill="url(#linearGradient-6)" fill-rule="nonzero"></path>\n' +
             '                <g id="g3807" transform="translate(3.444247, 11.802694)" fill-rule="nonzero">\n' +
             '                    <path d="M24.9945266,0.713778727 L21.7852323,2.45643975 C22.5005994,3.31654311 23.0837761,4.26215122 23.5028828,5.31438003 C26.9728984,14.0261981 15.7383794,27.0519163 4.06631152,31.9182515 C3.6925797,32.0740783 2.7551837,32.5432986 1.60287527,33.1496685 L11.4567649,30.2685304 C23.972832,23.9801398 31.324376,13.1066132 28.0908538,4.98886719 C27.4282674,3.325391 26.3730587,1.89129057 24.994599,0.713630023 L24.9945266,0.713778727 Z" id="path3799" fill="url(#linearGradient-3)"></path>\n' +
             '                    <path d="M23.5480841,3.68785676 L20.3387898,5.43051778 C21.0541569,6.29062114 21.6373336,7.23622925 22.0564403,8.28845806 C25.5264559,17.0002761 14.2919369,30.0259944 2.619869,34.8923295 C2.24613719,35.0481564 1.30874119,35.5173767 0.156432758,36.1237465 L10.0103224,33.2426085 C22.5263894,26.9542179 29.8779335,16.0806912 26.6444113,7.96294522 C25.9818249,6.29946902 24.9266162,4.8653686 23.5481564,3.68770805 L23.5480841,3.68785676 Z" id="path3803" fill="url(#linearGradient-4)"></path>\n' +
             '                </g>\n' +
             '            </g>\n' +
             '            <g id="g3825" transform="translate(706.000000, 203.000000) scale(-1, 1) rotate(-180.000000) translate(-706.000000, -203.000000) translate(672.000000, 178.000000)">\n' +
             '                <path d="M32.1163606,10.8782966 L28.5238133,12.8290657 C29.3246093,13.7918824 29.9774288,14.8504147 30.4465851,16.0283003 C34.3309889,25.780481 21.7548471,40.3617266 8.68890446,45.809198 C8.27054171,45.9836336 7.22120217,46.508888 5.93128542,47.1876704 L16.9619235,43.9624677 C30.9726555,36.9231195 39.2021187,24.7510796 35.5824502,15.6639149 C34.840738,13.8017868 33.6595165,12.1964266 32.1164416,10.8781302 L32.1163606,10.8782966 Z" id="path3827"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3829" fill="url(#linearGradient-3)" fill-rule="nonzero"></path>\n' +
             '                <path d="M45.7903039,4.96056985 L42.1977566,6.91133892 C42.9985526,7.87415556 43.6513721,8.9326879 44.1205284,10.1105736 C48.0049322,19.8627543 35.4287904,34.4439998 22.3628478,39.8914712 C21.944485,40.0659068 20.8951455,40.5911612 19.6052287,41.2699436 L30.6358668,38.0447409 C44.6465988,31.0053927 52.876062,18.8333528 49.2563935,9.74618807 C48.5146812,7.88406006 47.3334598,6.2786998 45.7903849,4.96040339 L45.7903039,4.96056985 Z" id="path3831" fill="url(#linearGradient-4)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3833" fill="url(#linearGradient-5)" fill-rule="nonzero"></path>\n' +
             '                <path d="M64.4917894,0.224723802 L59.4824629,1.75933768 C60.259797,3.18491889 60.8219265,4.69930763 61.1268983,6.31107667 C63.6523275,19.6563413 44.1563122,34.8460057 26.289512,38.3550262 C23.5409604,38.894896 2.90536888,45.49292 0.25477738,45.6830197 L0.25477738,49.1163 L33.8041089,39.0053936 C55.0849422,34.430766 70.1942852,20.3216902 67.7056113,7.1695216 C67.2233802,4.62132014 66.121976,2.29259894 64.492518,0.224890264 L64.4917894,0.224723802 Z" id="path3835" fill="url(#linearGradient-6)" fill-rule="nonzero"></path>\n' +
             '                <g id="g3837" transform="translate(3.444247, 11.802694)" fill-rule="nonzero">\n' +
             '                    <path d="M24.9945266,0.713778727 L21.7852323,2.45643975 C22.5005994,3.31654311 23.0837761,4.26215122 23.5028828,5.31438003 C26.9728984,14.0261981 15.7383794,27.0519163 4.06631152,31.9182515 C3.6925797,32.0740783 2.7551837,32.5432986 1.60287527,33.1496685 L11.4567649,30.2685304 C23.972832,23.9801398 31.324376,13.1066132 28.0908538,4.98886719 C27.4282674,3.325391 26.3730587,1.89129057 24.994599,0.713630023 L24.9945266,0.713778727 Z" id="path3839" fill="url(#linearGradient-3)"></path>\n' +
             '                    <path d="M23.5480841,3.68785676 L20.3387898,5.43051778 C21.0541569,6.29062114 21.6373336,7.23622925 22.0564403,8.28845806 C25.5264559,17.0002761 14.2919369,30.0259944 2.619869,34.8923295 C2.24613719,35.0481564 1.30874119,35.5173767 0.156432758,36.1237465 L10.0103224,33.2426085 C22.5263894,26.9542179 29.8779335,16.0806912 26.6444113,7.96294522 C25.9818249,6.29946902 24.9266162,4.8653686 23.5481564,3.68770805 L23.5480841,3.68785676 Z" id="path3841" fill="url(#linearGradient-4)"></path>\n' +
             '                </g>\n' +
             '            </g>\n' +
             '            <polygon id="rect3861" fill="url(#linearGradient-7)" fill-rule="nonzero" points="163.873258 388 181 392.855109 178.843024 407.869604 161 408 163.873171 388.000529"></polygon>\n' +
             '            <polygon id="path3864" fill="url(#linearGradient-8)" fill-rule="nonzero" points="181.585873 390 197 394.855084 195.058735 409.869608 179 410 181.585873 390.000026"></polygon>\n' +
             '            <polygon id="path3882" fill="url(#linearGradient-9)" fill-rule="nonzero" points="163.873258 174 181 169.144891 178.843024 154.130396 161 154 163.873171 173.999471"></polygon>\n' +
             '            <polygon id="path3884" fill="url(#linearGradient-10)" fill-rule="nonzero" points="181.585873 174 197 169.144916 195.058735 154.130392 179 154 181.585873 173.999974"></polygon>\n' +
             '            <path d="M478.6169,471.999501 C477.470036,471.991956 474.990688,471.739763 473.66208,471.208425 L471,469.945701 L477.582617,440 L493,440.36511 L486.377363,463.386682 C484.932153,467.10485 482.057491,472.022891 478.617128,471.99992 L478.6169,471.999501 Z" id="path4291" fill-opacity="0.99607999" fill="#FF4141" fill-rule="nonzero"></path>\n' +
             '            <path d="M481.451084,100.00042 C480.178618,100.007973 477.427738,100.260444 475.953624,100.792367 L473,102.056482 L479.773315,130 L499,129.634488 L488.698048,105.909162 C487.094562,102.186897 486.32889,100.806148 481.451337,100 L481.451084,100.00042 Z" id="path4293" fill-opacity="0.99607999" fill="#FF4141" fill-rule="nonzero"></path>\n' +
             '            <path d="M194.238783,146 L47.9698071,158.776225 C47.9698071,158.776225 43.7906931,160.601402 39.6115798,187.979029 C35.4324658,215.356647 36.0294823,233 36.0294823,233 C36.0294823,233 79.0146493,188.587416 115.432644,180.069932 C151.850631,171.552449 202,169.118885 202,169.118885 L194.238783,146 Z" id="path4305" fill="url(#linearGradient-11)"></path>\n' +
             '            <path d="M194.238783,414 L47.969805,401.223775 C47.969805,401.223775 43.790691,399.398598 39.6115769,372.020971 C35.4324629,344.643353 36.0294827,327 36.0294827,327 C36.0294827,327 79.0146496,371.412584 115.432645,379.930068 C151.850631,388.447551 202,390.881115 202,390.881115 L194.238783,414 Z" id="path4307" fill="url(#linearGradient-12)"></path>\n' +
             '            <path d="M789,322.682352 C789,322.682352 733.413566,344.817648 709.172868,353.170586 C684.93217,361.523533 598,387 598,387 L609.702408,348.994117 C609.702408,348.994117 629.939877,354.313874 730.070025,331.452943 C774.597196,321.28685 788.582059,316 788.582059,316 L789,322.682352 Z" id="path4327" fill="url(#linearGradient-13)" opacity="0.6"></path>\n' +
             '            <path d="M789,198.682352 C789,198.682352 733.413566,220.817648 709.172868,229.170586 C684.93217,237.523533 598,263 598,263 L609.702408,224.994117 C609.702408,224.994117 629.939877,230.313874 730.070025,207.452943 C774.597196,197.28685 788.582059,192 788.582059,192 L789,198.682352 Z" id="path4327" fill="url(#linearGradient-13)" opacity="0.6" transform="translate(693.500000, 227.500000) scale(1, -1) translate(-693.500000, -227.500000) "></path>\n' +
             '            <rect id="rect4341" fill="#000000" fill-rule="nonzero" x="793" y="269" width="2" height="41" rx="1"></rect>\n' +
             '            <polygon id="Path" fill="url(#linearGradient-14)" opacity="0.685847496" transform="translate(927.500000, 153.500000) rotate(6.000000) translate(-927.500000, -153.500000) " points="751 177.967358 1091.33632 18 1104 289 780.478994 221.397776"></polygon>\n' +
             '            <polygon id="Path" fill="url(#linearGradient-14)" opacity="0.685847496" transform="translate(926.500000, 422.500000) scale(1, -1) rotate(6.000000) translate(-926.500000, -422.500000) " points="750 446.967358 1090.33632 287 1103 558 779.478994 490.397776"></polygon>\n' +
             '        </g>\n' +
             '    </g>\n' +
             '</svg>';

                  car8600 =    '<svg xmlns="http://www.w3.org/2000/svg"   id="car8600'+childsnapshot.val().vehiclenumber+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="533px" height="1177px" viewBox="0 0 533 1177" version="1.1">\n' +
         '    <!-- Generator: Sketch 48.1 (47250) - http://www.bohemiancoding.com/sketch -->\n' +
         '    <title>8880</title>\n' +
         '    <desc>Created with Sketch.</desc>\n' +
         '    <defs>\n' +
         '        <linearGradient x1="95.5175667%" y1="90.8010012%" x2="46.0945729%" y2="100%" id="linearGradient-1">\n' +
         '            <stop stop-color="#FEFFFF" stop-opacity="0" offset="0%"/>\n' +
         '            <stop stop-color="#4D9BEB" offset="100%"/>\n' +
         '        </linearGradient>\n' +
         '    </defs>\n' +
         '    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
         '        <g id="8880" transform="translate(266.500000, 582.000000) rotate(90.000000) translate(-266.500000, -582.000000) translate(-328.500000, 298.500000)">\n' +
         '            <polygon id="Path" fill="url(#linearGradient-1)" opacity="0.685847496" transform="translate(176.750974, 431.386959) scale(-1, -1) translate(-176.750974, -431.386959) " points="0.250974178 455.854317 340.587297 295.886959 353.250974 566.886959 29.7299679 499.284735"/>\n' +
         '            <polygon id="Path" fill="url(#linearGradient-1)" opacity="0.685847496" transform="translate(189.734052, 136.374938) scale(-1, 1) translate(-189.734052, -136.374938) " points="13.2340515 160.842297 353.570374 0.874938449 366.234052 271.874938 42.7130452 204.272714"/>\n' +
         '            <path d="M311.539357,285.460502 L311.548723,285.460502 L311.548723,285.670774 C311.487843,366.866526 321.640882,417.759106 342.017209,438.320885 C350.910485,447.863243 357.602687,452.54638 362.515297,452.326272 C364.529046,450.869817 365.86374,449.422728 367.198434,447.970956 C380.250335,454.429001 394.739959,458.999742 410.803117,461.66913 C410.053815,464.863029 410.114696,470.543673 411.248015,478.027325 C414.596458,490.952782 418.310185,497.836992 422.740432,498.853233 C425.072634,499.56507 426.927156,498.670591 427.943396,495.98247 C425.437918,485.150376 423.09635,474.322964 420.764148,463.481503 C452.492398,467.377873 486.693343,469.466552 523.830615,469.546165 C534.24591,475.339205 545.213816,475.409452 556.481442,469.775639 C580.173429,468.693834 743.909929,469.691342 1046.88544,469.813104 C1067.08381,469.82247 1121.95143,466.961074 1135.86503,459.795875 C1143.50323,454.644425 1149.0387,448.823286 1152.25601,443.882109 C1152.99595,442.747854 1160.86361,442.656532 1161.84239,441.805606 C1164.10903,439.848524 1165.0878,428.936348 1165.88394,419.522307 C1166.28669,414.713194 1166.73627,412.38989 1163.22392,411.08189 C1162.6994,410.889881 1163.45339,409.993529 1163.57047,409.444665 C1166.12278,397.259144 1168.23487,383.531935 1169.95358,369.262886 C1170.43126,369.281151 1170.91363,369.297542 1171.39131,369.297542 L1172.55272,369.297542 C1182.14847,369.297542 1189.98804,364.460798 1189.98804,358.542719 L1189.98804,286.310959 L1189.98804,285.24976 L1175.55461,285.24976 L1175.55461,281.682615 L1189.98804,281.682615 L1189.98804,280.896317 L1189.98804,208.664089 C1189.98804,202.753502 1182.14847,197.916759 1172.55272,197.916759 L1171.39131,197.916759 C1170.91363,197.916759 1170.43126,197.926125 1169.95358,197.951414 C1168.23487,183.684239 1166.12278,169.946258 1163.57047,157.771508 C1163.45339,157.223113 1162.6994,156.317395 1163.22392,156.125386 C1166.73627,154.817386 1166.28669,152.494082 1165.88394,147.682628 C1165.0878,138.279826 1164.10903,127.368118 1161.84239,125.401201 C1160.86361,124.550743 1152.99595,124.459422 1152.25601,123.325167 C1149.0387,118.394761 1143.50323,112.559104 1135.86503,107.418894 C1121.95143,100.247607 1067.08381,97.3829323 1046.88544,97.3941719 C743.909929,97.5220215 580.173429,98.509695 556.481442,97.4395983 C545.213816,91.7964189 534.24591,91.8783738 523.830615,97.6686037 C486.693343,97.7416606 452.492398,99.8270613 420.764148,103.723431 C423.09635,92.8936778 425.437918,82.0639247 427.943396,71.2341717 C426.927156,68.5362168 425.072634,67.6393962 422.740432,68.3620042 C418.310185,69.3773081 414.596458,76.2558989 411.248015,89.1874436 C410.114696,96.6603244 410.053815,102.35174 410.803117,105.5344 C394.739959,108.212685 380.250335,112.77687 367.198434,119.245686 C365.86374,117.791104 364.529046,116.33699 362.515297,114.891775 C357.602687,114.663237 350.910485,119.353399 342.017209,128.886391 C321.640882,149.44817 311.487843,200.34075 311.548723,281.536501 L311.548723,281.609558 L311.548723,281.682615 L311.539357,281.746774 L311.539357,282.03947 L311.539357,282.103629 L311.539357,282.112527 L311.539357,282.176686 L311.539357,282.185584 L311.539357,282.24787 L311.539357,282.259109 L311.539357,282.3228 L311.539357,282.396325 L311.539357,282.469382 L311.539357,282.533541 L311.539357,282.540566 L311.539357,282.606598 L311.539357,282.615496 L311.539357,282.677782 L311.539357,282.689021 L311.539357,282.752712 L311.539357,282.814998 L311.539357,282.826237 L311.539357,282.889928 L311.539357,282.899294 L311.539357,282.963453 L311.539357,282.970478 L311.539357,283.03651 L311.539357,283.045408 L311.539357,283.107694 L311.539357,283.118933 L311.539357,283.173726 L311.539357,283.182624 L311.539357,283.24491 L311.539357,283.256149 L311.539357,283.31984 L311.539357,283.329206 L311.539357,283.383999 L311.539357,283.40039 L311.539357,283.457056 L311.539357,283.47532 L311.539357,283.530581 L311.539357,283.537606 L311.539357,283.603638 L311.539357,283.612536 L311.539357,283.676695 L311.539357,283.686061 L311.539357,283.749752 L311.539357,283.759118 L311.539357,283.813911 L311.539357,283.830302 L311.539357,283.886968 L311.539357,283.905232 L311.539357,283.960493 L311.539357,283.969391 L311.539357,284.03355 L311.539357,284.042448 L311.539357,284.106607 L311.539357,284.115973 L311.539357,284.179664 L311.539357,284.18903 L311.539357,284.243823 L311.539357,284.253189 L311.539357,284.31688 L311.539357,284.326246 L311.539357,284.390405 L311.539357,284.399303 L311.539357,284.454095 L311.539357,284.47236 L311.539357,284.527152 L311.539357,284.545885 L311.539357,284.600678 L311.539357,284.609576 L311.539357,284.673735 L311.539357,284.683101 L311.539357,284.746792 L311.539357,284.756158 L311.539357,284.819848 L311.539357,284.829215 L311.539357,284.882134 L311.539357,284.893374 L311.539357,284.957064 L311.539357,284.966431 L311.539357,285.03059 L311.539357,285.039488 L311.539357,285.103647 L311.539357,285.112544 L311.539357,285.17483 L311.539357,285.460502" id="path14" fill="#231F20"/>\n' +
         '            <path d="M396.196414,283.658431 L396.196414,283.55587 L396.229196,281.591294 L396.238563,281.591294 L396.238563,281.316862 L396.238563,281.042431 L396.229196,281.042431 C395.344084,237.695788 400.851452,193.387229 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C368.509712,175.121124 360.969862,228.503728 361.939271,280.896317 L361.878391,280.896317 L361.911173,283.612536 L361.878391,286.310959 L361.939271,286.310959 C360.969862,338.703548 368.509712,392.08381 384.521355,429.037035 C388.155469,435.000541 392.300045,437.854444 397.357832,437.58891 C405.909239,436.299643 414.460647,435.000541 423.012054,433.701907 C427.062967,432.723132 427.320539,430.171291 423.569347,425.817379 C418.441313,419.862771 415.565867,412.664322 412.779401,405.310393 C400.851452,373.827071 395.344084,329.520386 396.229196,286.17187 L396.238563,286.17187 L396.238563,285.897438 L396.238563,285.62488 L396.229196,285.62488 L396.196414,283.658431" id="path1130" fill="#99DEF9"/>\n' +
         '            <path d="M358.609561,285.62488 L358.600195,285.897438 L358.609561,286.17187 L358.600195,286.17187 C357.77128,324.333812 362.168745,362.11923 371.801957,404.340515 C375.815405,424.847501 381.94563,437.323845 391.466447,441.767205 C390.403375,446.425521 388.080539,450.228227 384.488573,453.183286 C321.931237,435.119493 324.647456,338.529804 323.397059,285.897438 L323.504771,280.896317 L358.529948,280.896317 C358.539314,282.469382 358.56273,284.042448 358.600195,285.62488 L358.609561,285.62488" id="path1132" fill="#81EF00"/>\n' +
         '            <path d="M424.220303,497.865091 C425.035169,497.682449 425.70954,497.059592 426.234052,496.07145 L417.935534,459.852073 C417.031688,459.191751 416.160625,458.920129 415.345759,459.112137 C411.781893,459.927003 410.873364,469.260494 413.327328,479.966144 C415.776608,490.66711 420.651753,498.679957 424.220303,497.865091" id="path1134" fill="#393536"/>\n' +
         '            <path d="M548.285953,454.958195 C499.094288,452.93508 467.647027,450.743372 441.379315,444.284391 C440.718993,444.12891 438.719293,443.763158 437.84823,443.470461 C434.200067,442.253783 431.380818,442.272047 427.596844,442.857439 C423.124449,443.543518 421.995813,443.708365 427.788853,444.879149 C460.879895,451.59102 497.267865,455.206401 548.168875,456.559828 C549.943784,456.644124 550.847629,456.658174 550.65562,455.744962 C550.426147,454.686573 549.812656,455.023759 548.285953,454.958195" id="path1136" fill="#99DEF9"/>\n' +
         '            <path d="M396.660045,316.586968 C398.271044,349.549692 403.647285,381.190367 412.779401,405.310393 C415.565867,412.664322 418.441313,419.862771 423.569347,425.817379 C427.320539,430.171291 427.062967,432.723132 423.012054,433.701907 C414.460647,435.000541 405.909239,436.299643 397.357832,437.58891 C392.300045,437.854444 388.155469,435.000541 384.521355,429.037035 C371.591216,399.209202 364.19186,358.671037 362.332655,316.586968 L396.660045,316.586968" id="path1138" fill="#99DEF9"/>\n' +
         '            <path d="M396.660045,316.586968 C398.271044,349.549692 403.647285,381.190367 412.779401,405.310393 C415.565867,412.664322 418.441313,419.862771 423.569347,425.817379 C427.320539,430.171291 427.062967,432.723132 423.012054,433.701907 C414.460647,435.000541 405.909239,436.299643 397.357832,437.58891 C392.300045,437.854444 388.155469,435.000541 384.521355,429.037035 C371.591216,399.209202 364.19186,358.671037 362.332655,316.586968 L396.660045,316.586968" id="path1140" fill="#D1E4E9"/>\n' +
         '            <path d="M668.558263,456.466165 L846.882733,456.466165 C847.706965,456.466165 848.37197,456.203909 848.37197,455.86204 L848.37197,455.229817 C848.37197,454.901998 847.706965,454.639742 846.882733,454.639742 L668.558263,454.639742 C667.743398,454.639742 667.064343,454.901998 667.064343,455.229817 L667.064343,455.86204 C667.064343,456.203909 667.743398,456.466165 668.558263,456.466165" id="path1142" fill="#99DEF9"/>\n' +
         '            <path d="M877.177942,456.466165 L1055.82086,456.466165 C1056.6451,456.466165 1057.32415,456.203909 1057.32415,455.86204 L1057.32415,455.229817 C1057.32415,454.901998 1056.6451,454.639742 1055.82086,454.639742 L877.177942,454.639742 C876.35371,454.639742 875.674655,454.901998 875.674655,455.229817 L875.674655,455.86204 C875.674655,456.203909 876.35371,456.466165 877.177942,456.466165" id="path1144" fill="#99DEF9"/>\n' +
         '            <path d="M583.629584,456.377186 L650.977769,456.377186 C651.286856,456.377186 651.544429,456.110247 651.544429,455.773061 L651.544429,455.140837 C651.544429,454.813018 651.286856,454.546079 650.977769,454.546079 L583.629584,454.546079 C583.320497,454.546079 583.062925,454.813018 583.062925,455.140837 L583.062925,455.773061 C583.062925,456.110247 583.320497,456.377186 583.629584,456.377186" id="path1146" fill="#99DEF9"/>\n' +
         '            <path d="M1162.65726,412.772034 C1159.18237,427.418075 1156.0353,436.939828 1153.22542,441.319029 C1154.26039,441.474509 1156.17111,441.181813 1157.92729,440.945783 C1160.78868,440.561765 1161.35534,440.982779 1162.21704,437.763123 C1163.57983,432.613078 1164.4509,421.911643 1164.76935,415.99169 C1164.88643,413.871634 1164.87706,413.6061 1162.65726,412.772034" id="path1148" fill="#ED1C24"/>\n' +
         '            <path d="M1152.26538,391.818745 C1152.85077,391.818745 1153.43616,391.818745 1154.02155,391.818745 C1154.32127,392.376506 1154.70529,391.498418 1155.05653,389.275802 C1158.50331,358.616244 1161.65038,326.245937 1162.24514,295.220158 C1162.26387,293.902792 1161.66911,293.34503 1160.33442,293.390456 C1159.38843,293.125391 1159.02314,293.774942 1159.12617,295.192527 C1158.64849,326.08109 1155.23917,356.073301 1152.0921,388.726938 C1151.76896,390.364631 1151.87199,391.526049 1152.26538,391.818745" id="path1150" fill="#EAF1F3"/>\n' +
         '            <path d="M358.609561,281.591294 L358.600195,281.316862 L358.609561,281.042431 L358.600195,281.042431 C357.77128,242.871122 362.168745,205.088046 371.801957,162.875659 C375.815405,142.359306 381.94563,129.883431 391.466447,125.447096 C390.403375,120.79159 388.080539,116.986541 384.488573,114.022584 C321.931237,132.094808 324.647456,228.677472 323.397059,281.316862 L323.504771,286.310959 L358.529948,286.310959 C358.539314,284.737894 358.56273,283.16436 358.600195,281.591294 L358.609561,281.591294" id="path1152" fill="#81EF00"/>\n' +
         '            <path d="M424.220303,69.350146 C425.035169,69.5327883 425.70954,70.1551771 426.234052,71.1334843 L417.935534,107.364101 C417.031688,108.013184 416.160625,108.287616 415.345759,108.104973 C411.781893,107.290576 410.873364,97.9430355 413.327328,87.2411321 C415.776608,76.548595 420.651753,68.5268506 424.220303,69.350146" id="path1154" fill="#393536"/>\n' +
         '            <path d="M313.464126,281.799694 L313.464126,280.969374 C313.398562,243.60497 316.297424,206.624583 322.333987,178.269597 C326.394266,159.207826 335.479551,131.547818 358.39882,117.269871 C361.709798,115.202735 363.751645,117.342928 365.114438,120.837016 C332.852311,142.807483 321.036758,196.425648 321.008659,278.298581 L321.036758,278.298581 C321.027392,279.231462 321.018025,280.164343 321.018025,281.097223 L321.018025,281.152016 L321.018025,281.207277 L321.018025,281.26207 L321.018025,281.326229 L321.018025,281.381021 L321.018025,281.435814 L321.018025,281.488733 L321.018025,281.545399 L321.018025,281.600192 L321.018025,281.655453 L321.018025,281.662478 L321.018025,281.710246 L321.018025,281.719144 L321.018025,281.765039 L321.018025,281.774405 L321.018025,281.829198 L321.018025,281.838095 L321.018025,281.88399 L321.018025,281.892888 L321.018025,281.911621 L321.036758,281.911621 L321.018025,283.521215 L321.018025,283.548845 L321.018025,283.567109 L321.018025,283.594272 L321.018025,283.612536 L321.018025,283.640166 L321.018025,283.649064 L321.018025,283.686061 L321.036758,285.293782 L321.018025,285.293782 L321.018025,285.323286 L321.018025,285.332184 L321.018025,285.378078 L321.018025,285.386976 L321.018025,285.432871 L321.018025,285.442237 L321.018025,285.49703 L321.018025,285.551823 L321.018025,285.561189 L321.018025,285.604742 L321.018025,285.661408 L321.018025,285.725567 L321.018025,285.78036 L321.018025,285.835152 L321.018025,285.890413 L321.018025,285.945206 L321.018025,285.999999 L321.018025,286.064158 L321.018025,286.11895 C321.018025,287.049958 321.027392,287.975814 321.036758,288.908695 L321.008659,288.908695 C321.036758,370.779286 332.852311,424.399325 365.114438,446.369323 C363.751645,449.872309 361.709798,452.003136 358.39882,449.942556 C335.479551,435.65899 326.394266,407.999449 322.333987,388.937679 C316.297424,360.591591 313.398562,323.611672 313.464126,286.2468 L313.464126,286.17187 L313.464126,286.100686 L313.464126,286.027629 L313.464126,285.96347 L313.464126,285.890413 L313.464126,285.816888 L313.464126,285.753198 L313.464126,285.679672 L313.464126,285.604742 L313.464126,285.533558 L313.464126,285.467526 L313.464126,285.414607 L313.464126,285.396343 L313.464126,285.34155 L313.464126,285.323286 L313.464126,285.268493 L313.464126,285.24976 L313.464126,285.194968 L313.464126,285.18607 L313.464126,285.131277 L313.464126,285.112544 L313.464126,285.057752 L313.464126,285.039488 L313.464126,284.984695 L313.464126,284.966431 L313.464126,284.911638 L313.464126,284.902272 L313.464126,284.847479 L313.464126,284.829215 L313.464126,284.774422 L313.464126,284.756158 L313.464126,284.701365 L313.464126,284.683101 L313.464126,284.62784 L313.464126,284.618942 L313.464126,284.564149 L313.464126,284.545885 L313.464126,284.490624 L313.464126,284.47236 L313.464126,284.415694 L313.464126,284.399303 L313.464126,284.34451 L313.464126,284.335144 L313.464126,284.278478 L313.464126,284.262087 L313.464126,284.207294 L313.464126,284.197928 L313.464126,284.134237 L313.464126,284.122998 L313.464126,284.060712 L313.464126,283.997021 L313.464126,283.985782 L313.464126,283.923496 L313.464126,283.914598 L313.464126,283.848566 L313.464126,283.841541 L313.464126,283.78628 L313.464126,283.777382 L313.464126,283.71135 L313.464126,283.704325 L313.464126,283.640166 L313.464126,283.6308 L313.464126,283.576007 L313.464126,283.55587 L313.464126,283.50295 L313.464126,283.493584 L313.464126,283.429894 L313.464126,283.418654 L313.464126,283.356368 L313.464126,283.34747 L313.464126,283.292678 L313.464126,283.274413 L313.464126,283.219621 L313.464126,283.210254 L313.464126,283.137198 L313.464126,283.082405 L313.464126,283.063672 L313.464126,283.00888 L313.464126,282.999982 L313.464126,282.935823 L313.464126,282.926925 L313.464126,282.871664 L313.464126,282.853399 L313.464126,282.798607 L313.464126,282.780343 L313.464126,282.72555 L313.464126,282.716184 L313.464126,282.652493 L313.464126,282.643127 L313.464126,282.588334 L313.464126,282.57007 L313.464126,282.515277 L313.464126,282.505911 L313.464126,282.441752 L313.464126,282.432854 L313.464126,282.366822 L313.464126,282.359797 L313.464126,282.304536 L313.464126,282.286272 L313.464126,282.229606 L313.464126,282.222581 L313.464126,282.16732 L313.464126,282.149056 L313.464126,282.09239 L313.464126,282.074126 L313.464126,282.030104 L313.464126,282.01184 L313.464126,281.955174 L313.464126,281.93691 L313.464126,281.88399 L313.464126,281.865726 L313.464126,281.810933 L313.464126,281.799694" id="path1156" fill="#7B7979"/>\n' +
         '            <path d="M548.285953,112.25751 C499.094288,114.278752 467.647027,116.46484 441.379315,122.922417 C440.718993,123.087263 438.719293,123.451143 437.84823,123.743839 C434.200067,124.962391 431.380818,124.934761 427.596844,124.358735 C423.124449,123.672655 421.995813,123.507809 427.788853,122.337025 C460.879895,115.62328 497.267865,112.010709 548.168875,110.647448 C549.943784,110.572518 550.847629,110.554254 550.65562,111.470743 C550.426147,112.531942 549.812656,112.191478 548.285953,112.25751" id="path1158" fill="#99DEF9"/>\n' +
         '            <path d="M396.660045,250.629674 C398.271044,217.664609 403.647285,186.016909 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C371.591216,168.006971 364.19186,208.545137 362.332655,250.629674 L396.660045,250.629674" id="path1160" fill="#99DEF9"/>\n' +
         '            <path d="M396.660045,250.629674 C398.271044,217.664609 403.647285,186.016909 412.779401,161.896883 C415.565867,154.542954 418.441313,147.344505 423.569347,141.398795 C427.320539,137.045351 427.062967,134.493042 423.012054,133.505369 C414.460647,132.206735 405.909239,130.916999 397.357832,129.617897 C392.300045,129.361729 388.155469,132.206735 384.521355,138.170241 C371.591216,168.006971 364.19186,208.545137 362.332655,250.629674 L396.660045,250.629674" id="path1162" fill="#80CEE9"/>\n' +
         '            <path d="M339.183911,164.970426 C339.586661,165.013979 339.989411,165.061747 340.392161,165.11654 L334.528874,217.188802 C334.126124,217.152273 333.723374,217.113872 333.320625,217.070319 C332.351215,216.958392 331.391172,216.832415 330.440496,216.68396 L330.412397,216.68396 C330.248487,216.658671 330.079894,216.63104 329.915984,216.60341 L329.433621,216.521455 L329.433621,216.484927 C323.120753,214.710018 319.318047,202.874327 320.863482,189.145244 C322.48853,174.711349 329.396156,163.643693 336.294416,164.421562 C336.861076,164.485253 337.409003,164.622469 337.938197,164.842108 C338.350313,164.876763 338.771795,164.924531 339.183911,164.970426" id="path1166" fill="#4F4C4C"/>\n' +
         '            <path d="M339.183911,164.970426 C339.586661,165.013979 339.989411,165.061747 340.392161,165.11654 L338.275383,183.849085 C331.803288,184.233102 325.921269,185.51394 321.074223,187.50802 C323.022408,173.888054 329.663095,163.671324 336.294416,164.421562 C336.861076,164.485253 337.409003,164.622469 337.938197,164.842108 C338.350313,164.876763 338.771795,164.924531 339.183911,164.970426" id="path1168" fill="#656263"/>\n' +
         '            <path d="M331.601914,166.76313 C326.928143,167.659483 322.287155,177.345614 320.90563,189.575156 C319.538154,201.80423 321.903138,212.286495 326.258455,214.198151 L331.601914,166.76313" id="path1170" fill="#E2ECED"/>\n' +
         '            <polyline id="path1172" fill="#E9E9E9" points="337.966296 165.363341 339.06215 165.482293 334.453944 206.404944 333.367456 206.284119 337.966296 165.363341 337.966296 165.363341"/>\n' +
         '            <path d="M668.558263,110.748135 L846.882733,110.748135 C847.706965,110.748135 848.37197,111.013669 848.37197,111.342894 L848.37197,111.973712 C848.37197,112.303405 847.706965,112.577837 846.882733,112.577837 L668.558263,112.577837 C667.743398,112.577837 667.064343,112.303405 667.064343,111.973712 L667.064343,111.342894 C667.064343,111.013669 667.743398,110.748135 668.558263,110.748135" id="path1174" fill="#99DEF9"/>\n' +
         '            <path d="M877.177942,110.748135 L1055.82086,110.748135 C1056.6451,110.748135 1057.32415,111.013669 1057.32415,111.342894 L1057.32415,111.973712 C1057.32415,112.303405 1056.6451,112.577837 1055.82086,112.577837 L877.177942,112.577837 C876.35371,112.577837 875.674655,112.303405 875.674655,111.973712 L875.674655,111.342894 C875.674655,111.013669 876.35371,110.748135 877.177942,110.748135" id="path1176" fill="#99DEF9"/>\n' +
         '            <path d="M583.629584,110.839925 L650.977769,110.839925 C651.286856,110.839925 651.544429,111.10499 651.544429,111.432342 L651.544429,112.065502 C651.544429,112.403624 651.286856,112.669158 650.977769,112.669158 L583.629584,112.669158 C583.320497,112.669158 583.062925,112.403624 583.062925,112.065502 L583.062925,111.432342 C583.062925,111.10499 583.320497,110.839925 583.629584,110.839925" id="path1178" fill="#99DEF9"/>\n' +
         '            <path d="M1162.65726,154.433369 C1159.18237,139.789201 1156.0353,130.276346 1153.22542,125.895272 C1154.26039,125.739792 1156.17111,126.023122 1157.92729,126.261025 C1160.78868,126.652535 1161.35534,126.233863 1162.21704,129.442279 C1163.57983,134.603096 1164.4509,145.304531 1164.76935,151.213712 C1164.88643,153.335642 1164.87706,153.610073 1162.65726,154.433369" id="path1180" fill="#ED1C24"/>\n' +
         '            <path d="M1152.26538,175.395556 C1152.85077,175.395556 1153.43616,175.395556 1154.02155,175.395556 C1154.32127,174.839667 1154.70529,175.717756 1155.05653,177.931006 C1158.50331,208.600398 1161.65038,240.970705 1162.24514,271.996484 C1162.26387,273.311509 1161.66911,273.871612 1160.33442,273.825717 C1159.38843,274.081885 1159.02314,273.4417 1159.12617,272.014748 C1158.64849,241.135083 1155.23917,211.142873 1152.0921,178.489236 C1151.76896,176.852011 1151.87199,175.688252 1152.26538,175.395556" id="path1182" fill="#EAF1F3"/>\n' +
         '            <path d="M572.717876,117.855263 C572.408789,117.763942 572.113752,117.718047 571.884278,117.734438 C503.57605,118.404127 438.48982,126.169704 428.613085,139.222073 C409.238949,162.582963 400.364406,222.768291 401.6991,280.896317 L401.619486,280.896317 L401.666318,283.603638 L401.619486,286.310959 L401.6991,286.310959 C400.364406,344.447883 409.238949,404.633211 428.613085,427.985203 C438.48982,441.04647 503.57605,448.81392 571.884278,449.478926 C572.113752,449.488292 572.408789,449.44146 572.717876,449.357164 L1033.60407,449.357164 C1051.3953,449.357164 1084.75328,447.15609 1106.7968,444.906311 C1115.97107,443.97343 1124.98142,444.401469 1131.38327,436.875669 C1133.61713,434.250771 1135.49975,431.113069 1137.35427,427.68314 C1147.97562,408.088897 1151.44114,345.399028 1154.32127,308.665443 L1154.29786,283.603638 L1154.32127,258.539492 C1151.44114,221.817146 1147.97562,159.116505 1137.35427,139.524136 C1135.49975,136.103104 1133.61713,132.954632 1131.38327,130.338632 C1124.98142,122.812832 1115.97107,123.242743 1106.7968,122.309863 C1084.75328,120.059616 1051.3953,117.855263 1033.60407,117.855263 L572.717876,117.855263 Z M574.53025,286.310959 L574.53025,130.475848 C574.53025,128.968814 575.499659,127.724505 576.670443,127.724505 C577.841227,127.724505 578.80127,128.968814 578.80127,130.475848 L578.80127,280.896317 L578.80127,286.310959 L578.80127,436.729087 C578.80127,438.247828 577.841227,439.482302 576.670443,439.482302 C575.499659,439.482302 574.53025,438.247828 574.53025,436.729087 L574.53025,286.310959 Z M656.658414,286.310959 L656.658414,130.475848 C656.658414,128.968814 657.618457,127.724505 658.789241,127.724505 C659.969391,127.724505 660.929434,128.968814 660.929434,130.475848 L660.929434,280.896317 L660.929434,286.310959 L660.929434,436.729087 C660.929434,438.247828 659.969391,439.482302 658.789241,439.482302 C657.618457,439.482302 656.658414,438.247828 656.658414,436.729087 L656.658414,286.310959 Z M738.786577,286.310959 L738.786577,130.475848 C738.786577,128.968814 739.74662,127.724505 740.917404,127.724505 C742.097555,127.724505 743.048231,128.968814 743.048231,130.475848 L743.048231,280.896317 L743.048231,286.310959 L743.048231,436.729087 C743.048231,438.247828 742.097555,439.482302 740.917404,439.482302 C739.74662,439.482302 738.786577,438.247828 738.786577,436.729087 L738.786577,286.310959 Z M820.914741,286.310959 L820.914741,130.475848 C820.914741,128.968814 821.874784,127.724505 823.045568,127.724505 C824.225718,127.724505 825.176395,128.968814 825.176395,130.475848 L825.176395,280.896317 L825.176395,286.310959 L825.176395,436.729087 C825.176395,438.247828 824.225718,439.482302 823.045568,439.482302 C821.874784,439.482302 820.914741,438.247828 820.914741,436.729087 L820.914741,286.310959 Z M903.042905,286.310959 L903.042905,130.475848 C903.042905,128.968814 904.002948,127.724505 905.173732,127.724505 C906.353882,127.724505 907.304559,128.968814 907.304559,130.475848 L907.304559,280.896317 L907.304559,286.310959 L907.304559,436.729087 C907.304559,438.247828 906.353882,439.482302 905.173732,439.482302 C904.002948,439.482302 903.042905,438.247828 903.042905,436.729087 L903.042905,286.310959 Z M985.171068,286.310959 L985.171068,130.475848 C985.171068,128.968814 986.131111,127.724505 987.301895,127.724505 C988.482046,127.724505 989.432722,128.968814 989.432722,130.475848 L989.432722,280.896317 L989.432722,286.310959 L989.432722,436.729087 C989.432722,438.247828 988.482046,439.482302 987.301895,439.482302 C986.131111,439.482302 985.171068,438.247828 985.171068,436.729087 L985.171068,286.310959 Z M1067.29923,286.310959 L1067.29923,130.475848 C1067.29923,128.968814 1068.25927,127.724505 1069.43006,127.724505 C1070.61021,127.724505 1071.56557,128.968814 1071.56557,130.475848 L1071.56557,280.896317 L1071.56557,286.310959 L1071.56557,436.729087 C1071.56557,438.247828 1070.61021,439.482302 1069.43006,439.482302 C1068.25927,439.482302 1067.29923,438.247828 1067.29923,436.729087 L1067.29923,286.310959 Z" id="path1184" fill="'+colorselected+'"/>\n' +
         '            <path d="M339.183911,402.234977 C339.586661,402.200322 339.989411,402.145529 340.392161,402.097761 L334.528874,350.018006 C334.126124,350.0639 333.723374,350.100429 333.320625,350.146324 C332.351215,350.255909 331.391172,350.383759 330.440496,350.530341 L330.412397,350.530341 C330.248487,350.548605 330.079894,350.576235 329.915984,350.612764 L329.433621,350.685821 L329.433621,350.720476 C323.120753,352.506156 319.318047,364.332949 320.863482,378.071398 C322.48853,392.495458 329.396156,403.572481 336.294416,402.79508 C336.861076,402.730921 337.409003,402.584339 337.938197,402.372193 C338.350313,402.328171 338.771795,402.291643 339.183911,402.234977" id="path1186" fill="#4F4C4C"/>\n' +
         '            <path d="M339.183911,402.234977 C339.586661,402.200322 339.989411,402.145529 340.392161,402.097761 L338.275383,383.358191 C331.803288,382.973705 325.921269,381.693336 321.074223,379.697383 C323.022408,393.31688 329.663095,403.542977 336.294416,402.79508 C336.861076,402.730921 337.409003,402.584339 337.938197,402.372193 C338.350313,402.328171 338.771795,402.291643 339.183911,402.234977" id="path1188" fill="#656263"/>\n' +
         '            <path d="M331.601914,400.453512 C326.928143,399.556691 322.287155,389.861194 320.90563,377.63212 C319.538154,365.403045 321.903138,354.930147 326.258455,353.018023 L331.601914,400.453512" id="path1190" fill="#E2ECED"/>\n' +
         '            <polyline id="path1192" fill="#E9E9E9" points="337.966296 401.852833 339.06215 401.724515 334.453944 360.802332 333.367456 360.930182 337.966296 401.852833 337.966296 401.852833"/>\n' +
         '            <path d="M568.545202,105.836462 C488.430787,106.952453 428.795727,113.510718 394.24823,123.928823 C391.485179,120.416471 390.314395,116.007766 387.541978,112.870533 C394.290378,110.528965 401.516457,108.781686 411.725695,107.016612 C412.301721,108.827581 414.624556,109.705669 415.612698,109.934206 C416.591474,110.162743 418.413214,109.842885 419.307693,109.193334 L420.103826,105.71751 C453.738112,100.586198 502.77055,98.2994221 568.545202,99.3128529 L568.545202,99.1686123 L1041.12518,99.1686123 L1046.93227,99.1686123 C1072.50688,100.476612 1115.44187,101.290541 1131.84222,108.187396 C1138.41734,110.958408 1143.83105,115.230365 1148.26598,120.471263 C1154.03092,126.90121 1158.8967,140.328698 1162.85863,160.735465 L1155.64192,160.735465 C1151.90946,144.225536 1147.26379,131.657871 1141.70022,123.032471 C1134.32896,112.303405 1121.82499,109.33055 1081.05829,107.490077 L1053.25919,106.156788 L568.545202,106.156788 L568.545202,105.836462 Z M568.545202,461.378775 C488.430787,460.264189 428.795727,453.707798 394.24823,443.278453 C391.485179,446.800171 390.314395,451.197637 387.541978,454.344704 C394.290378,456.686273 401.516457,458.433082 411.725695,460.198625 C412.301721,458.381568 414.624556,457.501138 415.612698,457.271665 C416.591474,457.051557 418.413214,457.365327 419.307693,458.020966 L420.103826,461.49117 C453.738112,466.628571 502.77055,468.909259 568.545202,467.902384 L568.545202,468.038195 L1041.12518,468.038195 L1046.93227,468.038195 C1072.50688,466.7316 1115.44187,465.916734 1131.84222,459.018474 C1138.41734,456.255424 1143.83105,451.975037 1148.26598,446.734608 C1154.03092,440.314964 1158.8967,426.887475 1162.85863,406.481177 L1155.64192,406.481177 C1151.90946,422.991106 1147.26379,435.558302 1141.70022,444.183703 C1134.32896,454.911364 1121.82499,457.885155 1081.05829,459.725628 L1053.25919,461.060322 L568.545202,461.060322 L568.545202,461.378775 Z M1163.29416,404.185035 C1168.41751,376.726401 1171.98606,337.256459 1174.01386,285.835152 L1174.19182,285.844519 L1174.14499,284.618942 L1166.82525,284.618942 C1165.88394,335.76769 1162.32475,375.629142 1156.14301,404.185035 L1163.29416,404.185035 Z M1174.13562,282.734448 L1174.19182,281.362757 L1174.01386,281.369782 C1171.98606,229.948944 1168.41751,190.478533 1163.29416,163.021773 L1156.14301,163.021773 C1162.33412,191.614662 1165.8933,231.512643 1166.82525,282.734448 L1174.13562,282.734448 Z" id="path1194" fill="#81EF00"/>\n' +
         '            <path d="M395.966941,126.133175 C408.321055,127.916514 419.106318,130.98069 431.474481,132.773863 C449.668466,124.706224 486.76359,116.62032 572.160583,115.742232 C572.553966,115.760496 572.94735,115.797493 573.331367,115.861184 L573.331367,116.062559 L574.235212,116.062559 C574.53025,116.144982 574.820604,116.226937 575.106276,116.33699 L575.106276,116.062559 L1041.26099,116.062559 C1069.25678,116.382885 1089.0243,118.294541 1110.41687,120.489528 C1121.62361,121.632681 1128.06293,122.986576 1133.486,129.096664 C1141.00712,137.557218 1143.63904,149.548857 1145.77923,160.735465 L1153.68437,160.735465 C1149.54916,142.578945 1144.25253,129.460544 1137.81322,121.468303 C1132.7086,116.02603 1125.37481,112.806374 1115.81653,111.809334 C1115.80716,111.736277 1115.79779,111.662752 1115.79779,111.587822 C1095.55728,110.025527 1061.64669,107.290576 1039.44862,107.290576 L575.106276,107.290576 L575.106276,107.281678 C573.996372,107.208621 572.825588,107.226885 571.575191,107.334597 C483.67272,108.845845 422.801313,116.016664 395.966941,126.133175 Z M395.966941,441.082999 C408.321055,439.290294 419.106318,436.235484 431.474481,434.442779 C449.668466,442.501052 486.76359,450.588829 572.160583,451.473942 C572.553966,451.455209 572.94735,451.408378 573.331367,451.347497 L573.331367,451.155488 L574.235212,451.155488 C574.53025,451.071192 574.820604,450.977529 575.106276,450.879183 L575.106276,451.155488 L1041.26099,451.155488 C1069.25678,450.832352 1089.0243,448.912266 1110.41687,446.725241 C1121.62361,445.57319 1128.06293,444.227725 1133.486,438.11951 C1141.00712,429.658956 1143.63904,417.658418 1145.77923,406.481177 L1153.68437,406.481177 C1149.54916,424.62833 1144.25253,437.744391 1137.81322,445.7371 C1132.7086,451.18827 1125.37481,454.410268 1115.81653,455.39841 C1115.80716,455.47334 1115.79779,455.552953 1115.79779,455.627884 C1095.55728,457.182685 1061.64669,459.912954 1039.44862,459.912954 L575.106276,459.912954 L575.106276,459.936369 C573.996372,460.006616 572.825588,459.987884 571.575191,459.870805 C483.67272,458.372202 422.801313,451.197637 395.966941,441.082999 Z M1151.79706,392.61441 C1152.54168,392.61441 1153.29098,392.61441 1154.03092,392.61441 C1154.41494,393.17264 1154.8973,392.294551 1155.34688,390.07896 C1158.40965,368.593198 1160.57794,343.588059 1161.85176,315.059329 C1162.16084,308.025258 1162.33412,301.1654 1162.50271,294.296175 C1162.52613,292.988175 1161.75809,292.429945 1160.06748,292.466942 C1158.87797,292.210774 1158.40497,292.859857 1158.54078,294.277911 C1157.92729,325.166474 1155.56699,356.878332 1151.57696,389.531969 C1151.16952,391.160296 1151.30533,392.321714 1151.79706,392.61441 Z M582.140347,457.14522 L652.743312,457.14522 C653.071131,457.14522 653.33807,456.606659 653.33807,455.946337 L653.33807,454.667841 C653.33807,454.007518 653.071131,453.454908 652.743312,453.454908 L582.140347,453.454908 C581.807844,453.454908 581.545588,454.007518 581.545588,454.667841 L581.545588,455.946337 C581.545588,456.606659 581.807844,457.14522 582.140347,457.14522 Z M666.984729,457.337228 L849.121272,457.337228 C849.964236,457.337228 850.652657,456.789302 850.652657,456.128979 L850.652657,454.850483 C850.652657,454.190161 849.964236,453.642234 849.121272,453.642234 L666.984729,453.642234 C666.141765,453.642234 665.458027,454.190161 665.458027,454.850483 L665.458027,456.128979 C665.458027,456.789302 666.141765,457.337228 666.984729,457.337228 Z M875.4124,457.337228 L1057.54894,457.337228 C1058.39191,457.337228 1059.08033,456.789302 1059.08033,456.128979 L1059.08033,454.850483 C1059.08033,454.190161 1058.39191,453.642234 1057.54894,453.642234 L875.4124,453.642234 C874.578801,453.642234 873.895063,454.190161 873.895063,454.850483 L873.895063,456.128979 C873.895063,456.789302 874.578801,457.337228 875.4124,457.337228 Z M1154.19483,404.185035 C1160.26886,376.223432 1163.69691,336.837786 1164.40407,286.310959 L1164.46495,286.310959 L1164.4509,284.618942 L1156.30692,284.618942 L1156.29756,286.310959 L1156.31629,286.310959 C1156.38185,330.178835 1153.3706,368.092102 1147.03431,399.995969 C1146.75801,401.368128 1146.49575,402.767449 1146.21945,404.185035 L1154.19483,404.185035 Z M1164.4509,282.734448 L1164.46495,280.896317 L1164.40407,280.896317 C1163.69691,230.369489 1160.26886,190.992742 1154.19483,163.021773 L1146.21945,163.021773 C1146.49575,164.439826 1146.75801,165.839148 1147.03431,167.211306 C1153.3706,199.122198 1156.38185,237.028441 1156.31629,280.896317 L1156.29756,280.896317 L1156.30692,282.734448 L1164.4509,282.734448 Z M549.831388,454.555445 C500.630357,452.527647 462.893644,448.280043 436.616565,441.814973 C434.51852,441.300764 430.814159,441.156524 428.748896,441.474509 C427.395469,441.686655 426.032677,441.886156 424.67925,442.098303 C420.197489,442.793748 418.090077,443.744893 423.883117,444.924575 C456.974159,451.637851 498.850765,455.871407 549.742409,457.234199 C551.526684,457.318496 552.346233,457.346595 552.191689,455.890139 C552.018413,454.190161 551.358091,454.621009 549.831388,454.555445 Z M1151.79706,174.592398 C1152.54168,174.592398 1153.29098,174.592398 1154.03092,174.592398 C1154.41494,174.034636 1154.8973,174.912724 1155.34688,177.135341 C1158.40965,198.621103 1160.57794,223.628115 1161.85176,252.156845 C1162.16084,259.18155 1162.33412,266.050774 1162.50271,272.911101 C1162.52613,274.227999 1161.75809,274.786229 1160.06748,274.740334 C1158.87797,275.005399 1158.40497,274.356317 1158.54078,272.938263 C1157.92729,242.0497 1155.56699,210.33831 1151.57696,177.684205 C1151.16952,176.055878 1151.30533,174.89446 1151.79706,174.592398 Z M582.140347,110.062056 L652.743312,110.062056 C653.071131,110.062056 653.33807,110.602022 653.33807,111.269837 L653.33807,112.550206 C653.33807,113.206782 653.071131,113.748621 652.743312,113.748621 L582.140347,113.748621 C581.807844,113.748621 581.545588,113.206782 581.545588,112.550206 L581.545588,111.269837 C581.545588,110.602022 581.807844,110.062056 582.140347,110.062056 Z M666.984729,109.879414 L849.121272,109.879414 C849.964236,109.879414 850.652657,110.417038 850.652657,111.086726 L850.652657,112.358198 C850.652657,113.026013 849.964236,113.56551 849.121272,113.56551 L666.984729,113.56551 C666.141765,113.56551 665.458027,113.026013 665.458027,112.358198 L665.458027,111.086726 C665.458027,110.417038 666.141765,109.879414 666.984729,109.879414 Z M875.4124,109.879414 L1057.54894,109.879414 C1058.39191,109.879414 1059.08033,110.417038 1059.08033,111.086726 L1059.08033,112.358198 C1059.08033,113.026013 1058.39191,113.56551 1057.54894,113.56551 L875.4124,113.56551 C874.578801,113.56551 873.895063,113.026013 873.895063,112.358198 L873.895063,111.086726 C873.895063,110.417038 874.578801,109.879414 875.4124,109.879414 Z M549.831388,112.659792 C500.630357,114.6904 462.893644,118.934726 436.616565,125.392303 C434.51852,125.913536 430.814159,126.060118 428.748896,125.739792 C427.395469,125.529519 426.032677,125.319246 424.67925,125.108505 C420.197489,124.422425 418.090077,123.462383 423.883117,122.291598 C456.974159,115.568488 498.850765,111.333527 549.742409,109.968862 C551.526684,109.897678 552.346233,109.870047 552.191689,111.31339 C552.018413,113.026013 551.358091,112.596101 549.831388,112.659792 Z" id="path1196" fill="#000000"/>\n' +
         '        </g>\n' +
         '    </g>\n' +
         '</svg>';
                let car = '';
                if(childsnapshot.val().vehicletype == 'Car'){
                    car = car8500;
                    left= 40;
                    right = 40;
                }else if(childsnapshot.val().vehicletype == 'wheelchair van' || childsnapshot.val().vehicletype == 'Van' ){
                    car = car8600;
                    left= 40;
                    right = 40;
                }else{
                    car = car8500;
                    left= 40;
                    right = 40;
                }

                let  url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(car);
                      
                var lat = markers[childsnapshot.val().vehiclenumber].position.lat();
                var lng = markers[childsnapshot.val().vehiclenumber].position.lng();
               
                icon[childsnapshot.val().vehiclenumber] = {
                    position:  { lat:lat , lng: lng },
                    url: url,
                    scaledSize: new google.maps.Size(40, 40), // scaled size
                    origin: new google.maps.Point(0,0), // origin
                    anchor: new google.maps.Point(20, 20) ,// anchor
                    labelOrigin: { x:20, y: 60}
                 }

                markers[childsnapshot.val().vehiclenumber].setIcon(icon[childsnapshot.val().vehiclenumber]);
                

                if(childsnapshot.val().Direction){

                    if($('img[src="'+icon[childsnapshot.val().vehiclenumber].url+'"]')){
                        try{
                            $('img[src="'+icon[childsnapshot.val().vehiclenumber].url+'"]').css({
                                'transform': 'rotate(' +  parseInt(childsnapshot.val().Direction)  + 'deg)',
                                'transform-origin': 'center center'
                            });
                        }catch (e){
                            console.log(e);
                        }
                    }
                }
            }else{
                if( markers[childsnapshot.val().vehiclenumber]){
                    markers[childsnapshot.val().vehiclenumber].setMap(null);
                  }
                AddCar(childsnapshot.val(),  childsnapshot.val());
                return;
            }
            if(totaldis > 0.01   ){
              
                if(typeof animatedMove[childsnapshot.val().vehiclenumber] === 'undefined'){
                    animatedMove[childsnapshot.val().vehiclenumber] = true;
                    animatedMove( markers[childsnapshot.val().vehiclenumber], 5,  markers[childsnapshot.val().vehiclenumber].position, latlng, childsnapshot.val().vehiclenumber);
                       }else{
                    if(animatedMove[childsnapshot.val().vehiclenumber] != false){
                  
                           animatedMove( markers[childsnapshot.val().vehiclenumber], 5,  markers[childsnapshot.val().vehiclenumber].position, latlng , childsnapshot.val().vehiclenumber);

                    }else{
                      
                    }

                }

 
            }else{
                animatedMove[childsnapshot.val().vehiclenumber] = true;
                 if( markers[childsnapshot.val().vehiclenumber]){
                     markers[childsnapshot.val().vehiclenumber].setMap(null);
                   }
                   AddCar(childsnapshot.val(),  childsnapshot.val());
                
             }
        
             markers[childsnapshot.val().vehiclenumber].addListener('mouseover', function() {
                  const contentString =
                  '<div id="content">' +
                  '<div id="siteNotice">' +
                  "</div>" +
                  '<h4 id="firstHeading" class="firstHeading">'+childsnapshot.val().drivername +'/'+childsnapshot.val().vehiclenumber+'</h4>' +
                  '<div id="bodyContent">' +
                  '<h6>App Version:'+childsnapshot.val().appver+'</h6>'+
                  '<h6>Vehicle Type:'+childsnapshot.val().vehicletype+'</h6>'+
                  '<h6>GPS Status:'+childsnapshot.val().GPSstatus+'</h6>'+

                  '<h6>Vehicle status:'+childsnapshot.val().vehiclestatus+'</h6>'+
                  '<h6>Vehicle Speed:'+childsnapshot.val().speed+'</h6>'+
                  '<h6>Zone name:'+childsnapshot.val().zonename+'</h6>'+
    
    
    
                  '<h6>Last Update Time:'+childsnapshot.val().time+'</h6>'+
                  "</div>" +
                  "</div>";
                 infowindow[childsnapshot.val().vehiclenumber].setContent(contentString);
                 infowindow[childsnapshot.val().vehiclenumber].open(map, this);
              
             });
           
             markers[childsnapshot.val().vehiclenumber].addListener('mouseout', function() {
                 infowindow[childsnapshot.val().vehiclenumber].close(map, marker);
               
             }, false);
        

              angular.element(document.getElementById('myangular')).scope().adddrivernew(childsnapshot.val());
          
            });
    
       
    });

   
  
   let animatemove = [];
    // move marker from position current to moveto in t seconds
   function animatedMove(marker, t, current, moveto , val) {
        var lat = current.lat();
        var lng = current.lng();
      
        if(animatemove[val] == false){
            return;
        }

         var deltalat = (moveto.lat() - current.lat()) / 100;
        var deltalng = (moveto.lng() - current.lng()) / 100;

        var delay = 10 * t;
        for (var i = 0; i < 100; i++) {
            (function(ind) {
               
                setTimeout(
                  function() {

                    
                      if(ind > 98 ){


                          animatemove[val] = true;
                    
                           
                      }else{
                          animatemove[val] = false;
                      }

                      var lat = marker.position.lat();
                      var lng = marker.position.lng();
                      lat += deltalat;
                      lng += deltalng;
                      latlng = new google.maps.LatLng(lat, lng);
                      marker.setPosition(latlng);
                  }, delay * ind
                );
            })(i)
        }
    }


     cars_Ref.on('child_removed', function (data) {
        data.forEach(function (childsnapshot) {
           if(markers[childsnapshot.val().vehiclenumber]){
                markers[childsnapshot.val().vehiclenumber].setMap(null);
            }
            angular.element(document.getElementById('myangular')).scope().adddriverremove(childsnapshot.val());
          });
      });
     $("#MoveToFront").click(function () {
         FnMoveQueueNo();

     });
    function FnCancelRide(DriverId, BookingId) {
       // A post entry.
        var postData = {
            bookingid: BookingId + ",Job Cancel," + DriverId + "," + $("#UId").text() + ",Dispatcher",
            content: "Passenger Cancel",
          };
        var newPostKey = firebase.database().ref().child('notification').push().key;

        // Write the new post's data simultaneously in the posts list and the user's post list.
        var updates = {};
        updates['/notification/' + DriverId] = postData;
        // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

        return firebase.database().ref().update(updates);
    }
    function JobEidtPost(DriverId, BookingId) {
       
        var postData = {
            bookingid: BookingId,
            content: "Job Updated",
        };
        firebase.database().ref().child("/notification/" + DriverId).remove();

        var newPostKey = firebase.database().ref().child('notification').push().key;

        // Write the new post's data simultaneously in the posts list and the user's post list.
        var updates = {};
        updates['/notification/' + DriverId] = postData;
        // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

        return firebase.database().ref().update(updates);
    }

    function FnCancelRidez(DriverId, BookingId, JobStatus, u_id) {

      
        firebase.database().ref().child("/Passengerjobs/" + u_id).update({ status: "cancel" });

    }
    function writeautodispatch(DriverId, BookingId ) {

       
        var postData = {
            bookingid: BookingId  
            
        };

        
        firebase.database().ref("/autodisp/"+ DriverId).set( postData);
         
    }

 
    function FnKickDriver(DriverId, BookingId, JobStatus) {

        // A post entry.
        var postData = {
            bookingid: BookingId + ",Kicked," + DriverId + "," + $("#UId").text() + ",Dispatcher",
            content: "You have been kicked",


        };

        firebase.database().ref().child("/notification/" + DriverId).remove();

        // Get a key for a new Post.
        var newPostKey = firebase.database().ref().child('notification').push().key;

        // Write the new post's data simultaneously in the posts list and the user's post list.
        var updates = {};
        updates['/notification/' + DriverId] = postData;
        // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

        return firebase.database().ref().update(updates);
    }


    function writeNewPost(DriverId, BookingId, JobStatus) {

        console.log("here");
        // A post entry.
        var postData = {
            bookingid: BookingId + "," + JobStatus + "," + DriverId + "," + $("#UId").text() + ",Dispatcher",
            content: "You have offered new Job please view details",
        };

        firebase.database().ref().child("/notification/" + DriverId).remove();

        // Get a key for a new Post.
        var newPostKey = firebase.database().ref().child('notification').push().key;

        // Write the new post's data simultaneously in the posts list and the user's post list.
        var updates = {};
        updates['/notification/' + DriverId] = postData;
        // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

        return firebase.database().ref().update(updates);
    }
    function writeNewPostpassenger(DriverId, BookingId, JobStatus, u_id) {

        // A post entry.
        var postData = {
            bookingid: BookingId + "," + JobStatus + "," + DriverId + "," + u_id + ",android",
            content: "You have offered new Job please view details",
        };

        firebase.database().ref().child("/notification/" + DriverId).remove();

        // Get a key for a new Post.
        var newPostKey = firebase.database().ref().child('notification').push().key;

        // Write the new post's data simultaneously in the posts list and the user's post list.
        var updates = {};
        updates['/notification/' + DriverId] = postData;
        // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

        return firebase.database().ref().update(updates);
    }
    var counterfirst = 0;

    

    function checkingjobz(vehicle , id,driverid){
        $message  = 'Job Not Shown to driver app. Try Again!';
        console.log("checking job");
        setTimeout(function(){   if($('.vowali #Divo'+id).length ){
            firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
            var DbRefz = firebase.database();
            console.log("inside");
          
            $('#Divo'+id).remove();
            firebase.database().ref().child("/notification/" + driverid).remove();
            convertstatus1(vehicle , id,'Unreached', driverid ,  $message ) ; 
             
        }
        }, 20000);
      
  

    }
    function checkingjob(id,driverid){
        $message  = 'Job Not Shown to driver app. Try Again!';
        console.log("checking job");
        setTimeout(function(){   if($('.vowali #Divo'+id).length ){
            firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
            var DbRefz = firebase.database();
            console.log("inside");
          
            $('#Divo'+id).remove();
            firebase.database().ref().child("/notification/" + driverid).remove();
            convertstatus(id,'Unreached', driverid ,  $message ) ; 
             
        }
        }, 20000);
      
  

    }
 
    
    function resolveAfter2Secondsx(vehivle  , driverid,bookid,status) {

 
        return new Promise(resolve => {
            setTimeout(() => {
                toastr["warning"](  ' Checking this id '+bookid+' Job Status! ', ' warning! ');
                var data = [];
                data[0]  = bookid;
                data[1] = status;
                ridestatusz.push(data);
                var id =     bookid;
                console.log(id);
                console.log(driverid);
                var DbRefz = firebase.database();
                var refaz  = DbRefz.ref("joback/"+id+"/"+driverid);
                var reponsex = 0;
  
                let listener =  refaz.on("value",   function (snapshot) {
                    $respp =   snapshot.val();
                    console.log( $respp );
                    if($respp == null  ){

                        toastr["error"](  " Driver Might be not Avalible. Job will be Not Reachedable. if not Accepted.   ", 'error!'); 
                        checkingjobz(vehivle , id, driverid);
                        return;
 
                    }
                    if($respp['status']){

                   
                        if($respp['status'] != 'Sent') {
                        
                            counterfirst++;
                            if($respp['jobstatus'] == 'offered'){

                                if($respp['discription']  == 'Ride Status successfully Updated to Assigned'){
                                    toastr["success"](  driverid +  " Accept The Job!", 'success!');
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    refaz.off("value", listener);

                                    $('#Divo'+bookid).remove();
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );
                                    return;


                                }else if($respp['discription'] == 'Ride Status successfully Updated to Reject'){
                               
                                    toastr["error"](  driverid + " Reject The Job!  ", 'error!'); 
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );
                                    return;
                                }else if($respp['discription'] == 'job reached but will not be displayed'){
                                    console.log("Reject by job reached but is in background");
                                    $message  = 'Job Not Shown to driver app. Try Again!';
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    convertstatus(id,'Unreached', driverid ,  $message ) ; 
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );

                                
                                }else{
                                    toastr["success"]( $respp['discription'] , 'success!');
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                }
 
                                return;
                            }else if($respp['jobstatus'] == 'Assigned'  ){
                                console.log("Accpet");
            
                                toastr["success"](  driverid +  " Accept The Job!", 'success!');
                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                refaz.off("value", listener);
                                $('#Divo'+bookid).remove();
                                localva = "Accept";
                                angular.element(document.getElementById('myangular')).scope().getjobs( );
                                return;
                            }else if($respp['jobstatus'] == 'Reject' ){
                                console.log("Reject");
                                localva = "Reject";
                                toastr["error"](  driverid + " Reject The Job!  ", 'error!'); 
                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                refaz.off("value", listener);
                                $('#Divo'+bookid).remove();
                                firebase.database().ref().child("/notification/" + driverid).remove();
                                angular.element(document.getElementById('myangular')).scope().getjobs( );
                                return;
                            }  else{
                                if(countr >= 6){
                                    console.log("Clear");
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    return;
                                }else{
 
                                    countr++;
                               
                                
                                }
                            }
                    
           
                        }else{  
                     

                        }   }else{

                    }
                                         
     

                } ); 
            }, 6000);
        });
    }
    function resolveAfter2Seconds(driverid,bookid,status) {

 
        return new Promise(resolve => {
            setTimeout(() => {
                toastr["warning"](  ' Checking this id '+bookid+' Job Status! ', ' warning! ');
                var data = [];
                data[0]  = bookid;
                data[1] = status;
                ridestatusz.push(data);
                var id =     bookid;
                console.log(id);
                console.log(driverid);
                var DbRefz = firebase.database();
                var refaz  = DbRefz.ref("joback/"+id+"/"+driverid);
                var reponsex = 0;
  
                let listener =  refaz.on("value",   function (snapshot) {
                    $respp =   snapshot.val();
                    console.log( $respp );
                    if($respp == null  ){

                        toastr["error"](  " Driver Might be not Avalible. Job will be Not Reachedable. if not Accepted.   ", 'error!'); 
                        checkingjob(id, driverid);
                        return;
 
                    }
                    if($respp['status']){

                   
                        if($respp['status'] != 'Sent') {
                        
                            counterfirst++;
                            if($respp['jobstatus'] == 'offered'){

                                if($respp['discription']  == 'Ride Status successfully Updated to Assigned'){
                                    toastr["success"](  driverid +  " Accept The Job!", 'success!');
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    refaz.off("value", listener);

                                    $('#Divo'+bookid).remove();
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );
                                    return;


                                }else if($respp['discription'] == 'Ride Status successfully Updated to Reject'){
                               
                                    toastr["error"](  driverid + " Reject The Job!  ", 'error!'); 
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );
                                    return;
                                }else if($respp['discription'] == 'job reached but will not be displayed'){
                                    console.log("Reject by job reached but is in background");
                                    $message  = 'Job Not Shown to driver app. Try Again!';
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    convertstatus(id,'Unreached', driverid ,  $message ) ; 
                                    angular.element(document.getElementById('myangular')).scope().getjobs( );

                                
                                }else{
                                    toastr["success"]( $respp['discription'] , 'success!');
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                }
 
                                return;
                            }else if($respp['jobstatus'] == 'Assigned'  ){
                                console.log("Accpet");
            
                                toastr["success"](  driverid +  " Accept The Job!", 'success!');
                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                refaz.off("value", listener);
                                $('#Divo'+bookid).remove();
                                localva = "Accept";
                                angular.element(document.getElementById('myangular')).scope().getjobs( );
                                return;
                            }else if($respp['jobstatus'] == 'Reject' ){
                                console.log("Reject");
                                localva = "Reject";
                                toastr["error"](  driverid + " Reject The Job!  ", 'error!'); 
                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                refaz.off("value", listener);
                                $('#Divo'+bookid).remove();
                                firebase.database().ref().child("/notification/" + driverid).remove();
                                angular.element(document.getElementById('myangular')).scope().getjobs( );
                                return;
                            }  else{
                                if(countr >= 6){
                                    console.log("Clear");
                                    refaz.off("value", listener);
                                    $('#Divo'+bookid).remove();
                                    firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                    firebase.database().ref().child("/notification/" + driverid).remove();
                                    return;
                                }else{
 
                                    countr++;
                               
                                
                                }
                            }
                    
           
                        }else{  
                     

                        }   }else{

                    }
                                         
     

                } ); 
            }, 6000);
        });
    }

    var ridestatusz = [];





    
    async function acknowledgemethodx(vehicle , driverid,bookid,status){
        if(status == "Offered"){
            status  = "Pending";
        }
        const result = await resolveAfter2Secondsx(vehicle , driverid,bookid,status);
 
    }

    async function acknowledgemethod(driverid,bookid,status){
        if(status == "Offered"){
            status  = "Pending";
        }
       const result = await resolveAfter2Seconds(driverid,bookid,status);
 
    }

 

    function scynmethod( driverid , id ) {

  
        return new Promise((resolve, reject) => {
         
            setTimeout(() => {
                console.log("hello"+id);
                console.log(resolve());
                  resolve(true);
            } , 6000);
         
        }).then((result) => {
            console.log('hello22');
            console.log(result);
            return result;         // preserve resolved value of the promise chain
        });

            
            
    
        
        
    }
    async function acknowledgemethod2(driverid,bookid,status){
        if(status == "Offered"){
            status  = "Pending";
        }
        const result = await resolveAfter2Seconds2(driverid,bookid,status);
 
    }
    

    function  convertstatus1(vehicle , id,status,driverid,messagezz){
        counterfirst = 0;
        var  param = [   { "name": "bookingid", "Value": id} 
        ];
        var  ar = 'checkriddestatusforoffer';
        jQuery.ajax(
           {
               type: "POST",
               url: "DataManager/Data.aspx/DataSelector",
               data: JSON.stringify({
                   "data": param,
                   "action": ar
               }),
               dataType: "json",
               contentType: "application/json; charset=utf-8",
               cache: false,
               success: function (result) {
                   var ridestatus= JSON.parse(result.d);
                    
                   if(ridestatus["dt1"].length > 0) {

                       if(messagezz == ''){

                       }else{
                           //toastr["error"](messagezz, 'error!'); 
                       }
                    
                       angular.element(document.getElementById('myangular')).scope().playAudio1( );
                       
                       var  param = [   { "name": "bookingid", "Value": id},
                         { "name": "ridestatus", "Value": status} 
                       ];

                       
                       var  ar = '[changeriddestatusforoffer]';
                       jQuery.ajax(
                          {
                              type: "POST",
                              url: "DataManager/Data.aspx/DataSelector",
                              data: JSON.stringify({
                                  "data": param,
                                  "action": ar
                              }),
                              dataType: "json",
                              contentType: "application/json; charset=utf-8",
                              cache: false,
                              success: function (response) {
                                  console.log("status :" + status);

                                  var d = new Date();

                                  var month = d.getMonth() + 1;
                                  var date = d.getDate();
                                  var FinalOutput = d.getFullYear() + '-' +
                                      (('' + month).length < 2 ? '0' : '') +
                                      month + '-' +
                                      (('' + date).length < 2 ? '0' : '') + date;
                                    h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                                  m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                                  var FindMinutes = FinalOutput + " " + h + ':' + m;
                                  var CurrentDateTime = $("#laterDate").val() + " " + h + ':' + m + ':00';


                                  Action([
                                       { "name": "VehicleId", "Value": vehicle }, 
                                       { "name": "DriverId", "Value": driverid }, 
                                       { "name": "PenaltyReason", "Value": "Kicked" },
                                       { "name": "PenaltyDate", "Value": CurrentDateTime },
                                       { "name": "PenaltyUpToDateTime", "Value": "" + " " + "12:00:00" }],
                                       "[KickDriver]");

                                  FnKickDriver(driverid, vehicle, "Kicked");
                                  console.log("this is it");
                                  toastr["success"]('Driver Kicked Successfully.', 'Success!');
                                  firebase.database().ref("online/" + SomeSession2 + "/"+vehicle).remove();
                                  console.log("this is it");
                                  angular.element(document.getElementById('myangular')).scope().getjobs( );
                            
                              }
                          });
 
                   }else{
                    
                   }

               }
           });
    } 

    function  convertstatus(id,status,driverid,messagezz){
        counterfirst = 0;
        var  param = [   { "name": "bookingid", "Value": id} 
        ];
        var  ar = 'checkriddestatusforoffer';
        jQuery.ajax(
           {
               type: "POST",
               url: "DataManager/Data.aspx/DataSelector",
               data: JSON.stringify({
                   "data": param,
                   "action": ar
               }),
               dataType: "json",
               contentType: "application/json; charset=utf-8",
               cache: false,
               success: function (result) {
                   var ridestatus= JSON.parse(result.d);
                    
                   if(ridestatus["dt1"].length > 0) {

                       if(messagezz == ''){

                       }else{
                           //toastr["error"](messagezz, 'error!'); 
                       }
                    
                       angular.element(document.getElementById('myangular')).scope().playAudio1( );
                       
                       var  param = [   { "name": "bookingid", "Value": id},
                         { "name": "ridestatus", "Value": status} 
                       ];

                       
                       var  ar = '[changeriddestatusforoffer]';
                       jQuery.ajax(
                          {
                              type: "POST",
                              url: "DataManager/Data.aspx/DataSelector",
                              data: JSON.stringify({
                                  "data": param,
                                  "action": ar
                              }),
                              dataType: "json",
                              contentType: "application/json; charset=utf-8",
                              cache: false,
                              success: function (response) {
                                  console.log("status :" + status);
                                  angular.element(document.getElementById('myangular')).scope().getjobs( );
                            
                              }
                          });
 
                   }else{
                    
                   }

               }
           });
         } 

    function sleep(milliseconds) {
        const date = Date.now();
        let currentDate = null;
        do {
            currentDate = Date.now();
        } while (currentDate - date < milliseconds);
    }
</script>
 <script>

      
     function FnMoveQueueNo1(VehicleId ='' , QueueNo ='') {
         var QueueNo1 = QueueNo;
         var VehicleId1 = VehicleId;
         console.log(VehicleId1);
         if(VehicleId1 == ''){
             VehicleId1 =    $("#lblBookingHeadId").text();
         }else{
        
         }
         if(QueueNo1 == ''){
             QueueNo1 =   $("#ddlQueueNo").val();
         }else{
       
         } 
         console.log(VehicleId1);
         Action([
          { "name": "QueueNo", "Value": QueueNo1 }, { "name": "VehicleId", "Value": VehicleId1 }], "[UpdateQueueNosp]");
                
      
         console.log("que change")
         angular.element(document.getElementById('myangular')).scope().zonetablez();
     }
         function FnMoveQueueNo(VehicleId='', QueueNo='') {
         var QueueNo1 = QueueNo;
         var VehicleId1 = VehicleId;
         if(VehicleId1 == ''){
             VehicleId1 =    $("#lblBookingHeadId").text();
         }else{
        
         }
         if(QueueNo1 == ''){
             QueueNo1 =   $("#ddlQueueNo").val();
         }else{
       
         } 

         Action([
          { "name": "QueueNo", "Value": QueueNo1 }, { "name": "VehicleId", "Value": VehicleId1 }], "[UpdateQueueNo]");
                
      
         console.log("que change")
         angular.element(document.getElementById('myangular')).scope().zonetablez();
      }
         function getpercentage() {
             var param = [ ];
             var proc = '[payment_percentage]';
             Selector1(param, proc).then(function (result) {
                 $res = JSON.parse(result.d);
                 if ($res.length != []) {
                                 
                     document.getElementById("percentagevalue").value = $res[0]['paymentpercent'];
                     document.getElementById("transection").value = $res[0]['chargepertra'];
                 }
                 else {

                 }
             });
         }
         getpercentage();


       

         function makeid(length) {
             var result           = '';
             var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
             var charactersLength = characters.length;
             for ( var i = 0; i < length; i++ ) {
                 result += characters.charAt(Math.floor(Math.random() * charactersLength));
             }
             return result;
         }
         var OutPutDate;
         //function FnDefaultDetails() {
             
         //    var param = [];
         //    var proc = '[DispatcherSettings]';
         //    Selector(param, proc).then(function (result) {
         //        $res = JSON.parse(result.d);
         //       console.log($res);
         //        if ($res["dt1"].length != []) {
                    
                   
         //            $("#DirectBookingIsAllowed").text($res["dt1"][0].DirectBookingIsAllowed); 
         //            $("#AllowDirectAssignment").text($res["dt1"][0].JobAllowedToAssignToaDriver);
         //            $("#AutoDispatch").text($res["dt1"][0].AutoDispatch);
         //            $("#EditZoneQueue").text($res["dt1"][0].EditZoneQueue);
         //            $("#DispatcherKickUsers").text($res["dt1"][0].DispatcherKickUsers);
         //            $("#DispatchShows").text($res["dt1"][0].DispatchShows);
         //            $("#ColorJobs").text($res["dt1"][0].ColorJobs);
         //            $("#DispatchAlerts").text($res["dt1"][0].DispatchAlerts);
         //            $("#DispatchSounds").text($res["dt1"][0].DispatchSounds); 
         //            $("#RespectShiftEnd").text($res["dt1"][0].RespectShiftEnd);
         //            $("#CompanyRadius").text($res["dt1"][0].Radius);
         //            if ($("#DispatcherKickUsers").text() == "0") {
         //                $("#DriverSuspends").disabled = true;
         //            }
         //        }
            
         //        $(".VehicleType").empty();
         //        $(".VehicleType").append("<option ng-value='Automatic' selected='selected'>Not Specified</option>");

         //        if ($res["dt3"].length != []) {


         //            for ($i = 0; $i < $res["dt3"].length; $i++) {
         //                $(".VehicleType").append("<option ng-value=" + $res["dt3"][$i].VehicleName + " >" + $res["dt3"][$i].VehicleName + "</option>");
         //            }
         //        }
                 

         //        if ($res["dt4"].length != []) {
         //            $('#StripePublicKey').text($res["dt5"][0].PublicKey);
         //        }

         //    });


         //}
       
         var someSession = 'safinah mohammed';  
      
         function FnFindMyVehicle() {

             ref.once('value', function (snapshot) {

                 snapshot.forEach(function (childsnapshot) {
                     var key1 = childsnapshot.key;
                     childsnapshot.forEach(function (childsnapshot1) {
               
                         if (key1 == $("#lblBookingHeadId").text()) {
                             var FBResult1 = childsnapshot1.val();
                             var VehicleLat = parseFloat(childsnapshot1.val().lat);
                             var VehicleLng = parseFloat(childsnapshot1.val().lng);

                             var VehicleLocation1 = new google.maps.LatLng(VehicleLat, VehicleLng);
                             map.setCenter(VehicleLocation1);
                             map.setZoom(15);
                             $("#VehicleDetails").modal('hide');
                             
                         }
                     });
                 });
             });



         }


         
 


    </script>
 
     <script src="https://www.gstatic.com/external_hosted/jquery2.min.js"></script>
     <script>





 
         // Replace with your own API key
         var API_KEY = 'AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA';

         // Icons for markers
         var RED_MARKER = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
         var GREEN_MARKER = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
         var BLUE_MARKER = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
         var YELLOW_MARKER = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';

         // URL for places requests
         var PLACES_URL = 'https://maps.googleapis.com/maps/api/place/details/json?' +
                         'key=' + API_KEY + '&placeid=';

         // URL for Speed limits
         var SPEED_LIMIT_URL = 'https://roads.googleapis.com/v1/speedLimits';

         var coords;
 
         /**
          * Current Roads API threshold (subject to change without notice)
          * @const {number}
          */
         var DISTANCE_THRESHOLD_HIGH = 300;
         var DISTANCE_THRESHOLD_LOW = 200;

         /**
          * @type Array<ExtendedLatLng>
          */
         var originals = [];     // the original input points, a list of ExtendedLatLng

         var interpolate = true;
         var map;
         var placesService;
         var originalCoordsLength;

         // Settingup Arrays
         var infoWindows = [];
         var markersxxxx = [];
         var placeIds = [];
         var polylines = [];
         var snappedCoordinates = [];
         var distPolylines = [];

         // Symbol that gets animated along the polyline

 
 
 
 
 
  

         // Reset the map to a clean state and reset all variables
         // used for displaying each request
         function clearMap() {
             // Clear the polyline
             for (var i = 0; i < polylines.length; i++) {
                 polylines[i].setMap(null);
             }
             // Clear all markersxxxx
             for (var i = 0; i < markersxxxx.length; i++) {
                 markersxxxx[i].setMap(null);
             }
             // Clear all the distance polylines
             for (var i = 0; i < distPolylines.length; i++) {
                 distPolylines[i].setMap(null);
             }
             // Clear all info windows
             for (var i = 0; i < infoWindows.length; i++) {
                 infoWindows[i].close();
             }

             // Empty everything
             polylines = [];
             markersxxxx = [];
             distPolylines = [];
             snappedCoordinates = [];
             placeIds = [];
             infoWindows = [];
             $('#unsnappedPoints').empty();
             $('#warningMessage').empty();
         }
         function getUnique(array){
             var uniqueArray = [];
        
             // Loop through array values
             for(i=0; i < array.length; i++){
                 if(uniqueArray.indexOf(array[i]) === -1) {
                     uniqueArray.push(array[i]);
                 }
             }
             return uniqueArray;
         }
 

        
         function parseCoordsFromQuery(input) {
             var coords1 = '';
             input = decodeURIComponent(input);
             
             
             var points = input.split('&');
       
          
             for (var i = 0; i < points.length; i++) {
       
                 if(points[i] == ''){
                     continue;
                 }

                 if (i == points.length-1) {
                     coords1 +=   points[i] ;
                 }else{

                     coords1 +=   points[i]+"|";
                 }


             }
      

             originals = [];
             var points = input.split('&');
             for (var i = 0; i < points.length; i++) {
                 var point = points[i].split(',');
                 originals.push({lat: Number(point[0]), lng: Number(point[1]), index:i});
             }
   
             
     
         

        
             return coords1;
         }

   
         // Make AJAX request to the snapToRoadsAPI
         // with coordinates parsed from text input element.
         function bendAndSnap( ) {
             coords = parseCoordsFromQuery( $('#coords').val());
        
             location.hash = coords;
              $.ajax({
                 type: 'GET',
                 url: 'https://roads.googleapis.com/v1/snapToRoads',
                 data: {
        
                     key: API_KEY,
                     path: coords
                 },
                 success: function(data) {
                       processSnapToRoadResponse(data);
              
                     drawSnappedPolyline(snappedCoordinates);
                     //drawOriginals(originals);
                     fitBounds(  data.snappedPoints[0].location.latitude,  data.snappedPoints[0].location.longitude);
                     //$('#map').appendTo('#shiftnew');
                    
                 
                 },
                 error: function() {
        
                     clearMap();
                 }
             });
         }

         // Toggle the distance polylines of the original points to show on the maps
         $('#distance').click(function(e) {
             for (var i = 0; i < distPolylines.length; i++) {
                 distPolylines[i].setVisible(!distPolylines[i].getVisible());
             }
             // Clear all infoWindows associated with distance polygons on toggle
             for (var i = 0; i < infoWindows.length; i++) {
                 if (infoWindows[i].dist) {
                     infoWindows[i].close();
                 }
             }
             e.preventDefault();
         });

         /**
          * Compute the distance between each original point and create a polyline
          * for each pair. Polylines are initially hidden on creation
          */
         function drawDistance() {
             for (var i = 0; i < originals.length - 1; i++) {
                 var origin = new google.maps.LatLng(originals[i]);
                 var destination = new google.maps.LatLng(originals[i+1]);
                 var distance =
               google.maps.geometry.spherical.computeDistanceBetween(origin, destination);

                 // Round the distance value to two decimal places
                 distance = Math.round(distance * 100) / 100;

                 var color;
                 var weight;
                 if (distance > DISTANCE_THRESHOLD_HIGH) {
                     color = '#CC0022';
                     weight = 7;
                 } else if (distance < DISTANCE_THRESHOLD_HIGH &&
                            distance > DISTANCE_THRESHOLD_LOW) {
                     color = '#FF6600';
                     weight = 6;
                 } else {
                     color = '#22CC00';
                     weight = 5;
                 }
                 var polyline = new google.maps.Polyline({
                     strokeColor: color,
                     strokeOpacity: 0.4,
                     strokeWeight: weight,
                     geodesic: true,
                     visible: false,
                     map: map
                 });
                 polyline.setPath([origin, destination]);

                 distPolylines.push(polyline);
                 infoWindows.push(addPolyWindow(polyline, distance, i));
             }
         }
         
         function addPolyWindow(polyline, distance, index) {
             var infoWindow = new google.maps.InfoWindow();
  
             content = '';

             infoWindow.setContent(content);
             infoWindow.dist = true;

             polyline.addListener('click', function(e) {
                 infoWindow.setPosition(e.latLng);
                 infoWindow.open(map);
             });

             polyline.addListener('mouseover', function(e) {
                 polyline.setOptions({strokeOpacity: 1.0});
             });

             polyline.addListener('mouseout', function(e) {
                 polyline.setOptions({strokeOpacity: 0.4});
             });

             return infoWindow;
         }

         // Parse the value in the input element
         // to get all coordinates
         function getMissingPoints(originalIndexes, originalCoordsLength) {
             var unsnappedPoints = [];
             var coordsArray = coords.split('|');
             var hasMissingCoords = false;
             for (var i = 0; i < originalCoordsLength; i++) {
                 if (originalIndexes.indexOf(i) < 0) {
                     hasMissingCoords = true;
                     var latlng = {
                         'lat': parseFloat(coordsArray[i].split(',')[0]),
                         'lng': parseFloat(coordsArray[i].split(',')[1])
                     };

                     unsnappedPoints.push(latlng);
                     latlng.unsnapped = true;
                 }
             }
             return unsnappedPoints;
         }

   
         function processSnapToRoadResponse(data) {
             var originalIndexes = [];
             var unsnappedMessage = '';
         
             for (var i = 0; i < data.snappedPoints.length; i++) {
                 var latlng = {
                     'lat': data.snappedPoints[i].location.latitude,
                     'lng': data.snappedPoints[i].location.longitude
                 };
                 var interpolated = true;

                 if (data.snappedPoints[i].originalIndex != undefined) {
                     interpolated = false;
                     originalIndexes.push(data.snappedPoints[i].originalIndex);
                     latlng.originalIndex = data.snappedPoints[i].originalIndex;
                 }

                 latlng.interpolated = interpolated;
                 snappedCoordinates.push(latlng);
                 placeIds.push(data.snappedPoints[i].placeId);

                 // Cross-reference the original point and this snapped point.
                 latlng.related = originals[latlng.originalIndex];
                 //originals[latlng.originalIndex].related = latlng;
             }

             var unsnappedPoints = getMissingPoints(
                 originalIndexes,
                 coords.split('|').length
             );

             //for (var i = 0; i < unsnappedPoints.length; i++) {
             //    var marker = addMarker(unsnappedPoints[i]);
             //    var infowindow = addBasicInfoWindow(marker, unsnappedPoints[i], i);
             //    infoWindows.push(infowindow);

             //    unsnappedMessage += unsnappedPoints[i].lat + ',' +
             //        unsnappedPoints[i].lng + '<br>';
             //}

             if (unsnappedPoints.length) {
                 console.log("aasd");
      
             }

             if (data.warningMessage) {
                 console.log("warning");
  
             }
         }
 
         function drawSnappedPolyline(snappedCoords) {
             var snappedPolyline = new google.maps.Polyline({
                 path: snappedCoords,
                 strokeColor: '#005db5',
                 strokeWeight: 6,
                 icons: [{
                     icon: lineSymbol,
                     offset: '100%'
                 }]
             });
             console.log(snappedPolyline);
             snappedPolyline.setMap(map);
             animateCircle(snappedPolyline);

             polylines.push(snappedPolyline);
        
             //for (var i = 0; i < snappedCoords.length; i++) {

             //    var marker = addMarker(snappedCoords[i]);
             //    var infoWindow = addDetailedInfoWindow(marker,
             //        snappedCoords[i],
             //        placeIds[i]);
             //    infoWindows.push(infoWindow);
             //}
         }
 
         function drawOriginals(originalCoords) {
             for (var i = 0; i < originalCoords.length; i++) {
                 var marker = addMarker(originalCoords[i]);
                 var infoWindow = addBasicInfoWindow(marker, originalCoords[i], i);
                 infoWindows.push(infoWindow);
             }
         }

         // Infowindow used for unsnappable coordinates
         function addBasicInfoWindow(marker, coords, index) {
             var infowindow = new google.maps.InfoWindow();
             var content = '<div style="width:99%"><p>' +
                 '<strong>Lat/Lng:</strong><br>' +
                 '(' + coords.lat + ',' + coords.lng + ')<br>' +
                 (index != undefined ? '<strong>Index: </strong>' + index : '') +
                 '</p></div>';

             infowindow.setContent(content);

             google.maps.event.addListener(marker, 'click', function() {
                 openInfoWindow(infowindow, marker);
             });

             return infowindow;
         }

         // Infowindow used for snapped points
         // Makes request to Places Details API to get data about each
         // Place ID.
         // Requests speed limit of each location using Roads SpeedLimit API
         function addDetailedInfoWindow(marker, coords, placeId) {
             var infowindow = new google.maps.InfoWindow();
             var placesRequestUrl = PLACES_URL + placeId;
             var detailsUrl = '<a target="_blank" hre' + 'f="' +
                 placesRequestUrl + '">' +
                 placeId + '</a></li>';

             // On click we make a request to the Places API
             // This is to avoid OVER_QUERY_LIMIT if we just requested everything
             // at the same time
             google.maps.event.addListener(marker, 'click', function() {
                 content = '<div style="width:99%"><p>';

                 function finishInfoWindow(placeDetails) {
                     content += '<strong>Place Details: </strong>' + placeDetails + '<br>' +
                         '<strong>' +
                         (coords.interpolated ? 'Coords' : 'Snapped coords') +
                         ': </strong>' +
                         '(' + coords.lat.toFixed(5) + ',' +
                         coords.lng.toFixed(5) + ')<br>';

                     if (!(coords.interpolated)) {
                         var original = originals[coords.originalIndex];
                         content += '<strong>Original coords: </strong>' +
                             '(' + original.lat + ',' + original.lng + ')<br>' +
                             '<strong>Original Index: </strong>' +
                             coords.originalIndex;
                     }
                     content += '</p></div>';
                     infowindow.setContent(content);
                     openInfoWindow(infowindow, marker);
                 };

                 getPlaceDetails(placeId, function(place) {
                     if (place.name) {
                         content += '<strong>' + place.name + '</strong><br>';
                     }
                     getSpeedLimit(placeId, function(data) {
                         if (data.speedLimits) {
                             content += '<strong>Speed Limit: </strong>' +
                                 data.speedLimits[0].speedLimit + ' km/h <br>';
                         }
                         finishInfoWindow(detailsUrl);
                     });
                 }, function() { finishInfoWindow("<em>None available</em>"); });
             });
             return infowindow;
         }

 

         //   // If the user came to the page with a particular path or URL,
         //   // immediately plot it.
  
         // } // End init function

         // Call the initialize function once everything has loaded
         //google.maps.event.addDomListener(window, 'load', initialize);

         // Load the control panel in a floating div if it is not loaded in an iframe
         // after the textarea has been rendered
         //$("#coords").ready(function() {
         //    if (!window.frameElement) {
         //       $('#panel').addClass("floating panel");
         //       $('#button-div').addClass("button-div");
         //       $('#coords').removeClass("coords-large").addClass("coords-small");
         //       $('#toggle').show();
         //       $('#map').height('100%');
         //    }
         //});
         /**
     *  latlng literal with extra properties to use with the RoadsAPI
     *  @typedef {Object} ExtendedLatLng
     *   lat:string|float
     *   lng:string|float
     *   interpolated:boolean
     *   unsnapped:boolean
     */

         /**
          * Add a line to the map for highlighting the connection between two
          * markersxxxx while the mouse is over it.
          * @param {ExtendedLatLng} from - The origin of the line
          * @param {ExtendedLatLng} to - The destination of the line
          * @return {!Object} line - the polyline object created
          */
         function addOverline(from, to) {
             return addLine("overline", from, to, '#ff77ff', 4, 1.0, 2.0, false);
         }

         /**
          * Add a line to the map for highlighting the connection between two
          * markersxxxx while the mouse is NOT over it.
          * @param {ExtendedLatLng} from - The origin of the line
          * @param {ExtendedLatLng} to - The destination of the line
          * @return {!Object} line - the polyline object created
          */
         function addOutline(from, to) {
             return addLine("outline", from, to, '#bb33bb', 2, 0.5, 1.35, true);
         }

         /**
          * Add a line to the map for highlighting the connection between two
          * markersxxxx.
          * @param {string}         attrib  - The attribute to use for managing the line
          * @param {ExtendedLatLng} from    - The origin of the line
          * @param {ExtendedLatLng} to      - The destination of the line
          * @param {string}         color   - The color of the line
          * @param {number}         weight  - The weight of the line
          * @param {number}         opacity - The opacity of the line (0..1)
          * @param {number}         scale   - The scale of the arrow-head (pt)
          * @param {boolean}        visible - The visibility of the line
          * @return {!Object}       line    - the polyline object created
          */
         function addLine(attrib, from, to, color, weight, opacity, scale, visible) {
             from[attrib] = new google.maps.Polyline({
                 path:         [from, to],
                 strokeColor:  color,
                 strokeWeight:  weight,
                 strokeOpacity: opacity,
                 icons:[{
                     offset: "0%",
                     icon: {
                         scale: scale/*pt*/,
                         path:  google.maps.SymbolPath.BACKWARD_CLOSED_ARROW
                     }
                 }]
             });
             from[attrib].setVisible(visible);
             from[attrib].setMap(map);
             to[attrib] = from[attrib];
             polylines.push(from[attrib]);
             return from[attrib];
         }

         /**
          * Add a pair of lines to the map for highlighting the connection between two
          * markersxxxx; one visible while the mouse is over the marker (the "overline"),
          * the other while it is not (the "outline").
          * @param {ExtendedLatLng} from - The origin of the line (the original input)
          * @param {ExtendedLatLng} to - The destination of the line (the snapped point)
          * @return {!Object} line - the polyline object created
          */
         function addCorrespondence(coords, marker) {
             if (!coords.overline) { addOverline(coords, coords.related); }
             if (!coords.outline)  { addOutline(coords, coords.related); }

             marker.addListener('mouseover', function(mevt) {
                 coords.outline.setVisible(false);
                 coords.overline.setVisible(true);
                 //coords.related.marker.setOpacity(1.0);
             });
             marker.addListener('mouseout', function(mevt) {
                 coords.overline.setVisible(false);
                 coords.outline.setVisible(true);
                 //coords.related.marker.setOpacity(0.5);
             });
         }

         /**
          * Add a marker to the map and check for special 'interpolated'
          * and 'unsnapped' properties to control which colour marker is used
          * @param {ExtendedLatLng} coords - Coords of where to add the marker
          * @return {!Object} marker - the marker object created
          */
         function addMarker(coords) {
             var marker = new google.maps.Marker({
                 position: coords,
                 title: coords.lat + ',' + coords.lng,
                 map: map,
                 opacity: 0.5,
                 icon: RED_MARKER
             });

             // Coord should NEVER be interpolated AND unsnapped
             if (coords.interpolated) {
                 marker.setIcon(BLUE_MARKER);
             } else if (!coords.related) {
                 marker.setIcon(YELLOW_MARKER);
             } else if (coords.originalIndex != undefined) {
                 marker.setIcon(RED_MARKER);
                 addCorrespondence(coords, marker);
             } else {
                 marker.setIcon({url: GREEN_MARKER,
                     scaledSize: {width: 20, height: 20}});
                 addCorrespondence(coords, marker);
             }

             // Make markersxxxx change opacity when the mouse scrubs across them
             marker.addListener('mouseover', function(mevt) {
                 marker.setOpacity(1.0);
             });
             marker.addListener('mouseout', function(mevt) {
                 marker.setOpacity(0.5);
             });

             coords.marker = marker;  // Save a reference for easy access later
             markersxxxx.push(marker);

             return marker;
         }

         /**
          * Animate an icon along a polyline
          * @param {Object} polyline The line to animate the icon along
          */
         function animateCircle(polyline) {
             var count = 0;
             // fallback icon if the poly has no icon to animate
             var defaultIcon = [
               {
                   icon: lineSymbol,
                   offset: '100%'
               }
             ];
             window.setInterval(function() {
                 count = (count + 1) % 200;
                 var icons = polyline.get('icons') || defaultIcon;
                 icons[0].offset = (count / 2) + '%';
                 polyline.set('icons', icons);
             }, 20);
         }


         /**
          * Fit the map bounds to the current set of markersxxxx
          * @param {Array<Object>} markersxxxx Array of all map markersxxxx
          */
         function fitBounds(markersxxxx11  ,markersxxxx1) {
            

             map.setCenter({ lat: markersxxxx11,  lng: markersxxxx1 });
            
             if ( $('#shiftnew').children().length > 0 ) {
                
             } else{
                 $('#map').appendTo('#shiftnew');
             }

            
         }

 
         function getPlaceDetails(placeId,
                                  foundCallback, missingCallback, errorCallback) {
             var request = {
                 placeId: placeId
             };

             placesService.getDetails(request, function(place, status) {
                 if (status == google.maps.places.PlacesServiceStatus.OK) {
                     foundCallback(place);
                 } else if (status == google.maps.places.PlacesServiceStatus.NOT_FOUND) {
                     missingCallback();
                 } else if (errorCallback) {
                     errorCallback();
                 }
             });
         }
 
         function getSpeedLimit(placeId, successCallback, errorCallback) {
             $.ajax({
                 type: 'GET',
                 url: SPEED_LIMIT_URL,
                 data: {
                     placeId: placeId,
                     key: API_KEY
                 },
                 success: successCallback,
                 error: errorCallback
             });
         }

         /**
          * Open an infowindow on either the map or the active streetview pano
          * @param {Object} infowindow Infowindow to be opened
          * @param {Object} marker Marker the infowindow is anchored to
          */
         function openInfoWindow(infowindow, marker) {
             // If streetView is visible display the infoWindow over the pano
             // and anchor to the marker
             if (map.getStreetView().getVisible()) {
                 infowindow.open(map.getStreetView(), marker);
             }
                 // Otherwise open it on the map and anchor to the marker
             else {
                 infowindow.open(map, marker);
             }
         }
 
         function closeAllInfoWindows(infoWindows) {
             for (var i = 0; i < infoWindows.length; i++) {
                 infoWindows[i].close();
             }
         }
    </script>
  
    


<script>
    var app = angular.module('myApp', []);
    app.controller('myCtrl', function ($scope, $http ) {
        $scope.searchitem = [];
        $scope.JobByBetweenDate =function() {
            var param = [{ "name": "From", "value": $("#TxtFrom").val() }, { "name": "To", "value": $("#TxtTo").val() }, { "name": "JobStatus", "value": $("#ddlStatus").val() }];
            var proc = 'SearchJobDateBetween';
            Selector1(param, proc).then(function (result) {
                if (result.d == "Session is experied, please login again") {
                    alert(result.d);
                    window.location.href = "DispatcherLogin.aspx?";
                }
                else {
                    $res = JSON.parse(result.d);

                    $("#SearchedJobsDetails").empty();
                    if ($res.length != []) {
                        $scope.searchitem = $res;
                        $scope.$digest();
                    }
                    else {
                        $scope.searchitem = [];
                        $("#SearchedJobsDetails").append('<div style="cursor:pointer" class="row">Record Not Found</div>');
                    }
                }
            });
        }
              
        $scope.VehicleDetails = function(ele){
            $('#VehicleDetails').modal('show');
            $scope.selectedone = ele;
            var param = [{ "name": "Id", "value": ele }];
            var proc = '[VehicleInfo]';
            Selector(param, proc).then(function (result) {
               
                if (result.d == "Session is experied, please login again") {
                    alert(result.d);
                    window.location.href = "DispatcherLogin.aspx?";
                }
                else {
                    $res = JSON.parse(result.d);
                    $show = 0;
                    if ($res["dt1"].length != []) {
                        console.log( $res["dt1"]);
                        $data =  $res["dt1"][0];
                        $scope.driveridselected = $data.DriverId;
                        
                        $('#lblDriverId').text($data.DriverId);
                        $('#VehicleLat').text($data.Lat);
                        $('#VehicleLng').text($data.Lng);
                    
                        $('#lblDriverPlayerId').text($data.PlayerId);
                        $('#lblVehicleName').text($data.VehicleName);
                        $('#lblVehicleSign').text($data.CallSign);
                        $('#lblVehicleNo').text($data.VehicleNo);
                        $('#lblBookingHeadId').text($data.BookingId);
                        $('#lblDriverPhone').text($data.BookingId);
                        $('#lblDriverName').text($data.UserFName + " " + $data.UserLName)
                        
                        $scope.VehicleImage = $data.VehicleImage;
                     
                        $("#VehicleJobs").empty();
                        if ($res["dt2"].length != []) {
                            var jobColor;

                            for ($i = 0; $i < $res["dt2"].length; $i++) {

                                $("#VehicleJobs").append(
                                    '       <div class="col-sm-12" style="background: #0080004f;">  '  + 
 '                                 '  + 
 '                            '  + 
 '                            <div class="alert-box-title">   '  + 
 '                            <ul class="list-inline">   '  + 
 '                              <li>' + $res["dt2"][$i].BookingStatus + ' </li>   '  + 
 '     '  + 
 '                                              </ul>   '  + 
 '                                            </div>   '  + 
 '                                             <div class=" " >   '  + 
 '                                              <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>When:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">   '  + 
 '                                                    <ul class="list-inline" style="margin-bottom: 0px;">   '  + 
 '                                                       <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].BookingDateTime   + '</p>   '  + 
 '                                                       </li>   '  + 
 '     '  + 
 '                                                   </ul>   '  + 
 '                                                </div>   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>Client:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">   '  + 
 '                                                    <ul class="list-inline" style="margin-bottom: 0px;">   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].PassengerId   + '</p>   '  + 
 '                                                        </li>   '  + 
 '     '  + 
 '                                                   </ul>   '  + 
 '                                                </div>   '  + 
 '                                                 </div>   '  + 
 '     '  + 
 '                                            <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>From:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p>' + $res["dt2"][$i].PickAddress   + ' </p>   '  + 
 '     '  + 
 '                                               </div>   '  + 
 '                                            </div>   '  + 
 '                                              <div class="row">   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>To:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p> ' + $res["dt2"][$i].DropAddress   + ' </p>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '                                            <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>Info:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                    <ul class="list-inline" style="display: inline-flex; margin-bottom: 0px;">   '  + 
 '                                                        <li>   '  + 
 '                                                            <img src="images/icon-user.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                            <p>' + $res["dt2"][$i].Passengers   + '</p>   '  + 
 '                                                        </li>   '  + 
 '                                                         <li>   '  + 
 '                                                           <img src="images/icon-case.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].Bags   + '</p>   '  + 
 '                                                        </li>   '  + 
 '                                                        <li>   '  + 
 '                                                            <img src="images/icon-wheelchair.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].WheelChairs   + '</p>   '  + 
 '                                                       </li>   '  + 
 '                                                    </ul>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '                                            <div class="row">   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>Route:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p>' + $res["dt2"][$i].EstimatedDistance   + ' Km. ' + $res["dt2"][$i].EstimatedTime   + ' Min</p>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '     '  + 
 '                                           </div>   '  + 
 '                                           <hr>   '  + 
 '                               </div>  '  )
                        
                                     
                                
                            }
                                 
                          
                                
                        }

                    
                   

                    }
                     
                   
                }
            });
        }
        $scope.zonelist = []; 
        $scope.driverdata = [];
        $scope.jobdetail = [];
        $scope.jobinfo = [];
        refreshdriver = 1 ;   
        $scope.driverdatarealx = [];

        $scope.timercheck = function(time , id){
            var date1 = new Date(time ); 
            var date2 = new Date(); 
    
            var Difference_In_Time = date2.getTime() - date1.getTime(); 
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24); 
            var  Difference_In_Timez = 	Difference_In_Time / (1000) ; 
             if(Difference_In_Timez > 80 ){
                  return "red";
                 }
            else{
                return "green";
            }
        }
        $scope.adddriverremove = function(datacom){
                

            var found = false;
          
            for(var i = 0; i < $scope.driverdatarealx.length; i++) {
                if ($scope.driverdatarealx[i].VehicleId ==  datacom.VehicleId ) {
                    $scope.driverdatarealx.splice(i, 1); 
                    console.log( $scope.driverdatarealx);
                    $scope.driverlist =  $scope.driverdatarealx;
                    if(markers[datacom.vehiclenumber]){
                        markers[datacom.vehiclenumber].setMap(null);
                    }
                    $scope.changezone($scope.driverdatarealx); 
                    $scope.$digest();
                    found = true;
                    break;
                }
            }
           
        }

        $scope.changedata = function(oldi , neww){
            if(oldi  == "Available"){
                if(neww == "Picking"){
                    
                    $scope.getjobs( );
                    $scope.AssignedJobs( );
                 
                }else if (neww == "Busy"){
                   
                    $scope.ActiveJobsdata( );
             
                }else if(neww == "Away"){
                   
  
                                   
                }
            }else if(oldi == "Picking"){
                if (neww == "Busy"){
 
                    $scope.AssignedJobs( );
                    $scope.ActiveJobsdata( );
              
                }else if (neww == "Available"){
                   
                    $scope.getjobs( );
                    $scope.AssignedJobs( );
                }else if(neww == "Away"){
                    
                   
                }
            }else if(oldi == "Busy"){
                                    
                if (neww == "Available"){
                    $scope.getjobs( );
                    $scope.ActiveJobsdata( );
                                         
                }else if(neww == "Away"){
                 
                                
                }
            }else if(oldi == "Away"){
                if (neww == "Available"){
                   
                   
                }else if (neww == "Busy"){
                    $scope.ActiveJobsdata( );
                    console.log("away to Busy");
                   
                } else if (neww == "Picking"){
                    console.log("away to picking");
                   
                    $scope.AssignedJobs( );
                } 
            }
            $scope.$digest();
        }

        $scope.updatedatat = function(datacom){
         
            var found = false;
            for(var i = 0; i < $scope.driverdatarealx.length; i++) {
               
                if ($scope.driverdatarealx[i].vehiclenumber ==  datacom.vehiclenumber ) {
                 
                     ince = i;
                    found = true;
                    break;
                }else{
                     
                }
            }
            if(found){
                $scope.adddrivernew(datacom);
               
            }
            
           
        }

        $scope.getcurrentchild = function(datacom){
         
            var found = false;
            for(var i = 0; i < $scope.driverdatarealx.length; i++) {
               
                if ($scope.driverdatarealx[i].vehiclenumber ==  datacom.vehiclenumber ) {
                     ince = i;
                     found = true;
                     break;
                }else{
                     
                }
            }
            if(found){
                $newdata =  $scope.driverdatarealx[ince] ;
                //$scope.driverdatarealx[ince] = datacom;
                return     $newdata ;
                        
            }else{
                return '';
            }
           
        }

        $scope.adddrivernew = function(datacom){
            $scope.tallo(datacom);
        }
        $scope.tallo = function(datacom) {
            
 

            datacom.Id = datacom.driverid;
            datacom.VehicleNo = datacom.vehiclenumber;
            datacom.VehicleName = datacom.vehiclenumber;
            datacom.VehicleDetails = datacom.drivername;
            var found = false;
            var incs;
            for(var i = 0; i < $scope.driverdatarealx.length; i++) {
                if ($scope.driverdatarealx[i].VehicleId ==  datacom.VehicleId ) {
                    incs = i;
                    found = true;
                    break;

                }
            }
         
            if(found){
               
                if ($scope.driverdatarealx[incs].VehicleId ==  datacom.VehicleId ) {
 
                    if($scope.driverdatarealx[incs].zonename  != datacom.zonename ){
                      
                        $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;

                      
                        $scope.zonetablez();
                      //
                       
                        $scope.$digest();
                    }
                    if($scope.driverdatarealx[incs].zonequeue  != datacom.zonequeue ){
                      
                        $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;
                    
                        $scope.zonetablez();
                        $scope.$digest();
                    }
                    if($scope.driverdatarealx[incs].joboffer  != datacom.joboffer ){
                      
                        $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;
                       
                        $scope.zonetablez();
                        $scope.$digest();
                    }


                    if($scope.driverdatarealx[incs].jobCount  != datacom.jobCount){
                        
                        $scope.AssignedJobs( );
                    }

                    if($scope.driverdatarealx[incs].jobpickup != datacom.jobpickup){
                        $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;
                        if($scope.driverdatarealx[incs].vehiclestatus  != datacom.vehiclestatus){
                            $scope.changedata($scope.driverdatarealx[incs].vehiclestatus ,datacom.vehiclestatus);
                         }
                        $scope.zonetablez();
                        $scope.$digest();

                    }
                    if($scope.driverdatarealx[incs].JobphoneNo != datacom.JobphoneNo){
                         $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;
                        if($scope.driverdatarealx[incs].vehiclestatus  != datacom.vehiclestatus){
                            $scope.changedata($scope.driverdatarealx[incs].vehiclestatus ,datacom.vehiclestatus);
                        }
                        $scope.zonetablez();
                        $scope.$digest();

                    }
                    if($scope.driverdatarealx[incs].vehiclestatus  != datacom.vehiclestatus){
                        //console.log($scope.driverdatarealx[incs]);
                        //console.log("change status");
                          $scope.changedata($scope.driverdatarealx[incs].vehiclestatus ,datacom.vehiclestatus);
                         
                        $scope.driverdatarealx[incs] =  datacom;
                        $scope.driverlist =  $scope.driverdatarealx;
                        
                        $scope.zonetablez();
                        $scope.$digest();
                    }

                    $scope.$digest();
                       
                }
                 
         
            }else{
                $scope.driverdatarealx.push( datacom);
                $scope.driverlist =  $scope.driverdatarealx;
                //if($('#checkitt').is(":checked")){  
                   
                //    $scope.zonetablez();
                        
                //}else{
                //    $scope.changezone($scope.driverdatarealx); 
                //}
                $scope.zonetablez();
                $scope.$digest();
            }
           
        }
        $scope.changezone = function(dataw){
                 
            $scope.zonetable = dataw;
            var dataStuff = $scope.zonetable;
    
            grouped = Object.create(null);
            grouped2 = Object.create(null);
            
            dataStuff.forEach(function (a) {
                grouped[a.zonename] = grouped[a.zonename] || [];
                grouped[a.zonename].push(a);
            });
            dataStuff.forEach(function (a) {
                grouped2[a.zoneid] = grouped2[a.zoneid] || [];
                grouped2[a.zoneid].push(a);
            });
             
            const keys = Object.keys(grouped)
            const keys2 = Object.keys(grouped2)
            var maaa = [];
            var finaldata = [];
            var maaa2 = [];
            var finaldata2 = [];
            for (var xx = 0 ; xx < keys.length ; xx++) {
                var value = keys[xx];
                var datashows = [];

                var datahead = [];
                var car = "";
                var carvalue = [];
                for (var o = 0; o < grouped[value].length; o++) {
                    var id =  grouped[value][o].zonename;
                    var indexOfDayx = datahead.indexOf(id);
                    if (indexOfDayx === -1) {
                        datahead.push(id)

                    } else {

                    }
                     
                    carvalue.push(grouped[value][o]);
                }


                datashows.push(datahead[0]);
                datashows.push(carvalue);
                maaa.push(datashows);
            }
            for (var xx = 0 ; xx < keys2.length ; xx++) {
                var value2 = keys2[xx];
                var datashows2 = [];

                var datahead2 = [];
                var car = "";
                var carvalue2 = [];
                for (var o = 0; o < grouped2[value2].length; o++) {
                    var id =  grouped2[value2][o].zoneid;
                    var indexOfDayx = datahead.indexOf(id);
                    if (indexOfDayx === -1) {
                        datahead2.push(id)

                    } else {

                    }
                     
                    carvalue2.push(grouped2[value2][o]);
                }


                datashows2.push(datahead2[0]);
                datashows2.push(carvalue2);
                maaa2.push(datashows2);
            }
            $scope.zonelist = maaa;
           
 
            // for zone id



        }
        $scope.JobByDetails =  function(Prc) {
            var param = [{ "name": "Id", "value": $("#TxtSearch").val() }, { "name": "JobStatus", "value": $("#ddlStatus").val() }];
            var proc = Prc;
            Selector1(param, proc).then(function (result) {
                if (result.d == "Session is experied, please login again") {
                    alert(result.d);
                    window.location.href = "DispatcherLogin.aspx?";
                }
                else {
                    $res = JSON.parse(result.d);
                    console.log($res);
                    $("#SearchedJobsDetails").empty();
                    if ($res.length != []) {
                        $scope.searchitem = $res;
                        $scope.$digest();
                    }
                    else {
                        $scope.searchitem =[];
                        $("#SearchedJobsDetails").append('<div style="cursor:pointer" class="row">Record Not Found</div>');
                    }
                }
            });
        }

        $scope.format = function(time) {   
            // Hours, minutes and seconds
            var hrs = ~~(time / 3600);
            var mins = ~~((time % 3600) / 60);
            var secs = ~~time % 60;

            // Output like "1:01" or "4:03:59" or "123:03:59"
            var ret = "";
            if (hrs > 0) {
                ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
            }
            ret += "" + mins + ":" + (secs < 10 ? "0" : "");
            ret += "" + secs;
            return ret;
        }
 
        $scope.jobdetailshowing = [];
        $scope.jobsectionempty =function (){
            $scope.jobdetailshowing = [];

        }
        var coords;
        $scope.JobDetails = function(ele) {
 
            var param = [{ "name": "Id", "value": ele }];
            var proc = 'JobDetails';
            Selector1(param, proc).then(function (result) {
                if (result.d == "Session is experied, please login again") {
                    alert(result.d);
                    window.location.href = "DispatcherLogin.aspx?";
                }
                else {
                    $res = JSON.parse(result.d);
              
                    if ($res.length != []) {

                        console.log($res);

                        $scope.jobdetailshowing = $res;
                        var input  = $res[0].Route;
              
                        console.log(input);

                        $('#coords').val(input)
                        $('#plot').click();
                        $scope.$digest();
                    }
                    else {
                        $("#JobsDetailsSection").append('<div style="cursor:pointer" class="row">Some Details are missing for this job</div>');
                    }
                }
            });
        }
 
        
        $('#plot').click(function(e) {
            clearMap();
            repeatedcall();
            //drawDistance();
            e.preventDefault();
        });



        function repeatedcall(){

         
                var coords1 = '';
                input = decodeURIComponent( $('#coords').val());
                var points = input.split('&');
                points =  getUnique(points);
                counter = 0;
              
                for (var i = 0; i < points.length; i++) {
       
                    if (i == points.length-1) {
                        coords1 +=   points[i] ;
                    }else{
                        if(counter == 90){
                            coords1 +=   points[i];
                        }else{
                            coords1 +=   points[i]+"&";
                        }
                        
                    }
                    if(counter == 90){
                        counter = 0;
                       
                        $('#coords').val(coords1);
                        coords1 = '';
                        bendAndSnap();

                    }else if( i == points.length-1){
                      

                        $('#coords').val(coords1);
                        coords1 = '';
                        bendAndSnap();
                     
                        break;
                       
                    }
                 counter++;
                }
          

               
           
        }
      
        $scope.calcRoute  = function(directionsService, directionsRenderer,pickup,formatted_address , x) {
            console.log(pickup);
            console.log(formatted_address);
            console.log(x);
            var waypts = [];
            var s = x.split('&');
            for (var i = 0 ; i < s.length; i++) {
                var single =  s[i].split(',');
                if(i == 0){
                    continue;
                }
                if(i == s.length-1){
                    continue;
                }
                console.log(single[0]);
                console.log(single[1]);

                waypts.push({
 
                    location: new google.maps.LatLng(   parseFloat( single[0] ) , parseFloat( single[1]) ), 
 
                    stopover: false
               
                });
            }
        
            console.log(waypts);
            var selectedMode = 'DRIVING';
            var request = {
                origin: pickup,  
                destination: formatted_address, 
                waypoints: waypts,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode[selectedMode]
            };
            directionsService.route(request, function (response, status) {
                
                if (status == google.maps.DirectionsStatus.OK) {
                    directionsRenderer.setDirections(response);
                

                
                  
                } else {
                    alert("directions response " + status);
                }
            });
   
       
     
       
      
        }
      

        //google.maps.event.addDomListener(window, "load", initialize);

      
 
        $scope.weekselect = 0;
        $scope.dayselect = '';
        $scope.mon  = true;
        $scope.tue  = true;
        $scope.wed  = true;
        $scope.thu   = true;
        $scope.fri   = true;
        $scope.sat  = true;
        $scope.sun  = true;
        $scope.changeweekday = function(){
            if($scope.weekselect == 0){
            
                $scope.mon  = true;
                $scope.tue  = true;
                $scope.wed  = true;
                $scope.thu   = true;
                $scope.fri   = true;
                $scope.sat  = true;
                $scope.sun  = true;
            }else if($scope.weekselect == 1){
                $scope.mon      = true;
                $scope.tue  = false;
                $scope.wed  = true;
                $scope.thu   = false;
                $scope.fri   = true;
                $scope.sat  = false;
                $scope.sun  = true;
            }else if($scope.weekselect == 2){
            
                $scope.mon  = false;
                $scope.tue  = true;
                $scope.wed  = false;
                $scope.thu   = true;
                $scope.fri   = false;
                $scope.sat  = true;
                $scope.sun  = false;
            }
        }
       
        $scope.ddlLaterMins = '00';
            
        $scope.assign_notice = '0';
        $scope.ddlLaterHrs = '00';
        $scope.dataset = function(){
            var now = new Date();
            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);
            var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
            $scope.datetimemain  = new  Date(todayz);                                              
            $scope.datetimesecond  = new  Date(todayz);     
            console.log($scope.datetimemain );
        }
        $scope.dataset();                                                       
        var promise;
        
        //var increaseCounter = function () {
        //    //$scope.getjobs();
        //    //$scope.LoginDrivers();
        //}
        $scope.counterarray = [];

      


        $scope.checkconter =function(i , counternum,email){
            if($('#checkitt').is(":checked")){

                if(!$scope.counterarray.includes(counternum)){
                           
                    $scope.counterarray.push(counternum);
                   
                }else{
                    return;  
                } 
            }
            i = "close"+i;
            i  = setInterval(function () {
     
                var param = [{ "name": "bookingsid", "value": counternum }];
                var proc = '[readwebsitestatuscheck]';
                Selector1(param, proc).then(function (result) {
              
                    $res = JSON.parse(result.d);
            
                    if($res[0].Result == 'cancel'){
                        clearInterval(i);
 
                        message1 =  '    <!DOCTYPE html>  '  + 
                                              '   <html>  '  + 
                                              '   <head>  '  + 
                                              '   	<title>Email test</title>  '  + 
                                              '   </head>  '  + 
                                              '   <body>  '  + 
                                              '   	<h1>Sorry we are unable at this time. !</h1>  '  + 
                                              '   	<p>Try Another Company.</p>  '  + 
                                              '   	<p>Thank You for bussiness with us</p>  '  +
                                              '   	<p style="color:red">Note: Do Not Reply</p>  '  +  
                                              '   </body>  '  + 
                                              '  </html>  ' ; 
                        jQuery.ajax(
                       {
                           type: "POST",
                           url: "Default.aspx/SendEmail",
                           data: JSON.stringify({
                               "Email":  'iffimalik66@gmail.com',
                               "CName":  'Invercargil',
                               "Body":    message1
                           }),
                           dataType: "json",
                           //contentType: "application/json; charset=utf-8",
                           cache: false,
                           success: function (response) {
                              
                               toastr["error"](     "Website Ride Was Cancel. Automatically!!  ", 'error!'); 
                           }
                       }
                       );
                    }
          


                });
                clearInterval(i);
            }, 20000);
       
        }
       
     
       
     
     
        

      

        $scope.showfirst = function(){ 
           
            $scope.clearsection();  
            $scope.noneed = 0;
         
            $('#firss').addClass('acc_active');
            $('#firss1').show( );
            $('#secc').removeClass('acc_active');
            $('#secc1').hide();
            
            $('#third').removeClass('acc_active');
            $('#third1').hide();
         
            $('#largeModal').modal({backdrop: 'static', keyboard: false}, 'show');
         }
       
        $scope.showfirst2 = function(){ 
            
            $scope.noneed = 0;
            $('#firss').addClass('acc_active');
            $('#firss1').show( );
            $('#secc').removeClass('acc_active');
            $('#secc1').hide();
            
            $('#third').removeClass('acc_active');
            $('#third1').hide();
            $('#largeModal').modal('show');
           
        }
        $scope.LocalPickLat = 0;
        $scope.LocalPickLng =  0;
        $scope.LocalDropLat = 0 ;
        $scope.LocalDropLng = 0 ;
        $scope.dropupaddress = '';
        $scope.pickupaddress = '';
        $scope.rideinfo = '';
        $scope.tarrifvalue = '';

        $scope.selectedcustomer = 1;
        $scope.selectedbeg = 0;
        $scope.selectedwheelchair = 0;
        $scope.selectedcar = 1;
        $scope.changeperson = function(){

            if($scope.selectedwheelchair > 0){
                $scope.changewheelch();
                return;
            }
            var homes = $scope.cartype

            let sortByPrice = homes.sort(function (a, b) 
            {
                return parseFloat(b.seat) - parseFloat(a.seat);
            });

            console.log(sortByPrice);
            let chosen = false;
         
            for(x = sortByPrice.length-1 ; x >= 0 ; x--){
                     
         
                console.log("current seat" +sortByPrice[x].seat);
                console.log("selected selectedcustomer" +$scope.selectedcustomer);
                if($scope.selectedcustomer <= sortByPrice[x].seat ){
                    console.log("selected index" + sortByPrice[x].VehicleName);
                        
                    console.log($scope.carlist);
                        
                    for ($i = 0; $i < $scope.carlist.length; $i++) {
                        console.log(sortByPrice[x].VehicleName);
                        console.log( $scope.carlist[$i] );
                        if(sortByPrice[x].VehicleName == $scope.carlist[$i]){
                               
                            console.log($i);
                            $scope.selectedcartype = $i; 
                            chosen = true;
                            break;
                           
                        }
                       
                    }

                    if(  chosen == true){
                        break;
                  
                    }

                    
                }
            }
            if(  chosen == false){
                Swal.fire(
                  'Choose Another No Of Passenger!',
                   "No Car Avalible which Support "+$scope.selectedcustomer+ " Passengers",
                   'warning'
              );
          
                  
            }
           
        }
        $scope.changewheelch = function(){

            if($scope.selectedwheelchair == 0){
                $scope.changeperson();
                return;
            }


            var homes = $scope.cartype

            let sortByPrice = homes.sort(function (a, b) 
            {
                return parseFloat(b.wheelchair) - parseFloat(a.wheelchair);
            });

            console.log(sortByPrice);
           let chosen = false;
         
            for(x = sortByPrice.length-1 ; x >= 0 ; x--){
                     
         
                console.log("current seat" +sortByPrice[x].wheelchair);
                console.log("selected selectedcustomer" +$scope.selectedwheelchair);
                if($scope.selectedwheelchair <= sortByPrice[x].wheelchair ){
                    console.log("selected index" + sortByPrice[x].VehicleName);
                        
                    console.log($scope.carlist);
                        
                    for ($i = 0; $i < $scope.carlist.length; $i++) {
                        console.log(sortByPrice[x].VehicleName);
                        console.log( $scope.carlist[$i] );
                        if(sortByPrice[x].VehicleName == $scope.carlist[$i]){
                               
                            console.log($i);
                            $scope.selectedcartype = $i; 
                            chosen = true;
                            break;
                        }
                       
                    }

 
                    chosen = true;
                    break;
                }
            }
            if(  chosen == false){
                Swal.fire(
                  'Choose Vehicle Manually!',
                   "No Wheal Chair Vehicle Avalible which Support "+$scope.selectedwheelchair+ " Passengers",
                   'warning'
              );
                $scope.selectedwheelchair = 0;
                $scope.selectedcustomer = 0;
                if($scope.selectedwheelchair == 0){
                    $scope.changeperson();
                    return;
                }
                  
            }

 
        }

        $scope.bookingtime_select = 0;
        var now = new Date();

        var day = ("0" + now.getDate()).slice(-2);
        var month = ("0" + (now.getMonth() + 1)).slice(-2);

        var todayq = now.getFullYear() + "-" + (month) + "-" + (day);
        $scope.latedate = todayq ;
        $scope.latehours = 0;
        $scope.latemin = 0;
        $scope.dispatchlatertime = 0

        $scope.btnReverse = function () {
           
            if($('#LocalDropLat').val() == 0){

                if($scope.stoplistarray.length > 0  ){

                    var qqq =   $scope.stoplistarray.length-1;
                    $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-input'+$scope.stoplistarray[qqq].id).val());
                }


            }else{
                var PickLocation = $scope.pickupaddress;
                var DropLocation = $scope.dropupaddress;
                $("#pac-input").val(DropLocation);
                $("#pac-inputx").val(PickLocation);
                $scope.pickupaddress  = DropLocation;
                $scope.dropupaddress =  PickLocation ;
                var PickLocationlat =  $('#LocalPickLat').val();  
                var PickLocationlng =  $('#LocalPickLng').val(); 
                var DropLocationlat = $('#LocalDropLat').val();  
                var DropLocationlng =  $('#LocalDropLng').val();
                $('#LocalPickLat').val(DropLocationlat);
                $('#LocalPickLng').val(DropLocationlng);
                $('#LocalDropLat').val(PickLocationlat);
                $('#LocalDropLng').val(PickLocationlng);
                var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
                var drop = $('#LocalDropLat').val()+','+$('#LocalDropLng').val();

                if($scope.stoplistarray.length == 0){
                     
                    $scope.calculateAndDisplayRoute(directionsService, directionsRenderer,pic , drop);
                }  else if($scope.stoplistarray.length > 0  ){

                    var qqq =   $scope.stoplistarray.length-1;
                    $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-input'+$scope.stoplistarray[qqq].id).val());
                  
                }

           

            }
          

        } ;


        $scope.noneed = 0;

        $scope.getddlvehicle = function () {

            if($scope.noneed == 1){
                return;
            }

            
          
            if ( $scope.selecteddriver == 0 ||  $scope.selecteddriver == -1) {
               
                $("#ddlVehicleType").empty();
                $("#ddlVehicleType").append("<option value='0' selected='selected'>Automatic</option>");

            }else{
                var param = [{ "name": "DriverId", "value": $scope.selecteddriver }];
                var proc = '[RetrieveVehicle]';
                jQuery.ajax(
                 {
                     type: "POST",
                     url: "DataManager/Data.aspx/DataSelectorLess",
                     data: JSON.stringify({
                         "data": param,
                         "action": proc
                     }),
                     dataType: "json",
                     contentType: "application/json; charset=utf-8",
                     cache: false,
                     success: function (result) {
 
                         if (result.d == "Session is experied, please login again") {

                             window.location.href = "DispatcherLogin.aspx?";
                         }
                         else {
                             $("#ddlVehicleType").empty();
                             try{
                                 $res = JSON.parse(result.d);
                             }catch(z){
                                 $res = [];
                             }
                             if ($res.length != [] && $res[0].AutoDispatch == '1') {
                                 $("#ddlVehicleType").append("<option value='' selected='selected'>Vehicle</option>");
                                 for ($i = 0; $i < $res.length; $i++) {
                                     $("#ddlVehicleType").append("<option value=" + $res[$i].Id + " >" + $res[$i].VehicleNo + " ," + $res[$i].CallSign + "</option>");
                                 }
                             }
                             else {
                                 if ($res.length == []) {
                                     $("#ddlVehicleType").append("<option value='' selected='selected'>Vehicle</option>");
                                 }
                                 else {
                                     //$("#ddlVehicleType").append("<option value='' selected='selected'>Automatic</option>");
                                     for ($i = 0; $i < $res.length; $i++) {
                                         $("#ddlVehicleType").append("<option value=" + $res[$i].Id + " >" + $res[$i].VehicleNo + " ," + $res[$i].CallSign + "</option>");
                                     }
                                 }
                             }
                         }
                          
                           
                     }
                 });
                   
            }
                
        }
       

        $scope.selecteddriver = 0;
        $scope.LoginDriver = [];
        // login driver list
        $scope.LoginDrivers = function() {
            var param = [];
            var proc = '[LoginDrivers]';
          
            jQuery.ajax(
                  {
                      type: "POST",
                      url: "DataManager/Data.aspx/DataSelectorLess",
                      data: JSON.stringify({
                          "data": param,
                          "action": proc
                      }),
                      dataType: "json",
                      contentType: "application/json; charset=utf-8",
                      cache: false,
                      success: function (response) {
                          $res= JSON.parse(response.d);
                            
                          
                          if($scope.updatex > 0){

                          }else{
                              $scope.LoginDriver = $res;
                          }
                       
                         
                           
                      }
                  });



        }
        //$scope.LoginDrivers();
        //driver list finished
        var ZonesArea = [];

        //getting zone area
            
        $scope.GetZoneAreas = function() {

            var param = [];
            var proc = 'ZoneCoordinates';



            jQuery.ajax(
                  {
                      type: "POST",
                      url: "DataManager/Data.aspx/DataSelector",
                      data: JSON.stringify({
                          "data": param,
                          "action": proc
                      }),
                      dataType: "json",
                      contentType: "application/json; charset=utf-8",
                      cache: false,
                      success: function (response) {
                          if (response.d == "Session is experied, please login again") {
                               
                              window.location.href = "DispatcherLogin.aspx?";
                          }
                          else {
                              ZonesArea = JSON.parse(response.d);
                       
                          }
                           
                      }
                  });


 

        }

        $scope.FnBookingZone = function(PickLat, PickLng) {
           
            $("#PickupZoneId").text("");
            if (ZonesArea["dt1"].length != [] || ZonesArea["dt2"].length != []) {
    
      
                var polygon = [], ZonesPolygon = [], UpdatedVehicle = [];
                var a = 0;
                for ($i = 0; $i < ZonesArea["dt1"].length; $i++) {
                    var ZonesCoordsArray = [];
                    var str = "";
                    for ($k = 0; $k < ZonesArea["dt1"][$i].No; $k++) {
                        str +=
                        ZonesCoordsArray.push({ lat: parseFloat(ZonesArea["dt2"][a].Lat), lng: parseFloat(ZonesArea["dt2"][a].Lng) });
                        a++;
                    }
                    for ($j = 0; $j < ZonesArea["dt2"].length; $j++) {
              
                        var CurrentLocation = new google.maps.LatLng(parseFloat(PickLat), parseFloat(PickLng));

                        try{
                            var bermudaTriangle = new google.maps.Polygon({ paths: ZonesCoordsArray });
                         
                            var resultColor = google.maps.geometry.poly.containsLocation(CurrentLocation, bermudaTriangle);
                      
                        }catch(ex){

                            break;
                      
                        }
                        if (resultColor == true) {
                             
                            $("#PickupZoneId").text(ZonesArea["dt1"][$i].ZoneId);
                            UpdatedVehicle.push({ "Parm1": ZonesArea["dt1"][$i].ZoneId });
                            break;
 

                        } 
                        if ($("#PickupZoneId").text() != "") {
                            break;
                        }


                    }
                    if ($("#PickupZoneId").text() != "") {

                        break;
                    }

                }

                if (resultColor == false) {
                      
                    $('#pac-input').val('');
                    $('#LocalPickLat').val(0);
                    $('#LocalPickLng').val(0);
                 
                    return false;
                } else{
                    return true;
                }
            }


        }


        $scope.GetZoneAreas();
        // zone area finshed



        // assignedsending

        $scope.AssignJobFromJobList = function(BookingId, VehicleId ,driverId,U_id , quenumber,type) {
              
            var JobVehicleId = $("#"+type+BookingId+ "").val();
 
            console.log(quenumber);
           
            var sel = document.getElementById(type+BookingId);
            var selected = sel.options[sel.selectedIndex];
            var extra = selected.getAttribute('data-doo');
            var quenumber1 = selected.getAttribute('data-zoneq');

            
                FnMoveQueueNo1(VehicleId,quenumber);
          
            console.log(JobVehicleId);
            if (JobVehicleId == '0') {
               

                 Action([
                { "name": "BookingId", "Value": BookingId },
                {"name":"reternVehicleid" , "Value" : VehicleId},
                {"name":"reterndriverId" , "Value" : driverId},
                {"name": "quenumber", "Value": quenumber1 }
                ], "[UnAssignJobStatusFromJobList]");
                 FnCancelRide(driverId, BookingId);
                 angular.element(document.getElementById('myangular')).scope().AssignedJobs();
                 $scope.getjobs();
            }
            else {
             

                console.log("sending to another one");
                Action([
                { "name": "BookingId", "Value": BookingId },
                { "name": "VehicleId", "Value": JobVehicleId },
                {"name": "reternVehicleid" , "Value" : VehicleId},
                {"name":"reterndriverId" , "Value" : driverId} , 
                 { "name": "quenumber", "Value": quenumber1 }
                ], "[AssignJobStatusFromJobList]");
              
                FnCancelRide(driverId, BookingId);
                if(U_id != null || U_id != ''){
                    writeNewPostpassenger(JobVehicleId, BookingId, "Offered" , U_id);
                }else{
                    writeNewPost(JobVehicleId, BookingId, "Offered");
                }
                angular.element(document.getElementById('myangular')).scope().AssignedJobs();
            }
            
 
           
           
        }

      

            $scope.copything = function(){
                $scope.updatex = 0;
                $scope.paymentobtrue = false;
                $scope.AmmountAddedvaluesend = ''; 
                $scope.AmmountAddedvalue = '';
            }


            $scope.AmmountAddedvalue = '';
            $scope.AmmountAddedvaluesend = '';
        
            var NewStopsLatLngArray = [], NewStopsLatLngArrayJob2 = [], geocoder, NewStopLat, NewStopLng, DispatchingTime, PickZoneId;
            var onestop = [];
            $scope.updatex = 0;
            $scope.updateride = function(previousdriverid , vehicleidpre){
            if($("#LocalPickLat").val() == 0){
                  toastr["error"]( "Please Select The Pickup address First", 'error!'); 
                 return;
            }
            var completelistofstop = '';
            var laterjob = false;
            $.each($scope.stoplistarray, function( index, value ) {
                completelistofstop +=     $('#lat'+value.id).val()+"@"+$('#lng'+value.id).val()+"@"+$('#pac-input'+value.id).val()+"="
            });

            var laterchecking = 0;
            if ($scope.bookingtime_select == 1) {
                laterjob = true;
                BookingDateTime = $("#laterDate").val() + " " + $("#ddlLaterHrs").val()  + ":" +$("#ddlLaterMins").val()   + ":00";
                DispatchingTime = new Date(BookingDateTime);
                DispatchingTime.setMinutes(DispatchingTime.getMinutes() - $("#assign_notice").val() ) ;
                var month = DispatchingTime.getMonth() + 1;
                var date = DispatchingTime.getDate();
                var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                    (('' + month).length < 2 ? '0' : '') +
                    month + '-' +
                    (('' + date).length < 2 ? '0' : '') + date;

                h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                var dispatchshowtime = $("#assign_notice").val()  
                laterchecking = 1;
            }
            else {
                laterchecking = 0;

                var now = new Date();
                var day = ("0" + now.getDate()).slice(-2);
                var month = ("0" + (now.getMonth() + 1)).slice(-2);
                var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                var d = new Date();

                h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                BookingDateTime = todayz + " " + h + ':' + m;
                DispatchingTime = new Date(BookingDateTime);


                DispatchingTime.setMinutes(DispatchingTime.getMinutes() - 0);
                var month = DispatchingTime.getMonth() + 1;
                var date = DispatchingTime.getDate();
                var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                    (('' + month).length < 2 ? '0' : '') +
                    month + '-' +
                    (('' + date).length < 2 ? '0' : '') + date;

                h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                var dispatchshowtime = 0;
            }
             

            if ($("#ddlVehicleType").val() == "") {
                VehicleId = "0";
            }
            else {
                VehicleId = $("#ddlVehicleType option:selected").val();

            }

            var sel = document.getElementById('ddlDriver');
            var selected = sel.options[sel.selectedIndex];
            var VehicleId = selected.getAttribute('data-foo');
            var quenumberxx = selected.getAttribute('data-zoneq');
            console.log(VehicleId);
            var bookstatus = "";
            var DriveId = "";
            if(laterjob){
                DriveId = "0";
                bookstatus = "No One";
            }else{
                if ($scope.selecteddriver == 0) {
                    DriveId = "0";
                    bookstatus = "Offered";
                }
                else if ($scope.selecteddriver == -1 ) {
                    DriveId = "0";
                    bookstatus = "No One";
                }
                else {
                    DriveId = $scope.selecteddriver;
                    if( DriveId != 0  && DriveId != -1 && DriveId != previousdriverid){
                        bookstatus = "Offered";
                    }else{
                        bookstatus = "Assigned";
                    }
            
                }
            }
            var previous= "0";
            if(DriveId != "0"  && DriveId != "-1" && DriveId != previousdriverid ){
                previous  = previousdriverid;

            }else{
                previous = "0";
            }
            var  BookingUgent = 'no';
            if ($scope.urgentdata == true) {
                BookingUgent = "Yes";
            }
            else {
                BookingUgent = "No";
            }
            var CornerAddress = '';
            if ( $scope.cornershow == true) {
                CornerAddress = $scope.cornerdata;

            }
            else {
                CornerAddress = "";
            }
            $amountadded =  '';


            if (DriveId == "0" || DriveId == "-1") {
                var quenumber = 0;

                //FnCancelRide(previousdriverid, BookingIz );
                //$("#Divo" + BookingIz + "").remove();
            }else if( DriveId != "0"  && DriveId != "-1" && DriveId != previousdriverid ){
                //writeNewPost(DriveId, BookingIz, "Offered");
                //FnCancelRide(previousdriverid,  BookingIz ); 
                var quenumber = selected.getAttribute('data-zoneq');

            }
            else {
                var quenumber = $scope.quenumberq;

                //JobEidtPost(DriveId, BookingIz);
                     
            }
            //$amountadded =  document.getElementById("AmmountAddedvalue").value;
            if( $scope.acc_select_id  != ''){
                $booking_type = "ACC Ride";
            }else if( $scope.account_Select_Id != ''){
                $booking_type = "Account Ride";
            }else if( $scope.paymentobtrue == false){
                $booking_type = "Normal Ride";
            }else {
                $booking_type = "Normal Ride";
            }
            var param = [
           { "name": "Id", "Value": $scope.updatebookingid },
           { "name": "Name", "Value":  $scope.account_Name },
           { "name": "PassengerId", "Value": $scope.account_PhoneNo  },
           { "name": "Email", "Value":  $scope.account_Email },
           { "name": "VId", "Value": VehicleId }, 
           { "name": "DId", "Value": DriveId },
           { "name": "PickLatLng", "Value": $("#LocalPickLat").val() + "," + $("#LocalPickLng").val() },
           { "name": "DropLatLng", "Value": $("#LocalDropLat").val() + "," + $("#LocalDropLng").val() },
           { "name": "PickLocation", "Value": $('#pac-input').val() },
           { "name": "DropLocation", "Value": $('#pac-inputx').val() },
           { "name": "VehicleType", "Value": $("#VehicleType option:selected").text() },
           { "name": "PassengersNo", "Value": $scope.selectedcustomer },
           { "name": "BagsNo", "Value": $scope.selectedbeg },
           { "name": "WheelChairsNo", "Value": $scope.selectedwheelchair },
           { "name": "VRequired", "Value":  $scope.selectedcar },
           { "name": "TarriffId", "Value":  $scope.selectedtarrif },
           { "name": "TarriffName", "Value":$("#ddlTariff option:selected").text()  },
           { "name": "CustomeRate", "Value": $scope.CustomeRate },
           { "name": "Urgent", "Value": BookingUgent },
           { "name": "FlightNo", "Value":'' },
           { "name": "RoomNo", "Value": '' },
           { "name": "Nextstop", "Value": $scope.stoplistarray.length },
           { "name": "nextstopdata", "Value":completelistofstop },
           { "name": "ZoneId", "Value": parseInt( $('#PickupZoneId').text()) },
           { "name": "EntitiesDetails", "Value": $scope.rideinfo  },
           { "name": "DateTime", "Value": BookingDateTime },
           { "name": "Dispatchbefore", "Value": dispatchshowtime },
           { "name": "DispatchMinutes", "Value": DispatchingTime },
           { "name": "Distance", "Value":  $scope.distance },
           { "name": "Time", "Value": $scope.Time  },
           { "name": "EstimatedCost", "Value":  $scope.currency },
           { "name": "CornerAddress", "Value": $scope.cornerdata },
           { "name": "PromoId", "Value": '' },
           { "name": "Acc_job_id", "Value": $scope.acc_select_id},
           { "name": "Acc_manager_id", "Value": $scope.manager_id },
           { "name": "Account_id", "Value":$scope.account_Select_Id},
           { "name": "Acc_claim_id", "Value":   $scope.claim_number  },
           { "name": "Acc_client_id", "Value": $scope.client_id },
           { "name": "Acc_trip_status", "Value":  $scope.trip_status },
           { "name": "bookstatus", "Value": bookstatus},
            {"name": "booking_type" , "Value" :  $booking_type},
            {"name":"previous" , "value": previous},
            
            {"name":"quenumber" , "value": quenumber},

              {"name":"recieve_ammount" , "value": $scope.AmmountAddedvaluesend}
            ];
            var proc = "[ProcUpdateJobv6]";
            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataProcessor",

                data: {
                    data: param,
                    action: proc
                }

            }).then(function mySuccess(result) {
        
                if (result.data.d == "Booking Details Update Successfully" ) { 
                 
                    toastr["success"](   "Booking Information Successfully Submitted", 'success!'); 
                    var  BookingIz =  $scope.updatebookingid ;
                    if(laterjob){
                        FnCancelRide(previousdriverid,  BookingIz );
                        $("#Divo" + BookingIz + "").remove();
                    }else{
                        if (DriveId == "0" || DriveId == "-1") {
                            FnCancelRide(previousdriverid, BookingIz );
 

                            //var chceck = false;
                            //for(var x = 0 ;  x < $scope.driverdatarealx.length; x++ ){

                            //    if($scope.driverdatarealx[x].driverid == previousdriverid){
                            //        if($scope.driverdatarealx[x].zoneid == $('#PickupZoneId').text()){
                            //            chceck = true;

                            //            break;
                            //        }
                            //    }
                            //}
                            //if(chceck){
                                FnMoveQueueNo1(vehicleidpre,$scope.quenumberq);
                            //}else{
                            //    FnMoveQueueNo1(vehicleidpre,1);
                            //}
                            

                            
                            //$scope.quenumberq;
                            $("#Divo" + BookingIz + "").remove();
                        }else if( DriveId != "0"  && DriveId != "-1" && DriveId != previousdriverid ){
                            writeNewPost(DriveId, BookingIz, "Offered");
                            FnCancelRide(previousdriverid,  BookingIz ); 

                            //var chceck = false;
                            //for(var x = 0 ;  x < $scope.driverdatarealx.length; x++ ){

                            //    if($scope.driverdatarealx[x].driverid == previousdriverid){
                            //        if($scope.driverdatarealx[x].zoneid == $('#PickupZoneId').text()){
                            //            chceck = true;

                            //            break;
                            //        }
                            //    }
                            //}
                            //if(chceck){
                                FnMoveQueueNo1(vehicleidpre,$scope.quenumberq);
                            //}else{
                            //    FnMoveQueueNo1(vehicleidpre,1);
                            //}
                            
                            
                        }
                        else {
                         
                            JobEidtPost(DriveId, BookingIz);
                     
                        }
                    }
                    $scope.AssignedJobs();
                    $scope.getjobs();
                    $scope.clearsection();  
                    $scope.updatebookingid = '';
                    $('#largeModal').modal('hide');
                    $("#PickupZoneId").text('');
                    //$scope.LoginDrivers(); 
                    $scope.quenumberq = '';
                }else{
              
                    toastr["warning"](   "Booking Information Not Update", 'warning!'); 

                }
            
              
              
            }, function myError(response) {
                console.log(response);


            });
 
            
            
        }
        //car booking

        $scope.carbooking = function(){


            $('#paymentmodel').modal('show');

        }
        //carbooking end
        $scope.paymentobtrue = false;
        //payment jobs // 
        $scope.AmmountAddedvaluesend = '';
        $scope.paymentjob = function(payment,email, name){
            $scope.paymentobtrue = true;
            $scope.AmmountAddedvaluesend = payment;
            var pick = $('#pac-input').val();
            var drop = $('#pac-inputx').val();
            $scope.bookingride();
            console.log($('#Email').val());
            if($('#Email').val() != ''){
                console.log("send hoi");
                $scope.sendpaymetnemail( $('#Email').val(),  $('#TxtName').val(), $('#TxAmountfinal').val() , pick , drop     );
                $('#TxtName').val("");
                $('#Email').val("");   
                $('.card-number').val(""),
                $('.card-cvc').val(""),
                 $('.card-expiry-month').val(""),
                $('.card-expiry-year').val("")
            }else{
                console.log("send ni hoi");
                $('#TxtName').val("");
                $('#Email').val("");   
                $('.card-number').val(""),
                 $('.card-cvc').val(""),
                 $('.card-expiry-month').val(""),
                $('.card-expiry-year').val("")
            }
        } 
        $scope.sendpaymetnemail = function(email , name , payment ,pick , drop){
            console.log(email);
            console.log(name);
            console.log(payment);
            message1 = "<!DOCTYPE html>" +
           "<html>" +
           "<head>" +
               "<title></title>" +
           "</head>" +
           "<body>" +
           " <div>" +
               "<div style=' padding: 20px; background: #ffc10770;'>" +
               "	<h2 align='center' style='font-family: sans-serif;'>Account Verification Update:</h2>" +
               "</div>" +
              "<div style='padding: 20px; background:  #f1efeb70;'>" +
                   "<h4>Hello "+name+".</h4>"+
                   "<h3>Your Booking is Successfully made in "+$('#CompanyName').text()+" Company.</h3>" +
                   "<h3>Pick Up: "+pick+" </h3>"+
                   "<h3>Drop off: "+drop+" </h3>"+
                   "<h3>You have Charged : "+payment+" NZD Taxes & card fee Included . From your Provided Card Details</h3>" +
                   "<span>Soon Driver Will contect you. Or reached at your specified location</span>" +
                    "<h3>Payment is not Refundable</h3>" +
               "</div>" +
                   "<div style=' padding: 20px; background: #0a0a0a70;'>" +
                   "<h2 align='center' style='font-family: sans-serif;'> </h2>" +
               "</div>" +
           " </div>" +
           "</html>";
            console.log("here");
            jQuery.ajax(
             {
                 url: "Default.aspx/SendEmail",
                 type: "POST",
                 dataType: "json",
                 data: JSON.stringify({
                     "Email":  email,
                     "CName":  'Invercargil',
                     "Body":    message1
                 }),
               
                 contentType: "application/json; charset=utf-8",
                 cache: false,
                 success: function (response) {
                     console.log("this is ");
                     console.log(response);
                     if(response.d == 'Success'){
                              
                         toastr["success"]("Payment Email is Send Successfully", 'success!');
                     }else{
                               
                         toastr["warning"]('Payment Email Not Send Try Again!', 'warning!');
                         
                     }

                    

                 }
             }
             );
        }
        $scope.bookingridebefore = function(){
            
            var length = $('#ddlDriver').children('option').length;
          
            if(length == 2){


                Swal.fire({
                    title: 'Are you sure?',
                    text:  $( "#VehicleType option:selected" ).text() +" Type Vehicle is not avalible yet. change the Vehicle Type or You still want to Make a ride??",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    cancelButtonText: "Leave", 
                    confirmButtonText: 'Yes create!'
                }).then((result) => {
           
                    if (result.value) {
              
                        $scope.bookingride();
                    }else{

                    }
                })
            
            }else{
               
                $scope.bookingride();
            }
         


        }
        $scope.bookingride = function(){

            if($("#LocalPickLat").val() == 0){
             
                Swal.fire(
                 'Warning!',
                  "Please Select The Pickup address First",
                  'warning'
             );
                return;
            }
            var completelistofstop = '';
            if ($("#PickupZoneId").text() == "" && $scope.selecteddriver == 0) {
                Swal.fire(
                        'Warning!',
                        "Assign the ride to a driver.  The Pickup Address is out of this Company Zones",
                        'so it can t be dispatch automatically'
                    );
            }
            else {
                $.each($scope.stoplistarray, function( index, value ) {
                    completelistofstop +=     $('#lat'+value.id).val()+"@"+$('#lng'+value.id).val()+"@"+$('#pac-input'+value.id).val()+"="
                });

                var laterchecking = 0;
                if ($scope.bookingtime_select == 1) {
                    BookingDateTime = $("#laterDate").val() + " " +  $("#ddlLaterHrs").val() + ":" +$("#ddlLaterMins").val()  + ":00";
                    DispatchingTime = new Date(BookingDateTime);
                    DispatchingTime.setMinutes(DispatchingTime.getMinutes() - $("#assign_notice").val()  );
                    var month = DispatchingTime.getMonth() + 1;
                    var date = DispatchingTime.getDate();
                    var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                        (('' + month).length < 2 ? '0' : '') +
                        month + '-' +
                        (('' + date).length < 2 ? '0' : '') + date;

                    h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                    m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                    DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                    var dispatchshowtime = $("#assign_notice").val()  
                    laterchecking = 1;
                }
                else {
                    laterchecking = 0;

                    var now = new Date();
                    var day = ("0" + now.getDate()).slice(-2);
                    var month = ("0" + (now.getMonth() + 1)).slice(-2);
                    var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                    var d = new Date();

                    h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                    m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                    BookingDateTime = todayz + " " + h + ':' + m;
                    DispatchingTime = new Date(BookingDateTime);


                    DispatchingTime.setMinutes(DispatchingTime.getMinutes() - 0);
                    var month = DispatchingTime.getMonth() + 1;
                    var date = DispatchingTime.getDate();
                    var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                        (('' + month).length < 2 ? '0' : '') +
                        month + '-' +
                        (('' + date).length < 2 ? '0' : '') + date;

                    h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                    m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                    DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                    var dispatchshowtime = 0;
                }

                if(laterchecking  == 1 && $scope.ddlLaterMins == 00){
                     

                    Swal.fire(
                        'You Forget To Select Dispatch before Time!',
                         "Please Select Dispatch Before Time",
                           'warning'
                      );
                    $('#ddlLaterMins').css("color", "red");
                    return;
                } 


                var  BookingUgent = 'no';
                if ($scope.urgentdata == true) {
                    BookingUgent = "Yes";
                }
                else {
                    BookingUgent = "No";
                }
                var CornerAddress = '';
                if ( $scope.cornershow == true) {
                    CornerAddress = $scope.cornerdata;
                }
                else {
                    CornerAddress = "";
                }

                if ($("#PickupZoneId").text() == "") {
                    PickZoneId = "0";
                }
                else {
                    PickZoneId = $("#PickupZoneId").text();
                }
                $amountadded =  '';
                 if( $scope.acc_select_id  != ''){
                    $booking_type = "ACC Ride";
                }else if( $scope.account_Select_Id != ''){
                    $booking_type = "Account Ride";
                }else if( $scope.paymentobtrue == false){
                    $booking_type = "Normal Ride";
                }else {
                    $booking_type = "Normal Ride";
                }
                 
                

                var sel = document.getElementById('ddlDriver');
                var selected = sel.options[sel.selectedIndex];
                var extra = selected.getAttribute('data-foo');
                var quenumber = selected.getAttribute('data-zoneq');
                console.log(extra);
                var param = [
            { "name": "Name", "Value":  $scope.account_Name },
            { "name": "PassengerId", "Value": $scope.account_PhoneNo  },
            { "name": "Email", "Value":  $scope.account_Email },
            { "name": "Account_id", "Value":  $scope.account_Select_Id  },
            { "name": "VId", "Value": extra }, 
            { "name": "DId", "Value": $scope.selecteddriver },
            { "name": "PickLatLng", "Value": $("#LocalPickLat").val() + "," + $("#LocalPickLng").val() },
            { "name": "DropLatLng", "Value": $("#LocalDropLat").val() + "," + $("#LocalDropLng").val() },
            { "name": "PickLocation", "Value": $('#pac-input').val() },
            { "name": "DropLocation", "Value": $('#pac-inputx').val()},
            { "name": "VehicleType", "Value": $("#VehicleType option:selected").text() },
            { "name": "PassengersNo", "Value": $scope.selectedcustomer },
            { "name": "BagsNo", "Value": $scope.selectedbeg  },
            { "name": "WheelChairsNo", "Value":  $scope.selectedwheelchair  },
            { "name": "VRequired", "Value":  $scope.selectedcar  },
            { "name": "TarriffId", "Value": $scope.selectedtarrif},
            { "name": "TarriffName", "Value": $("#ddlTariff option:selected").text() },
            { "name": "CustomeRate", "Value": $scope.CustomeRate },
            { "name": "Urgent", "Value": BookingUgent },
            { "name": "FlightNo", "Value": '' },
            { "name": "RoomNo", "Value":'' },
            { "name": "EntitiesDetails", "Value": $scope.rideinfo },
            { "name": "DateTime", "Value": BookingDateTime },
            { "name": "DispatchMinutes", "Value": DispatchingTime },
            { "name": "Dispatchbefore", "Value": dispatchshowtime },
            { "name": "Source", "Value": 'Dispatch Console' },
            { "name": "Distance", "Value":  $scope.distance },
            { "name": "Time", "Value":  $scope.Time },
            { "name": "EstimatedCost", "Value": $scope.currency },
            { "name": "CornerAddress", "Value": CornerAddress },
            {"name":  "DispatcherName", "value":someSession},
            { "name": "nextstop", "Value": $scope.stoplistarray.length },
            { "name": "nextstopdata", "Value": completelistofstop  },
            { "name": "ZoneId", "Value": PickZoneId },
            { "name": "Acc_job_id", "Value": $scope.acc_select_id},
            { "name": "Acc_claim_id", "Value":  $scope.claim_number },
            { "name": "Acc_client_id", "Value": $scope.client_id },
            { "name": "Acc_manager_id", "Value": $scope.manager_id },
            { "name": "Acc_trip_status", "Value":  $scope.trip_status },
            {"name" : "Bookingtype" , "Value" : $booking_type},
            {"name" : "quenumber" , "Value" : quenumber},

             {"name": "Recieve_payment" , "Value" : $scope.AmmountAddedvaluesend },
            { "name": "PromoId", "Value": '' }];
 
                var driverset =   $scope.selecteddriver;
                console.log(param);
                if($scope.showdays){
                    var firstDate = new Date($("#laterDate").val());
                    var secondDate = new Date($("#MultipleDate").val()); 
                    var oneDay = 24 * 60 * 60 * 1000;
                    var diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / (oneDay)));
 
                    for ($C = 0; $C <= diffDays; $C++) {
                            
                        var NewDate = new Date(BookingDateTime);
                           
                         
                        NewDate.getDate();
                          
                        NewDate.setDate(NewDate.getDate() + $C);

                        var dateshow =    NewDate.toLocaleDateString().split('/');
                             
                        var mmm =  (dateshow[0] < 10 ? '0' : '') +dateshow[0];
                        var ddd =   (dateshow[1] < 10 ? '0' : '') + dateshow[1];
                        var yyy=   dateshow[2]
                        var compliging = yyy+"-"+mmm+"-"+ddd;
                        var  BookingDateTime2 = compliging + " " +  $("#ddlLaterHrs").val() + ":" +$("#ddlLaterMins").val()  + ":00";
                           
                        var DispatchingTime2 = new Date(BookingDateTime2);
                        DispatchingTime2.setMinutes(DispatchingTime2.getMinutes() - $("#assign_notice").val()  );
                        var month = DispatchingTime2.getMonth() + 1;
                        var date = DispatchingTime2.getDate();
                        var DispatchOutput = DispatchingTime2.getFullYear() + '-' +
                            (('' + month).length < 2 ? '0' : '') +
                            month + '-' +
                            (('' + date).length < 2 ? '0' : '') + date;

                        h = (DispatchingTime2.getHours() < 10 ? '0' : '') + DispatchingTime2.getHours(),
                        m = (DispatchingTime2.getMinutes() < 10 ? '0' : '') + DispatchingTime2.getMinutes();
                        DispatchingTime2 = DispatchOutput + " " + h + ':' + m+':'+"00";
                        var dispatchshowtime3 = $("#assign_notice").val();
                        console.log(BookingDateTime2);
                        console.log(DispatchingTime2);
                        console.log(dispatchshowtime3);


                        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        var dss = new Date(NewDate.toLocaleDateString());
                        var dayName = days[dss.getDay()];
                        console.log(dayName);

                        if(dayName == 'Sun'){
                            if($scope.sun == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Mon'){
                            if($scope.mon == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Tue'){
                            if($scope.tue == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Wed'){
                            if($scope.wed == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Thu'){
                            if($scope.thu == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Fri'){
                            if($scope.fri == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }else if(dayName == 'Sat'){
                            if($scope.sat == true){

                            }else{
                                console.log("conitnues");
                                continue;
                            }
                        }
           
                              
                        var param = [
                    { "name": "Name", "Value":  $scope.account_Name },
                    { "name": "PassengerId", "Value": $scope.account_PhoneNo  },
                    { "name": "Email", "Value":  $scope.account_Email },
                    { "name": "Account_id", "Value":  $scope.account_Select_Id  },
                    { "name": "VId", "Value": $("#ddlVehicleType").val() }, 
                    { "name": "DId", "Value": $scope.selecteddriver },
                    { "name": "PickLatLng", "Value": $("#LocalPickLat").val() + "," + $("#LocalPickLng").val() },
                    { "name": "DropLatLng", "Value": $("#LocalDropLat").val() + "," + $("#LocalDropLng").val() },
                    { "name": "PickLocation", "Value": $('#pac-input').val() },
                    { "name": "DropLocation", "Value": $('#pac-inputx').val()},
                    { "name": "VehicleType", "Value": $("#VehicleType option:selected").text() },
                    { "name": "PassengersNo", "Value": $scope.selectedcustomer },
                    { "name": "BagsNo", "Value": $scope.selectedbeg  },
                    { "name": "WheelChairsNo", "Value":  $scope.selectedwheelchair  },
                    { "name": "VRequired", "Value":  $scope.selectedcar  },
                    { "name": "TarriffId", "Value": $scope.selectedtarrif},
                    { "name": "TarriffName", "Value": $("#ddlTariff option:selected").text() },
                    { "name": "CustomeRate", "Value": $scope.CustomeRate },
                    { "name": "Urgent", "Value": BookingUgent },
                    { "name": "FlightNo", "Value": '' },
                    { "name": "RoomNo", "Value":'' },
                    { "name": "EntitiesDetails", "Value": $scope.rideinfo },
                    { "name": "DateTime", "Value": BookingDateTime2 },
                    { "name": "DispatchMinutes", "Value": DispatchingTime2 },
                    { "name": "Dispatchbefore", "Value": dispatchshowtime3 },
                    { "name": "Source", "Value": 'Dispatch Console' },
                    { "name": "Distance", "Value":  $scope.distance },
                    { "name": "Time", "Value":  $scope.Time },
                    { "name": "EstimatedCost", "Value": $scope.currency },
                    { "name": "CornerAddress", "Value": CornerAddress },
                    {"name":  "DispatcherName", "value":someSession},
                    { "name": "nextstop", "Value": $scope.stoplistarray.length },
                    { "name": "nextstopdata", "Value": completelistofstop  },
                    { "name": "ZoneId", "Value": PickZoneId },
                    { "name": "Acc_job_id", "Value": $scope.acc_select_id},
                    { "name": "Acc_claim_id", "Value":  $scope.claim_number },
                    { "name": "Acc_client_id", "Value": $scope.client_id },
                    { "name": "Acc_manager_id", "Value": $scope.manager_id },
                    { "name": "Acc_trip_status", "Value":  $scope.trip_status },
                    {"name" : "Bookingtype" , "Value" : $booking_type},
                     {"name" : "quenumber" , "Value" : quenumber},
                    {"name": "Recieve_payment" , "Value" : $scope.AmmountAddedvaluesend },
                    { "name": "PromoId", "Value": '' }];
                        var proc = 'InsertBookingv4';
                        $http({

                            method: "POST",

                            url: "DataManager/Data.aspx/DataSelectorRide",

                            data: {
                                data: param,
                                action: proc
                            }

                        }).then(function mySuccess(result) {
                       
                            if (result.data.d == "Session is experied, please login again") {
                                alert(result.data.d);
                                window.location.href = "DispatcherLogin.aspx?";
                            }
                            else {
                                $res = result.data;
                                $res = JSON.parse($res.d);
                                        
                                if ($res[0].Result == "Booking Information Successfully Submitted") {
                                 
                                }
                            }

              
                        }, function myError(response) {
                            console.log(response);


                        });
                    }
                    toastr["success"]("You Created  Repeated Ride Successfully", 'success!');

                }
                else
                {
                    for ($R = 0; $R < $scope.selectedcar ; $R++) {
                        var proc = 'InsertBookingv4';
                        $http({

                            method: "POST",

                            url: "DataManager/Data.aspx/DataSelectorRide",

                            data: {
                                data: param,
                                action: proc
                            }

                        }).then(function mySuccess(result) {
                       
                            if (result.data.d == "Session is experied, please login again") {
                                alert(result.data.d);
                                window.location.href = "DispatcherLogin.aspx?";
                            }
                            else {
                                $res = result.data;
                                $res = JSON.parse($res.d);
                          
                                if ($res[0].Result == "Booking Information Successfully Submitted") {
                                    console.log($("#ddlVehicleType").val())
                                    
                                    toastr["success"]("Booking Information Successfully Submitted", 'success!');

                                    console.log( $("#ddlVehicleType").val() );
                                    if($res[0].BookingStatus == "No One"){
                                             
                                    }  else if($res[0].BookingStatus == "Offered") {
                                             


                                        if(laterchecking == 0) {
                                            console.log(driverset)
                                            console.log($res[0].BookingId)
                                            console.log($res[0].BookingStatus)

                                            writeNewPost(driverset, $res[0].BookingId, $res[0].BookingStatus)
                                     
                                            acknowledgemethodx( $("#ddlVehicleType").val() , driverset, $res[0].BookingId,"Offered");  
                                        }

                                            
                                    }else if($res[0].BookingStatus == "Pending"){
                                             
                                        //$scope.FnZonewiseJobtwo();
                                             
                                    }
                                        
                                }
                            }

              
                        }, function myError(response) {
                            console.log(response);


                        });
                       }
                }
                  
                   
                $scope.clearsection();  
                $scope.getjobs();
                $('#largeModal').modal('hide'); 
                //if($('#checkitt').is(":checked")){  
                   
                //    $scope.FnZonewiseJobtwo();
                        
                //}
                  
            }

            
        }
        var counterr = 0;
        $scope.autodispatchdriver = [];
        var timerz = '';
        $scope.FnZonewiseJobtwo =  function () {
            console.warn("start");
            var d = new Date();
            var month = d.getMonth() + 1;
            var date = d.getDate();
            var FinalOutput = d.getFullYear() + '-' +
                (('' + month).length < 2 ? '0' : '') +
                month + '-' +
                (('' + date).length < 2 ? '0' : '') + date;

            h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
            m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
            var CurrentDateTime = FinalOutput + " " + h + ':' + m;
   
            var param = [{ "name": "CurrentDateTime", "Value": CurrentDateTime }];
            var proc = 'AutoDispatchVehiclesallride';
    
            Selector(param, proc).then(function (result) {
                $resz = JSON.parse(result.d);
 
              
                  if($resz["dt1"].length > 0){

                     var  zz = 0;
                    var timerz = new IntervalTimer(function () {
                       if(zz >= $resz["dt1"].length){
                            zz = 0;
                             timerz.pause();
                            
                        } else {
                                var id =   $resz["dt1"][zz].Id;
                                var zonedi = $resz["dt1"][zz].ZoneId;
                                var vehicletpe = $resz["dt1"][zz].VehicleType ;
                                var PassengersNo = $resz["dt1"][zz].Passengers;
                           
                                  var  param = [{ "name": "CurrentDateTime", "Value": CurrentDateTime },
                                  { "name": "bookingid", "Value": id},
                                  { "name": "ZoneId", "Value": zonedi }];
                            
                              var  proc = 'AutoDispatchVehiclesv2';
                      
                               Selector(param, proc).then(   function (result) {
                                  var ressp  = JSON.parse(result.d);
                                 
                                
                                  if (ressp["dt2"].length != []) {

                                      var  param = [   { "name": "bookingid", "Value": id} 
                                      ];
                                      var  ar = 'checkriddestatusforautodispatch';
                                      jQuery.ajax(
                                         {
                                             type: "POST",
                                             url: "DataManager/Data.aspx/DataSelector",
                                             data: JSON.stringify({
                                                 "data": param,
                                                 "action": ar
                                             }),
                                             dataType: "json",
                                             contentType: "application/json; charset=utf-8",
                                             cache: false,
                                             success: function (result) {
                                                 var ridestatus = JSON.parse(result.d);
                    
                                                 if(ridestatus["dt1"].length > 0) {
                                                            
                                                     $scope.recursive(ressp["dt2"] , 0 , id ,  vehicletpe , zonedi , 0  ,  ressp["dt2"].length , CurrentDateTime , PassengersNo , 0 , 0 , 0 , 0);

                                                 }else{
                    
                                                 }

                                             }
                                         });


                                  }
                                  else
                                  { 
                                      $scope.recursive(ressp["dt2"] , 0 , id ,  vehicletpe , zonedi ,  2  ,  ressp["dt2"].length , CurrentDateTime , PassengersNo , 0 , 0 , 1 , 1);
                                  }

                                    });
                                
                                
                                zz++;
                         
                        }
              
                    } , 3000);
        
                }
           });
        }
      
        $scope.recursive =  async function(obj , i , id , vehicletype , zoneid ,first ,totallenth , CurrentDateTime , PassengersNo , PickLatLng , DropLatLng , radiuscounter , startcounter){
     
          return;
            
            if(first == 0){
                sleep(Math.floor(Math.random() * 11));

                console.log("this job start" + id);
            } 
            var DbRef = firebase.database();
            let myPromisejob = new Promise(function(myResolve, myReject) {
                var refaz21= DbRef.ref("/autodisp/"+ id);
                refaz21.once("value", function (snapshot) {
                    $resppx =   snapshot.val();
                    if($resppx == null  ){
                        myResolve("jobnotexist");
                    }else{
                        myResolve("jobexist");
                    }

                });
            });

            var resppjob =  await myPromisejob;
             
            if(resppjob == "jobexist"){
             
                if(first == 0){
                    return ;
                } 
              
            }
          

            let myPromise = new Promise(function(myResolve, myReject) {
                if(!obj[i]){
                    myResolve("exist");
                }

                var driverid =    obj[i].PlayerId;
                var bookid = id;
                var driveridonline= DbRef.ref("/autodisp/"+ obj[i].PlayerId);
                let driverilistener =  driveridonline.once("value", function (snapshot) {
                    $driverrespp =   snapshot.val();
                  if($driverrespp == null  ) {
                           var refaz= DbRef.ref("/autodisp/"+ obj[i].PlayerId);
             
                            var refaz2= DbRef.ref("/autodisp/"+ id);
            
                            refaz2.once("value", function (snapshot) {
                                $resppx =   snapshot.val();
                                if($resppx == null  ){
                                 
                                    let listener =  refaz.once("value", function (snapshot) {
                                        $respp =   snapshot.val();
                                 
                                        if($respp == null  ){
                                      
                                            if(vehicletype == "Not Specified"){
                                               
                                                  if(obj[i].seat < PassengersNo){
                                                    myResolve("exist");
                                                  }else{
                                                      var  param = [   { "name": "bookingid", "Value": id} 
                                                      ];
                                                      var  ar = 'checkriddestatusforautodispatch';
                                                      jQuery.ajax(
                                                         {
                                                             type: "POST",
                                                             url: "DataManager/Data.aspx/DataSelector",
                                                             data: JSON.stringify({
                                                                 "data": param,
                                                                 "action": ar
                                                             }),
                                                             dataType: "json",
                                                             contentType: "application/json; charset=utf-8",
                                                             cache: false,
                                                             success: function (result) {
                                                                 var ridestatus = JSON.parse(result.d);
                    
                                                                 if(ridestatus["dt1"].length > 0) {
                                                            
                                                                     writeautodispatch(id, id);
                                                                     writeautodispatch(obj[i].PlayerId, id);
                                                                     writeNewPost(obj[i].PlayerId, id, "Pending");   
                                                                     myResolve("notexist");

                                                                 }else{
                    
                                                                 }

                                                             }
                                                         });


                                                
                                                }
                                                 
                                            }else if( obj[i].VehicleName == vehicletype  ){
                                                if(obj[i].seat < PassengersNo){
                                                    myResolve("exist");
                                                }else{

                                                    var  param = [   { "name": "bookingid", "Value": id} 
                                                    ];
                                                    var  ar = 'checkriddestatusforautodispatch';
                                                    jQuery.ajax(
                                                       {
                                                           type: "POST",
                                                           url: "DataManager/Data.aspx/DataSelector",
                                                           data: JSON.stringify({
                                                               "data": param,
                                                               "action": ar
                                                           }),
                                                           dataType: "json",
                                                           contentType: "application/json; charset=utf-8",
                                                           cache: false,
                                                           success: function (result) {
                                                               var ridestatus = JSON.parse(result.d);
                    
                                                               if(ridestatus["dt1"].length > 0) {
                                                            
                                                                   writeautodispatch(id, id);
                                                                   writeautodispatch(obj[i].PlayerId, id);
                                                                   writeNewPost(obj[i].PlayerId, id, "Pending");   
                                                                   myResolve("notexist");

                                                               }else{
                                                                   myResolve("exist");
                                                               }

                                                           }
                                                       });


                                                  
                                                }
                                            }else{
                                                myResolve("exist");
                                            }
         
                                        }else{
                                            myResolve("exist");
                                        }
                                    });
                        
                                }else{

                                    let listener =  refaz.once("value", function (snapshot) {
                                        $respp =   snapshot.val();
                                       
                                        if($respp == null  ){
                                            if(vehicletype == "Not Specified"){
                                                if(obj[i].seat < PassengersNo){
                                                    myResolve("exist");
                                                }else{

                                                    var  param = [   { "name": "bookingid", "Value": id} 
                                                    ];
                                                    var  ar = 'checkriddestatusforautodispatch';
                                                    jQuery.ajax(
                                                       {
                                                           type: "POST",
                                                           url: "DataManager/Data.aspx/DataSelector",
                                                           data: JSON.stringify({
                                                               "data": param,
                                                               "action": ar
                                                           }),
                                                           dataType: "json",
                                                           contentType: "application/json; charset=utf-8",
                                                           cache: false,
                                                           success: function (result) {
                                                               var ridestatus = JSON.parse(result.d);
                    
                                                               if(ridestatus["dt1"].length > 0) {
                                                            
                                                                   writeautodispatch(obj[i].PlayerId, id);
                                                                   writeNewPost(obj[i].PlayerId, id, "Pending");   
                                                   
                                                                   myResolve("notexist");

                                                               }else{
                                                                   myResolve("exist");
                                                               }

                                                           }
                                                       });

                                                  
                                                }
                                            }else if( obj[i].VehicleName == vehicletype  ){
                                                if(obj[i].seat < PassengersNo){
                                                    myResolve("exist");
                                                }else{

                                                    var  param = [   { "name": "bookingid", "Value": id} 
                                                    ];
                                                    var  ar = 'checkriddestatusforautodispatch';
                                                    jQuery.ajax(
                                                       {
                                                           type: "POST",
                                                           url: "DataManager/Data.aspx/DataSelector",
                                                           data: JSON.stringify({
                                                               "data": param,
                                                               "action": ar
                                                           }),
                                                           dataType: "json",
                                                           contentType: "application/json; charset=utf-8",
                                                           cache: false,
                                                           success: function (result) {
                                                               var ridestatus = JSON.parse(result.d);
                    
                                                               if(ridestatus["dt1"].length > 0) {
                                                            
                                                                   writeautodispatch(obj[i].PlayerId, id);
                                                                   writeNewPost(obj[i].PlayerId, id, "Pending");  
                                                                   myResolve("notexist");

                                                               }else{
                                                                   myResolve("exist");
                                                               }

                                                           }
                                                       });
                                                  

                                                }
                                            }else{
                                                myResolve("notexist");
                                            }
         
                                        }else{
                                            myResolve("exist");
                                        }
                                    });
                                }
                            });
              
                    }else{
                        
                        myResolve("exist");
                    }
                });
                 
            });
            var respp =  await myPromise;
             
            if(respp == "exist"){
              
        
                if( i+1 < totallenth){
                    var  param = [   { "name": "bookingid", "Value": id} 
                    ];
                    var  ar = 'checkriddestatusforautodispatch';
                    jQuery.ajax(
                       {
                           type: "POST",
                           url: "DataManager/Data.aspx/DataSelector",
                           data: JSON.stringify({
                               "data": param,
                               "action": ar
                           }),
                           dataType: "json",
                           contentType: "application/json; charset=utf-8",
                           cache: false,
                           success: function (result) {
                               var ridestatus = JSON.parse(result.d);
                    
                               if(ridestatus["dt1"].length > 0) {
                                                            
                                  
                                   $scope.recursive(obj ,  i+1 , id , vehicletype , zoneid ,  i+1 , totallenth , CurrentDateTime ,PassengersNo , PickLatLng , DropLatLng , radiuscounter , startcounter);


                               } 

                           }
                       });


                   
                }else{
                         
                 
                    let myPromisetotaldriver = new Promise(function(myResolve, myReject) {
                    
                    var param = [{ "name": "BookingId", "Value": id }];
                    var prod = 'AutoDispatchAllVehicles';
     
                    Selector(param, prod).then(  function (result) {
                        let res = JSON.parse(result.d);
                        console.log(res);
                        if (res["dt1"].length != []) {

                            var  VehiclesArray = [];
                            if (res["dt2"].length != []) {
                                console.log(res["dt2"].length);
                                totaldrivers = [];

                    
                                    res["dt2"].forEach( function( item) {
                          
                                        var refz = firebase.database().ref("online/" + SomeSession2 + "/"+item.vehicleid);
                   
                                        var resp = [];
                                        refz.once("value", function (snapshot) {
                                            xoo  = snapshot.val();
                                            if (xoo == null) {
                                            }else{
                                                snapshot.forEach(function (itemz) {
                                                  
                                                   var random44 = new google.maps.LatLng(itemz.val().lat, itemz.val().lng);
                                                   var  random55 = new google.maps.LatLng(res["dt1"][0].Item, res["dt1"][1].Item);
                                                    var distance = (google.maps.geometry.spherical.computeDistanceBetween(random44, random55) / 1000).toFixed(2);
                                                    //var  data = [distance, item.DriverId, item.VehicleName , item.VehicleNo];
                                                   
                                                    if(parseInt(distance) <= parseInt($('#CompanyRadius').text()) ){
                                                        if(itemz.val().vehiclestatus == "Available") {
                                                            var data = { 
                                                                distance : distance,
                                                                PlayerId : item.DriverId ,
                                                                VehicleName  : item.VehicleName , 
                                                                VehicleNo :  item.VehicleNo ,
                                                                VehicleStatus : itemz.val().vehiclestatus ,
                                                                ZoneId : itemz.val().zoneid,
                                                                ZoneQueueNo : itemz.val().zonequeue ,
                                                                vehicleidno : itemz.val().VehicleId ,
                                                                seat : item.seat  
                                                            }
                                                             totaldrivers.push(data);
                                                             totaldrivers.sort();
                                                             console.log(totaldrivers);

                                                        }
                                                           
                                                    }
                                                    
                                                }
                                              )
                                            }
                                        });
                       
                          
                                    });
                                    myResolve('complete');
                              
                            }


                        }
       
                    });
                    });

                    var resppjob =  await myPromisetotaldriver;
             
                    if(resppjob == "complete"){
                        if(resppjob == "complete"){
                            console.log(totaldrivers);
                            console.log(resppjob);
                            if(totaldrivers.length == 0){
                                console.log("this job finished" + id);
                                firebase.database().ref().child("/autodisp/"+id).remove();
                                firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                            }else{
                                if(startcounter == 1){
                                    var  param = [   { "name": "bookingid", "Value": id} 
                                    ];
                                    var  ar = 'checkriddestatusforautodispatch';
                                    jQuery.ajax(
                                       {
                                           type: "POST",
                                           url: "DataManager/Data.aspx/DataSelector",
                                           data: JSON.stringify({
                                               "data": param,
                                               "action": ar
                                           }),
                                           dataType: "json",
                                           contentType: "application/json; charset=utf-8",
                                           cache: false,
                                           success: function (result) {
                                               var ridestatus = JSON.parse(result.d);
                    
                                               if(ridestatus["dt1"].length > 0) {
                                                            
                                                 
                                                   $scope.recursive(totaldrivers ,  0 , id , vehicletype , zoneid ,  2 , totaldrivers.length , CurrentDateTime ,PassengersNo , PickLatLng , DropLatLng , 1 , 0);


                                               } 

                                           }
                                       });



                                }else{
                                    if(radiuscounter == 1){
                                        console.log("this job finished" + id);
                                        firebase.database().ref().child("/autodisp/"+id).remove();
                                        firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                                    }else if(radiuscounter == 0){
                                      
                                        var  param = [   { "name": "bookingid", "Value": id} 
                                        ];
                                        var  ar = 'checkriddestatusforautodispatch';
                                        jQuery.ajax(
                                           {
                                               type: "POST",
                                               url: "DataManager/Data.aspx/DataSelector",
                                               data: JSON.stringify({
                                                   "data": param,
                                                   "action": ar
                                               }),
                                               dataType: "json",
                                               contentType: "application/json; charset=utf-8",
                                               cache: false,
                                               success: function (result) {
                                                   var ridestatus = JSON.parse(result.d);
                    
                                                   if(ridestatus["dt1"].length > 0) {
                                                            
                                  
                                                       $scope.recursive(totaldrivers ,  0 , id , vehicletype , zoneid ,  2 , totaldrivers.length , CurrentDateTime ,PassengersNo , PickLatLng , DropLatLng , 1 , 0);


                                                   } 

                                               }
                                           });

                                    }
                                }
                            }
                             

                        }
                    }
                  } 
                }else if(respp=="notexist"){
                  let myPromisoffer =  new Promise(function(myResolve, myReject) {
                   var  param = [   { "name": "bookingid", "Value": id},
                         { "name": "VehicleNo", "Value": obj[i].vehicleidno},
                         { "name": "driverid", "Value": obj[i].PlayerId },
                         { "name": "ridestatus", "Value": "Offered"} 
                    ];
                    console.log(param);
                    console.log("status need to change");
                    var  ar = '[changeriddestatusforoffer1]';
                    jQuery.ajax(
                       {
                           type: "POST",
                           url: "DataManager/Data.aspx/DataSelector",
                           data: JSON.stringify({
                               "data": param,
                               "action": ar
                           }),
                           dataType: "json",
                           contentType: "application/json; charset=utf-8",
                           cache: false,
                           success: function (response) {
                               console.log(response);
                               console.log("status need to change");
                               $scope.getjobs( );
                               myResolve('dont');
                               $scope.$digest();
                           },
                           error:  function (response) {
                               myResolve('dont');
                           }
                       });
                
                });
                var ackoffer =    await myPromisoffer;
                if(ackoffer == 'dont'){


                    var chck1 = true;
                    var chck = true;
                    let myPromiseack =  new Promise(function(myResolve, myReject) {
                        setTimeout(() => {
                         
                            var DbRefz = firebase.database();
                            var refaz  = DbRefz.ref("joback/"+id+"/"+obj[i].PlayerId);
                            var reponsex = 0;
                         
                            let listener =  refaz.on("value",   function (snapshot) {
                                $respp =   snapshot.val();
                                setTimeout(function(){  
                                   
                                    if(chck1 == true){
                                        console.log("dispatch will cancel this job. app is not responding");
                                        var DbRefz = firebase.database();
                                        firebase.database().ref().child("/notification/" + obj[i].PlayerId).remove();
                                        console.log("status need to update for delay");
                                        convertstatus(id,'Pending', obj[i].PlayerId ,  $message ) ; 
                                        refaz.off("value", listener);
                                        firebase.database().ref().child("joback/"+id+"/"+obj[i].PlayerId).remove();
                                        firebase.database().ref().child("/autodisp/"+ obj[i].PlayerId).remove();
                                        firebase.database().ref().child("/autodisp/"+id).remove();
                                        myResolve("reject");
                                    }
                                    
                                     
                                }, 40000);
      
                                if($respp == null  ){
                        
                                    $message  = 'Job Not Shown to driver app. Try Again!';
                                     setTimeout(function(){  
                                        if($('#Divo'+id).length && chck == true ){
                                        var DbRefz = firebase.database();
                                        firebase.database().ref().child("/notification/" + obj[i].PlayerId).remove();
                                        convertstatus(id,'Pending', obj[i].PlayerId ,  $message ) ; 
                                        refaz.off("value", listener);
                                        firebase.database().ref().child("joback/"+id+"/"+obj[i].PlayerId).remove();
                                        firebase.database().ref().child("/autodisp/"+ obj[i].PlayerId).remove();
                                        firebase.database().ref().child("/autodisp/"+id).remove();
                                        myResolve("reject");
                                    }
                                    }, 30000);
      
 
                                }else {
                                    if($respp['status']){

                                        chck = false;
                                        if($respp['status'] != 'Sent') {
                        
                                            counterfirst++;
                                            if($respp['jobstatus'] == 'offered'){
                                               if($respp['discription']  === 'Ride Status Successfully Updated to Assigned'){
                                                   chck1 = false;
                                                   refaz.off("value", listener);
                                                    firebase.database().ref().child("joback/"+id+"/"+obj[i].PlayerId).remove();
                                                    firebase.database().ref().child("/autodisp/"+ obj[i].PlayerId).remove();
                                                    $('#Divo'+id).remove();
                                                    angular.element(document.getElementById('myangular')).scope().getjobs( );
                                                    myResolve("accept");
                                                }
                                                else if($respp['discription'] === 'Ride Status Successfully Updated to Reject'){
                                                    refaz.off("value", listener);
                                                    chck1 = false;
                                                    console.log(obj[i].PlayerId + " Reject The Job!  ");
                                                    firebase.database().ref().child("joback/"+id+"/"+obj[i].PlayerId).remove();
                                                    $scope.zonetablez();
                                                    $scope.$digest();
                                                    firebase.database().ref().child("/notification/" + obj[i].PlayerId).remove();
                                                    firebase.database().ref().child("/autodisp/"+ obj[i].PlayerId).remove();
                                                    myResolve("reject");
                                                 }else if($respp['discription'] === 'job reached but will not be displayed'){
                                                     chck1 = false;
                                                    console.log("Reject by job reached but is in background");
                                                    refaz.off("value", listener);
                                                    $message  = 'Job Not Shown to driver app. Try Again!';
                                                    firebase.database().ref().child("joback/"+id+"/"+obj[i].PlayerId).remove();
                                                    firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                                            
                                                    firebase.database().ref().child("/notification/" + obj[i].PlayerId).remove();
                                                    convertstatus(id,'Pending', obj[i].PlayerId ,  $message ) ; 
                                                    myResolve("reject");
                                              
                                                }else{
                                                    console.log($respp['discription'] );
                                                } 
                                            }  
                    
           
                                        }  
                                    }
                                }
                         
                             
                                        
     

                            } ); 
                        }, 5000);
                    });

                    var ackres =    await myPromiseack;
                    if(ackres ==  "reject"){
                        if(  i+1 < totallenth){

                            var  param = [   { "name": "bookingid", "Value": id} 
                            ];
                            var  ar = 'checkriddestatusforautodispatch';
                            jQuery.ajax(
                               {
                                   type: "POST",
                                   url: "DataManager/Data.aspx/DataSelector",
                                   data: JSON.stringify({
                                       "data": param,
                                       "action": ar
                                   }),
                                   dataType: "json",
                                   contentType: "application/json; charset=utf-8",
                                   cache: false,
                                   success: function (result) {
                                       var ridestatus = JSON.parse(result.d);
                    
                                       if(ridestatus["dt1"].length > 0) {
                                                            
                                  
                                           $scope.recursive(obj ,  i+1 , id , vehicletype , zoneid ,  i+1 ,totallenth  , CurrentDateTime , PassengersNo ,PickLatLng , DropLatLng , radiuscounter,startcounter);


                                       } 

                                   }
                               });


                       
                        
                        
                        }else{
                       
                          let myPromisetotaldriver = new Promise(function(myResolve, myReject) {
                          var param = [{ "name": "BookingId", "Value": id }];
                          var prod = 'AutoDispatchAllVehicles';
     
                          Selector(param, prod).then(  function (result) {
                              let res = JSON.parse(result.d);
                              console.log(res);
                              if (res["dt1"].length != []) {

                                  var  VehiclesArray = [];
                                  if (res["dt2"].length != []) {
                                      console.log(res["dt2"].length);
                                      totaldrivers = [];

                    
                                      res["dt2"].forEach( function( item) {
                          
                                          var refz = firebase.database().ref("online/" + SomeSession2 + "/"+item.vehicleid);
                   
                                          var resp = [];
                                          refz.once("value", function (snapshot) {
                                              xoo  = snapshot.val();
                                              if (xoo == null) {
                                              }else{
                                                  snapshot.forEach(function (itemz) {
                                                      
                                                      random44 = new google.maps.LatLng(itemz.val().lat, itemz.val().lng);
                                                      random55 = new google.maps.LatLng(res["dt1"][0].Item, res["dt1"][1].Item);
                                                      var distance = (google.maps.geometry.spherical.computeDistanceBetween(random44, random55) / 1000).toFixed(2);
                                                      //var  data = [distance, item.DriverId, item.VehicleName , item.VehicleNo];
                                                     
                                                      if(parseInt(distance) <= parseInt($('#CompanyRadius').text())){
                                                          if(itemz.val().vehiclestatus == "Available") {
                                                              var data = { 
                                                                  distance : distance,
                                                                  PlayerId : item.DriverId ,
                                                                  VehicleName  : item.VehicleName , 
                                                                  VehicleNo :  item.VehicleNo ,
                                                                  VehicleStatus : itemz.val().vehiclestatus ,
                                                                  ZoneId : itemz.val().zoneid,
                                                                  ZoneQueueNo : itemz.val().zonequeue ,
                                                                  vehicleidno : itemz.val().VehicleId ,
                                                                  seat : item.seat  
                                                              }
                                                              totaldrivers.push(data);
                                        
                                                              totaldrivers.sort();
                                                              console.log(totaldrivers);

                                                          }
                                                           
                                                      }
                                                    
                                                  }
                                                )
                                              }
                                          });
                       
                          
                                      });
                                      myResolve('complete');
                             

                                
                  
                                  }


                              }
       
                          });
                          });
                          var resppjob =  await myPromisetotaldriver;
             
                          if(resppjob == "complete"){
                      
                              if(totaldrivers.length == 0){
                                  console.log("this job finished" + id);
                                  firebase.database().ref().child("/autodisp/"+id).remove();
                                  firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                              }else{
                                  if(startcounter == 1){

                                      var  param = [   { "name": "bookingid", "Value": id} 
                                      ];
                                      var  ar = 'checkriddestatusforautodispatch';
                                      jQuery.ajax(
                                         {
                                             type: "POST",
                                             url: "DataManager/Data.aspx/DataSelector",
                                             data: JSON.stringify({
                                                 "data": param,
                                                 "action": ar
                                             }),
                                             dataType: "json",
                                             contentType: "application/json; charset=utf-8",
                                             cache: false,
                                             success: function (result) {
                                                 var ridestatus = JSON.parse(result.d);
                    
                                                 if(ridestatus["dt1"].length > 0) {
                                                            
                                  
                                                     $scope.recursive(totaldrivers ,  0 , id , vehicletype , zoneid ,  2 , totaldrivers.length , CurrentDateTime ,PassengersNo , PickLatLng , DropLatLng , 1 , 0);


                                                 } 

                                             }
                                         });

                                  }else{
                                      if(radiuscounter == 1){
                                          console.log("this job finished" + id);
                                          firebase.database().ref().child("/autodisp/"+id).remove();
                                          firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                                      }else if(radiuscounter == 0){
                                          var  param = [   { "name": "bookingid", "Value": id} 
                                          ];
                                          var  ar = 'checkriddestatusforautodispatch';
                                          jQuery.ajax(
                                             {
                                                 type: "POST",
                                                 url: "DataManager/Data.aspx/DataSelector",
                                                 data: JSON.stringify({
                                                     "data": param,
                                                     "action": ar
                                                 }),
                                                 dataType: "json",
                                                 contentType: "application/json; charset=utf-8",
                                                 cache: false,
                                                 success: function (result) {
                                                     var ridestatus = JSON.parse(result.d);
                    
                                                     if(ridestatus["dt1"].length > 0) {
                                                            
                                  
                                                         $scope.recursive(totaldrivers ,  0 , id , vehicletype , zoneid ,  2 , totaldrivers.length , CurrentDateTime ,PassengersNo , PickLatLng , DropLatLng , 1 , 0);


                                                     } 

                                                 }
                                             });


                                      }
                                  }
                                 
                              }
                             

                          }


                        }
                        }else if(ackres == "accept"){
                          firebase.database().ref().child("/autodisp/"+id).remove();
                          firebase.database().ref().child("/autodisp/"+obj[i].PlayerId).remove();
                    }
                
                }
             
               

            }
             
 
        }
       

      
        
        $scope.showdiv  = function(id){
      
            
            if(document.getElementById('datassun'+id).style.display == 'none'){
                document.getElementById('datassun'+id).style.display = 'block'
            }else{
                document.getElementById('datassun'+id).style.display = 'none'
            } 
        }
        $scope.checkdata  = function(number ){ 
    
            if(spx.length > 0){
                if(spx[number]){
                    
                 
                    if(spx[number].id == number){
                   
                        if(spx[number].opened == true){
                         
                            return 'block';
                         }else {
                         
                            return 'none';
                        }


                        
                    }
                }else{
                    return 'none';
                }
            }else{
                return 'none';
            }
        }
        $scope.checkvalue  = function(str , number, spxa ){
           
            if(spx.length > 0){
                if(spx[number]){

                
                    if(spx[number].id == number){
                      
                        return parseInt(spx[number].vallue);
                    }}
            }else{
                return 0;
            }
              
            
        }

        var inrolejob = [];
        var checkdriverlist = [];

        $scope.jobsending = function (random1, random2, random3,random4,random5, random6 , random7, majorrandom, loops ,loopsz,spliss,spliszzz, id , ZoneId , CurrentDateTime ){
            

            console.log("job is in sending state " + id + " in this zone " + ZoneId);

            var random11 =    makeid(2);
            var random22 =    makeid(3);
            var random33 =    makeid(4);
            var random44 =    makeid(5);
            var random55 =    makeid(6);
            var random66 =    makeid(8);
            var random77 =    makeid(9);
            var random88 =      makeid(10);
            var random99 =      makeid(11);
            var random110 =      makeid(11);
            var randomautoo = makeid(12);
            random1 = [{ "name": "CurrentDateTime", "Value": CurrentDateTime },
                      { "name": "bookingid", "Value": id},
                      { "name": "ZoneId", "Value": ZoneId }];
            random2 = 'AutoDispatchVehiclesv2';
 
            Selector(random1, random2).then(function (result) {
                random3  = JSON.parse(result.d);
                console.log(random3);
                if (random3["dt2"].length != []) {

                    console.log("zone Driver");
                    console.log(random3);
                    if (random3["dt1"].length != []) {
                        console.log("enter in sending state");
                        random4 = 0;
                        random5 = new IntervalTimer(function () {
        
                            console.log("enter in interval state");
                            if(inrolejob.includes(id)){
                                console.log("all ready in process");
                                random5.pause();
                            }else{
                                console.log(random3["dt2"].length + " driver array length");
                                console.log(random4 +" time this job send out of this length of driver" + random3["dt2"].length );
                                if(random4 == random3["dt2"].length ){
                                    console.log("no more sending this job"+id);
                                    for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                     
                                        spliszzz = checkdriverlist[loopsz].split("_");	
                                        if (spliszzz.includes(random6) == true) {
                                            checkdriverlist.splice(loopsz , 1);

                                        }
                                    }
                           
                                    random5.pause();
                                    var  param = [ { "name": "bookingid", "Value": id} 
                                    ];
                                    var  ar = 'checkriddestatus';
                           
                                    Selector(param, ar).then(function (result) {
                                        random7  = JSON.parse(result.d);
                               
                                        if(random7["dt1"].length > 0){
                               
                                            if(inrolejob.includes(random3["dt1"][0].Id)){
                                                console.log("already in que");
                                            }
                                            else 
                                            {
                                                inrolejob.push(random3["dt1"][0].Id);
                                                console.log("added in que");
                                                console.log("send to radius");
                                                $scope.AuotDispatchtwo(random11,random22,random33,random44,random55,random66,random77,random88,random99,random110,randomautoo,random3["dt1"][0].Id, random3["dt1"][0].BookingStatus, random3["dt1"][0].VehicleType);

                                            }
                                        }
                                    });
                     
                                }else{
                                    console.log("Job sending counter: "+ random4);

                                   

                                    var  param = [   { "name": "bookingid", "Value": id} 
                                    ];
                                    var  ar = 'checkriddestatus';
                           
                                    Selector(param, ar).then(  function (result) {
                                        random7  = JSON.parse(result.d);
                               
                                        if(random7["dt1"].length > 0){
                                 
                                            majorrandom = false;
                                            for(loops = 0 ; loops < checkdriverlist.length; loops++){
	 	     
                                                spliss = checkdriverlist[loops].split("_");	
                                      
                                                if (spliss[0] == random3["dt2"][random4].PlayerId) {
                                                    majorrandom = true;
					    
                                                } 

                                            }
                                            if(majorrandom == true){
                                    
                                                random4++
                                                random5.newone(2000);
                                     
                                            }else{
                                                console.log("job sending to driver");
                                                checkdriverlist.push( random3["dt2"][random4].PlayerId+"_"+random6);
                                                console.log(random3["dt1"][0].Id);
                                                //document.getElementById('Divoo'+ random3["dt1"][0].Id).innerHTML = "Going To "+random3["dt2"][random4].VehicleNo +" / "+random3["dt2"][random4].VehicleName;
                                                //document.getElementById('Divoo'+ random3["dt1"][0].Id).style.background =  red;
                                              
                                                random5.pause();
                                                console.log("random5 need to stop");
                                                var id =    random3["dt1"][0].Id;
                                                var  driverid =  random3["dt2"][random4].PlayerId
                                                console.log("supose send"+driverid);
                                                //writeNewPost(driverid, id, "Pending");    
                                                var DbRef = firebase.database();
                                                var refaz= DbRef.ref("joback/" + id  + "/"+driverid);
                                                refaz.set({'jobstatus':'Offer','status':'Sent'});
                                                var localva  =  'Normal';
                                                var countr = 0;
                                                var checkchange = 0; 
                                                let listener =  refaz.on("value", function (snapshot) {
                                                    $respp =   snapshot.val();
                                                    console.log( $respp );
                                                    if($respp == null  ){
                                                        if( localva == "Reject"){
                                                            $message  = "Job Not Reach to Driver App. Try Again!";
                                                            convertstatus(id,'Pending' , driverid ,  '' ) ; 
                                                        } 
                        
                                                    }
                                                    if($respp['status'] != 'sent') {
                                                        if($respp['jobstatus'] == 'offered'){

                                                            if($respp['discription']  == 'Ride Status successfully Updated to Assigned'){
                                                                toastr["success"](  driverid +  "Accept The Auto-dispatch Job! ", 'success!');
                                                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                                                
                                                                localva = "Accept";
                                                                for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                     
                                                                    spliszzz = checkdriverlist[loopsz].split("_");	
                                                                    if (spliszzz.includes(random6) == true) {
                                                                        checkdriverlist.splice(loopsz , 1);

                                                                    }
                                                                }
                                                                angular.element(document.getElementById('myangular')).scope().getjobs( );
                                                            }else if($respp['discription'] == 'Ride Status successfully Updated to Reject'){
                                                                console.log("Reject");
                                                                localva = "Reject";
                                                                toastr["error"](  driverid + "Reject The Auto-dispatch Job!  ", 'error!'); 
                                                                firebase.database().ref().child("joback/"+id+"/"+driverid).remove();
                                                                firebase.database().ref().child("/notification/" + driverid).remove();
                                                                if(checkchange == 0){
                                                                    random4++;
                                                                    for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                     
                                                                        spliszzz = checkdriverlist[loopsz].split("_");	
                                                                        if (spliszzz.includes(driverid) == true) {
                                                                            checkdriverlist.splice(loopsz , 1);
                                                                            console.log("removed dddriver" + driverid);
                                                                        }
                                                                    }
                                                                }
                                                                checkchange++;
                                                                random5.newone(1500);
                                                            }else{
                                                                toastr["success"]( $respp['discription'] , 'success!');
                                                            }
 
                                                            return;
                                                        }else if($respp['jobstatus'] == 'assigned'  ){
                                                            console.log("Accpet");
                                                           
                                                            refaz.off("value", listener);
                                                            refaz.remove();
                                                            localva = "Accept";
                                                            for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                                                                spliszzz = checkdriverlist[loopsz].split("_");	
                                                                if (spliszzz.includes(random6) == true) {
                                                                    checkdriverlist.splice(loopsz , 1);

                                                                }
                                                            }
                                                        }else if($respp['jobstatus'] == 'Reject' ){
                                                            console.log("Reject");
                                                            localva = "Reject";
                                                    
                                                            refaz.off("value", listener);
                                                            refaz.remove();
                                                            firebase.database().ref().child("/notification/" + driverid).remove();
                                                            if(checkchange == 0){
                                                                random4++;
                                                                for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                     
                                                                    spliszzz = checkdriverlist[loopsz].split("_");	
                                                                    if (spliszzz.includes(driverid) == true) {
                                                                        checkdriverlist.splice(loopsz , 1);
                                                                        console.log("removed dddriver" + driverid);
                                                                    }
                                                                }
                                                            }


                                                            checkchange++;
                                                            random5.newone(1500);
                                                        }else{
                                                            if(countr >= 6){
                                                                console.log("Clear");
                                                                refaz.off("value", listener);
                                                                refaz.remove();
                                                                firebase.database().ref().child("/notification/" + driverid).remove();
                                                                random4++;
                                                                random5.newone(1500);

                                                            }else{

                                                         
                                                                console.log("still pending");
                                                                countr++;
                                                            }
                                                        }
                  
                                                    }else{
                                                        if(countr >= 4){
                                                            refaz.remove();
                                                            firebase.database().ref().child("/notification/" +driverid).remove();
                                               
                                                        }else{
                                                            countr++;
                                                        }
                                             
                                             
                                                    }  
                                         
     

                                                } );
   
                                            }
                                        }else{
                                            random5.newone(1000);
                                            random4++;
                                        }
                               
                              
                                
                               
                                    }
                                    );

                            
                                }
                            }
                        }, 1000);
                    }
                }
                else {
                    if (random3["dt1"].length != []) {
                        if(inrolejob.includes(random3["dt1"][0].Id)){
                            console.log("already in que");
                        }else{
                            inrolejob.push(random3["dt1"][0].Id);
                            console.log("added in que");
                            console.log("send to radius: booking id" + random3["dt1"][0].Id );                     
                            $scope.AuotDispatchtwo(random11,random22,random33,random44,random55,random66,random77,random88,random99,random110,randomautoo,random3["dt1"][0].Id, random3["dt1"][0].BookingStatus, random3["dt1"][0].VehicleType);

                        }

                    }else{
                        for(o = inrolejob.length; o >= 0 ; o--){
                            if(inrolejob[o] == id){
                                inrolejob.splice(o, 1);    
                                console.log("itemremoved from zone");
                            }
                        }

                    }
                }
            });
        }

        var contervarable = 0;
        $scope.AuotDispatchtwo = function(random11,random22,random33,random44,random55,random66,random77,random88,random99,random110,randomautoo,Id, Status, VehicleType) {
            console.log("eNTERY HOI");
            contervarable++;
            random110 = 0;
            var random11 = [{ "name": "BookingId", "Value": Id }];
            var random22 = 'AutoDispatchAllVehicles';
     
            Selector(random11, random22).then(  function (result) {
                random33 = JSON.parse(result.d);
                console.log(random33);
                if (random33["dt1"].length != []) {

                    var  VehiclesArray = [];
                    if (random33["dt2"].length != []) {
                        console.log(random33["dt2"].length);
                        random77 = [];
                        random33["dt2"].forEach(async function( item) {
                            //var   resp =   getdriverlatlng(item.vehicleid);
                            var refz = firebase.database().ref("online/" + SomeSession2 + "/"+item.vehicleid);
                   
                            var resp = [];
                            var xxx = [];
                    
                            xxx =  await refz.once("value");
                            xxx.forEach(function(itemz){
                        
                                random44 = new google.maps.LatLng(itemz.val().lat, itemz.val().lng);
                                random55 = new google.maps.LatLng(random33["dt1"][0].Item, random33["dt1"][1].Item);
                                random66 = (google.maps.geometry.spherical.computeDistanceBetween(random44, random55) / 1000).toFixed(2);
                                var  data = [random66 , item.DriverId,item.VehicleName , item.VehicleNo];
                                random77.push(data);
                                        
                                random77.sort();
                                console.log("ok");
                                console.log(random77);

                                if(random77.length != random33["dt2"].length){
                                    console.log("retry");
                                }else{
                                    console.log("testingmethod");
                                    $scope.testingmethod(random77, random110,random88,Id,randomautoo,random99, random33);
                                }
                               })
                          
                        });
                      
         
             
                    }


                }
       
            });
        }
      var autodis = new IntervalTimer(function () {
          $scope.FnZonewiseJobtwo();
      }    , 20000);

        $scope.testingmethod=  function(random77, random110,random88,Id,randomautoo,random99,random100){
            console.log("job sending in radius");
            console.log("testingmethod entry");
            console.log(random77);
            console.log(random77.length);
            console.log(random110);

            random88 = new IntervalTimer(function () {
                console.log(random110);
        
                if(random110 >= random77.length){
                    console.log(random110);
                    random110 = 0;
                    random88.pause();

                    if($('#Divoo'+Id).length){
                        document.getElementById('Divoo'+Id).innerHTML = "";

                    }else{
                          
                    }
	                  
                    for(o = inrolejob.length; o >= 0 ; o--){
                        if(inrolejob[o] == Id){
                            inrolejob.splice(o, 1);    
                            console.log("itemremoved");
                        }
                    }
                    for(var zzz = checkdriverlist.length-1 ; zzz >= 0 ; zzz--){
                     
                        spliszzz = checkdriverlist[zzz].split("_");	
                        if (spliszzz.includes(randomautoo) == true) {
                            checkdriverlist.splice(zzz , 1);

                        } 

                    }

                    //if($('#checkitt').is(":checked")){
                    //    $scope.FnZonewiseJobtwo();
                        
                    //}
                    
                } else {
                    console.log(random110);
                    var  param = [ { "name": "bookingid", "Value": Id} 
                    ];
                    var  ar = 'checkriddestatus';
                           
                    Selector(param, ar).then(function (result) {
                        random99  = JSON.parse(result.d);
                        for(ppp = checkdriverlist.length-1 ; ppp >= 0 ; ppp--){
                     
                            spliszzz = checkdriverlist[ppp].split("_");	
                
                            if (spliszzz.includes(randomautoo) == true) {
                                checkdriverlist.splice(ppp , 1);

                            } 

                        }
                        var majorrandomz = true;
               
                        if(checkdriverlist.length > 0) { 
                            for(var loops = 0 ; loops < checkdriverlist.length; loops++){
	 	     
                                spliss = checkdriverlist[loops].split("_");	
                    
                            
                                if (parseInt(spliss[0]) == random77[random110][1]) {
                          
                                    majorrandomz = false;
					    
                                } 

                            }
                        }else{
                            majorrandomz = true;
                        }
                        console.log(majorrandomz);
                        if(majorrandomz == true){
                            console.log(random110);
                            console.log("job sending state");
                            if(random99["dt1"].length > 0){
                                //random88.newone(25000);
                                console.log("interval pause");
                                random88.pause();
                                checkdriverlist.push(random77[random110][1]+"_"+randomautoo);
                     
                                var id =    Id;
                                var  driverid = random77[random110][1];
                                console.log("job sending to driver " +  driverid);
                                document.getElementById('Divoo'+ Id).innerHTML = "Going To "+random100["dt2"][random4].VehicleNo +" / "+random100["dt2"][random4].VehicleName;
                                document.getElementById('Divoo'+ Id).style.background =  red;
                                              
                                writeNewPost(driverid, id, "Pending");    
                                var DbRef = firebase.database();
                                var refaz= DbRef.ref("joback/" + id  + "/"+driverid);

                                refaz.set({'jobstatus':'Offer','status':'Sent'});
                                var localva  =  'Normal';
                                var countr = 0;
                                var checkchange = 0;
                                let listener =  refaz.on("value", function (snapshot) {
                                    $respp =   snapshot.val();
                                    console.log( $respp );
  
                                    if($respp['status'] != 'sent') {
                                        if($respp['jobstatus'] == 'assigned'  ){
                                            console.log("Accpet");
                                            refaz.off("value", listener);
                                            refaz.remove();
                                            localva = "Accept";
                                                          
                                            for(o = inrolejob.length; o >= 0 ; o--){
                                                if(inrolejob[o] == id){
                                                    inrolejob.splice(o, 1);    
                                                    console.log("itemremoved");
                                                }
                                            }
                                            for(ppp = checkdriverlist.length-1 ; ppp >= 0 ; ppp--){
                     
                                                spliszzz = checkdriverlist[ppp].split("_");	
                
                                                if (spliszzz.includes(randomautoo) == true) {
                                                    checkdriverlist.splice(ppp , 1);
                                                    console.log("Free driver" +spliszzz);
                                                } 

                                            }


                                        }else if($respp['jobstatus'] == 'Reject' ){
                                       
                                            localva = "Reject";

                                            refaz.off("value", listener);
                                            refaz.remove();
                                            firebase.database().ref().child("/notification/" + driverid).remove();
                                            if(checkchange == 0){
                                                console.log("Reject");
                                                checkchange++;
                                                random110++;
                                                for(loopsz = checkdriverlist.length-1 ; loopsz >= 0 ; loopsz--){
                     
                                                    spliszzz = checkdriverlist[loopsz].split("_");	
                                                    if (spliszzz.includes(driverid) == true) {
                                                        checkdriverlist.splice(loopsz , 1);
                                                        console.log("removed dddriver" + driverid);
                                                    }
                                                }
                                            }
                                            for(o = inrolejob.length; o >= 0 ; o--){
                                                if(inrolejob[o] == id){
                                                    inrolejob.splice(o, 1);    
                                                    console.log("itemremoved from zone");
                                                }
                                            }
                                            for(ppp = checkdriverlist.length-1 ; ppp >= 0 ; ppp--){
                     
                                                spliszzz = checkdriverlist[ppp].split("_");	
                
                                                if (spliszzz.includes(randomautoo) == true) {
                                                    checkdriverlist.splice(ppp , 1);
                                                    console.log("Free driver" +spliszzz);
                                                } 

                                            }
                                            console.log("randomvalue"+random110);
                                            random88.newone(1500);

                                                

                                        }else{
                                            if(countr >= 6){
                                                console.log("Clear");
                                                refaz.off("value", listener);
                                                refaz.remove();
                                                firebase.database().ref().child("/notification/" + driverid).remove();
                                                for(o = inrolejob.length; o >= 0 ; o--){
                                                    if(inrolejob[o] == id){
                                                        inrolejob.splice(o, 1);    
                                                        console.log("itemremoved from zone");
                                                    }
                                                }
                                                for(ppp = checkdriverlist.length-1 ; ppp >= 0 ; ppp--){
                     
                                                    spliszzz = checkdriverlist[ppp].split("_");	
                
                                                    if (spliszzz.includes(randomautoo) == true) {
                                                        checkdriverlist.splice(ppp , 1);
                                                        console.log("Free driver" +spliszzz);
                                                    } 

                                                }

                                                random110++;
                                                random88.newone(1500);

                                            }else{
                                                console.log("still pending");
                                                countr++;
                                            }
                                        }
                 
                                        //DbRef.ref("joback/" + id  + "/"+driverid).off('value', refaz)
               
           
                                    }else{
                                        if(countr >= 4){
                
                                            refaz.remove();
                                            firebase.database().ref().child("/notification/" +driverid).remove();


                                            for(o = inrolejob.length; o >= 0 ; o--){
                                                if(inrolejob[o] == id){
                                                    inrolejob.splice(o, 1);    
                                                    console.log("itemremoved from zone");
                                                }
                                            }
                                            for(ppp = checkdriverlist.length-1 ; ppp >= 0 ; ppp--){
                     
                                                spliszzz = checkdriverlist[ppp].split("_");	
                
                                                if (spliszzz.includes(randomautoo) == true) {
                                                    checkdriverlist.splice(ppp , 1);
                                                    console.log("Free driver" +spliszzz);
                                                } 

                                            }
                                            random110++;
                                            random88.newone(1500);
                                        }else{
                                            countr++;
                                        }
                                             
                                             
                                    }  
                                         
     

                                } );
  


                                //  random110++;
                      


                                
                               
                            }
                            else
                            {
                                random88.pause();
               
                                if($('#Divoo'+Id).length){
                                    document.getElementById('Divoo'+Id).innerHTML = "";
                                }else{
                          
                                }

                                for(o = inrolejob.length; o >= 0 ; o--){
                                    if(inrolejob[o] == Id){
                                        inrolejob.splice(o, 1);    
                                        console.log("itemremoved");
                                    }
                                }
                            }
                        }
                        else{
                            random110++
                            random88.newone(2000);
                        }
                    });
                }
            }, 2000);


        }

        $scope.FnNewStopInsert = function(  BookingId) {
            
            var url = "DataManager/Data.aspx/DataProcessor1";
            return $.ajax({
                url: url,
                type: "POST",
                datatype: "json",
                data: JSON.stringify({
                    "data": [{ "name": "bookings_id", "value":  BookingId }  ],
                    "colms":  "2",
                    "Details": NewStopsLatLngArray,
                    "action": "[InsertBookingNewStops]"
                }),
                contentType: "application/json; charset=utf-8",
                success: function (data) {
      
                },
                error: $scope.errorFn()
            });
        }
        $scope.errorFn = function(err, status, xhr) {
            
            //alert("Error, Server is down OR internet connection problem");
        }
        // bookings ride end
        //clear senction

        $scope.listofassign = [
   {value:0 , name: "0min" } ,
        {value :5,name:" 5min" },
   {value : 10,  name:"10min" } ,
   { value : 15, name: "15min" },
   {value : 20, name: "20min" } ,
   {value  : 30 , name: "30min" }  ,
   {value :  45, name:"45min"  },
   {value :  60, name: "1h0min"  } ,
   { value : 75 ,name:  "1h15min " },
   {value : 90, name: "1h30min"  },
   { value: 120, name: "2h0min"  }
        ];



        $scope.clearsectionuupdate = function(){
            changerefresh();
            refreshjob = 0;
            
            $('#timesuggested').text('');
            $scope.weekselect = 0;
            $scope.dayselect = '';
            $scope.showdays = false;
            $scope.mon  = true;
            $scope.tue  = true;
            $scope.wed  = true;
            $scope.thu   = true;
            $scope.fri   = true;
            $scope.sat  = true;
            $scope.sun  = true;
            $scope.paymentobtrue = false;
            $scope.AmmountAddedvaluesend = ''; 
            $scope.AmmountAddedvalue = '';
            
            $scope.ddlLaterMins = '00';
            
            $scope.assign_notice = '0';
            $scope.ddlLaterHrs = '00';
            var now = new Date();
            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);
            var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                                                
            $scope.datetimemain  = new  Date(todayz);
             
            marker.setVisible(false);
            if(markers[1]){
                markers[1].setMap(null);
            }
            directionsRenderer.setMap(null);
            var now = new Date();
            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);
            var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                                                               
           
            $("#pac-input").val('');
            $("#pac-inputx").val('');
            $("#laterDate").val(todayz) ;
            $scope.searchtext = '';                        
            $scope.urgentdata = false;

            
            $scope.autodispatchready = 'No';
            $scope.cornershow = false
            $scope.cornerdata = ''
            $scope.bookingtime_select = 0;
            $amountadded =  '';
            $scope.acc_select_id = '';
            $scope.account_Select_Id = '';
            $scope.account_Name    = '';
            $scope.account_Email = '';
            $scope.account_PhoneNo  = '';
            $scope.LocalPickLat = 0;
            $scope.LocalPickLng =  0;
            $scope.LocalDropLat = 0 ;
            $scope.LocalDropLng = 0 ;
            $scope.dropupaddress = '';
            $scope.pickupaddress = '';
            $('#LocalPickLat').val('0')
            $('#LocalPickLng').val('0');
            $('#LocalDropLat').val('0')
            $('#LocalDropLng').val('0');
            $('#pac-inputx').val('');
            $('#pac-input').val('');

            $scope.selectedcartype = 0 ; 
            
            $scope.selectedcustomer = 1
            $scope.selectedbeg  = 0 ;  $scope.selectedwheelchair  = 0;

            $scope.selectedcar = 1;
            $scope.selectedtarrif = 0;
            $scope.CustomeRate  = '';
            $scope.rideinfo  = '';
            $scope.distance = 0;
            $scope.Time = 0;
            $scope.currency = 0;
            $scope.AmmountAddedvalue  = '';
            $scope.trip_status = ''
            $scope.manager_id
            $scope.client_id
            $scope.claim_number
            $scope.acc_select_id
            $scope.stoplistarray = [];

            $scope.customeshow = 0;

            $scope.account_Select_Id = '' ;
            $scope.account_Name =  '';
            $scope.account_PhoneNo =  '';
            $scope.account_AccountId = '';
            $scope.account_Email = '';
       
            $scope.claim_number =  '';
            $scope.trip_days_left =   '';
            $scope.client_name =   '';
            $scope.client_phone =    '';
                      
            $scope.manager_id =    '';
            $scope.client_id =     '';
            $scope.trip_status =     '';
            $scope.acc_select_id =    '';

        }
        $scope.searchitemreset = function(){
            $scope.jobdetailshowing = [];
           $scope.searchitem = [];
            $scope.$digest();
        }
        $scope.clearsection = function(){
           
            changerefresh();
            refreshjob = 0;
            
            $('#timesuggested').text('');
            $scope.weekselect = 0;
            $scope.dayselect = '';
            $scope.showdays = false;
            $scope.mon  = true;
            $scope.tue  = true;
            $scope.wed  = true;
            $scope.thu   = true;
            $scope.fri   = true;
            $scope.sat  = true;
            $scope.sun  = true;
            $scope.paymentobtrue = false;
            $scope.AmmountAddedvaluesend = ''; 
            $scope.AmmountAddedvalue = '';
            $scope.updatex = 0;
            $scope.ddlLaterMins = '00';
            $scope.LoginDriverdata = [];
            $scope.assign_notice = '0';
            $scope.ddlLaterHrs = '00';
            var now = new Date();
            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);
            var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                                                
            $scope.datetimemain  = new  Date(todayz);
             
            marker.setVisible(false);
            if(markers[1]){
                markers[1].setMap(null);
            }
            directionsRenderer.setMap(null);
            var now = new Date();
            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);
            var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                                                               
           
            $("#pac-input").val('');
            $("#pac-inputx").val('');
            $("#laterDate").val(todayz) ;
            $scope.searchtext = '';                        
            $scope.urgentdata = false;

            
            $scope.autodispatchready = 'No';
            $scope.cornershow = false
            $scope.cornerdata = ''
            $("#ddlVehicleType").empty( );
            $scope.bookingtime_select = 0;
            $("#ddlVehicleType").append("<option value='0' selected='selected'>Automatic</option>");
            $amountadded =  '';
            $scope.acc_select_id = '';
            $scope.account_Select_Id = '';
            $scope.account_Name    = '';
            $scope.account_Email = '';
            $scope.account_PhoneNo  = '';
            $scope.selecteddriver = 0;
            $scope.LocalPickLat = 0;
            $scope.LocalPickLng =  0;
            $scope.LocalDropLat = 0 ;
            $scope.LocalDropLng = 0 ;
            $scope.dropupaddress = '';
            $scope.pickupaddress = '';
            $('#LocalPickLat').val('0')
            $('#LocalPickLng').val('0');
            $('#LocalDropLat').val('0')
            $('#LocalDropLng').val('0');
            $('#pac-inputx').val('');
            $('#pac-input').val('');

            $scope.selectedcartype = 0 ;  
            $scope.selectedcustomer = 1
            $scope.selectedbeg  = 0 ; 
            $scope.selectedwheelchair  = 0;

            $scope.selectedcar = 1;
            $scope.selectedtarrif = 0;
            $scope.CustomeRate  = '';
            $scope.rideinfo  = '';
            $scope.distance = 0;
            $scope.Time = 0;
            $scope.currency = 0;
            $scope.AmmountAddedvalue  = '';
            $scope.trip_status = ''
            $scope.manager_id
            $scope.client_id
            $scope.claim_number
            $scope.acc_select_id
            $scope.stoplistarray = [];

            $scope.customeshow = 0;

            $scope.account_Select_Id = '' ;
            $scope.account_Name =  '';
            $scope.account_PhoneNo =  '';
            $scope.account_AccountId = '';
            $scope.account_Email = '';
       
            $scope.claim_number =  '';
            $scope.trip_days_left =   '';
            $scope.client_name =   '';
            $scope.client_phone =    '';
                      
            $scope.manager_id =    '';
            $scope.client_id =     '';
            $scope.trip_status =     '';
            $scope.acc_select_id =    '';

        }

        // clear section end
         
         
        $scope.account_Select_Id = '' ;
        $scope.account_Name =  '';
        $scope.account_PhoneNo =  '';
        $scope.account_AccountId = '';
        $scope.account_Email = '';
       
        $scope.claim_number =  '';
        $scope.trip_days_left =   '';
        $scope.client_name =   '';
        $scope.client_phone =    '';
        $scope.claim_number =    '';
        $scope.manager_id =    '';
        $scope.client_id =     '';
        $scope.trip_status =     '';
        $scope.acc_select_id =    '';
        $scope.accselect = function(arg){
             
            if(arg.trip_days_left < 1){
                $scope.acc_record_search = [];
                $scope.account_record_search = [];
                $scope.passenger_record_search = [];
             
                toastr["error"]("This Claim Id is Expired Or No more Ride", 'Error!');

            }else{
                $scope.claim_number =    arg.claim_number;
                $scope.trip_days_left =    arg.trip_days_left;
                $scope.client_name =     arg.client_name;
                $scope.client_phone =      arg.client_phone;
                $scope.claim_number =      arg.claim_number;
                $scope.manager_id =      arg.manager_id;
                $scope.client_id =      arg.client_id;
                $scope.trip_status =       arg.trip_status;
                $scope.acc_select_id =       arg.id;


                $scope.account_Select_Id = '' ;
                $scope.account_Name =  '';
                $scope.account_PhoneNo =  '';
                $scope.account_AccountId = '';
                $scope.account_Email = '';


                $scope.acc_record_search = [];
                $scope.account_record_search = [];
                $scope.passenger_record_search = []; 
            }

            $scope.searchtext =    '';
        }
        $scope.accountselect = function(arg){
         
          
            $scope.account_Select_Id =   arg.Id  ;
            $scope.account_Name =   arg.Name ;
            $scope.account_PhoneNo =   arg.PhoneNo ;
            $scope.account_AccountId =   arg.Id ;
            $scope.account_Email = arg.Email ;

            $scope.acc_record_search = [];
            $scope.account_record_search = [];
            $scope.passenger_record_search = [];

            $scope.claim_number =  '';
            $scope.trip_days_left =   '';
            $scope.client_name =   '';
            $scope.client_phone =    '';
            $scope.claim_number =    '';
            $scope.manager_id =    '';
            $scope.client_id =     '';
            $scope.trip_status =     '';
            $scope.acc_select_id =    '';
            $scope.searchtext =    '';
        }
        $scope.customerselect = function(arg){
         
            $scope.account_Name =   arg.Name ;
            $scope.account_PhoneNo =   arg.PhoneNo ;
            $scope.account_Email = arg.Email ;

            $scope.acc_record_search = [];
            $scope.account_record_search = [];
            $scope.passenger_record_search = [];
            $scope.account_Select_Id = '';
            $scope.account_AccountId = '';
            $scope.claim_number =  '';
            $scope.trip_days_left =   '';
            $scope.client_name =   '';
            $scope.client_phone =    '';
            $scope.claim_number =    '';
            $scope.manager_id =    '';
            $scope.client_id =     '';
            $scope.trip_status =     '';
            $scope.acc_select_id =    '';
            $scope.searchtext =    '';
        }

        $scope.searchtext = '';
        $scope.acc_record_search = [];
        $scope.account_record_search = [];
        $scope.passenger_record_search = [];
        $scope.clearseacch = function(){
            $scope.searchtext = '';
            $scope.acc_record_search = [];
            $scope.account_record_search = [];
            $scope.passenger_record_search = [];
        }
        $scope.Searchmulti = function( ){
           
            $scope.paramm =  [{ "name": "claim_number", "value":  $scope.searchtext }];
            $scope.procm = '[searchmulti]';
            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataSelector",

                data: {
                    data: $scope.paramm,
                    action: $scope.procm
                }

            }).then(function mySuccess(result) {
                
                var resp = result.data;
                $res = JSON.parse(resp.d);
               
                $scope.acc_record_search = $res['dt1'];
                $scope.account_record_search = $res['dt2'];
                $scope.passenger_record_search = $res['dt3'];

              
            }, function myError(response) {



            });


        }


        $scope.showstopshow = 0;
        $scope.changedroplat = function(){

            $scope.showstopshow = 1;
            var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
            var drop = $('#LocalDropLat').val()+','+$('#LocalDropLng').val();
            $scope.dropupaddress =  $('#pac-inputx').val();
            if($('#pac-input').val() != ''){
                directionsRenderer.setMap(map);
                if($scope.stoplistarray.length == 0){
                     
                    $scope.calculateAndDisplayRoute(directionsService, directionsRenderer,pic , drop);
                }  else if($scope.stoplistarray.length > 0  ){

                    $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-inputx').val());
                }
            }else{
                
                $('#LocalPickLat').val(0)
                $('#LocalPickLng').val(0);
                  
                marker.setVisible(false);
                directionsRenderer.setMap(null);
                $scope.stoplistarray.length = 0;
            }
        }

        $scope.changedroplat1z = function(){

            $scope.showstopshow = 1;
            var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
            var drop = $('#LocalDropLat').val()+','+$('#LocalDropLng').val();
            
            if($('#pac-input').val() != ''){
                directionsRenderer.setMap(map);
                if($scope.stoplistarray.length == 0){
                    console.log(pic);
                    console.log(drop);
                    console.log("one");
                    $scope.calculateAndDisplayRoute(directionsService, directionsRenderer,pic , drop);
                }  else if($scope.stoplistarray.length > 0  ){
                    console.log("two");
                    $scope.calculateAndDisplayRoute2z( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-inputx').val());
                }
            }else{
                
                $('#LocalPickLat').val(0)
                $('#LocalPickLng').val(0);
                marker.setVisible(false);
                directionsRenderer.setMap(null);
                $scope.stoplistarray.length = 0;
            }
        }
        $scope.setvalue = function(vaar){
            if(vaar == 1){
                marker.setVisible(false);
                directionsRenderer.setMap(null);
                $scope.LocalPickLat =  0;
                $scope.LocalPickLng =  0;
                $('#LocalPickLat').val(0) ;
                $('#LocalPickLng').val(0);
                directionsRenderer.setMap(null);
                marker.setVisible(false);
                $scope.stoplistarray.length = 0;
            }else if(vaar == 0){
                
                $('#LocalDropLat').val(0);
                $('#LocalDropLng').val(0);
                var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
                
                $('#pac-inputx').val('');
                $scope.dropupaddress =  '';
                if($('#pac-input').val() != ''){
                    directionsRenderer.setMap(map);
                    if($scope.stoplistarray.length == 0){
                        directionsRenderer.setMap(null);
                        // showmap($('#LocalPickLat').val(), $('#LocalPickLng').val());
                        $scope.showmakert1(1 , pic);
                    }  else if($scope.stoplistarray.length > 0  ){
                        var qqq =   $scope.stoplistarray.length-1;
                        $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-input'+$scope.stoplistarray[qqq].id).val());
                    }
                }else{
                
                    $('#LocalPickLat').val(0)
                    $('#LocalPickLng').val(0);
                    marker.setVisible(false);
                    directionsRenderer.setMap(null);
                    $scope.stoplistarray.length = 0;
                }

            }else if(vaar == 3){

                $scope.pickupaddress  = $('#pac-input').val();
                $scope.suggest();
            }
            

        }
        $scope.showcolor = function (VehicleStatus){
            if( VehicleStatus == 'Available' ){
                return "lightgreen";
            }
            else if ( VehicleStatus == 'Away'  ){
                return "orange";
            }
            else if ( VehicleStatus  == 'Busy' ){
                return "#fb0404";
            }
            else if ( VehicleStatus == 'Picking' ){
                return "#0000f57a";
            }else if(VehicleStatus == 'manualreject'){
                return "lightgreen";
            }
             
        }
        
     
        $scope.activejobdetails = [];
        $scope.VehicleDetailschng = function(ele){
            $('#VehicleDetails').modal('show');
            $('#loading').show();
            $scope.selectedone = ele;
            var param = [{ "name": "Id", "value": ele }];
            var proc = '[VehicleInfov2]';
            Selector(param, proc).then(function (result) {
               
                if (result.d == "Session is experied, please login again") {
                    alert(result.d);
                    window.location.href = "DispatcherLogin.aspx?";
                }
                else {
                    $res = JSON.parse(result.d);
                    $show = 0;
                    if ($res["dt1"].length != []) {
                        $("#VehicleJobs").empty();
                        console.log( $res["dt1"]);
                        $data =  $res["dt1"][0];
                        $scope.driveridselected = $data.DriverId;
                        
                        $('#lblDriverId').text($data.DriverId);
                        $('#VehicleLat').text($data.Lat);
                        $('#VehicleLng').text($data.Lng);
                    
                        $('#lblDriverPlayerId').text($data.PlayerId);
                        $('#lblVehicleName').text($data.VehicleName);
                        $('#lblVehicleSign').text($data.CallSign);
                        $('#lblVehicleNo').text($data.VehicleNo);
                        $('#lblBookingHeadId').text($data.BookingId);
                        $('#lblDriverPhone').text($data.BookingId);
                        $('#lblDriverName').text($data.UserFName + " " + $data.UserLName)
                        
                        $scope.VehicleImage = $data.VehicleImage;
                     
                      
                        if ($res["dt2"].length != []) {
                            var jobColor;

                            for ($i = 0; $i < $res["dt2"].length; $i++) {

                                $("#VehicleJobs").append(
                                    '       <div class="col-sm-12" style="background: #0080004f;">  '  + 
 '                                 '  +  
 '                            '  + 
 '                            <div class="alert-box-title">   '  + 
 '                            <ul class="list-inline">   '  + 
 '                              <li>' + $res["dt2"][$i].BookingStatus + ' </li>   '  + 
 '     '  + 
 '                                              </ul>   '  + 
 '                                            </div>   '  + 
 '                                             <div class=" " >   '  + 
 '                                              <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>When:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">   '  + 
 '                                                    <ul class="list-inline" style="margin-bottom: 0px;">   '  + 
 '                                                       <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].BookingDateTime   + '</p>   '  + 
 '                                                       </li>   '  + 
 '     '  + 
 '                                                   </ul>   '  + 
 '                                                </div>   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>Client:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">   '  + 
 '                                                    <ul class="list-inline" style="margin-bottom: 0px;">   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].PassengerId   + '</p>   '  + 
 '                                                        </li>   '  + 
 '     '  + 
 '                                                   </ul>   '  + 
 '                                                </div>   '  + 
 '                                                 </div>   '  + 
 '     '  + 
 '                                            <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>From:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p>' + $res["dt2"][$i].PickAddress   + ' </p>   '  + 
 '     '  + 
 '                                               </div>   '  + 
 '                                            </div>   '  + 
 '                                              <div class="row">   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                   <p>To:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p> ' + $res["dt2"][$i].DropAddress   + ' </p>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '                                            <div class="row">   '  + 
 '                                                <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>Info:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                    <ul class="list-inline" style="display: inline-flex; margin-bottom: 0px;">   '  + 
 '                                                        <li>   '  + 
 '                                                            <img src="images/icon-user.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                            <p>' + $res["dt2"][$i].Passengers   + '</p>   '  + 
 '                                                        </li>   '  + 
 '                                                         <li>   '  + 
 '                                                           <img src="images/icon-case.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].Bags   + '</p>   '  + 
 '                                                        </li>   '  + 
 '                                                        <li>   '  + 
 '                                                            <img src="images/icon-wheelchair.png"> =</li>   '  + 
 '                                                        <li>   '  + 
 '                                                           <p>' + $res["dt2"][$i].WheelChairs   + '</p>   '  + 
 '                                                       </li>   '  + 
 '                                                    </ul>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '                                            <div class="row">   '  + 
 '                                                 <div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">   '  + 
 '                                                    <p>Route:</p>   '  + 
 '                                                </div>   '  + 
 '                                                <div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">   '  + 
 '                                                   <p>' + $res["dt2"][$i].EstimatedDistance   + ' Km. ' + $res["dt2"][$i].EstimatedTime   + ' Min</p>   '  + 
 '                                                </div>   '  + 
 '                                            </div>   '  + 
 '     '  + 
 '                                           </div>   '  + 
 '                                           <hr>   '  + 
 '                               </div>  '  )
                        
                                     
                                
                            }
                                 
                          
                                
                        }

                    
                        $('#loading').remove();
                     $scope.$digest();
                    }
                  
                   
                }
            });
        }
  
        $scope.LoginDriverdata = [];
        $scope.drivertable = function () {
            
 

            $scope.param = [{ "name": "Status", "Value": "Active" }];
            $scope.proc = '[VehiclesDetails]';

            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataSelector",

                data: {
                    data: $scope.param,
                    action: $scope.proc
                }

            }).then(function mySuccess(response) {
                
                var resp = response.data;
                $scope.maindata = JSON.parse(resp.d);
                $scope.driverdata = $scope.maindata['dt3'];
                console.log( $scope.driverdata );
                $scope.jobdetail = $scope.maindata['dt2'];
                $scope.jobinfo = $scope.maindata['dt1'];
                for ($j = 0; $j < $scope.maindata['dt3']; $j++) {
                    var refz = firebase.database().ref("online/" + SomeSession2 + "/"+$res["dt3"][$j].Id);
                    refz.once("value", function (snapshot) {
                    
                        
                        xoo  = snapshot.val();
              
                    
                        if (xoo == null) {
                    

                        }else{
                            snapshot.forEach(function (childsnapshot) {
                    
                                var date1 = new Date(childsnapshot.val().time ); 
                                var date2 = new Date(); 
  
                                // To calculate the time difference of two dates 
                                var Difference_In_Time = date2.getTime() - date1.getTime(); 
  
                                // To calculate the no. of days between two dates 
                                var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24); 
                                var  Difference_In_Timez = 	Difference_In_Time / (1000) ; 
		
                                if(Difference_In_Timez > 30 ){
                                    $statustext = "red";
                           
                                    document.getElementById('online'+$res["dt3"][$j].Id).style.color ="red";
                          
                                }
                                else{
                                    $statustext = "blue"; 
                                    if(document.getElementById('online'+$res["dt3"][$j].Id).style.color){
                                        document.getElementById('online'+$res["dt3"][$j].Id).style.color = "blue";
                                    }else{
                                        
                                    }

                                       
                                }

                  
                    
                            });
                        }
             
                    });
                }



            }, function myError(response) {

                console.log(response);

            });




        }
        $scope.stopLocalLat = [];
        $scope.stopLocalLng = [];
        $scope.stoplstshow = 0;
        $scope.stoplistarray  = []  ;
        $scope.stoplistarraynumber = 0;
        //Create New Stop 
        $scope.createnewstop = function(){
            $scope.stoplstshow = 1;
            $scope.stoplistarraynumber++;
            $scope.dataa = {
                'id' : $scope.stoplistarraynumber
            };
        
            $scope.stoplistarray.push($scope.dataa);
               
        }
        $scope.deletestopz = function(id ){
           
            if(id == 1){
                $scope.stoplistarray.splice(0, 1);
            }
            
            for(var x = 0 ; x < $scope.stoplistarray.length; x++ ){
                if(id == $scope.stoplistarray[x].id){
                    $scope.stoplistarray.splice(x, 1);
                }

            }
              
            var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
            var drop = $('#LocalDropLat').val()+','+$('#LocalDropLng').val();
            $scope.dropupaddress =  $('#pac-inputx').val();
            if($('#pac-input').val() == ''){
                
                $('#LocalPickLat').val(0)
                $('#LocalPickLng').val(0);
                  
                marker.setVisible(false);
                directionsRenderer.setMap(null);
                $scope.stoplistarray.length = 0;

                return ;
            } else if($('#pac-input').val() != '' && $('#pac-inputx').val() != ''){
                directionsRenderer.setMap(map);
                if($scope.stoplistarray.length == 0){
                     
                    $scope.calculateAndDisplayRoute(directionsService, directionsRenderer,pic , drop);
                }  else if($scope.stoplistarray.length > 0  ){

                    var qqq =   $scope.stoplistarray.length-1;
                    $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, $('#pac-input').val() , $('#pac-input'+$scope.stoplistarray[qqq].id).val());
                  
                }

            }
        }
        $scope.createnewstoplat = function (id){
           
            var input = document.getElementById('pac-input'+id);
            var autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.bindTo('bounds', map);
            autocomplete.setFields(
            ['address_components', 'geometry', 'icon', 'name']);
            var infowindow = new google.maps.InfoWindow();
            var infowindowContent = document.getElementById('infowindow-content');
            infowindow.setContent(infowindowContent);
      

            var marker = new google.maps.Marker({
                map: map,
                anchorPoint: new google.maps.Point(0, -29)
            });

            autocomplete.setComponentRestrictions(
               {'country': ['nz','pk' ]});

            autocomplete.addListener('place_changed', function() {
           

                infowindow.close();
            
                var place = autocomplete.getPlace();
           
                $('#lat'+id).val( place.geometry.location.lat());
              
                $('#lng'+id).val( place.geometry.location.lng());
                $scope.stopare(place.geometry.location.lat() , place.geometry.location.lng(), $('#pac-input'+id).val( ));
                //angular.element(document.getElementById('myangular')).scope().setvalue(3);
  

   
            });

        }
        $scope.cornerdata = '';
        $scope.cornershow = false;
       
        $scope.urgentdata = false;
       

        $scope.unitChanged = function(){
            
            if($scope.selectedtarrif == -1){
                $scope.customeshow = 1;
                $scope.currency = 0;
                $scope.currencyprice = '';
            }else{
                $scope.CustomeRate = '';
                $scope.customeshow = 0;
                if ( $scope.distance != 0) {

                   
                  
                    var str =  $scope.distance;
                    DistanceRes = str.split(" ");

                    $scope.paramq = [{ "name": "TariffId", "Value": $scope.selectedtarrif }];
                    $scope.procq = 'DispatchEstimation';

                    $http({

                        method: "POST",

                        url: "DataManager/Data.aspx/DataSelectorLess",

                        data: {
                            data: $scope.paramq,
                            action: $scope.procq
                        }

                    }).then(function mySuccess(result) {
               
                        var resp = result.data;
               
                        $res = JSON.parse(resp.d);
                        if ($res.length != []) {


                            var totalvalue = (parseFloat($res[0].StartPrice) + (parseFloat($res[0].DistanceRate) * parseFloat(DistanceRes))).toFixed(2);
                            
                            totalvalue = Math.ceil(totalvalue);    
               
                            var percentage = document.getElementById("percentagevalue").value;
                            var transectioon = document.getElementById("transection").value;
                            var percentagefound = (parseFloat(totalvalue) * parseFloat(percentage)) / 100;
                            console.log(percentagefound);
                            var percentageadded = parseFloat(percentagefound) + parseFloat(totalvalue);
                            console.log(percentageadded)
                            var transeadd = parseFloat(transectioon) + percentageadded;

                            var amountz = transeadd * 100;
                            var fulls = Math.ceil(transeadd);
                            console.log(fulls);



                   

                            $scope.currency =  Math.ceil(totalvalue);
                            $scope.currencyprice = $res[0].CurrencyName;
                            $scope.AmmountAddedvalue =  Math.ceil(totalvalue);

                            
                            document.getElementById('TxAmountfinal').value =  fulls;
                            document.getElementById('paymentvalueshow').innerHTML = fulls +" " + $res[0].CurrencyName +" ";
                            document.getElementById('textforpayment').innerHTML  = '  Ride Fair + Taxes Included';
                        }
                    }, function myError(response) {



                    });



                  
                }


            }
        }   

        $scope.suggest= function(){
            var locallat = $('#LocalPickLat').val() ;
            var locallng = $('#LocalPickLng').val() ;
            if(locallat == 0){

            }else{
      
                var respns =  distance(locallat,locallng,dispatcher_lat,dispatcher_lng , "K");
     
                var totalkm =  Math.round(respns);
                onekmminute = 3;
                var totaltimeneed =  totalkm * onekmminute;
                document.getElementById('timesuggested').innerHTML ="Pickup Distane is "+ totalkm +" KM from This dispatcher </br> : ,  Suggested Time : " + totaltimeneed +" Minute" ;

            }
        }
        $scope.customeshow = 0;
        $scope.CustomeRate = 0;
        $scope.selectedtarrif = 0;
        $scope.selectedcartype = 0;
       
 

        $scope.cartype = [];
        $scope.carlist =[];
        $scope.defaultsetting = function () {
            
            $scope.param = [];
            $scope.proc = '[DispatcherSettings]';

            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataSelector",

                data: {
                    data: $scope.param,
                    action: $scope.proc
                }

            }).then(function mySuccess(result) {
               
                var resp = result.data;
               
                $res = JSON.parse(resp.d);
               
                $scope.defaltlist = $res
                $scope.tarriflist =   $scope.defaltlist["dt4"];
            
                if ($res["dt1"].length != []) {

                    $('#CompanyName').text($res["dt1"][0].CompanyName);
                    $("#DirectBookingIsAllowed").text($res["dt1"][0].DirectBookingIsAllowed); 
                    $("#AllowDirectAssignment").text($res["dt1"][0].JobAllowedToAssignToaDriver);
                    $("#AutoDispatch").text($res["dt1"][0].AutoDispatch);
                    $("#EditZoneQueue").text($res["dt1"][0].EditZoneQueue);
                    $("#DispatcherKickUsers").text($res["dt1"][0].DispatcherKickUsers);
                    $("#DispatchShows").text($res["dt1"][0].DispatchShows);
                    $("#ColorJobs").text($res["dt1"][0].ColorJobs);
                    $("#DispatchAlerts").text($res["dt1"][0].DispatchAlerts);
                    $("#DispatchSounds").text($res["dt1"][0].DispatchSounds); 
                    $("#RespectShiftEnd").text($res["dt1"][0].RespectShiftEnd);
                    $("#CompanyRadius").text($res["dt1"][0].Radius);
                    if ($("#DispatcherKickUsers").text() == "0") {
                        $("#DriverSuspends").disabled = true;
                    }
                }
                        
                if ($res["dt3"].length != []) {
                    $scope.cartype =  $res["dt3"];
                    console.log( $scope.cartype);
                    $scope.carlist.push("Not Specified");
                    for ($i = 0; $i < $scope.cartype.length; $i++) {
                        $scope.carlist.push($scope.cartype[$i].VehicleName);
                       
                    }
                }

                console.log($scope.carlist);
                if ($scope.defaltlist["dt5"].length != []) {
                    $scope.publickey =   $res["dt5"][0].PublicKey;
                }
            }, function myError(response) {



            });




        }
        $scope.defaultsetting();
        //$scope.drivertable();
        $scope.zonetablez = function () {

            $scope.param = [];
            $scope.proc = '[ZonesListUpdate]';

            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataSelectorLess",

                data: {
                    data: $scope.param,
                    action: $scope.proc
                }

            }).then(function mySuccess(response) {


                var resp = response.data;
                $scope.zonetable = JSON.parse(resp.d);
      
         
              
                var dataStuff = $scope.zonetable;
                grouped = Object.create(null);
               
                dataStuff.forEach(function (a) {
                    grouped[a.zonename] = grouped[a.zonename] || [];
                    grouped[a.zonename].push(a);
                });



                const keys = Object.keys(grouped)
                var maaa = [];
                var finaldata = [];
                for (var xx = 0 ; xx < keys.length ; xx++) {
                    var value = keys[xx];
                    var datashows = [];

                    var datahead = [];
                    var car = "";
                    var carvalue = [];
                    for (var o = 0; o < grouped[value].length; o++) {
                        var id = grouped[value][o].zonename  ;
                        var indexOfDayx = datahead.indexOf(id);
                        if (indexOfDayx === -1) {
                            datahead.push(id)

                        } else {

                        }

                        carvalue.push(grouped[value][o]);
                    }


                    datashows.push(datahead[0]);
                    datashows.push(carvalue);
                    maaa.push(datashows);
                }

                $scope.zonelist = maaa;
              
            }, function myError(response) {



            });




        }
        spx = [];
        $scope.jobsdata =[];
        $scope.tstst =[];
        //$scope.zonetablez();
        $scope.CurrentDateTime = ''
        $scope.unassignedjob_list = [];
        $scope.getjobs = function (ok='') {
          
            var now = new Date();

            var day = ("0" + now.getDate()).slice(-2);
            var month = ("0" + (now.getMonth() + 1)).slice(-2);

            var today = now.getFullYear() + "-" + (month) + "-" + (day);



            var d = new Date();
            var month = d.getMonth() + 1;
            var date = d.getDate();
            var FinalOutput = d.getFullYear() + '-' +
                (('' + month).length < 2 ? '0' : '') +
                month + '-' +
                (('' + date).length < 2 ? '0' : '') + date;

            h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
            m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
            var FindMinutes = FinalOutput + " " + h + ':' + m;
            $scope.CurrentDateTime = today + " " + h + ':' + m + ':00';


            $scope.param = [{ "name": "CurrentDateTime", "Value": FindMinutes }];
            $scope.proc = '[UnAssignedJobsv3]';

            $http({

                method: "POST",

                url: "DataManager/Data.aspx/DataSelector",

                data: {
                    data: $scope.param,
                    action: $scope.proc
                }

            }).then(function mySuccess(response) {


                var resp = response.data;
                $scope.jobsdata = JSON.parse(resp.d);
 
                $scope.UnAssignedCount = $scope.jobsdata['dt4'][0]['UnAssignedCount'];
             
                $scope.tstst = $scope.jobsdata['dt1'];
              
               
              
                if(  $scope.unassignedjob_list.length > 0){
                    for(var p = 0 ; p <  $scope.tstst.length ; p++){
                       
                    
                        var  iss = $scope.tstst[p].Id;
                        try {
                             var vall =   document.getElementById('spx'+iss).value;
                        }
                        catch(err) {
                            continue;
                        }
                        
                        var cardata;
                        if ($('#spx'+iss).is(":focus")){
                            return ;
                        } 
                        if($("#datassun"+iss ).is( ":visible" )){
                            cardata = {id:iss, vallue:vall  , opened : true};
                        }else{
                            cardata = {id:iss, vallue:vall  , opened : false};
                        }
                       
                        spx[iss] = cardata;
                            
                    }

                }
                   
                
                $scope.oferunassignedjob_list = [];
                for(var x = 0 ; x <  $scope.tstst.length ; x++){ 
                    if( $scope.tstst[x].BookingStatus == 'Offered'){
                     
                        $scope.oferunassignedjob_list.push( $scope.tstst[x] );
                    } else if( $scope.tstst[x].BookingStatus == 'Pending' || $scope.tstst[x].BookingStatus == 'Reject' ){
                   
                       
                    }
                }
                   
                $scope.UnAssignedCountoffer = $scope.oferunassignedjob_list.length;
                $scope.unassignedjob_list = $scope.jobsdata['dt1'];
             
                



                
                    $scope.driverlist = $scope.jobsdata['dt5'];
                    //$scope.$digest();
                
            }, function myError(response) {

                console.log(response);

            });


        } 

            $scope.responsexx  = false; 
            $scope.checkrideexist = async function(id ,x){


                var DbRef = firebase.database();
            
                let myPromisejob = new Promise(function(myResolve, myReject) {
                    var refaz21= DbRef.ref("/autodisp/"+ id);
                    refaz21.once("value", function (snapshot) {
                        $resppx =   snapshot.val();
                        if($resppx == null  ){
                            myResolve("jobnotexist");
                            
                            $scope.jobsdata['dt1'][x].autodispatch = 0; 
                        }else{
                            myResolve("jobexist");
                            $scope.oferunassignedjob_list.push(  $scope.tstst[x]   );
                            $scope.jobsdata['dt1'][x].autodispatch = 1; 
                   
                            
                        }

                    });
                });

                var resppjob =  await myPromisejob;
            
                return resppjob;
                 

            }
            $scope.checkjobvehile1= function(jobcartype){

                if($( '#VehicleType option:selected').text() == 'Not Specified'){
                    return true;
                }else if($( '#VehicleType option:selected').text() == jobcartype){
                    return true;
                }else{
                    return false;
                }
            }
            $scope.checkjobvehile = function(jobcartype, vehicletype){

                if(jobcartype == 'Not Specified'){
                    return true;
                }else if(jobcartype == vehicletype){
                    return true;
                }else{
                    return false;
                }
            }
            $scope.checkofferjob = function(driverid){
                var found = true;
                if($scope.oferunassignedjob_list.length == 0){
                    return true;
                }else{
                    for(var i = 0; i <  $scope.oferunassignedjob_list.length; i++) {
                        if ($scope.oferunassignedjob_list[i].DriverId == driverid) {
                            
                            found = false;
                            break;

                        }
                    } 
                    return found;
                }
             
                 
                
            }
            //delievery

            $scope.GetJobsdelivery = function () {

                var now = new Date();

                var day = ("0" + now.getDate()).slice(-2);
                var month = ("0" + (now.getMonth() + 1)).slice(-2);

                var today = now.getFullYear() + "-" + (month) + "-" + (day);



                var d = new Date();
                var month = d.getMonth() + 1;
                var date = d.getDate();
                var FinalOutput = d.getFullYear() + '-' +
                    (('' + month).length < 2 ? '0' : '') +
                    month + '-' +
                    (('' + date).length < 2 ? '0' : '') + date;

                h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                var FindMinutes = FinalOutput + " " + h + ':' + m;
                $scope.CurrentDateTime = today + " " + h + ':' + m + ':00';


                $scope.param = [{ "name": "CurrentDateTime", "Value": FindMinutes }];
                $scope.proc = '[deviUnAssignedJobsv2]';

                $http({

                    method: "POST",

                    url: "DataManager/Data.aspx/DataSelector",

                    data: {
                        data: $scope.param,
                        action: $scope.proc
                    }

                }).then(function mySuccess(response) {


                    var resp = response.data;
                    $scope.jobsdata = JSON.parse(resp.d);
                    $scope.deliverycount =  $scope.jobsdata["dt4"][0].deUnAssignedCount;
                    $scope.deliverycountx($scope.deliverycount);
                    $scope.driverlistx = $scope.jobsdata['dt5'];
                    $scope.deliveryjobs = $scope.jobsdata['dt1'];


                }, function myError(response) {

                    console.log(response);

                });


            } 
            //end deliv

            $scope.AssignPendingJobFromJobList2 = function(BookingId, VehicleId ,driverId, u_id , types) {
               
               
                var JobVehicleId = $("#"+types + BookingId + "").val();
                console.log(VehicleId);
                $("#Div"+BookingId+"").remove();
                if (JobVehicleId == '0') {
                   Action([
                      { "name": "BookingId", "Value": BookingId },
                      {"name":"reternVehicleid" , "Value" : VehicleId},
                      {"name":"reterndriverId" , "Value" : driverId},
                      { "name": "quenumber", "Value": 0 }
                    ], "[UnAssignJobStatusFromJobList]");
                }
                else {
            
                    Action([
                   { "name": "BookingId", "Value": BookingId },
                   { "name": "VehicleId", "Value": JobVehicleId} ,
                   { "name": "quenumber", "Value": 0 }
                   ], "[AssignJobStatusFromJobListv2]");
       
                    if(JobVehicleId == driverId){
 
                    }else{
                        FnCancelRide(driverId, BookingId);
                    }
               
              
    

                    if(u_id != null || u_id != ''){
                        writeNewPostpassenger(JobVehicleId, BookingId, "Offered" , u_id);
                    }else{
                        writeNewPost(JobVehicleId, BookingId, "Offered");
                    }
                    $("#Divo" + BookingId + "").remove();
        
              
                    acknowledgemethod(JobVehicleId, BookingId, "Offered")

                

                }
        
            }
            $scope.AssignJobFromJobList2 = function(BookingId, VehicleId ,driverId,U_id , typex) {

                var JobVehicleId = $("#"+typex + BookingId + "").val();
                if (JobVehicleId == '0') {
                    Action([
             { "name": "BookingId", "Value": BookingId },
                   {"name":"reternVehicleid" , "Value" : VehicleId},
                   {"name":"reterndriverId" , "Value" : driverId},
                       { "name": "quenumber", "Value": 0 }], "[UnAssignJobStatusFromJobList]");
                    FnCancelRide(driverId, BookingId);
                    $("#Div" + BookingId + "").remove();
        

                }
                else {
                    Action([
                    { "name": "BookingId", "Value": BookingId },
                    { "name": "VehicleId", "Value": JobVehicleId },
                    {"name": "reternVehicleid" , "Value" : VehicleId},
                    {"name":"reterndriverId" , "Value" : driverId}], "[AssignJobStatusFromJobList]");
                    FnCancelRide(driverId, BookingId);

                    if(U_id != null || U_id != ''){
                        writeNewPostpassenger(JobVehicleId, BookingId, "Offered" , U_id);
                    }else{
                        writeNewPost(JobVehicleId, BookingId, "Offered");
                    }
 
                    $("#Divo" + BookingId + "").remove();
                    acknowledgemethod(JobVehicleId, BookingId, "Offered")

                }
    
            }

            var flightPath ;
     

            //kicked and suspends//
            $scope.ShowKickDetails  = function(id) {


                Swal.fire({
                    title: 'Are you sure?',
                    text: "You want to Kick this Driver",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, Kick Driver!'
                }).then((result) => {
                    if (result.value) {


                        Action([
                   { "name": "VehicleId", "Value": $("#lblBookingHeadId").text() }, 
                   { "name": "DriverId", "Value": $("#lblDriverId").text() }, 
                   { "name": "PenaltyReason", "Value": "Kicked" },
                   { "name": "PenaltyDate", "Value": $scope.CurrentDateTime },
                   { "name": "PenaltyUpToDateTime", "Value": "" + " " + "12:00:00" }],
                   "[KickDriver]");

                        FnKickDriver($("#lblDriverId").text(), $("#lblBookingHeadId").text(), "Kicked");
                 
                        toastr["success"]('Driver Kicked Successfully.', 'Success!');
                        firebase.database().ref("online/" + SomeSession2 + "/"+$("#lblBookingHeadId").text()).remove();
                        //$scope.drivertable();
                        //$scope.zonetablez();
                    }
                })

           
    

            }

            $scope.ShowSuspendDetails= function(id) {

                Swal.fire({
                    title: 'Are you sure?',
                    text: "You want to Suspend this Driver",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, suspend Driver!'
                }).then((result) => {
                    if (result.value) {


                        Action([
                  { "name": "DriverId", "Value": $("#lblDriverId").text() }, 
                  { "name": "VehicleId", "Value": $("#lblBookingHeadId").text() },
                  { "name": "PenaltyReason", "Value": "Suspended" },
                  { "name": "PenaltyDateTime", "Value": $scope.CurrentDateTime }],
                  "[DispatcherKickUsers]");
          
                        FnKickDriver($("#lblDriverId").text(), $("#lblBookingHeadId").text(), "Suspended");
               
                        toastr["success"]('Driver suspend Successfully.', 'Success!');
                        firebase.database().ref("online/" + SomeSession2 + "/"+$("#lblBookingHeadId").text()).remove();

                        //$scope.drivertable();
                        //$scope.zonetablez();
                    }
                })
           
                //$("#VehicleDetails").modal('hide');

            }
            //end kicked//


            $scope.showmakert1 = function(id, pickup){

                $scope.distance  = 0;
                $scope.Time  = 0;
            
                var pickups =   pickup.split(',');
                var LatLng = new google.maps.LatLng(pickups[0], pickups[1]);
            
        
                var icon = {  
                    path: 'M30.828 1.172c-1.562-1.562-4.095-1.562-5.657 0l-5.379 5.379-3.793-3.793-4.243 4.243 3.326 3.326-14.754 14.754c-0.252 0.252-0.358 0.592-0.322 0.921h-0.008v5c0 0.552 0.448 1 1 1h5c0 0 0.083 0 0.125 0 0.288 0 0.576-0.11 0.795-0.329l14.754-14.754 3.326 3.326 4.243-4.243-3.793-3.793 5.379-5.379c1.562-1.562 1.562-4.095 0-5.657zM5.409 30h-3.409v-3.409l14.674-14.674 3.409 3.409-14.674 14.674z',

                    scale: 0.4,
                    fillColor: "green",   
                    fillOpacity: 1,
                    strokeWeight: 1,
                    anchor: new google.maps.Point(0, 5),
              
                    labelOrigin: { x: 20, y: -10 }
                };

           
                var marker = new google.maps.Marker({
                    position: LatLng,
                    icon: icon,
                    label: {
                        text: 'Pickup',
                        color: "#eb3a44",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: "black"
                    },
                    map: map
                });
           
          
                markers[id] = marker;
                map.setCenter(LatLng);
            }
            $scope.showmakert = function(id, pickup, dropoff){
           
            
                directionsRenderer.setMap(map);
                $scope.calculateAndDisplayRoute0(directionsService , directionsRenderer,pickup, dropoff);
                 
            }
            $scope.showmakert3 = function(id, pickup, dropoff , nextstop){
                console.log(nextstop);
                directionsRenderer.setMap(map);
                $scope.calculateAndDisplayRoute44(directionsService , directionsRenderer,pickup, dropoff , nextstop) 
            }
            $scope.calculateAndDisplayRoute44 = function(directionsService, directionsRenderer,pickups,dropoffs ,nextstop) {
            

                var stopdata1 =  nextstop.split('=');
                  
                var waypts = [];
                $.each(  stopdata1 , function( index, value ) {
                    var stop22 =   stopdata1[index].split('@');
                    console.log(stop22);
                    if(stop22[0]){
                        waypts.push({
                            location:new google.maps.LatLng(   parseFloat( stop22[0] ) , parseFloat( stop22[1]) ) ,
                            stopover: true
                        }); 
                    }
                            
                }); 
                console.log(pickups);
                console.log(dropoffs);
                console.log(waypts);
            
                var selectedMode = 'DRIVING';
                var request = {
                    origin: pickups,  
                    destination: dropoffs, 
                    waypoints: waypts,
                    optimizeWaypoints: true,
                    travelMode: google.maps.TravelMode[selectedMode]
                };
                directionsService.route(request, function (response, status) {
                
                    if (status == google.maps.DirectionsStatus.OK) {
                        directionsRenderer.setDirections(response);
                        var route = response.routes[0];
                        var duration1;
                        var str;
                        var DistanceRes  = 0;
                        var DistanceResx = 0;
                        var      duration1z = 0;
                        for (var i = 0; i < route.legs.length; i++) {
                     
                       
                        
 
                            
                        
                        }

                   
                  
                   
                    } else {
                        alert("directions response " + status);
                    }
                });


            }
            $scope.markerremove1 = function(id, pickup){
                if( markers[id]){
                    markers[id].setMap(null);
                }else{

                }
     
          
            }
            $scope.showmakertcreate = function(id, pickup, dropoff){
           

 
                     
                directionsRenderer.setMap(map);
                $scope.calculateAndDisplayRoute(directionsService , directionsRenderer,pickup, dropoff);
            
            }
            $scope.stopare = function(lat, lng,text){

                directionsRenderer.setMap(map);
                var pic =  $('#LocalPickLat').val()+','+$('#LocalPickLng').val();
                var pictext = $('#pac-input').val();
                var drop = '';
                var droptext = '';
                if($('#LocalDropLat').val() == 0){
                    drop =  lat +','+ lng;
                    droptext =  text;
                }else{
                    drop = $('#LocalDropLat').val()+','+$('#LocalDropLng').val();
                    droptext =   $('#pac-inputx').val();
                }
                if(pic == '0.0'){

                }else{
                    if($scope.stoplistarray.length == 1 && $('#LocalDropLat').val() == '0'){
                        $scope.calculateAndDisplayRoute(directionsService, directionsRenderer,pic , drop);
                    }else{
                        $scope.calculateAndDisplayRoute2( directionsService, directionsRenderer, pictext , droptext);
                    }

        
                }

     
             
            }

            $scope.calculateAndDisplayRoute2z = function(directionsService, directionsRenderer,pickups,dropoffs ) {
                var waypts = [];
                // //var checkboxArray = document.getElementById('waypoints');
                $.each($scope.fata, function( index, value ) {
         
                 
                    waypts.push({
                        location:new google.maps.LatLng(  value.lat ,  value.lng ) ,
                        stopover: true
                    });
                }); 
          
                var selectedMode = 'DRIVING';
                var request = {
                    origin: pickups,  
                    destination: dropoffs, 
                    waypoints: waypts,
                    optimizeWaypoints: true,
                    travelMode: google.maps.TravelMode[selectedMode]
                };
                directionsService.route(request, function (response, status) {
                
                    if (status == google.maps.DirectionsStatus.OK) {
                        directionsRenderer.setDirections(response);
                        var route = response.routes[0];
                        var duration1;
                        var str;
                        var DistanceRes  = 0;
                        var DistanceResx = 0;
                        var      duration1z = 0;
                        for (var i = 0; i < route.legs.length; i++) {
                     
                       
                            duration1 = route.legs[i].duration.text;
                            duration1 = duration1.split(" ");
                            duration1z += parseInt(duration1[0]);
                  
                        
                   
                            str = route.legs[i].distance.text;
                            DistanceRes = str.split(" ");
                            DistanceResx += parseInt(DistanceRes[0]);
 
                            
                        
                        }

                        $scope.distance = DistanceResx +' Km';
                        $scope.distancemet = DistanceResx;
                        $scope.Time  = duration1z +" min";
                        $scope.estimate(DistanceResx+1);
                        $.each($scope.fata, function( index, value ) {
                            $('#lat'+index).val(value.lat) 
                            $('#lng'+index).val(value.lng) 
                            $('#pac-input'+index).val(value.path) 
                        
                        });
                  
                    } else {
                        alert("directions response " + status);
                    }
                });


            }

            $scope.calculateAndDisplayRoute2 = function(directionsService, directionsRenderer,pickups,dropoffs ) {
                var waypts = [];
                // //var checkboxArray = document.getElementById('waypoints');
                $.each($scope.stoplistarray, function( index, value ) {
                
                    waypts.push({
                        location:new google.maps.LatLng(  $('#lat'+value.id).val() , $('#lng'+value.id).val()) ,
                        stopover: true
                    });
                });
           
                var selectedMode = 'DRIVING';
                var request = {
                    origin: pickups,  
                    destination: dropoffs, 
                    waypoints: waypts,
                    optimizeWaypoints: true,
                    travelMode: google.maps.TravelMode[selectedMode]
                };
                directionsService.route(request, function (response, status) {
                
                    if (status == google.maps.DirectionsStatus.OK) {
                        directionsRenderer.setDirections(response);
                        var route = response.routes[0];
                        var duration1;
                        var str;
                        var DistanceRes  = 0;
                        var DistanceResx = 0;
                        var      duration1z = 0;
                        for (var i = 0; i < route.legs.length; i++) {
                     
                       
                            duration1 = route.legs[i].duration.text;
                            duration1 = duration1.split(" ");
                            duration1z += parseInt(duration1[0]);
                  
                        
                   
                            str = route.legs[i].distance.text;
                            DistanceRes = str.split(" ");
                            DistanceResx += parseInt(DistanceRes[0]);
 
                            
                        
                        }

                        $scope.distance = DistanceResx +' Km';
                        $scope.distancemet = DistanceResx;
                        $scope.Time  = duration1z +" min";
                        $scope.estimate(DistanceResx+1);
                   
                    } else {
                        alert("directions response " + status);
                    }
                });


            }
            $scope.calculateAndDisplayRoute0 = function(directionsService, directionsRenderer,pickup, dropoff) {
             
                var pickups =   pickup.split(',');
                var dropoffs =   dropoff.split(',');  
          
                var selectedMode = 'DRIVING';
                directionsService.route({
                    origin: {lat: parseFloat(pickups[0]), lng: parseFloat(pickups[1])},  // Haight.
                    destination: {lat: parseFloat(dropoffs[0]), lng: parseFloat(dropoffs[1])},  // Ocean Beach.
            
                    travelMode: google.maps.TravelMode[selectedMode]
                }, function(response, status) {
                    if (status == 'OK') {
                        directionsRenderer.setDirections(response);
 
                 

                    } else {
                        window.alert('Directions request failed due to ' + status);
                    }
                });
            }
            $scope.calculateAndDisplayRoute = function(directionsService, directionsRenderer,pickup, dropoff) {
             
                var pickups =   pickup.split(',');
                var dropoffs =   dropoff.split(',');  
          
                var selectedMode = 'DRIVING';
                directionsService.route({
                    origin: {lat: parseFloat(pickups[0]), lng: parseFloat(pickups[1])},  // Haight.
                    destination: {lat: parseFloat(dropoffs[0]), lng: parseFloat(dropoffs[1])},  // Ocean Beach.
            
                    travelMode: google.maps.TravelMode[selectedMode]
                }, function(response, status) {
                    if (status == 'OK') {
                        directionsRenderer.setDirections(response);

                        var route = response.routes[0];
                        var leg1 = response.routes[0].legs[0];
                    
                  
                        for (var i = 0; i < route.legs.length; i++) {
                       
                            $scope.distance = route.legs[i].distance.text;
                            $scope.Time = route.legs[i].duration.text;
                      

                            var str = route.legs[i].distance.text;
                            DistanceRes = str.split(" ");
                     
                            $scope.estimate(DistanceRes);

                            
                        
                        }

                    } else {
                        window.alert('Directions request failed due to ' + status);
                    }
                });
            }
            $scope.customeshow = 0;
            $scope.currency = 0;
            $scope.estimate = function(EstimatedDistance){
                var BookingTime , BookingDate;

                if($scope.selectedtarrif == -1){
                    $scope.customeshow = 1;
                    $scope.currency = 0;
                    $scope.currencyprice = '';
                }else{
                    $scope.CustomeRate = '';
                    $scope.customeshow = 0;
                    if ( $scope.distance != 0) {
                        var str =  $scope.distance;
                        DistanceRes = str.split(" ");

                        $scope.paramq = [{ "name": "TariffId", "Value": $scope.selectedtarrif }];
                        $scope.procq = 'DispatchEstimation';

                        $http({

                            method: "POST",

                            url: "DataManager/Data.aspx/DataSelectorLess",

                            data: {
                                data: $scope.paramq,
                                action: $scope.procq
                            }

                        }).then(function mySuccess(result) {
               
                            var resp = result.data;
               
                            $res = JSON.parse(resp.d);
                            if ($res.length != []) {


                                var totalvalue = (parseFloat($res[0].StartPrice) + (parseFloat($res[0].DistanceRate) * parseInt(DistanceRes[0])));
                  
                                totalvalue = Math.ceil(totalvalue);                          
                  
                                //var percentage = document.getElementById("percentagevalue").value;
                                //var transectioon = document.getElementById("transection").value;
                    
                
                                //var percentagefound = (parseFloat(totalvalue) * parseFloat(percentage)) / 100;
                                //var percentageadded = parseFloat( percentagefound )+ parseFloat(totalvalue );
                                //var transeadd = parseFloat( transectioon )+ percentageadded;
                                //var amountz = transeadd * 100;
                                //var fulls =  Math.ceil(transeadd);
                                //$scope.currency = fulls;
                                //$scope.currencyprice = $res[0].CurrencyName;
                                //$scope.AmmountAddedvalue = fulls;
                                //document.getElementById('paymentvalueshow').innerHTML = fulls +" " + $res[0].CurrencyName;
                                //document.getElementById('textforpayment').innerHTML  = '  Ride Fair + Taxes Included';



                                var percentage = document.getElementById("percentagevalue").value;
                                var transectioon = document.getElementById("transection").value;
                                var percentagefound = (parseFloat(totalvalue) * parseFloat(percentage)) / 100;
                                console.log(percentagefound);
                                var percentageadded = parseFloat(percentagefound) + parseFloat(totalvalue);
                                console.log(percentageadded)
                                var transeadd = parseFloat(transectioon) + percentageadded;

                                var amountz = transeadd * 100;
                                var fulls = Math.ceil(transeadd);
                                console.log(fulls);



                   

                                $scope.currency =  Math.ceil(totalvalue);
                                $scope.currencyprice = $res[0].CurrencyName;
                                $scope.AmmountAddedvalue = Math.ceil(totalvalue); 
                                document.getElementById('paymentvalueshow').innerHTML = fulls +" " + $res[0].CurrencyName;
                                document.getElementById('textforpayment').innerHTML  = '  Ride Fair + Taxes Included';

                            }else{
                                toastr["warning"]('Tarrif Not Define', 'warning!');
                            }
                       


                        }, function myError(response) {



                        });



                  
                    }


                }







 

            }

            $scope.distance = 0;
            $scope.Time = 0;
            $scope.markerremovecreate = function(  ){
                $scope.currency = 0;
                $scope.currencyprice = '';
            }
            $scope.markerremove = function(id, pickup, dropoff){
                $scope.currency = 0;
                $scope.currencyprice = '';
                directionsRenderer.setMap(null);
             
            }
            $scope.markerremove3 = function(){
                directionsRenderer.setMap(null);
            }
            $scope.getjobs();
            $scope.GetJobsdelivery();
            $scope.datecreate = function (data) {
                var res = data.split(" ");

                var res1 = res[0].split("-");

                var datee = res1[2] + "-" + res1[1];

                var res2 = res[1].split(":");

                var timee = res2[0] + ":" + res2[1];
                return datee + " " + timee;
            }
            $scope.checklateornow = function (data1, data2) {

                $dispatchremain = parseInt(data1) + parseInt(data2);

                var unsigned_value = Math.abs($dispatchremain)
                $dispatchtimeshow = parseInt(data1) - $dispatchremain

                var showme = 0
                var lifted = "";
                if (parseInt(data1) <= parseInt($dispatchtimeshow)) {
                    lifted = "Min Remain";
                    showme = unsigned_value;
                    return showme + " " + lifted;
                } else {
                    lifted = "Late";
                    showme = -Math.abs($dispatchremain);
                    return showme + " " + lifted;
                }
            }
            $scope.alerting = function (DispatchTimebefore, BookingDateTime) {
                if (DispatchTimebefore > 0) {
                    BookingDateTime =    BookingDateTime.slice(0, -1);
            
                    if ($scope.CurrentDateTime >= BookingDateTime) {
                        $scope.playAudio();

                        return 'button-glow';

                    } else {
                         return '';
                    }
                } else {
                        return '';
               
                }
            }
            $scope.playAudio1 = function() {
          
                var audio = new Audio('sound/b.wav');
                audio.play();
            };
            $scope.playAudio = function() {
          
                var audio = new Audio('sound/a.wav');
                audio.play();
            };
            $scope.asssigned = function (DispatchTimebefore, BookingDateTime) {
            
                BookingDateTime =    BookingDateTime.slice(0, -1);
                if (DispatchTimebefore > 0) {

                    if ($scope.CurrentDateTime >= BookingDateTime) {

                        return 'block';
                    } else {
                        return 'none';
                    }
                } else {
                    return 'block';

                }
            }
            $scope.deliverycountx = function ( BookingDateTime) {
             

                if (BookingDateTime >  0) {
           
                    
                } else {
                               
                }
             
            }
            background:' + BackgroundColor + ';
            $scope.asssigned1 = function (BookingStatus) {
            

                if (  BookingStatus == "Assigned") {
              
              
                    return 'block';
                }
                else if( BookingStatus == "Active") {
               
           
                    return 'none';
                }
                else{
                    return 'none';
                }
            }
            $scope.asssigned11 = function (BookingStatus) {
            

                if (  BookingStatus == "Assigned") {
              
               
                    return 'none';
                }
                else if( BookingStatus == "Active") {
               
               
                    return 'none';
                }
                else{
               
                    $scope.playAudio();
                    return 'block';
                }
            }
            $scope.asssignedcolor = function (BookingStatus) {
            

                if (  BookingStatus == "Assigned") {
                    BackgroundColor = "#e6e11761";
                    return BackgroundColor;
                }
                else if( BookingStatus == "Active") {
                    BackgroundColor = "#e4520a8c";
                    return BackgroundColor;
                }
                else{
                    BackgroundColor = "#17e68861"
                    return BackgroundColor;
                }
            }
        $scope.testemailing = function(){


                        jQuery.ajax(
                         {
                             type: "POST",
                             url: "default.aspx/SendEmail",
                             data: JSON.stringify({
                                 "Email":  'iffimalik66@gmail.com',
                                 "CName":  'Invercargil',
                                 "Body":    'this is test message'
                             }),
                             dataType: "json",
                             contentType: "application/json; charset=utf-8",
                             cache: false,
                             success: function (response) {
                            console.log("response");
                            }})


}
            $scope.sendemail = function(emailtype , useremails,jobid,timeremain,acept){
                if(acept != '' || acept != null){
                    clearInterval("close"+acept);
                }
                var type = "";
                if(emailtype ==0){
                    type = "Reject"; 
                }else{
                    type = "Accept";
                }

                Swal.fire({
                    title: 'Are you sure?',
                    text: "Are you Sure To "+type+" This Job!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, '+ type +' it!',
                    cancelButtonText: 'Leave it Now'
                }).then((result) => {
                    if (result.value) {
                        Swal.fire(
                           'Warning!',
                           "Please Wait .Confirmation Email is In process",
                           'warning'
                           );

                        if(emailtype == 0){
                            var reso =   $scope.UnAssignedJobsCancelng(jobid, '');
             
                            if(reso == 'no'){
                                Swal.fire({
                                    title: 'Ok?',
                                    text: "So you Want to Accept !",
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: '#3085d6',
                                    cancelButtonColor: '#d33',
                                    confirmButtonText: 'Yes, Accept It',
                                    cancelButtonText: 'Leave It Now!'
                                }).then((result) => {
                                    if (result.value) {
                                        console.log(result);
                                        emailtype = 1;
                                    }else{
                                        return;
                                    }
                                })

                            }
                        }
            
                        var message1   = '';
    
                        var notification = '';

                        if(emailtype == 0){
                            notification = 'Cancel';
                            message1 =  '   <!DOCTYPE html>  '  + 
                                             '   <html>  '  + 
                                             '   <head>  '  + 
                                             '   	<title>Email test</title>  '  + 
                                             '   </head>  '  + 
                                             '   <body>  '  + 
                                             '   	<h1>Sorry we are unable at this time. !</h1>  '  + 
                                             '   	<p>Try Another Company.</p>  '  + 
                                             '   	<p>Thank You for bussiness with us</p>  '  +
                                             '   	<p style="color:red">Note: Do Not Reply</p>  '  +  
                                             '   </body>  '  + 
                                             '  </html>  ' ; 
                        }else{
                            notification = 'Accept';

                            message1 =  '   <!DOCTYPE html>  '  + 
                                    '   <html>  '  + 
                                    '   <head>  '  + 
                                    '   	<title>Email test</title>  '  + 
                                    '   </head>  '  + 
                                    '   <body>  '  + 
                                    '   	<h1>Your Ride is Booked</h1>  '  + 
                                     '   	<p>In case of any changes . Please Contect The selected Company Through the Phone.</p>  '  + 
                                    '   	<p>Thank You for bussiness with us</p>  '  + 
                                   '   	<p style="color:red">Note: Do Not Reply</p>  '  + 
                                    '   </body>  '  + 
                                    '  </html>  ' ; 
                        }
 

                        jQuery.ajax(
                         {
                             type: "POST",
                             url: "default.aspx/SendEmail",
                             data: JSON.stringify({
                                 "Email":  useremails,
                                 "CName":  'Invercargil',
                                 "Body":    message1
                             }),
                             dataType: "json",
                             contentType: "application/json; charset=utf-8",
                             cache: false,
                             success: function (response) {
                             
                                 console.log(response);
                                 if(response.d == 'Success'){
                              
                                     toastr["success"](notification+" Email is Send Successfully", 'success!');
                                 }else{
                               
                                     toastr["warning"]('Email Not Send Try Again!', 'warning!');
                                     //  return;
                                 }

                                 if(emailtype == 0){
                                     //UnAssignedJobsCancel(jobid, '');
                                     var param = [{ "name": "bookingsid", "value": jobid }];
                                     var proc = '[readwebsitestatus]';
                                     Selector1(param, proc).then(function (result) {
                                         console.log(result);
                                     });
                                 }else{
                                     if(timeremain > -1){
                                         Swal.fire(
                                            'Warning!',
                                            "This is Current Job (NOW) . Dispatched this Soon as Poosible, Thank You",
                                            'warning'
                                          );
                                         var param = [{ "name": "bookingsid", "value": jobid }];
                                         var proc = '[readwebsitestatus]';
                                         Selector1(param, proc).then(function (result) {
                                             console.log(result);
                                         });

                                     }else{
                                         Swal.fire(
                                           'Warning!',
                                           "This is Later Job. Set Dispatch Time According to your schechule , Thank You",
                                           'warning'
                                           );
                                         var param = [{ "name": "bookingsid", "value": jobid }];
                                         var proc = '[readwebsitestatus]';
                                         Selector1(param, proc).then(function (result) {
                                  
                                     
                                             $scope.EditJobunassignedng(jobid,timeremain);
                                             $("#DivLaterDateTime").modal('show');
                                         });

                               
                                  
                                         ;
        
                                  
                                                             

                                     }
                                 
                                 }

                             }
                         }
                         );

                    }else{

                    }
                }) 
    
     
            }
        
            $scope.latejobx = 0;


            $scope.latealert = function (DispatchTimebefore, BookingDateTime) {
                BookingDateTime =    BookingDateTime.slice(0, -1);
                if (DispatchTimebefore > 0) {
                    if ($scope.CurrentDateTime >= BookingDateTime) {
                
                        return "#ff4d4d";
                    } else {

                        $scope.latejobx += 1;
                   
                        return "#00b359";

                    }
                } else {
                    return;

                }

            }
            $scope.getTheValue2 = function (BookingDateTime) {
          

            
                BookingDateTime =    BookingDateTime.slice(0, -1);
                if ($scope.CurrentDateTime >=  BookingDateTime) {
                    return "rgba(230, 71, 23, 0.2)";
                }
                else {
                    return "rgba(145, 208, 232, 0.39)";
                }

            
            }


            $scope.getTheValue = function (BookingDateTime) {
                
                BookingDateTime =  BookingDateTime.slice(0, -1);
                if ($scope.CurrentDateTime >=  BookingDateTime) {
                    return "rgba(230, 71, 23, 0.2)";
                }
                else {
                    return "rgba(145, 208, 232, 0.39)";
                }

            
            }
            $scope.JobMinstime = 0;
            $scope.EditJobunassignedng =   function (ele,JobMins) {
 
                if($('#Filter-jobs').is(':visible')){
                  
                    $('#Filter-jobs').modal('hide');
                }else{
                    
                }

                  $scope.clearsection();
                $scope.fata = [];
             
                $scope.updatex = 2;
                var remaining_time = JobMins;
                $scope.updatebookingid = ele;
              
                
                var param = [{ "name": "Id", "value": ele }];
                var proc = '[Editjobv4]';
                Selector(param, proc).then(   function (result) {
                    if (result.d == "Session is experied, please login again") {
                        alert(result.d);
                        window.location.href = "DispatcherLogin.aspx?";
                    }
                    else {
                         
                        $res = JSON.parse(result.d);
                        console.log($res);

                        if($res["dt1"][0].nextstopdata != null ){
                            var stopdata1 =  $res["dt1"][0].nextstopdata.split('=');
                  
                            for ($j = 0; $j <  parseInt($res["dt1"][0].Nextstop); $j++) {
                               
                                $scope.stoplistarray.push({
                                    'id' : $j
                                });

                            }

                        }
                        $.each(  $scope.stoplistarray , function( index, value ) {
                            var stop22 =   stopdata1[index].split('@');
                            $scope.stoplistarray[index].lat = stop22[0];
                            $scope.stoplistarray[index].lng = stop22[1];
                            $scope.stoplistarray[index].path = stop22[2];
                            $scope.fata.push({
                                lat:stop22[0],
                                lng :stop22[1],
                                path:stop22[2]
                            })
                                  
                        });

                        if( $scope.dropupaddress != ''){
                             $scope.changedroplat1z();
                        }else{
                               $scope.setvalue(0);
                        }
 
                        var newtime =  remaining_time + parseInt($res["dt1"][0].DispatchTimebefore) ;
                        var d = new Date();

                        var month = d.getMonth() + 1;
                        var date = d.getDate();
                        var FinalOutput = d.getFullYear() + '-' +
                            (('' + month).length < 2 ? '0' : '') +
                            month + '-' +
                            (('' + date).length < 2 ? '0' : '') + date;
                          h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                        m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                        var FindMinutes = FinalOutput + " " + h + ':' + m;
                        var CurrentDateTime = $("#laterDate").val() + " " + h + ':' + m + ':00';
            
                        var strtime = $res["dt1"][0].BookingDateTime;
                        var xdelete = ( strtime).slice(10);
 
                        strtime = strtime.replace(xdelete, "");
                        console.log(newtime);
                        if( newtime > 0){ 
                            //$('#nowcheck').attr('checked', true);
                               $scope.bookingtime_select = 0;  
                               $("#ddlLaterMins").val('00');
                               $("#ddlLaterHrs").val('00');
                               $("#assign_notice").val( '0');
                            $scope.ddlLaterMins = '00';
                            $scope.assign_notice = '0';
                            $scope.ddlLaterHrs = '00';
                        }else if(newtime < 0){
                            //$('#latecheck').attr('checked', true);
                            $scope.bookingtime_select = 1;
                            $scope.DispatchTimebefore = $res["dt1"][0].DispatchTimebefore;
                            var datetime = $res["dt1"][0].BookingDateTime;
                            $scope.myTime = datetime.substr(11, 2);
                            $scope.myTime2 = datetime.substr(14, 2);
                            $scope.datetimemain  = new  Date(strtime);
                          
                              $scope.ddlLaterMins =  $scope.myTime2;
                            $scope.assign_notice = $res["dt1"][0].DispatchTimebefore;
                            $scope.ddlLaterHrs =  $scope.myTime;

                            $("#ddlLaterMins").val($scope.myTime2);
                            $("#ddlLaterHrs").val($scope.myTime);
                           $("#assign_notice").val($res["dt1"][0].DispatchTimebefore);
                        }
                        var   currentdriverid = $res["dt1"][0].DriverId;
                        $("#PickupZoneId").text( $res["dt1"][0].ZoneId);
                        var LatDetails = $res["dt1"][0].PickLatLng.split(',');
                        var LngDetails = $res["dt1"][0].DropLatLng.split(',');
                        $scope.LocalPickLat = LatDetails[0];
                        $scope.LocalPickLng = LatDetails[1];  
                        $('#LocalPickLat').val(LatDetails[0]);
                        $('#LocalPickLng').val(LatDetails[1]);
                        $('#LocalDropLat').val(LngDetails[0])
                        $('#LocalDropLng').val(LngDetails[1]);
                        $scope.LocalDropLat = LngDetails[0] ;
                        $scope.LocalDropLng = LngDetails[1] ;
                        $scope.dropupaddress = $res["dt1"][0].DropAddress;
                         $('#pac-inputx').val($res["dt1"][0].DropAddress);
                        $scope.pickupaddress = $res["dt1"][0].PickAddress;
                        $('#pac-input').val($res["dt1"][0].PickAddress);
                        $scope.distance = $res["dt1"][0].EstimatedTime;
                       $scope.Time = $res["dt1"][0].EstimatedDistance;
                        $scope.currency = $res["dt1"][0].EstimatedCost;
                       $scope.rideinfo = $res["dt1"][0].EntitiesDetails;
                       
                       
                        if($res["dt1"][0].CornerAddress != ''){
                            $scope.cornershow = true;
                         }else{
                            $scope.cornershow = false;
                         }
                        $scope.cornerdata =   $res["dt1"][0].CornerAddress  != null ? $res["dt1"][0].CornerAddress  : '';  
                       if ($res["dt1"][0].Urgent == "Yes") {
                         $scope.urgentdata  = true;
                        }
                        else {
                            $scope.urgentdata  = false;
                          }
                        $scope.noneed = 1;
                        $scope.selectedtarrif = parseInt($res["dt1"][0].TarriffId);
                        if ($res["dt1"][0].CustomeRate != 0) {
                            $scope.customeshow = 1;
                            $scope.CustomeRate =  parseInt($res["dt1"][0].CustomeRate);
                        }
                        $scope.account_Select_Id =   $res["dt1"][0].accountiDa  != null ? $res["dt1"][0].accountiDa  : '';  
                        $scope.account_Name =   $res["dt1"][0].Name  != null ? $res["dt1"][0].Name  : '';  
                        $scope.account_PhoneNo =   $res["dt1"][0].PhoneNo  != null ? $res["dt1"][0].PhoneNo  : '';  
                        $scope.account_AccountId =  $res["dt1"][0].accountiDa  != null ? $res["dt1"][0].accountiDa  : '';  
                        $scope.account_Email =   $res["dt1"][0].Email  != null ? $res["dt1"][0].Email  : '';  
                        $scope.claim_number =   $res["dt1"][0].claim_number  != null ? $res["dt1"][0].claim_number  : '';  
                        $scope.trip_days_left =    $res["dt1"][0].trip_days_left != null ? $res["dt1"][0].trip_days_left  : '';  
                        $scope.client_name =   $res["dt1"][0].client_name != null ? $res["dt1"][0].client_name  : '';  
                        $scope.client_phone =    $res["dt1"][0].client_phone != null ? $res["dt1"][0].client_phone  : '';  
                        $scope.manager_id =   $res["dt1"][0].manager_id  != null ? $res["dt1"][0].manager_id  : '';
                        $scope.client_id =     $res["dt1"][0].client_id  != null ? $res["dt1"][0].client_id  : '';
                        $scope.trip_status =    $res["dt1"][0].trip_status  != null ? $res["dt1"][0].trip_status  : ''; 
                        $scope.acc_select_id =     $res["dt1"][0].Acc_job_id  != null ? $res["dt1"][0].Acc_job_id  : '';  
                        $scope.account_PhoneNo  = $res["dt1"][0].PassengerId ;
                        $scope.AmmountAddedvaluesend  = $res["dt1"][0].Recieve_payment ;
                         $scope.selectedcustomer = $res["dt1"][0].Passengers;
                        $scope.selectedbeg =  $res["dt1"][0].Bags;
                        $scope.selectedwheelchair = $res["dt1"][0].WheelChairs;
                        $scope.selectedcar = $res["dt1"][0].VehiclesReguired;
                         $.each( $scope.carlist, function( index, value ) {
                          if($res["dt1"][0].VehicleType == value ){
                                $scope.selectedcartype = index;
                            }
                        });
                        if (parseInt($res["dt1"][0].Nextstop) > 0) {
                            $scope.showstopshow = 1;
                            $scope.stoplstshow = 1;
                            $scope.stoplistarraynumber = parseInt($res["dt1"][0].Nextstop);    
                        }else{
                            $scope.showstopshow = 0;
                            $scope.stoplstshow = 0;
                        }
                        $scope.selecteddriverpre = 0;
                        $scope.vehicleidpre = 0;
                        if($res["dt1"][0].BookingStatus == 'No One'){
                            $scope.selecteddriver = -1;
                            $scope.selecteddriverpre = 0;
                        }else if($res["dt1"][0].BookingStatus == 'Pending'){
                            $scope.selecteddriver = 0;
                            $scope.selecteddriverpre = 0;
                        }else if($res["dt1"][0].BookingStatus == 'Offered'){
                                  $scope.vehicleidpre =  $res["dt1"][0].vehicleid;
                                 $scope.selecteddriver =  parseInt($res["dt1"][0].DriverId);
                              $scope.selecteddriverpre =  parseInt($res["dt1"][0].DriverId);
                          
                          }
                         console.log($res["dt1"][0].nextstopdata);
 
                       
                    }
                });
                 
                $scope.showfirst2();
                $scope.getjobs();
            }
            $scope.updateride2 = function(previousdriverid, vehicleidpre ){
                if($("#LocalPickLat").val() == 0){
                    toastr["warning"]("Please Select The Pickup address First", 'warning!');

                    return;
                }
                var completelistofstop = '';
                var laterjob = false;
                $.each($scope.stoplistarray, function( index, value ) {
                    completelistofstop +=     $('#lat'+value.id).val()+"@"+$('#lng'+value.id).val()+"@"+$('#pac-input'+value.id).val()+"="
                });

                var laterchecking = 0;
                if ($scope.bookingtime_select == 1) {
                    laterjob = true;
                    BookingDateTime = $("#laterDate").val() + " " + $("#ddlLaterHrs").val()   + ":" +  $("#ddlLaterMins").val( ) + ":00";
                    DispatchingTime = new Date(BookingDateTime);
                    DispatchingTime.setMinutes(DispatchingTime.getMinutes() - $("#assign_notice").val()  );
                    var month = DispatchingTime.getMonth() + 1;
                    var date = DispatchingTime.getDate();
                    var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                        (('' + month).length < 2 ? '0' : '') +
                        month + '-' +
                        (('' + date).length < 2 ? '0' : '') + date;

                    h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                    m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                    DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                    var dispatchshowtime =$("#assign_notice").val()  ;
                    laterchecking = 1;
                }
                else {
                    laterchecking = 0;

                    var now = new Date();
                    var day = ("0" + now.getDate()).slice(-2);
                    var month = ("0" + (now.getMonth() + 1)).slice(-2);
                    var todayz = now.getFullYear()+"-"+(month)+"-"+(day) ;
                    var d = new Date();

                    h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
                    m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                    BookingDateTime = todayz + " " + h + ':' + m;
                    DispatchingTime = new Date(BookingDateTime);


                    DispatchingTime.setMinutes(DispatchingTime.getMinutes() - 0);
                    var month = DispatchingTime.getMonth() + 1;
                    var date = DispatchingTime.getDate();
                    var DispatchOutput = DispatchingTime.getFullYear() + '-' +
                        (('' + month).length < 2 ? '0' : '') +
                        month + '-' +
                        (('' + date).length < 2 ? '0' : '') + date;

                    h = (DispatchingTime.getHours() < 10 ? '0' : '') + DispatchingTime.getHours(),
                    m = (DispatchingTime.getMinutes() < 10 ? '0' : '') + DispatchingTime.getMinutes();
                    DispatchingTime = DispatchOutput + " " + h + ':' + m+':'+"00";
                    var dispatchshowtime = 0;
                }
             

                if ($("#ddlVehicleType").val() == "") {
                    VehicleId = "0";
                }
                else {
                    VehicleId = $("#ddlVehicleType option:selected").val();

                }

                var sel = document.getElementById('ddlDriver');
                var selected = sel.options[sel.selectedIndex];
                var VehicleId = selected.getAttribute('data-foo');

                var quenumber = selected.getAttribute('data-zoneq');
                console.log(VehicleId);
                var bookstatus = "";
                var DriveId = "";
                if(laterjob){
                  
                    if ($scope.selecteddriver == 0) {
                        DriveId = "0";
                        bookstatus = "Pending";
                    }
                    else if ($scope.selecteddriver == -1 ) {
                        DriveId = "0";
                        bookstatus = "No One";
                    }else{

                        DriveId = "0";
                        bookstatus = "No One";
                    }

                }else{
                    if ($scope.selecteddriver == 0) {
                        DriveId = "0";
                        bookstatus = "Pending";
                    }
                    else if ($scope.selecteddriver == -1 ) {
                        DriveId = "0";
                        bookstatus = "No One";
                    }
                    else {
                        DriveId =  $scope.selecteddriver;
                        bookstatus = "Offered";
                    }
                }
           


                var previous= "0";
          
                var  BookingUgent = 'no';
                if ($scope.urgentdata == true) {
                    BookingUgent = "Yes";
                }
                else {
                    BookingUgent = "No";
                }
           
                $amountadded =  '';
                if( $scope.acc_select_id  != ''){
                    $booking_type = "ACC Ride";
                }else if( $scope.account_Select_Id != ''){
                    $booking_type = "Account Ride";
                }else if( $scope.paymentobtrue == false){
                    $booking_type = "Normal Ride";
                }else {
                    $booking_type = "Normal Ride";
                }
                var param = [
                 { "name": "Id", "Value": $scope.updatebookingid },
                 { "name": "Name", "Value":  $scope.account_Name },
                 { "name": "PassengerId", "Value": $scope.account_PhoneNo  },
                 { "name": "Email", "Value":  $scope.account_Email },
                 { "name": "VId", "Value": VehicleId }, 
                 { "name": "DId", "Value": $scope.selecteddriver },
                 { "name": "PickLatLng", "Value": $("#LocalPickLat").val() + "," + $("#LocalPickLng").val() },
                 { "name": "DropLatLng", "Value": $("#LocalDropLat").val() + "," + $("#LocalDropLng").val() },
                 { "name": "PickLocation", "Value": $('#pac-input').val() },
                 { "name": "DropLocation", "Value": $('#pac-inputx').val() },
                 { "name": "VehicleType", "Value": $("#VehicleType option:selected").text() },
                 { "name": "PassengersNo", "Value": $scope.selectedcustomer },
                 { "name": "BagsNo", "Value": $scope.selectedbeg },
                 { "name": "WheelChairsNo", "Value": $scope.selectedwheelchair },
                 { "name": "VRequired", "Value":  $scope.selectedcar },
                 { "name": "TarriffId", "Value":  $scope.selectedtarrif },
                 { "name": "TarriffName", "Value":$("#ddlTariff option:selected").text()  },
                 { "name": "CustomeRate", "Value": $scope.CustomeRate },
                 { "name": "Urgent", "Value": BookingUgent },
                 { "name": "FlightNo", "Value":'' },
                 { "name": "RoomNo", "Value": '' },
                 { "name": "Nextstop", "Value": $scope.stoplistarray.length },
                 { "name": "nextstopdata", "Value":completelistofstop },
                 { "name": "ZoneId", "Value": parseInt( $('#PickupZoneId').text()) },
                 { "name": "EntitiesDetails", "Value": $scope.rideinfo  },
                 { "name": "DateTime", "Value": BookingDateTime },
                 { "name": "Dispatchbefore", "Value": dispatchshowtime },
                 { "name": "DispatchMinutes", "Value": DispatchingTime },
                 { "name": "Distance", "Value":  $scope.distance },
                 { "name": "Time", "Value": $scope.Time  },
                 { "name": "EstimatedCost", "Value":  $scope.currency },
                 { "name": "CornerAddress", "Value":  $scope.cornerdata },
                 { "name": "PromoId", "Value": '' },
                 { "name": "Acc_job_id", "Value": $scope.acc_select_id},
                 { "name": "Acc_manager_id", "Value": $scope.manager_id },
                 { "name": "Account_id", "Value":$scope.account_Select_Id},
                { "name": "Acc_claim_id", "Value":   $scope.claim_number  },
                 { "name": "Acc_client_id", "Value": $scope.client_id },
                 { "name": "Acc_trip_status", "Value":  $scope.trip_status },
                 { "name": "bookstatus", "Value": bookstatus},
                 {"name": "booking_type" , "Value" :  $booking_type},

                   {"name": "quenumber" , "Value" :  quenumber},
                {"name":"previous" , "value": previous},
                {"name":"recieve_ammount" , "value": $scope.AmmountAddedvaluesend}
                ];

                console.log(param);
                var proc = "[ProcUpdateJobv6]";
                $http({

                    method: "POST",

                    url: "DataManager/Data.aspx/DataProcessor",

                    data: {
                        data: param,
                        action: proc
                    }

                }).then(function mySuccess(result) {
                    console.log(result);
                    var  BookingStatusx = '';
                    if (result.data.d == "Booking Details Update Successfully" ) { 
                 
                        var  BookingIz =  $scope.updatebookingid ;
                    
                        if  ( $scope.bookingtime_select == 1 ) {
                        
                            if($scope.selecteddriver == 0 ){
                          
                             
                                toastr["success"](  "Booking Update", 'success!');   
                          
                            }else if($scope.selecteddriver == -1){
                              
                                toastr["success"](  "Booking Update", 'success!');
                            }else{
                                Swal.fire(
                                      'Warning!',
                                      "This Job is Not Yet Ready For Dispatch.Please Change it to 'Now' Then Dispatch",
                                      'warning'
                                    );
                        
                            }  
                        }else{
                        
                            if ($scope.selecteddriver == 0) {
                                toastr["success"](  "Booking Update", 'success!');
                         
                            } else if(   $scope.selecteddriver == -1){
                                toastr["success"](  "Booking Update", 'success!');
                            }else {
                           
                                BookingStatusx = "Offered";
                              
                                    writeNewPost(DriveId, BookingIz, "Offered");
                                    toastr["success"](  "Job send to Driver", 'success!');
                               
                              
                            }
                        }

                    
                        $scope.updatebookingid = '';
                      
                        $scope.AssignedJobs();
                        $scope.clearsection();  
                        $scope.getjobs();
                        $('#largeModal').modal('hide');
                        $("#PickupZoneId").text('');
                        if(BookingStatusx == "Offered") {
                             acknowledgemethod(DriveId, BookingIz, BookingStatusx)
                            }
                    }else{
                  
                        toastr["error"](  "Booking Information Not Update", 'Error!');
                    }
            
              
              
                }, function myError(response) {
                    console.log(response);


                });

            
            }
            $scope.ActiveJobsdata = function (ok='') {
 

                if(ok == 0){
                    refreshjob = 0;
                }
                $scope.param1 = [];
                $scope.proc1 = '[ActiveJobsv3]';

                $http({

                    method: "POST",

                    url: "DataManager/Data.aspx/DataSelectorLess",

                    data: {
                        data: $scope.param1,
                        action: $scope.proc1
                    }

                }).then(function mySuccess(response) {


                    var resp = response.data;  

                    if(refreshjob == 1){
                        return;
                    }
                    $scope.ActiveJob = JSON.parse(resp.d);
                    $scope.ActiveCount =  $scope.ActiveJob.length;  
                    //$scope.driverlistassigned = $scope.assigneddata['dt2'];
                    //$scope.assignedjob_list = $scope.assigneddata['dt1'];
                    //$scope.$digest();

                }, function myError(response) {

               

                });

            }

                $scope.AssignedJobs = function (ok='') {
                    if(ok == 0){
                        refreshjob = 0;
                    }
                    $scope.param11 = [];
                    $scope.proc11 = '[AssignedJobsv2]';

                    $http({

                        method: "POST",

                        url: "DataManager/Data.aspx/DataSelector",

                        data: {
                            data: $scope.param11,
                            action: $scope.proc11
                        }

                    }).then(function mySuccess(response) {


                        var resp = response.data;
                        $scope.assigneddata = JSON.parse(resp.d);
              
                        $scope.driverlistassigned = $scope.assigneddata['dt2'];
                       
                        $scope.assignedjob_list = $scope.assigneddata['dt1'];
                        console.log($scope.assignedjob_list);
                        $scope.AssignedCount = $scope.assigneddata['dt1'].length;
                        //$scope.$digest();
                    }, function myError(response) {

               

                    });

                }
        
                    $scope.cancelactivejob = function(id){
            
                        $scope.param111 = [{ "name": "BookingId", "Value": id },
                             { "name": "DropLocation", "Value": '' },
                         { "name": "Distance", "Value": '' },
                         { "name": "Time", "Value": '' },
                         { "name": "Cost", "Value":'' },
                         { "name": "RideCost", "Value": '' },
                         { "name": "WaitingCost", "Value":''},
                         { "name": "Curreny", "Value": '' }];
                        $scope.proc11a = 'UpdateBooking';
              
                        $http({

                            method: "POST",

                            url: "DataManager/Data.aspx/DataSelectorRide",

                            data: {
                                data: $scope.param111,
                                action: $scope.proc11a
                            }

                        }).then(function mySuccess(result) {
                
                            $res = JSON.parse(result.d);
                       
                            if ($res[0].Result == "Ride Ended Successfully") {
                                $scope.ActiveJobsdata();
                            }
                     

                        }, function myError(response) {

                            console.log(response);

                        });


          
           
                    }
                    $scope.AssignPendingJobFromJobList = function (BookingId, VehicleId, driverId, u_id, laststatus,type) {
                     
            
                        var JobVehicleId = $("#"+type+BookingId).val();
                      
                        
                        var sel = document.getElementById(type+BookingId);
                        var selected = sel.options[sel.selectedIndex];
                        var extra = selected.getAttribute('data-doo');
                        var quenumber = selected.getAttribute('data-zoneq');
                    
                        if (JobVehicleId == '0') {


                            var   param = [{ "name": "bookingsID", "value": BookingId }];
                            var   proc = '[checkjobstatusv2]';
                            jQuery.ajax(
                                {
                                    type: "POST",
                                    url: "DataManager/Data.aspx/DataSelector",
                                    data: JSON.stringify({
                                        "data": param,
                                        "action": proc
                                    }),
                                    dataType: "json",
                                    contentType: "application/json; charset=utf-8",
                                    cache: false,
                                    success: function (response) {
                                        console.log(response);
                                        var ridestatuspre= JSON.parse(response.d);

                                        if(ridestatuspre["dt1"].length > 0) {
                                            toastr["error"]("Taking Job from Driver",'success!');
                                              FnCancelRide(ridestatuspre["dt1"][0].DriverId, BookingId);
                                             //TODO later for chaning que
                                            //FnMoveQueueNo1($res[0].DriverId,quenumber);
                          
                                              $("#Divo" + BookingId + "").remove();
                                              $scope.param = [
                                               { "name": "BookingId", "Value": BookingId },
                                               { "name": "reternVehicleid", "Value": VehicleId },
                                               { "name": "reterndriverId", "Value": driverId },
                                             { "name": "quenumber", "Value": quenumber }
                            
                                              ];
                                              console.log($scope.param);
                                              $scope.proc = "[UnAssignJobStatusFromJobList]";
                                              $http({

                                                  method: "POST",

                                                  url: "DataManager/Data.aspx/DataProcessor",

                                                  data: {
                                                      data: $scope.param,
                                                      action: $scope.proc
                                                  }

                                              }).then(function mySuccess(response) {
                                                  toastr["success"]("Job Status Changed",'success!');
                                                  $scope.getjobs();
                                              }, function myError(response) {
                                                  console.log(response);

                                              });
                                             
                                           
                                        } else {
                                          
                                            $("#Divo" + BookingId + "").remove();
                                            $scope.param = [
                                             { "name": "BookingId", "Value": BookingId },
                                             { "name": "reternVehicleid", "Value": VehicleId },
                                             { "name": "reterndriverId", "Value": driverId },
                                           { "name": "quenumber", "Value": quenumber }
                            
                                            ];
                                            console.log($scope.param);
                                            $scope.proc = "[UnAssignJobStatusFromJobList]";
                                            $http({

                                                method: "POST",

                                                url: "DataManager/Data.aspx/DataProcessor",

                                                data: {
                                                    data: $scope.param,
                                                    action: $scope.proc
                                                }

                                            }).then(function mySuccess(response) {
                                                toastr["success"]("Job Status Changed",'success!');
                                                $scope.getjobs();
                                            }, function myError(response) {
                                                console.log(response);

                                            });

                              

                                        }
                                    }
                                });

                        
                        } else {

                            for(var xx = 0 ;  xx < $scope.driverlist.length; xx++){

                                if($scope.driverlist[xx].Id == driverId) {
                                    $scope.driverlist.splice(xx, 1);
                                }

                            }
                            
                         
                            console.log($scope.driverlist);
                           
                            toastr["success"]("Successfully in sending Process",'success!');

                            var   param = [{ "name": "bookingsID", "value": BookingId }];
                            var   proc = '[checkjobstatus]';
                            jQuery.ajax(
                                {
                                    type: "POST",
                                    url: "DataManager/Data.aspx/DataProcessor",
                                    data: JSON.stringify({
                                        "data": param,
                                        "action": proc
                                    }),
                                    dataType: "json",
                                    contentType: "application/json; charset=utf-8",
                                    cache: false,
                                    success: function (response) {
                                        if (response.d == 'false') {
                       
                                            toastr["error"](   "This Job Is in Already Offer",'error!');
                                           
                                        } else {
                                          
                                            firebase.database().ref("online/" + SomeSession2 + "/"+extra).once('value').then(function (snapshot) {
                                             snapshot.forEach(function (childsnapshot) {
                                                    console.log(childsnapshot.val());
                                                    if(childsnapshot.val().vehiclestatus == "Available"){
                                                        Action([
                                                          { "name": "BookingId", "Value": BookingId },
                                                          { "name": "VehicleId", "Value": JobVehicleId },
                                                           
                                                         { "name": "quenumber", "Value": quenumber 
                                                          }], "[AssignJobStatusFromJobListv2]");
                                                        if (u_id == 'null' || u_id == '') {
                                                            writeNewPost(JobVehicleId, BookingId, "Offered");

                                                        } else {
                                                            writeNewPostpassenger(JobVehicleId, BookingId, "Offered", u_id);
                                                        }
                                                        $scope.getjobs();
                                                        acknowledgemethodx(VehicleId , JobVehicleId, BookingId, laststatus);

                                                    }else{
                                                        toastr["error"]("Job Can't be send to driver. \n  Driver status is '"+childsnapshot.val().vehiclestatus+"'", 'error!');

                                                    }
            
                                                });
                                            });
                              

                                        }
                                    }
                                });



                        }
                    }
                    $scope.updatebookingid = '';
                    $scope.fata = [];
                    $scope.EditJob = function(ele , quenumberq) {
                        $scope.quenumberq = quenumberq  ;
                        if($('#Filter-jobs').is(':visible')){
                    
                            $('#Filter-jobs').modal('hide');
                        }else{
                         
                        }
                        $scope.updatebookingid=ele; 
                        $scope.fata = [];
                        //$scope.stop();
                        $scope.clearsection();
                        $scope.updatex = 1;
                        //$("#JobUpdateId").text(ele);
                        directionsRenderer.setMap(null);
                        $scope.markerremove1(1 , 's'); 
                        var param = [{ "name": "Id", "value": ele }];
                        var proc = '[Editjobv4]';
                        Selector(param, proc).then(function (result) {
                            if (result.d == "Session is experied, please login again") {
                                window.location.href = "DispatcherLogin.aspx?";
                            }
                            else {
                                $res = JSON.parse(result.d);
                                console.log($res);
                                var   currentdriverid = $res["dt1"][0].DriverId;
                  
                  
                                $("#PickupZoneId").text( $res["dt1"][0].ZoneId);
                   
                                var LatDetails = $res["dt1"][0].PickLatLng.split(',');
                     
                                var LngDetails = $res["dt1"][0].DropLatLng.split(',');
                                $scope.LocalPickLat = LatDetails[0];
                                $scope.LocalPickLng = LatDetails[1];  
                                $('#LocalPickLat').val(LatDetails[0]);
                                $('#LocalPickLng').val(LatDetails[1]);
                                $('#LocalDropLat').val(LngDetails[0])
                                $('#LocalDropLng').val(LngDetails[1]);
                                $scope.LocalDropLat = LngDetails[0] ;
                                $scope.LocalDropLng = LngDetails[1] ;
                                $scope.dropupaddress = $res["dt1"][0].DropAddress;
                                $('#pac-inputx').val($res["dt1"][0].DropAddress);
                                $scope.pickupaddress = $res["dt1"][0].PickAddress;
                                $('#pac-input').val($res["dt1"][0].PickAddress);
                                $scope.distance = $res["dt1"][0].EstimatedTime;
                                $scope.Time = $res["dt1"][0].EstimatedDistance;
                    
                                $scope.currency = $res["dt1"][0].EstimatedCost;
                                $scope.account_Select_Id =   $res["dt1"][0].accountiDa  != null ? $res["dt1"][0].accountiDa  : '';  
                                $scope.account_Name =   $res["dt1"][0].Name  != null ? $res["dt1"][0].Name  : '';  

                                $scope.account_PhoneNo =   $res["dt1"][0].PhoneNo  != null ? $res["dt1"][0].PhoneNo  : '';  

                                $scope.account_AccountId =   $res["dt1"][0].AccountId  != null ? $res["dt1"][0].AccountId  : '';  

                                $scope.account_Email =   $res["dt1"][0].Email  != null ? $res["dt1"][0].Email  : '';  

                                $scope.claim_number =   $res["dt1"][0].claim_number  != null ? $res["dt1"][0].claim_number  : '';  
                                $scope.trip_days_left =    $res["dt1"][0].trip_days_left;
                                $scope.client_name =   $res["dt1"][0].client_name;
                                $scope.client_phone =    $res["dt1"][0].client_phone;
                   
                   
                                $scope.manager_id =      $res["dt1"][0].manager_id  != null ? $res["dt1"][0].manager_id  : '';
                    

                                $scope.client_id =     $res["dt1"][0].client_id  != null ? $res["dt1"][0].client_id  : '';
                                $scope.trip_status =    $res["dt1"][0].trip_status  != null ? $res["dt1"][0].trip_status  : ''; 
                                $scope.acc_select_id =     $res["dt1"][0].Acc_job_id  != null ? $res["dt1"][0].Acc_job_id  : '';  
 
                                $scope.account_PhoneNo  = $res["dt1"][0].PassengerId ;
                    
                                $scope.AmmountAddedvaluesend  = $res["dt1"][0].Recieve_payment ;
                                $scope.selectedcustomer = $res["dt1"][0].Passengers;
                                $scope.selectedbeg =  $res["dt1"][0].Bags;
                                $scope.selectedwheelchair = $res["dt1"][0].WheelChairs;
                                $scope.selectedcar = $res["dt1"][0].VehiclesReguired;
                    
                                if($res["dt1"][0].CornerAddress != ''){
                                    $scope.cornershow = true;
                           
                                }else{
                                    $scope.cornershow = false;
                             
                                }
                                $scope.cornerdata =   $res["dt1"][0].CornerAddress  != null ? $res["dt1"][0].CornerAddress  : '';  

                   
                                $.each( $scope.carlist, function( index, value ) {
                        

                                    if($res["dt1"][0].VehicleType == value ){
                                        $scope.selectedcartype = index;
                                    }
                                });
                     
                    
                                $scope.rideinfo = $res["dt1"][0].EntitiesDetails;
                                $scope.selectedtarrif = parseInt($res["dt1"][0].TarriffId);
                     
                                if ($res["dt1"][0].CustomeRate != "") {
                                    $scope.customeshow = 1;
                                    $scope.CustomeRate =  parseInt($res["dt1"][0].CustomeRate);
                      
                                }
                 
                                $("#ddlVehicleType").empty();
                                $("#ddlVehicleType").append("<option value='' selected='selected'>Vehicle</option>");
                                if ($res["dt1"][0].Urgent == "Yes") {
                       
                                    $scope.urgentdata  = true;
                                }
                                else {
                                    $scope.urgentdata  = false;
                        
                                }
                                $scope.noneed = 1;
                  

                    
                                if (parseInt($res["dt1"][0].Nextstop) > 0) {
                                    $scope.showstopshow = 1;
                                    $scope.stoplstshow = 1;
                                    $scope.stoplistarraynumber = parseInt($res["dt1"][0].Nextstop);    
                     
                                }else{
                                    $scope.showstopshow = 0;
                                    $scope.stoplstshow = 0;
                                }
                             
                                
                                $scope.LoginDriverdata.push( {  Id: $res["dt1"][0].DriverId ,
                                    UserFName : $res["dt1"][0].UserFName,
                                    UserLName :  $res["dt1"][0].UserLName, 
                                    VehicleNo : $res["dt1"][0].VehicleNo,
                                    VehicleId : $res['dt1'][0].vehicleid
                                });
                           
                                $scope.selecteddriver =  parseInt($res["dt1"][0].DriverId);
                                $scope.selecteddriverpre =  parseInt($res["dt1"][0].DriverId);
                                $scope.vehicleidpre =  $res["dt1"][0].vehicleid;
                                $scope.stoplistarray = [];
                                console.log($res["dt1"][0].nextstopdata);
                                if($res["dt1"][0].nextstopdata != null ){
                                    var stopdata1 =  $res["dt1"][0].nextstopdata.split('=');
                  
                                    for ($j = 0; $j <  parseInt($res["dt1"][0].Nextstop); $j++) {
                               
                                        $scope.stoplistarray.push({
                                            'id' : $j
                                        });

                                    }
                                }
                  
                                $.each(  $scope.stoplistarray , function( index, value ) {
                                    var stop22 =   stopdata1[index].split('@');
                                    $scope.stoplistarray[index].lat = stop22[0];
                                    $scope.stoplistarray[index].lng = stop22[1];
                                    $scope.stoplistarray[index].path = stop22[2];
                                    $scope.fata.push({
                                        lat:stop22[0],
                                        lng :stop22[1],
                                        path:stop22[2]
                                    })
                                  
                                });

                                if( $scope.dropupaddress != ''){
                                    $scope.changedroplat1z();
                                }else{
                                    $scope.setvalue(0);
                                }

                                $scope.showfirst2();
                                $scope.getjobs();
                            }
                        });
        
                    }


                    $scope.CancelJob = function(BookingId , U_id , zoneid , quenumber) {




                        if (confirm('Do you want to cancel the job?')) {
                            $("#Divo" + BookingId + "").remove();
                            var param = [{ "name": "BookingId", "Value": BookingId }];
                            var proc = '[CancelJobStatusFromJobList]';
                            Selector1(param, proc).then(function (result) {
                                if (result.d == "Session is experied, please login again") {
                       
                                    window.location.href = "DispatcherLogin.aspx?";
                                }
                                else {
                                    $res = JSON.parse(result.d);
                                    if ($res[0].Result != "Operation Not Successfully Performed") {
                                        $("#Divo" + BookingId + "").remove();
                                        if ($res[0].DriverId != "0") {

                                            FnCancelRide($res[0].DriverId, BookingId);
                                            FnMoveQueueNo1($res[0].DriverId,quenumber);
                                            angular.element(document.getElementById('myangular')).scope().AssignedJobs();
                                           }
                                        if(U_id == 'null' || U_id == ''){
                   
         
                                        }else{
                                            FnCancelRidez('234', BookingId, "Offered" , U_id);
                                        }
                           
                                        toastr["success"]( $res[0].Result, 'success!');
                                    }
                                    else {
                                        toastr["warning"]( $res[0].Result, 'warning!');
                                   
                                    }

                                }
                            });
                        }
                        else {

                        }
           
                    }
 
                    $scope.AssignedJobs( );
                    $scope.ActiveJobsdata();
                    $scope.UnAssignedJobsCancelng = function (BookingId, U_Id) {
                        $("#Divo" + BookingId + "").remove();
                        refreshjob = 0;
                        console.log(refreshjob);
                        if (confirm('Do you want to cancel the job? !')) {
              
                            $scope.param = [ { "name": "BookingId", "Value": BookingId }];
                            $scope.proc = "[CancelUnAssignedJobStatusFromJobList]";
                
                            $http({

                                method: "POST",

                                url: "DataManager/Data.aspx/DataProcessor",

                                data: {
                                    data: $scope.param,
                                    action: $scope.proc
                                }

                            }).then(function mySuccess(response) {
                                $("#Divo" + BookingId + "").remove();
                                $scope.getjobs();
                                if (U_Id == 'null' || U_Id == '') {


                                } else {
                                    FnCancelRidez('234', BookingId, "Offered", U_Id);
                                }
                   
                            }, function myError(response) {
                     
                            });

 
                        } else {
                            return "no";
                        }



             
                    }
                });
</script>


<script>
    function testingemail(){
        jQuery.ajax(
              {
                  type: "POST",
                  url: "default.aspx/SendEmail",
                  data: JSON.stringify({
                      "Email":  'iffimalik66@gmail.com',
                      "CName":  'Invercargil',
                      "Body":    'tthis is email'
                  }),
                  dataType: "json",
                  contentType: "application/json; charset=utf-8",
                  cache: false,
                  success: function (response) {
                      console.log(response);
                      toastr["error"](     "Website Ride Was Cancel. Automatically!!  ", 'error!'); 
                  }
              }
              );
    }
    var refreshjob = 0;
    function showwxx(){
        //refreshjob = 1;

        //setTimeout(function(){ refreshjob = 0 ; }, 15000);
    
    }
   
     
    function FnNewMessage(DriverId, Message, DateTime) {


        if (someSession4 != null) {
            // A post entry.
            var postData = {
                bookingid: $("#lblName1").text() + "," + Message + "," + DateTime + "," + someSession4 + ",Dispatcher",
                content: "You have New Message",


            };

            firebase.database().ref().child("/chat/" + DriverId).remove();

            // Get a key for a new Post.
            var newPostKey = firebase.database().ref().child('chat').push().key;

            // Write the new post's data simultaneously in the posts list and the user's post list.
            var updates = {};
            updates['/chat/' + DriverId] = postData;
            // updates['/user-posts/' + uid + '/' + newPostKey] = postData;

            return firebase.database().ref().update(updates);
        }
        else {

        }
    }
    function seenall( ){
        var alldata =   document.getElementById('totalnoti').value ; 
        var res = alldata.split(",");
        console.log(res);
        for(var i = 0;  i < res.length; i++){
            if(res[i] != ''){
                Action([
                    { "name": "BookingId", "Value": res[i] }], "[UpdateAlarts]");
                $("#AlertDiv" + res[i] + "").remove();
                console.log(res[i]);
            }
        }
        $('#alertshow').hide();
    
    }
    function Alerts() {
        var jobColor;
        var param = [];
        var proc = 'RetrieveAlarts';
        Selector1(param, proc).then(function (result) {
            $("#alertshow").empty();
            $res = JSON.parse(result.d);
            var datax = ''
            for(var p = 0 ;  p < $res.length ; p++){
        
                datax += $res[p].Id+",";
            }
            document.getElementById('totalnoti').value = datax;
   

            if($res.length > 0){
                angular.element(document.getElementById('myangular')).scope().getjobs( );
            }
            document.getElementById("total_notification").innerHTML = $res.length;
            if ($res.length != []) {
                document.getElementById("total_notification").className = "button-glow2";
                if ($("#DispatchSounds").text() == "1") {

                    angular.element(document.getElementById('myangular')).scope().playAudio( );
                }
                $("#alertshow").empty();
                $("#alertshow").append('<button class="btn btn-success" onclick="seenall( )" >Seen All</button>');
                for ($i = 0; $i < $res.length; $i++) {
                    if ($res[$i].BookingStatus == "Cancel") {
                        jobColor = 'alert-box-title';
                    }
                    else {
                        jobColor = 'alert-box-title no-show';
                    }
                    $("#alertshow").append(
                         '<li id="AlertDiv' + $res[$i].Id + '" style="cursor:pointer;">'+
                                  '<div class="col-lg-12"   style="padding: 3px 4px; border-radius: 1px; border: 1px solid #80808054; margin-bottom: 4px; box-shadow: 1px 1px 1px 1px #8080804f; border-radius: 5px; padding: 1px; background: #9ad3d64f;">'+
                                       '<div class="row">'+
                                         '<div class="col-sm-12">'+
                                           '<div class="col-sm-12 >'+
                                                '<h5 class="' + jobColor + '" style="background: red;  padding: 7px; color: white; font-weight: 600;  border-radius: 5px;  text-align: center;  margin: 0px;  font-size: 16px;">Booking Ride  ' + $res[$i].Id + ' is ' + $res[$i].BookingStatus + '</h5>'+
                                           '</div>'+
                                            '<div class="col-sm-12 row" style="display:inline-flex; border-bottom: 1px solid #80808059;" >'+
                                           '<div class="col-lg-6" style="display:inline-flex;">'+
                                             '<label style="font-size: 13px; text-transform: initial;  margin: 0px; color: #28a0a1;  font-weight: 600;">Client:</label>'+
                                             '<h5  style="text-transform: capitalize;  margin: 0px; margin-left:10px; margin-top:3px;">' + $res[$i].PassengerId + '</h5>'+
                                           ' </div>'+
                                                '<div class="col-lg-6" style="display:inline-flex;">'+
                                               ' <label style="font-size: 13px; text-transform: initial;  margin: 0px; color: #28a0a1;  font-weight: 600;">Driver:</label>'+
                                             '<h5  style="text-transform: capitalize;  margin: 0px; margin-left:10px; margin-top:3px;">' + $res[$i].UserFName + ' ' + $res[$i].UserLName + '</h5>'+
                                           ' </div>'+
                                         '</div>'+
                                          ' <div class="col-sm-12" style="width: 304px; overflow: hidden;" >'+
                                           ' <label style="font-size: 13px; text-transform: initial;  margin: 0px; color: #28a0a1;  font-weight: 600;">From:</label></br>'+
                                            ' <span>' + $res[$i].PickAddress + '</span>'+
                                        ' </div>'+
                                          ' <div class="col-sm-12" style="width: 304px; overflow: hidden; border-bottom: 1px solid #80808059;" >'+
                                            '<label style="font-size: 13px; text-transform: initial;  margin: 0px; color: #28a0a1;  font-weight: 600;">To:</label></br>'+
                                            ' <span>' + $res[$i].DropAddress + '</span>'+
                                        ' </div>'+
                                            ' <div class="col-sm-12 row" style="display:inline-flex;" >'+
                                            '<div class="col-lg-6" style="display:inline-flex; padding: 0px;">'+
                                            '    <label style="font-size: 13px; text-transform: initial;  margin: 0px; color: #28a0a1;  font-weight: 600;">Vehicle:</label>'+
                                             '<h5  style="text-transform: capitalize;  margin: 0px; margin-left:10px; margin-top:3px;">' + $res[$i].VehicleNo + ',' + $res[$i].CallSign + '</h5>'+
                                           ' </div>'+
                                               ' <div class="col-lg-6" style="display:inline-flex;">'+
                                                '<button class="btn btn-success" onclick="UpdateAlerts(' + $res[$i].Id + ')" style="padding: 2px;  margin: 4px;  margin-top: 0px;">Seen Alert</button>'+
                                            '</div>'+
                                        ' </div>'+
                                        ' </div>'+
                                        '</div>'+
                                    ' </div>'+
                                 ' </li> '
                             );
                }
            }else{
                document.getElementById("total_notification").className = "";
                $("#alertshow").append(
                    '<li style="text-align: center; font-size: 18px; background: red; margin-top: 15px;  color: white;">'+
                    '<span>No Notification Found</span>'+
                    '</li>'
                  );
            }

        });
    }

    $("#btnNewAlarm").click(function () {
        SaveAlarm();
    });
    function UpdateAlerts(Id) {
        Action([
                   { "name": "BookingId", "Value": Id }], "[UpdateAlarts]");
        $("#AlertDiv" + Id + "").remove();
    }

    function Alarms() {
        var currentdate = new Date();
        var datetime = currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds();
        var param = [{ "name": "AlarmTime", "value": datetime }];
        var proc = 'RetrieveAlarms';
        Selector1(param, proc).then(function (result) {
            if (result.d == "Session is experied, please login again") {
                window.location.href = "DispatcherLogin.aspx?";
            }
            else {
                $res = JSON.parse(result.d);
                if ($res.length != []) {
                    if ($("#DispatchSounds").text() == "1") {
                        angular.element(document.getElementById('myangular')).scope().playAudio( );
                    }
                    $("#alarms .modal-alarm-box").empty();
                    for ($i = 0; $i < $res.length; $i++) {
                        $("#alarms .modal-alarm-box").append('<div id="AlarmDiv' + $res[$i].Id + '" style="cursor:pointer;background:#fff;" class="row">' +
                            '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                            '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                                '<p>Text</p>' +
                                                            '</div>' +
                                                            '<div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">' +
                                                                '<p class="txt-light">' + $res[$i].AlarmText + '</p>' +
                                                            '</div>' +

                                                        '</div>' +
                                                         '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                         '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                          '<p>Date</p>' +
                                                          '</div>' +
                                                          '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                            '<p class="txt-light">' + $res[$i].AlarmDate + '</p>' +
                                                        '</div>' +
                                                        '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                            '<p>Time</p>' +
                                                            '</div>' +
                                                      '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                '<p class="txt-light">' + $res[$i].AlarmTime + '</p>' +
                                                '</div>' +
                                                '</div>' +
                                                '<div class="col-lg-6 col-md-6 col-sm-6 col-xs-6">' +
                                                    '<button class="btn btn-main" onclick="UpdateAlarm(' + $res[$i].Id + ')">Disable Alarm</button>' +
                                                '</div>' +
                                            '</div>' +
                                         '<hr>');
                    }
                    $("#alarms").modal();
                }
            }
        });

    }

    function UpdateAlarm(ele) {
        Action([ { "name": "Id", "Value": ele }], "[UpdateAlarm]");
        $("#AlarmDiv" + ele + "").remove();
    }
    function SaveAlarm() {

        Action([ { "name": "AlarmText", "Value": $("#AlarmText").val() },
                 { "name": "Time", "Value": $("#AlarmTime").val() },
                 { "name": "Date", "Value": $("#AlarmDate").val() }, ], "[InsertAlarm]");
        $("#AlarmText").val('');
    }
    function AllAlarm() {
        var param = [];
        var proc = 'AllAlarms';
        Selector1(param, proc).then(function (result) {
            if (result.d == "Session is experied, please login again") {
                alert(result.d);
                window.location.href = "DispatcherLogin.aspx?";
            }
            else {
                $res = JSON.parse(result.d);
                if ($res.length != []) {
                    if ($("#DispatchSounds").text() == "1") {

                        angular.element(document.getElementById('myangular')).scope().playAudio( );
                    }
                    $("#alarms .modal-alarm-box").empty();
                    for ($i = 0; $i < $res.length; $i++) {
                        $("#alarms .modal-alarm-box").append('<div style="cursor:pointer;background:#fff;" class="row">' +
                            '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                            '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                                '<p>Text</p>' +
                                                            '</div>' +
                                                            '<div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">' +
                                                                '<p class="txt-light">' + $res[$i].AlarmText + '</p>' +
                                                            '</div>' +

                                                        '</div>' +
                                                         '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                          '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                          '<p>Date</p>' +
                                                          '</div>' +
                                                          '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                            '<p class="txt-light">' + $res[$i].AlarmDate + '</p>' +
                                                        '</div>' +
                                                        '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                            '<p>Time</p>' +
                                                            '</div>' +
                                                       '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                '<p class="txt-light">' + $res[$i].AlarmTime + '</p>' +
                                                '</div>' +
                                                 '</div>' +
                                                  '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                            '<p>Status</p>' +
                                                            '</div>' +
                                                       '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                '<p class="txt-light">' + $res[$i].Status + '</p>' +
                                                '</div>' +
                                                 '</div>' +
                                            '</div>' +

                                            '<hr>');
                    }
                    $("#alarms").modal();
                }
            }
        });
    }
    function FnEmergency(DriverId, DriverName, Lat, Lng, Vehicle, Time) {
      
 
     
        Addmanager([
                 { "name": "DriverId", "Value": DriverId},
                 { "name": "DriverName", "Value": DriverName},
                 { "name": "Lat", "Value": Lat},
                 { "name": "Lng", "Value": Lng},
                 { "name": "Vehicle", "Value": Vehicle},
                 { "name": "Time", "Value": Time}
        ], "[storeemergency]").then(function (result) {
        
        });
        
        $("#Emergency .modal-alert-box").empty();
        $("#Emergency .modal-alert-box").append('<div  style="cursor:pointer;"><div  class="alert-box-title no-show>' +
                           '<ul class="list-inline">' +
                               '<li>Emergency</li>' +

                           '</ul>' +
                       '</div>' +
                       '<div class="alert-box-desc">' +
                           '<div class="row">' +
                               '<div class="col-lg-2 col-md-2">' +
                                   '<p>Driver: </p>' +
                               '</div>' +
                               '<div class="col-lg-10">' +
                               ' <p>' + DriverName + '</p>' +
                               '</div>' +
                           '</div>' +
                           '<div class="row">' +
                               '<div class="col-lg-2 col-md-2">' +
                                   '<p>Vehicle: </p>' +
                               '</div>' +
                               '<div class="col-lg-10 col-md-10">' +
                                   '<p>' + Vehicle + '</p>' +
                               '</div>' +
                           '</div>' +
                           '<div class="row">' +
                               '<div class="col-lg-2 col-md-2">' +
                                   '<p>Date Time: </p>' +
                               '</div>' +
                               '<div class="col-lg-10 col-md-10">' +
                                   '<p>' + Time + '</p>' +
                               '</div>' +
                           '</div>' +
                         '<div class="row">' +
                               '<div class="col-lg-2 col-md-2">' +
                                   '<p>Location: </p>' +
                               '</div>' +
                               '<div class="col-lg-10 col-md-10">' +
                                   '<p>' + Lat + "," + Lng + '</p>' +
                               '</div>' +
                           '</div>' +

                               '<div class="row">' +
                               '<button class="btn btn-success" onclick="UpdateEmergency(' + DriverId + ')">Seen Emergency</button>' +
                               '<button class="btn btn-success" onclick="FnFindMyVehicle2(' + DriverId + ')">Find Location</button>' +
                               '</div></div>');
        angular.element(document.getElementById('myangular')).scope().playAudio( );
        $("#Emergency").modal();


    }

    function FnFindMyVehicle2(driverid) {

        ref.once('value', function (snapshot) {

            snapshot.forEach(function (childsnapshot) {
                var key1 = childsnapshot.key;
                childsnapshot.forEach(function (childsnapshot1) {
               
                    if (key1 == driverid) {
                        var FBResult1 = childsnapshot1.val();
                        var VehicleLat = parseFloat(childsnapshot1.val().lat);
                        var VehicleLng = parseFloat(childsnapshot1.val().lng);

                        var VehicleLocation1 = new google.maps.LatLng(VehicleLat, VehicleLng);
                        map.setCenter(VehicleLocation1);
                        map.setZoom(15);
                   
                    }
                });
            });
        });



    }
    function UpdateEmergency(DriverId) {

        var desertRef1 = firebase.database().ref().child("/Emergency/" + SomeSession2 + "/" + DriverId).remove();

        $("#Emergency").modal('hide');

    }
    //$('#showAllArlams').on('change', ':checkbox', function () {
    //    alert("asdasd");
    //    if ($("#showAllArlams").is(":checked")) {
    //        AllAlarm();
    //    }
    //    else {
    //        Alarms();
    //    }
    //});
     
    //set initial state.
        
    $('#showAllArlams').change(function() {
       
        if(this.checked) {
            AllAlarm();
        }else{
            Alarms();
        }
                    
    });
    function getapprovalall(){
        var proc = 'ACC_All_approval';
        getmanager([], proc).then(function (result) {
    
            $res = JSON.parse(result.d);
            var items = $res;
            var datasetx = [];
        
            for ($i = 0; $i < items.length; $i++) {
                var datas = [];
                var d = new Date();
                var x = d.getFullYear()+"-";
                var check = d.getMonth() + 1;
                var  y =    d.getMonth() + 1 +"-";
                if(check < 10){
                    var yy = "0"+y;
                }else{
                    var yy = y;
                }
                var z   = d.getDate();
                var todaydate = x+yy+z;
            
                var CDate = new Date(todaydate);
                var CDate1 = new Date(items[$i].trip_to_date);
                var statuss = '';
                var color  = '';
                if(CDate > CDate1){
                    statuss = "expire";
                    color= "red";
                }else{
                    statuss = "Continues";
                    color= "green";
                }

                datas.push("<span style='    width: 119px;  position: absolute;  overflow: hidden;'>"+ items[$i].acc_id+"</span>");
                datas.push("<span style='    width: 119px;  position: absolute;  overflow: hidden;'>"+ items[$i].manager_name+"</span>");
                datas.push("<span style='    width: 119px;  position: absolute;  overflow: hidden;'>"+ items[$i].client_name+"</span>");
                datas.push("<span>"+ items[$i].claim_number+"</span>");
                datas.push("<span>"+ items[$i].trip_from_date+"</span>");
                datas.push("<span>"+ items[$i].trip_to_date+"</span>");
                datas.push("<span>"+ items[$i].trip_days_approved+"/"+items[$i].trip_days_left +"</span>");
                datas.push("<span style='width: 199px; display: table-caption;  overflow: auto;'>"+ items[$i].trip_description+"</span>");
                datas.push("<span style='color:"+ color +"'>"+ statuss +"</span>");
                datas.push("<button class='btn btn-warning' onclick='editapprove("+ items[$i].id +")'>Edit</button>");

                datasetx.push(datas);
            }

            var tabless =  $('#approvaltable').DataTable({
                data: datasetx,
                columns: [
                    { title: "ACC_ID" },
                    { title: "Manager Name" },
                    { title: "Client Name" },
                    { title: "Claim Number" },
                    { title: "Trip From" },
                    { title: "Trip To" },
                    { title: "T/ R Trip" },
                    { title: "Trip Detail" },
                    { title: "Trip Status" },
                    {title : "Edit/Update"}
                ],
                dom: 'Bfrtip',
                buttons: [
                    'copy', 'csv', 'pdf', 'print'
                ],
                destroy: true,
           
            });

        });

    }

    function getmanagerlist(){
        var proc = 'Manager_ACC_GET';
        getmanager([], proc).then(function (result) {
            $res = JSON.parse(result.d);
            var items = $res;
       
            $("#selectmanager").empty();
            $("#allmanager_list").empty();
            $("#approvealmanager").empty();
            $("#approvealmanager").append("<option >Select Manager</option>");

            $("#selectmanager").append("<option >Select Manager</option>");
            for(var x = 0; x < items.length; x++){
          
        
                $("#selectmanager").append("<option value=" + items[x].id + ">" + items[x].manager_name+ "/"+ items[x].manager_branch_code + "</option>");
                $("#allmanager_list").append("<option value=" + items[x].id + ">" + items[x].manager_name+ "/"+ items[x].manager_branch_code + "</option>");
                $("#approvealmanager").append("<option value=" + items[x].id + ">" + items[x].manager_name+ "/"+ items[x].manager_branch_code + "</option>");

            } 

        });

    }
    function getclientlist(value){

        var params = [
                 { "name": "manager_id", "Value": value},
        ];

        var proc = 'Client_ACC_GET';getapprovalall()
        getmanager(params, proc).then(function (result) {
            $res = JSON.parse(result.d);
            var items = $res;
            $("#selected_clients").empty();
            if(items.length == 0){
                $("#selected_clients").append("<option>No Client Found</option>");

            }else{
                $("#selected_clients").append("<option>Choose Client</option>");
                for(var x = 0; x < items.length; x++){
           
                    $("#selected_clients").append("<option  data-toggle='collapse' data-target='#addapprovesz' value=" + items[x].id + ">" + items[x].client_name + "</option>");
         
                } 
            }        
       

        });

    }
    function Approve_ACC_GET(value){

        var params = [
                 { "name": "id", "Value": value},
        ];
        var proc = 'Approve_ACC_GET';
        getmanager(params, proc).then(function (result) {
            $res = JSON.parse(result.d);
            var items = $res;
            console.log(items);
            $('#acc').modal('hide');
            $('#updateapproval').modal('show');
             
            $('#upmanagername').text(items[0]['manager_name']);
            $('#upemail').text(items[0]['manager_email']);
            $('#upphone').text(items[0]['manager_phone']);
            $('#upclientname').text(items[0]['client_name']);
            $('#upcemail').text(items[0]['registration_date']);
            $('#upcphone').text(items[0]['client_phone']);


            $('#approvalupid').val(items[0]['id']);
            $('#upacc_id').val(items[0]['acc_id']);
            $('#upclaimnum').val(items[0]['claim_number']);
            $('#uppurhcase').val(items[0]['purchase_order_number']);
            $('#upClient_Code').val(items[0]['client_services_code']);
            $('#upfrom').val(items[0]['trip_from_date']);
            $('#upto').val(items[0]['trip_to_date']);
            $('#uprotestatus').val(items[0]['trip_status']);
            $('#upqty').val(items[0]['trip_days_approved']);
            $('#servicedisp').val(items[0]['trip_description']);
            
        });

    }

    function getclientall(){
        var proc = 'Client_ACC_ALL';
        getmanager([], proc).then(function (result) {
            $res = JSON.parse(result.d);
            var items = $res;
            $("#added_client_list").empty();

            for(var x = 0; x < items.length; x++){
         
                $("#added_client_list").append("<option value=" + items[x].id + ">" + items[x].client_name + '( '+items[x].manager_name + ' )' + "</option>");

            } 

        });

    }
    function updateclientrideapproval(){
        var approvalid = document.getElementById('approvalupid').value ;
        var client_ACCID = document.getElementById('upacc_id').value ;
        var client_Service_code = document.getElementById('upClient_Code').value ;
        var client_Route_Status = document.getElementById('uprotestatus').value ;
        var client_trip_from_Date = document.getElementById('upfrom').value ;
        var client_trip_allowed = document.getElementById('upqty').value ;
        var client_purchase_order_number = document.getElementById('uppurhcase').value ;
        var client_trip_to_Date = document.getElementById('upto').value ;
        var client_Service_description = document.getElementById('servicedisp').value ;
        var client_Claim = document.getElementById('upclaimnum').value ;
  
        var param = [
            { "name": "id", "Value":  approvalid },
            { "name": "acc_id", "Value":  client_ACCID },
            { "name": "claim_number", "Value": client_Claim},
            { "name": "purchase_order_number", "Value": client_purchase_order_number},
            { "name": "client_services_code", "Value": client_Service_code},
            { "name": "trip_from_date", "Value": client_trip_from_Date},
            { "name": "trip_to_date", "Value": client_trip_to_Date},
            { "name": "trip_status", "Value": client_Route_Status},
            { "name": "trip_days_approved", "Value": client_trip_allowed},
            { "name": "trip_description", "Value": client_Service_description} 
        ];
        var proc = 'ACC_Approval_update';
        Addmanager(param, proc).then(function (result) {
        
            if (result.d == "Approval successfully Saved") {
                
                toastr["success"](    "Client successfully Save" , 'success!');
                document.getElementById('approvalid').value = "";
                document.getElementById('client_ACCID').value = "" ;
                document.getElementById('client_Claim').value = "" ;
                document.getElementById('client_purchase_order_number').value = "" ;
                document.getElementById('client_Service_code').value = "" ;
                document.getElementById('client_trip_from_Date').value = "" ;
                document.getElementById('client_trip_to_Date').value = "" ;
                document.getElementById('client_Route_Status').value = "" ;
                document.getElementById('client_trip_allowed').value = "" ;
                document.getElementById('client_Service_description').value = "" ; 
                getapprovalall();
            }else if(result.d == "Approval successfully update"){
              
                toastr["success"](  "Client successfully update", 'success!');
                $('#acc').modal('show');
                $('#updateapproval').modal('hide');
                getapprovalall();
            }
            else if (result.d == "Approval not successfully update") {
               
                
                toastr["error"](  "Approval not successfully update", 'error!');
            }
            else if (result.d == "Approval not successfully Saved") {
               
         
                toastr["error"](  "Approval not successfully Saved", 'error!');
            }else {
                toastr["error"](  "Approval not successfully Saved", 'error!');

            }
    

        });
    


    }

    function addclientrideapproval(){
    
        var approvalid = document.getElementById('approvalid').value ;
        var client_ACCID = document.getElementById('client_ACCID').value ;
        var client_Service_code = document.getElementById('client_Service_code').value ;
        var client_Route_Status = document.getElementById('client_Route_Status').value ;
        var client_trip_from_Date = document.getElementById('client_trip_from_Date').value ;
        var client_trip_allowed = document.getElementById('client_trip_allowed').value ;
        var client_purchase_order_number = document.getElementById('client_purchase_order_number').value ;
        var client_trip_to_Date = document.getElementById('client_trip_to_Date').value ;
        var client_Service_description = document.getElementById('client_Service_description').value ;
        var client_Claim = document.getElementById('client_Claim').value ;
        var manager_id = document.getElementById('approvealmanager').value ;
        var client_id = document.getElementById('selected_clients').value ;
  
        if(approvalid == "" || approvalid == null){

            if(client_Route_Status == "One Way"){

            }else{
                client_trip_allowed = client_trip_allowed * 2;
            }

            var param = [
              { "name": "manager_id", "Value": manager_id },
              { "name": "client_id", "Value": client_id },
              { "name": "acc_id", "Value":  client_ACCID },
              { "name": "claim_number", "Value": client_Claim},
              { "name": "purchase_order_number", "Value": client_purchase_order_number},
              { "name": "client_services_code", "Value": client_Service_code},
              { "name": "trip_from_date", "Value": client_trip_from_Date},
              { "name": "trip_to_date", "Value": client_trip_to_Date},
              { "name": "trip_status", "Value": client_Route_Status},
              { "name": "trip_days_approved", "Value": client_trip_allowed},
              { "name": "trip_description", "Value": client_Service_description} 
            ];
            var proc = 'ACC_Approval_add';
        }else{
            var param = [
               { "name": "id", "Value":  approvalid },
               { "name": "acc_id", "Value":  client_ACCID },
               { "name": "claim_number", "Value": client_Claim},
               { "name": "purchase_order_number", "Value": client_purchase_order_number},
               { "name": "client_services_code", "Value": client_Service_code},
               { "name": "trip_from_date", "Value": client_trip_from_Date},
               { "name": "trip_to_date", "Value": client_trip_to_Date},
               { "name": "trip_status", "Value": client_Route_Status},
               { "name": "trip_days_approved", "Value": client_trip_allowed},
               { "name": "trip_description", "Value": client_Service_description} 
            ];
            var proc = 'ACC_Approval_update';
        }
    
        Addmanager(param, proc).then(function (result) {
       
            if (result.d == "Approval successfully Saved") {
             
                toastr["success"](  "Client   successfully Saved", 'success!');

                document.getElementById('approvalid').value = "";
                document.getElementById('client_ACCID').value = "" ;
                document.getElementById('client_Claim').value = "" ;
                document.getElementById('client_purchase_order_number').value = "" ;
                document.getElementById('client_Service_code').value = "" ;
                document.getElementById('client_trip_from_Date').value = "" ;
                document.getElementById('client_trip_to_Date').value = "" ;
                document.getElementById('client_Route_Status').value = "" ;
                document.getElementById('client_trip_allowed').value = "" ;
                document.getElementById('client_Service_description').value = "" ; 
                getapprovalall();
                getmanagerlist();
            }else if(result.d == "Approval successfully update"){
                toastr["success"](  "Client   successfully update", 'success!');
                document.getElementById('approvalid').value = "";
                document.getElementById('client_ACCID').value = "" ;
                document.getElementById('client_Claim').value = "" ;
                document.getElementById('client_purchase_order_number').value = "" ;
                document.getElementById('client_Service_code').value = "" ;
                document.getElementById('client_trip_from_Date').value = "" ;
                document.getElementById('client_trip_to_Date').value = "" ;
                document.getElementById('client_Route_Status').value = "" ;
                document.getElementById('client_trip_allowed').value = "" ;
                document.getElementById('client_Service_description').value = "" ; 

            }
            else if (result.d == "Approval not successfully update") {
               
            
                toastr["error"](  "Approval not successfully update", 'error!');
            }
            else if (result.d == "Approval not successfully Saved") {
               
            
                toastr["error"](  "Approval not successfully Saved", 'error!');
            }else {
                toastr["error"](  "Approval not successfully Saved", 'error!');
            }
    

        });
    }
    function clearapproval(){
        document.getElementById('approvalid').value = "";
        document.getElementById('client_ACCID').value = "" ;
        document.getElementById('client_Claim').value = "" ;
        document.getElementById('client_purchase_order_number').value = "" ;
        document.getElementById('client_Service_code').value = "" ;
        document.getElementById('client_trip_from_Date').value = "" ;
        document.getElementById('client_trip_to_Date').value = "" ;
        document.getElementById('client_Route_Status').value = "" ;
        document.getElementById('client_trip_allowed').value = "" ;
        document.getElementById('client_Service_description').value = "" ; 
    }
    function addclient(){
  
        var selectmanager = document.getElementById('selectmanager').value ;
        var client_name =  document.getElementById('client_name').value;
        var client_registration_Date =  document.getElementById('client_registration_Date').value;
        var client_address =  document.getElementById('client_address').value;
        var client_phone =  document.getElementById('client_phone').value;
        var param = [{ "name": "manager_id", "Value": selectmanager},
            { "name": "client_name", "Value": client_name },
            { "name": "registration_date", "Value": client_registration_Date },
            { "name": "client_address", "Value":  client_address },
            { "name": "client_phone", "Value": client_phone}
               
        ];
        var proc = 'Client_ACC_ADD';
        console.log(proc);
    
        Addmanager(param, proc).then(function (result) {
       
            if (result.d == "Client successfully Saved") {
  
                Swal.fire(
                  'Good job!',
                  "Client successfully Saved",
                  'success'
                )
                toastr["success"](   "Client successfully Saved", 'success!');
                document.getElementById('client_name').value = "" ;
                document.getElementById('client_address').value = "" ;
                document.getElementById('client_phone').value = "" ;
                getclientall();
                getmanagerlist(); 
            }
            else if (result.d == "Client not successfully Saved") {
               
            
                toastr["error"]("Client not successfully Saved", 'error!');
            } else {
                toastr["error"]("Client not successfully Saved", 'error!');
            }
    

        });
    }

    function addmanager(){
      
        var manager_name = document.getElementById('manager_name').value ;
        var mananger_po_box =  document.getElementById('mananger_po_box').value;
        var manager_branch_code =  document.getElementById('manager_branch_code').value;
        var manager_country =  document.getElementById('manager_country').value;
        var manager_email =  document.getElementById('manager_email').value;
        var manager_address =  document.getElementById('manager_address').value;
        var manager_phone =  document.getElementById('manager_phone').value;
        var manager_registration_date =  document.getElementById('manager_registration_date').value;
        var param = [{ "name": "manager_name", "Value": manager_name},
                   { "name": "manager_branch_code", "Value": manager_branch_code },
                   { "name": "manager_address", "Value":manager_address },
                   { "name": "po_box", "Value":  mananger_po_box },
                   { "name": "manager_country", "Value": manager_country},
                   { "name": "manager_phone", "Value":manager_phone },
                   { "name": "registration_date", "Value": manager_registration_date },
                   { "name": "manager_email", "Value":manager_email } 
        ];
        var proc = 'Manager_ACC_ADD';
        Addmanager(param, proc).then(function (result) {
       
            if (result.d == "Manager successfully Saved") {
  
                toastr["success"]("Client not successfully Saved", 'success!');
                document.getElementById('manager_name').value = "" ;
                document.getElementById('mananger_po_box').value  = "" ;
                document.getElementById('manager_branch_code').value = "" ;
                document.getElementById('manager_country').value = "" ;
                document.getElementById('manager_email').value = "" ;
                document.getElementById('manager_address').value = "" ;
                document.getElementById('manager_phone').value = "" ;
                document.getElementById('manager_registration_date').value = "" ;
                getmanagerlist();
            }
            else if (result.d == "Manager not successfully Saved") {
               
           
                toastr["error"]("Manager not successfully Saved", 'error!');
            } else {
                toastr["error"]("Manager not successfully Saved", 'error!');
            }
    

        });
    }
</script>
<script>
    function selectemc() {
        $('#clientadding').show(1000);

    }
    function refresshapprove() {
        getapprovalall();
    }

  
    $(document).ready(function () {
        //$(".chosen").chosen();
        getmanagerlist();
        getclientall();
        getapprovalall();
        $.validator.addMethod("regexx1", function (value, element, regexprz) {
            return regexprz.test(value);
        }, "No Spacing Allowed.");
        $('form[id="updateapproval"]').validate({
            rules: {
                upacc_id  :{
                    regexx1:  /^\S*$/,
                    required:true
                 },  
                upclaimnum: 'required',
                uppurhcase : 'required',
                upClient_Code : 'required',
                upfrom: 'required',
                upto: 'required',
                uprotestatus : 'required',
                upqty: 'required',
                servicedisp: 'required' 
                 
               
            },
            messages: {
                upacc_id   :{
                    required: 'This field is required'
                   
                        }  ,
                upclaimnum : 'This field is required',
                uppurhcase : 'This field is required',
                upClient_Code : 'This field is required',
                upfrom : 'This field is required',
                upto : 'This field is required',
                uprotestatus : 'This field is required',
                upqty : 'This field is required',
                servicedisp : 'This field is required' 
            },
            submitHandler: function (form) {
            
                updateclientrideapproval();

            }
        });
        $.validator.addMethod("regexx", function (value, element, regexprz) {
            return regexprz.test(value);
        }, "No Spacing Allowed.");
        $('form[id="add_approval_acc"]').validate({
            rules: {
                client_ACCID:{
                   regexx:  /^\S*$/,
                   required:true
                
                },
                client_Service_code: 'required',
                client_Route_Status: 'required',
                client_Claim: 'required',
                client_trip_from_Date: 'required',
                client_trip_allowed: 'required',
                client_purchase_order_number: 'required',
                client_trip_to_Date: 'required',
                client_Service_description: 'required' 
            },
            messages: {
                client_ACCID:{
                    required: 'This field is required'
                   
                }  ,
                client_Service_code: 'This field is required',
                client_Route_Status: 'This field is required',
                client_Claim: 'This field is required',
                client_trip_from_Date: 'This field is required',
                client_trip_allowed: 'This field is required',
                client_purchase_order_number: 'This field is required',
                client_trip_to_Date: 'This field is required',
                client_Service_description: 'This field is required'
                  
            },
            submitHandler: function (form) {
                 
                var selectedclient =  $("#selected_clients").val();
                   
                if (selectedclient == null || selectedclient == "No Client Found" || selectedclient == "Choose Client") {
                    
                    Swal.fire(
                    'Warning!',
                    "Please Select Manager And Client First. Then Add Approval",
                    'warning'
                  );
                } else {
                    //alert("Client Selected" + selectedclient);
                    addclientrideapproval();
                    $('#addapprovesz').hide(1000);
                    $('#selected_clientsz').hide(1000);
                }
                // addclientrideapproval();

            }
        });
        $('form[id="add_Client"]').validate({
            rules: {
                selectmanager: 'required',
                client_name: 'required',
                client_registration_Date: 'required',
                client_address: 'required',
                
                client_phone: {
                    required :true,
                    remote: function () {
                        var r = {
                            url: "DataManager/Data.aspx/DataProcessor22",
                            type: "POST",
                            contentType: "application/json; charset=utf-8",
                            dataType: "json",
                            data: "{'email': '" + $('#selectmanager').val() + "' , 'phone':'" + $('#client_phone').val() + "' , 'action' : 'checkpassengernumber' }",
                            dataFilter: function (data) {
                                return (JSON.parse(data)).d;
                            }
                        }
                        return r;
                    }

                } 
                  


                
            },
            messages: {
                selectmanager: 'This field is required',
                client_name: 'This field is required',
                client_registration_Date: 'This field is required',
                client_address: 'This field is required',
                client_phone: {
                    required: "This Field is reqired",
                    remote: "This Client is already Register under this manager"
                }
            },
            submitHandler: function (form) {
                $('#clientadding').hide(1000);
                addclient();
                  
            }
        });
        $.validator.addMethod("regex", function (value, element, regexpr) {
            return regexpr.test(value);
        }, "Please enter a valid Email.");

        $('form[id="add_manager"]').validate({
            rules: {
                manager_name: {
                    required: true,
                    remote: function () {
                        var r = {
                            url: "DataManager/Data.aspx/DataProcessor22",
                            type: "POST",
                            contentType: "application/json; charset=utf-8",
                            dataType: "json",
                            data: "{'email': '" + $('#manager_name').val() + "' , 'phone':'noting' , 'action' : 'checkmanagername' }",
                            dataFilter: function (data) {
                                return (JSON.parse(data)).d;
                            }
                        }
                        return r;
                    }
                },
                mananger_po_box: 'required',
                manager_registration_date: 'required',
                manager_branch_code: 'required',
                manager_country: 'required',
                manager_email: {
                    required: true,
                    regex: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                    remote: function () {
                        var r = {
                            url: "DataManager/Data.aspx/DataProcessor22",
                            type: "POST",
                            contentType: "application/json; charset=utf-8",
                            dataType: "json",
                            data: "{'email': '" + $('#manager_email').val() + "' , 'phone':'noting' , 'action' : 'checkmanageremail' }",
                            dataFilter: function (data) {
                                return (JSON.parse(data)).d;
                            }
                        }
                        return r;
                    }
                },
                manager_address: 'required',
                manager_phone: {
                    required: true,
                    remote: function () {
                        var r = {
                            url: "DataManager/Data.aspx/DataProcessor22",
                            type: "POST",
                            contentType: "application/json; charset=utf-8",
                            dataType: "json",
                            data: "{'email': '" + $('#manager_phone').val() + "' , 'phone':'noting' , 'action' : 'checkmanagerphone' }",
                            dataFilter: function (data) {
                                return (JSON.parse(data)).d;
                            }
                        }
                        return r;
                    }
                },
                manager_registration_date:'required'
            },
            messages: {
                manager_name:{
                    required: 'This field is required',
                    remote : 'This Manager Is Already Register In Your Company'
                },
                mananger_po_box: 'This field is required',
                manager_registration_date: 'This field is required',
                manager_branch_code: 'This field is required',
                manager_email:{
                    required: 'This field is required',
                    remote : 'This Manager Email Is Already Register In Your Company',
                },
                manager_country: 'This field is required',
                manager_address: 'This field is required',
                manager_phone:{
                    required: 'This field is required',
                    remote : 'This Manager Phone Is Already Register In Your Company'
                },
                manager_registration_date:'This field is required'
            },
            submitHandler: function (form) {
                addmanager();
            }
        });
    });
</script>

     <script>
         function tellc( ) {

             var added_client_list = document.getElementById('selectmanager').value;
                     
             getmanagerlist();
             getclientall();
             //getclientlist(value);

         }

         function getclient() {

             var manager_id = document.getElementById('approvealmanager').value;
             getclientlist(manager_id);
             $('#selected_clientsz').show(1000);
         }
         function selectedclientok() {
             $('#addapprovesz').show(1000);
         }
             </script>
        <script>
  
            function editapprove(value){
         
                Approve_ACC_GET(value);


            }
            $("#JobsSearch").click(function () {
                FnClosedJobs();

            });
            var table;
  
            function FnClosedJobs() {
       
                var param = [{ "name": "BookingStatus", "value": $("#SearchJobsStatus option:selected").val() }, { "name": "FromDate ", "value": $("#DateFrom").val() },
                { "name": "ToDate", "value": $("#DateTo").val() }, { "name": "VehicleId ", "value": $("#JobsSearchVehicle").val() },
                { "name": "DriverId", "value": $("#JobsSearchDriver").val() }];
     
     
                var proc = 'ClosedJobs';
                Selector(param, proc).then(function (result) {
                    if (result.d == "Session is experied, please login again") {
                        alert(result.d);
                        window.location.href = "DispatcherLogin.aspx?";
                    }
                    else {
    
                        $res = JSON.parse(result.d);
                        var datasetx = [];
             
                        for ($i = 0; $i < $res["dt1"].length; $i++) {
                            var datas = [];
                            $action =  "<span><i class='fa fa-search txt-theme' onclick='ShowJobDetails(" + $res["dt1"][$i].Id + ")'></i></span>";
                            datas.push($action);
                            $refresh = " <span><i class='fa fa-refresh txt-theme' onclick='RefreshJob(" + $res["dt1"][$i].Id + ")'></i></span>";
                            datas.push($refresh);
                            datas.push("<span>"+ $res["dt1"][$i].BookingDateTime+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].JobCompleteTime+"</span>");
                            datas.push("<div id='lessshow'  style='white-space: nowrap;  overflow: hidden;  text-overflow: ellipsis; width: 121px;'><span>"+$res["dt1"][$i].PickAddress+"</span></div>");
                            datas.push("<div id='lessshow' style='white-space: nowrap;  overflow: hidden;  text-overflow: ellipsis; width: 121px;'><span style='width:20px;'>"+$res["dt1"][$i].DropAddress+"</span></div>");
                            datas.push("<span>"+$res["dt1"][$i].Name+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].PhoneNo+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].VehicleNo+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].UserFName + $res["dt1"][$i].UserLName+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].BookingSource+"</span>");
                            datas.push("<span>"+$res["dt1"][$i].BookingStatus+"</span>");
                            datasetx.push(datas);
                        }
          
                        var tabless =  $('#tbleClosedJobs').DataTable({
                            data: datasetx,
                            columns: [
                                { title: "Show Jobs" },
                                { title: "Refresh" },
                                { title: "Filed" },
                                { title: "Closed" },
                                { title: "Pick up" },
                                { title: "Drop off" },
                                { title: "Passenger" },
                                { title: "Contact" },
                                { title: "Vehicle" },
                                { title: "Driver" },
                                { title: "Source" },
                                { title: "Reason" }
                            ],
                            dom: 'Bfrtip',
                            buttons: [
                                'copy', 'csv', 'pdf', 'print'
                            ],
                            destroy: true,
                            paging: true,
                            autoWidth: false
                      
                        });
             
                        $('#container').css( 'display', 'block' );
                        tabless.columns.adjust().draw();
               
                    }
                    $("#JobsSearchDriver").empty();
                    $("#JobsSearchDriver").append("<option value='' selected='selected'>All</option>");
                    for ($i = 0; $i < $res["dt2"].length; $i++) {
                        $("#JobsSearchDriver").append("<option value=" + $res["dt2"][$i].Id + ">" + $res["dt2"][$i].DriveName + "</option>");
                    }
                    $("#JobsSearchVehicle").empty();
                    $("#JobsSearchVehicle").append("<option value='' selected='selected'>All</option>");
                    for ($i = 0; $i < $res["dt3"].length; $i++) {
                        $("#JobsSearchVehicle").append("<option value=" + $res["dt3"][$i].Id + ">" + $res["dt3"][$i].VehicleNo + "</option>");
                    }

                });



            }


            function SearchJob() {
   
                if ($("#ddlSearchBy").val() == "All") {
        
                    //var Prc = '[SearchById]';
       
                    //angular.element(document.getElementById('myangular')).scope().JobByDetails( Prc);

                }
                else if ($("#ddlSearchBy").val() == "Number") {
                    var Prc = '[SearchById]';
                    angular.element(document.getElementById('myangular')).scope().JobByDetails(Prc );

                }
                else if ($("#ddlSearchBy").val() == "Name") {
                    var Prc = '[SearchJobByName]';
                    angular.element(document.getElementById('myangular')).scope().JobByDetails( Prc);

                }
                else if ($("#ddlSearchBy").val() == "PhoneNo") {
                    var Prc = '[SearchByPhoneNo]';
                    angular.element(document.getElementById('myangular')).scope().JobByDetails(Prc );

                }
                else if ($("#ddlSearchBy").val() == "After") {
                    var Prc = '[SearchByAfterDate]';
                    angular.element(document.getElementById('myangular')).scope().JobByDetails( Prc);

                }
                else if ($("#ddlSearchBy").val() == "Before") {
                    var Prc = '[SearchByBeforeDate]';
                    angular.element(document.getElementById('myangular')).scope().JobByDetails( Prc);

                }
                else if ($("#ddlSearchBy").val() == "Between") {
     
                    angular.element(document.getElementById('myangular')).scope().JobByBetweenDate( );

                }
            }
  

  
            function GeneratePDF() {

                var doc = new jsPDF();
                var specialElementHandlers = {
                    '#editor': function (element, renderer) {
                        return true;
                    }
                };
                doc.fromHTML($('#JobsDetailsSection').html(), 20, 20, {
                    'width': 170,
                    'elementHandlers': specialElementHandlers
                });
                doc.save('Job_Detatils.pdf');
            }
            function SearchCustomer() {
                var param = [{ "name": "SearchDetails", "value": $("#TxtCustomerSearch").val() }];
                var proc = 'SearchCustomerJob';
                Selector(param, proc).then(function (result) {
                    if (result.d == "Session is experied, please login again") {
                        alert(result.d);
                        window.location.href = "DispatcherLogin.aspx?";
                    }
                    else {
                        $res = JSON.parse(result.d);

                        $("#CustomerJobsDetails").empty();
                        if ($res["dt1"].length != []) {
                            $("#TxtCustomer").val($res["dt1"][0].Customer);
                            $("#ddlType").val($res["dt1"][0].Type);
                            $("#TxtAddress").val($res["dt1"][0].Address);
                            $("#TxtCustomerEmail").val($res["dt1"][0].Email);
                            $("#TxtCustomerInfo").val($res["dt1"][0].Info);
                            $("#ddlPaymentType").val($res["dt1"][0].PaymentType);
                            $("#TxtDriverDiscount").val($res["dt1"][0].DriverDiscount);
                            $("#TxtCompanyDiscount").val($res["dt1"][0].CompanyDiscount);

                            if ($res["dt1"][0].Status == "Active") {
                                $("#checkOption1").prop("checked", "checked");
                            }
                            else {
                                $("#checkOption1").prop("checked", "");
                            }
                            $("#TxtCustomerAccountId").val($res["dt1"][0].AccountId);
                            $("#TxtFName").val($res["dt1"][0].Name);
                            $("#TxtPhone").val($res["dt1"][0].PhoneNo);
                            $("#lblCustomerId").text($res["dt1"][0].Id);

                            $("#span0").text($res["dt1"][0].AccountId);
                            $("#span1").text($res["dt1"][0].Name);
                            $("#span2").text($res["dt1"][0].PhoneNo);
                            $("#PhoneNoJobs").text($res["dt1"][0].PhoneNo);
                        }
                        for ($i = 0; $i < $res["dt2"].length; $i++) {
                            $("#CustomerJobsDetails").append('<div style="cursor:pointer;background:#fff;" class="row" onclick="JobRestart(' + $res["dt2"][$i].Id + ')"> <div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                                '<p>Booking Date</p>' +
                                                                '<p class="txt-light">' + $res["dt2"][$i].BookingDateTime + '</p>' +
                                                            '</div>' +

                                                      '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                        '<p>Passenger Phone</p>' +
                                                    '<p class="txt-light">' + $res["dt2"][$i].PassengerId + '</p>' +
                                                     '</div>' +
                                                     '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                                '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                                    '<p>From</p>' +
                                                                '</div>' +
                                                                '<div class="col-lg-8 col-md-8 col-sm-8 col-xs-8">' +
                                                                    '<p class="txt-light">' + $res["dt2"][$i].PickAddress + '</p>' +
                                                                '</div>' +

                                                            '</div>' +
                                                             '<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
                                                                '<div class="col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
                                                                    '<p>To</p>' +
                                                                '</div>' +
                                                                '<div class="col-lg-8 col-md-8 col-sm-8 col-xs-8">' +
                                                                    '<p class="txt-light">' + $res["dt2"][$i].DropAddress + '</p>' +
                                                                '</div>' +

                                                            '</div>' +
                                                             '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                        '<p>Estimated Distance</p>' +
                                                    '<p class="txt-light">' + $res["dt2"][$i].EstimatedDistance + '</p>' +
                                                     '</div>' +
                                                      '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                        '<p>Estimated Time</p>' +
                                                    '<p class="txt-light">' + $res["dt2"][$i].EstimatedTime + '</p>' +
                                                     '</div>' +
                                                      '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4">' +
                                                        '<p>Info</p>' +
                                                    '<p class="txt-light">' + $res["dt2"][$i].EntitiesDetails + '</p>' +
                                                     '</div>' +
                                                            '</div><hr>');
                        }
                    }
                });
            }
            $("#ddlSearchBy").change(function () {

                var now = new Date();
 
                var day = ("0" + now.getDate()).slice(-2);
                var month = ("0" + (now.getMonth() + 1)).slice(-2);

                var today = now.getFullYear()+"-"+(month)+"-"+(day) ;


                if ($("#ddlSearchBy").val() == "All") {
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-8">' +
                                                    '<div class="form-group" id="SearchField">' +
                                                        '<input type="hidden" class="form-control" id="TxtSearch" value="All" placeholder="Search By Booking Id">' +
                                                       '</div>' +
                                                '</div>');

                }
                else  if ($("#ddlSearchBy").val() == "Number") {
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-8">' +
                                                    '<div class="form-group" id="SearchField">' +
                                                        '<input type="text" class="form-control" id="TxtSearch" placeholder="Search By Booking Id">' +
                                                       '</div>' +
                                                '</div>');

                }
                else if ($("#ddlSearchBy").val() == "Name") {
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-8">' +
                                                    '<div class="form-group" id="SearchField">' +
                                                        '<input type="text" class="form-control" id="TxtSearch" placeholder="Search By Passenger Name">' +
                                                       '</div>' +
                                                '</div>');
                }
                else if ($("#ddlSearchBy").val() == "PhoneNo") {
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-8">' +
                                                   '<div class="form-group" id="SearchField">' +
                                                       '<input type="text" class="form-control" id="TxtSearch" placeholder="Search By Passenger Phone">' +
                                                      '</div>' +
                                               '</div>');
                }
                else if ($("#ddlSearchBy").val() == "Between") {
          

                    $("#SearchFields").empty();
                    $("#SearchFields").append(' <div class="col-lg-6 col-md-6">' +

                                                    '<div class="form-group">' +
                                                        '<input type="date" id="TxtFrom"  class="form-control" value=' + OutPutDate + '>' +
                                                         '</div>' +
                                                '</div>' +
                                                '<div class="col-lg-6 col-md-6">' +
                                                    '<div class="form-group">' +
                                                        '<input type="date" id="TxtTo" class="form-control" value=' + OutPutDate + '>' +
                                                         '</div>' +
                                                '</div>');
                                                       
                    $('#TxtFrom').val(today);
                    $('#TxtTo').val(today);
   
                }
                else if ($("#ddlSearchBy").val() == "Before") {
            
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-">' +
                                                   '<div class="form-group" id="SearchField">' +
                                                       '<input type="date" class="form-control" id="TxtSearch" value=' + OutPutDate + '>' +
                                                      '</div>' +
                                               '</div>');
    
                    $('#TxtSearch').val(today);
                }
                else if ($("#ddlSearchBy").val() == "After") {
          
                    $("#SearchFields").empty();
                    $("#SearchFields").append('<div class="col-lg-8 col-md-8">' +
                                                   '<div class="form-group" id="SearchField">' +
                                                       '<input type="date" class="form-control" id="TxtSearch" value=' + OutPutDate + '>' +
                                                      '</div>' +
                                               '</div>');
                    $('#TxtSearch').val(today);
                }


     
  
            });

            $("#btnSearchJob").click(function () {
                SearchJob();
            });


            function ShowJobDetails(ele) {
                angular.element(document.getElementById('myangular')).scope().JobDetails( ele);

                $("#closed-jobs").modal('hide');
                $("#search-jobs").modal('show');
            }


            //FnClosedJobs();
</script>

<script>




    $(document).on('show.bs.modal','#largeModal', function () {
  
        $('#map').css({'z-index':'1000'});

      

    });
    $(document).on('hide.bs.modal','#largeModal', function () {
  
    
        
        $('#map').css({'z-index':'0'});
    });
    $(document).on('hide.bs.modal','#search-jobs', function () {
  
    
        if ( $('#shiftnew').children().length > 0 ) {
            $('#map').appendTo('.map-header');
        } 
     
        angular.element(document.getElementById('myangular')).scope().searchitemreset( );
        changerefresh();

    });
    $('body').click(function (event) 
    {
  


        if(!swal.isVisible()){
        if($('#largeModal').is(':visible')) {
           
            
            
            if (event.target.id == "largeModalcontet" || $(event.target).parents("#largeModalcontet").length || $(event.target).parents("#paymentmodel").length  ||   $(event.target).parents("#testingss").length  ||  $(event.target).parents("#searchdatas").length||  $(event.target).parents("#map").length) {
                 
            } else {
               
                if(document.getElementById('updatecancel').value != 0){
                    $('#largeModal').modal('hide');
                }else{
                    if($('#pac-input').val() != '' || $('#searchdatasx').val() || $('#phonenumbers').val() ){
                        myFunctioncancel();
                    }else{
                        $('#largeModal').modal('hide');
                    }
                }
              }
        }
        return;
    }

      
        
    });

    function myFunctioncancel() {
        var txt;
      
        Swal.fire({
            title: 'Are you sure?',
            text: "Leave the page or stay on the page! if you leave you'll lose all create job data",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            cancelButtonText: "Stay", 
            confirmButtonText: 'Yes Leave!'
        }).then((result) => {
           
            if (result.value) {
              
                $('#largeModal').modal('hide');
                angular.element(document.getElementById('myangular')).scope().clearsection( );
            }else{

            }
        })

        //var r = confirm("You Want to Close Job Create . you lose your data");
        //if (r == true) {
            
          
        //} else {
            

        //    $('#largeModal').modal('hide');
        //    angular.element(document.getElementById('myangular')).scope().clearsection( );

        //}
         
    }
</script>
<style>
    div#alertshow {
        overflow: scroll;
        height: 400px;
    }

    .error {
        color: red;
          width: 100%;
    }
    
    .icon {
        display: inline-block;
        width: 1em;
        height: 1em;
        stroke-width: 0;
        stroke: currentColor;
        fill: currentColor;
    }

    .icon-rd-car-2 {
        width: 0.5em;
    }
</style>

  
<style>
    .modal-header {
        background: #83e6a3;
    }

    .header-brand-img {
        width: 65px !important;
        /* height: auto; */
        vertical-align: middle;
        margin-top: 5px;
    }

    ul.nav.panel-tabs li {
        width: auto;
    }
</style>
 
<script src="https://cdn.datatables.net/1.10.21/js/jquery.dataTables.min.js"></script>

 <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA&libraries=places,geometry&callback=initMap"
            async defer></script> 
     <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js"></script> 
<script src="https://cdn.rawgit.com/googlemaps/v3-utility-library/master/markerwithlabel/src/markerwithlabel.js"></script>

  <script src="https://cdn.jsdelivr.net/jquery.validation/1.16.0/jquery.validate.min.js"></script>