import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const aspPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'taxitime.co.nz', 'Dispatchthree', 'Default.aspx');
let html = fs.readFileSync(aspPath, 'utf8');

const dyCard = `                                                <div class="tab-pane " id="tab8">
                                                    <div id="Divo{{value.Id}}" ng-if="true" ng-style="getCardStyle(value.Pickingtime || value.BookingDateTime, value.DispatchTimebefore)" class="col-sm-12 col-md-12 col-xl-12 bw-job-card {{ alerting(value.DispatchTimebefore, value.Pickingtime || value.BookingDateTime, value.BookingStatus) }}" ng-class="{'bw-card-alt': $odd, 'bw-svc-food': value.serviceType==='food', 'bw-svc-freight': value.serviceType==='freight', 'bw-svc-tm': value.serviceType==='tm', 'bw-urgent': value.Urgent==='Yes', 'bw-svc-rental': value.BookingSource==='Rental'}" id="singlediv-{{value.Id}}" ng-repeat="(key, value) in deliveryjobs">
                                                        <div class="bw-card-hd">
                                                            <span class="bw-jid"><i class="fa fa-hashtag"></i>{{value.Id}}</span>
                                                            <span class="bw-b" ng-style="{background: value.JobMins<=0 ? '#16a34a' : value.JobMins<=30 ? '#d97706' : '#2563eb', color:'#fff'}"><i class="fa fa-clock-o"></i> {{jobTypeLabel(value.JobMins, value.DispatchTimebefore)}}</span>
                                                            <span class="bw-b" style="background:#e0e7ff;color:#3730a3;font-size:11px;">{{datecreate(value.Pickingtime || value.BookingDateTime, value.DispatchTimebefore)}}</span>
                                                            <span ng-if="value.PaymentType === 'total_mobility'" class="bw-tm-badge">TM</span>
                                                            <span ng-if="value.serviceType && value.serviceType !== 'taxi'" class="bw-b" ng-style="{background: value.serviceType==='food'?'#16a34a':value.serviceType==='freight'?'#ea580c':'#7c3aed', color:'#fff'}">{{value.serviceType|uppercase}}</span>
                                                            <span ng-if="value.DispatchTimebefore > 0" class="bw-b" ng-style="{background: dispatchWindowOpen(value.DispatchTimebefore, value.BookingDateTime) ? '#dc2626' : '#6d28d9', color:'#fff'}"><i class="fa fa-send"></i> {{ dispatchAtLabel(value.BookingDateTime, value.DispatchTimebefore) }}</span>
                                                            <i ng-if="value.DropLatLng != '0,0'" ng-mouseover="showmakert(value.Id,value.PickLatLng,value.DropLatLng)" ng-mouseleave="markerremove(value.Id,value.PickLatLng,value.DropLatLng)" class="fa fa-compass" style="color:#e53e3e;font-size:17px;cursor:pointer;margin-left:auto;"></i>
                                                        </div>
                                                        <div class="bw-card-route">
                                                            <div class="bw-card-route-row">
                                                                <span class="bw-rdot bw-rdot-pick"></span>
                                                                <span class="bw-raddr">{{bwFormatAddress(value.PickAddress, 'Hail Pickup')}}</span>
                                                                <span class="bw-rmeta"><i class="fa fa-user"></i> {{value.passengername || value.Name || '—'}}</span>
                                                            </div>
                                                            <div class="bw-card-route-row" ng-if="value.DropAddress">
                                                                <span class="bw-rdot bw-rdot-drop"></span>
                                                                <span class="bw-raddr">{{value.DropAddress}}</span>
                                                                <span class="bw-rmeta" ng-if="value.PhoneNo"><i class="fa fa-phone"></i> {{value.PhoneNo}}</span>
                                                            </div>
                                                        </div>
                                                        <div class="bw-assign-row">
                                                            <span class="bw-b" style="background:#dc2626;color:#fff;font-weight:700;">{{value.BookingStatus}}</span>
                                                            <span class="bw-b" ng-style="{background: latealert(value.DispatchTimebefore, value.BookingDateTime) || '#475569', color:'#fff'}"><i class="fa fa-hourglass-half"></i> {{checklateornow(value.JobMins, value.DispatchTimebefore)}}</span>
                                                            <span class="bw-mc" ng-if="value.EntitiesDetails"><i class="fa fa-info-circle"></i>{{value.EntitiesDetails}}</span>
                                                            <span class="bw-mc" ng-if="value.DispatcherName"><i class="fa fa-headphones"></i>{{value.DispatcherName}}</span>
                                                            <span style="margin-left:auto;display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">
                                                                <select id="sax{{value.Id}}" class="form-control bw-spx-sel" style="max-width:130px;"><option value="0">Select Driver</option><option value="-1" data-is-noone="true">No One</option><option ng-repeat="drivi in driverdatarealx" value="{{drivi.Id}}">{{drivi.VehicleNo}}/{{drivi.VehicleName}}</option></select>
                                                                <span class="bw-b bw-send-pulse" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="bwConfirmCard('sax','pending',value.Id,value.VehicleId,value.DriverId,value.U_id)"><i class="fa fa-paper-plane"></i></span>
                                                                <span class="bw-ab bw-ab-del" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)"><i class="fa fa-times"></i></span>
                                                                <span class="bw-ab bw-ab-edit" ng-click="bwZoomPickup(value.PickLatLng)" title="Zoom map"><i class="fa fa-map-marker"></i></span></span>
                                                        </div>
                                                    </div>
                                                </div>`;

const tab8Start = html.indexOf('<div class="tab-pane " id="tab8">');
const tab8EndMarker = '<div style="padding: 0px;" class="row col-sm-12 col-md-6 col-lg-6 col-xs-12">';
const tab8End = html.indexOf(tab8EndMarker, tab8Start);
if (tab8Start >= 0 && tab8End > tab8Start) {
  const chunk = html.slice(tab8Start, tab8End);
  const closeIdx = chunk.lastIndexOf('                                                </div>');
  if (closeIdx > 0) {
    html = html.slice(0, tab8Start) + dyCard + html.slice(tab8Start + closeIdx + '                                                </div>'.length);
    console.log('OK: Tab8 DY bw cards');
  }
} else {
  console.warn('SKIP: tab8');
}

const searchStart = html.indexOf('<!-- RIGHT: Job Details -->');
const searchEnd = html.indexOf('<div class="modal fade" id="closed-jobs">', searchStart);
if (searchStart >= 0 && searchEnd > searchStart) {
  const before = html.lastIndexOf('<div style="flex:1;', searchStart);
  const panelStart = before >= searchStart - 200 ? before : searchStart;
  html = html.slice(0, panelStart) + `                    <div style="flex:1;padding:24px;background:#fff;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px;text-align:center;">
                        <div><i class="fa fa-info-circle" style="font-size:28px;color:#dfba5f;display:block;margin-bottom:10px;"></i>Click a result to open the job detail popup.<br><span style="font-size:12px;color:#94a3b8;">Legacy inline detail panel removed.</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    ` + html.slice(searchEnd);
  console.log('OK: Search jobs right panel removed');
}

html = html.replace(
  /<div class="modal-body modal-alarm-box" style="height:300px; overflow-y:auto; padding:12px 16px; background:#f9fafb;">\s*<\/div>/,
  `<div class="modal-body" style="height:300px; overflow-y:auto; padding:12px 16px; background:#f9fafb;">
                    <div ng-if="!(bwAlarmList && bwAlarmList.length)" style="text-align:center;color:#94a3b8;padding:24px;">No alarms due right now.</div>
                    <div ng-repeat="alm in bwAlarmList track by alm.Id" id="AlarmDiv{{alm.Id}}" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                        <div style="font-size:13px;color:#334155;margin-bottom:6px;">{{alm.AlarmText}}</div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:8px;"><i class="fa fa-calendar"></i> {{alm.AlarmDate}} &nbsp; <i class="fa fa-clock-o"></i> {{alm.displayTime || alm.AlarmTime}}</div>
                        <button class="btn btn-sm btn-warning" ng-click="bwDisableAlarm(alm.Id)" style="font-weight:600;">Disable</button>
                    </div>
                </div>`
);
console.log('OK: Alarms modal template');

const alarmHelpers = `    function bwNowAlarmParam() {
        var d = new Date();
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
            p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function bwApplyAlarmList(rows, playSound) {
        var sc = angular.element(document.getElementById('myangular')).scope();
        if (!sc) return;
        var list = (rows || []).map(function (r) {
            var copy = {};
            for (var k in r) { if (Object.prototype.hasOwnProperty.call(r, k)) copy[k] = r[k]; }
            copy.displayTime = (window.bwAlarmIncludesDate ? window.bwAlarmIncludesDate(r.AlarmTime) : r.AlarmTime);
            return copy;
        });
        var _apply = function () { sc.bwAlarmList = list; };
        if (!sc.$$phase) { sc.$apply(_apply); } else { _apply(); }
        if (list.length > 0) {
            if (playSound && $("#DispatchSounds").text() == "1" && typeof sc.playAudio === 'function') {
                sc.playAudio();
            }
            $("#alarms").modal();
        }
    }

`;

if (!html.includes('function bwApplyAlarmList')) {
  html = html.replace('    function Alarms() {', alarmHelpers + '    function Alarms() {');
}

html = html.replace(
  /function Alarms\(\) \{\s*var currentdate = new Date\(\);\s*var datetime = currentdate\.getHours\(\)[^}]+\}\);[\s\S]*?\n    \}/,
  `function Alarms() {
        var param = [{ "name": "AlarmTime", "value": bwNowAlarmParam() }];
        var proc = 'RetrieveAlarms';
        Selector1(param, proc).then(function (result) {
            if (result.d == "Session is experied, please login again") {
                window.location.href = "DispatcherLogin.aspx?";
            } else {
                $res = JSON.parse(result.d);
                bwApplyAlarmList($res, true);
            }
        });
    }`
);

html = html.replace(
  /function AllAlarm\(\) \{[\s\S]*?\n    \}\n    function FnEmergency/,
  `function AllAlarm() {
        var param = [];
        var proc = 'AllAlarms';
        Selector1(param, proc).then(function (result) {
            if (result.d == "Session is experied, please login again") {
                alert(result.d);
                window.location.href = "DispatcherLogin.aspx?";
            } else {
                $res = JSON.parse(result.d);
                bwApplyAlarmList($res, true);
            }
        });
    }
    function FnEmergency`
);

html = html.replace(
  `    function UpdateAlarm(ele) {
        Action([ { "name": "Id", "Value": ele }], "[UpdateAlarm]");
        $("#AlarmDiv" + ele + "").remove();
    }`,
  `    function UpdateAlarm(ele) {
        var sc = angular.element(document.getElementById('myangular')).scope();
        if (sc && typeof sc.bwDisableAlarm === 'function') {
            sc.bwDisableAlarm(ele);
            return;
        }
        Action([ { "name": "Id", "Value": ele }], "[UpdateAlarm]");
        $("#AlarmDiv" + ele + "").remove();
    }`
);

if (!html.includes("$('#bw-closed-empty').show()")) {
  html = html.replace(
    '                        var tabless =  $(\'#tbleClosedJobs\').DataTable({',
    `                        if (datasetx.length === 0) {
                            $('#bw-closed-empty').show();
                            $('#tbleClosedJobs').hide();
                            if ($.fn.DataTable.isDataTable('#tbleClosedJobs')) {
                                $('#tbleClosedJobs').DataTable().clear().destroy();
                            }
                            return;
                        }
                        $('#bw-closed-empty').hide();
                        $('#tbleClosedJobs').show();
                        var tabless =  $('#tbleClosedJobs').DataTable({`
  );
  console.log('OK: Closed jobs empty state');
}

fs.writeFileSync(aspPath, html, 'utf8');
console.log('Patch complete');
