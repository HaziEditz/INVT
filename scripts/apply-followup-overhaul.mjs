import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const aspPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'taxitime.co.nz', 'Dispatchthree', 'Default.aspx');
let html = fs.readFileSync(aspPath, 'utf8');

function between(startMarker, endMarker) {
  const i0 = html.indexOf(startMarker);
  const i1 = html.indexOf(endMarker, i0 + startMarker.length);
  if (i0 < 0 || i1 < 0) return null;
  return { i0, i1, end: i1 + endMarker.length };
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const span = between(startMarker, endMarker);
  if (!span) {
    console.warn('SKIP:', label);
    return false;
  }
  html = html.slice(0, span.i0) + replacement + html.slice(span.i1);
  console.log('OK:', label);
  return true;
}

const BW_CARD = (varName, actionsHtml, extraNgIf) => `
                                                    <div id="Divo{{${varName}.Id}}" ng-if="${extraNgIf || 'true'}" ng-style="getCardStyle(${varName}.Pickingtime || ${varName}.BookingDateTime, ${varName}.DispatchTimebefore)" class="col-sm-12 col-md-12 col-xl-12 bw-job-card {{ alerting(${varName}.DispatchTimebefore, ${varName}.Pickingtime || ${varName}.BookingDateTime, ${varName}.BookingStatus) }}" ng-class="{'bw-card-alt': $odd, 'bw-svc-food': ${varName}.serviceType==='food', 'bw-svc-freight': ${varName}.serviceType==='freight', 'bw-svc-tm': ${varName}.serviceType==='tm', 'bw-urgent': ${varName}.Urgent==='Yes', 'bw-svc-rental': ${varName}.BookingSource==='Rental'}" id="singlediv-{{${varName}.Id}}" ng-repeat="(key, ${varName}) in __LIST__">
                                                        <div class="bw-card-hd">
                                                            <span class="bw-jid"><i class="fa fa-hashtag"></i>{{${varName}.Id}}</span>
                                                            <span class="bw-b" ng-style="{background: ${varName}.JobMins<=0 ? '#16a34a' : ${varName}.JobMins<=30 ? '#d97706' : '#2563eb', color:'#fff'}"><i class="fa fa-clock-o"></i> {{jobTypeLabel(${varName}.JobMins, ${varName}.DispatchTimebefore)}}</span>
                                                            <span class="bw-b" style="background:#e0e7ff;color:#3730a3;font-size:11px;">{{datecreate(${varName}.Pickingtime || ${varName}.BookingDateTime, ${varName}.DispatchTimebefore)}}</span>
                                                            <span ng-if="${varName}.PaymentType === 'total_mobility'" class="bw-tm-badge">TM</span>
                                                            <span ng-if="${varName}.serviceType && ${varName}.serviceType !== 'taxi'" class="bw-b" ng-style="{background: ${varName}.serviceType==='food'?'#16a34a':${varName}.serviceType==='freight'?'#ea580c':'#7c3aed', color:'#fff'}">{{${varName}.serviceType|uppercase}}</span>
                                                            <span ng-if="${varName}.RecallStatus === 'Recalled'" class="bw-b" style="background:#c0392b;color:#fff;">&#9888; Recalled</span>
                                                            <i ng-if="${varName}.DropLatLng != '0,0'" ng-mouseover="showmakert(${varName}.Id,${varName}.PickLatLng,${varName}.DropLatLng)" ng-mouseleave="markerremove(${varName}.Id,${varName}.PickLatLng,${varName}.DropLatLng)" class="fa fa-compass" style="color:#e53e3e;font-size:17px;cursor:pointer;margin-left:auto;"></i>
                                                        </div>
                                                        <div class="bw-card-route">
                                                            <div class="bw-card-route-row">
                                                                <span class="bw-rdot bw-rdot-pick"></span>
                                                                <span class="bw-raddr">{{bwFormatAddress(${varName}.PickAddress, 'Hail Pickup')}}</span>
                                                                <span class="bw-rmeta"><i class="fa fa-user"></i> {{${varName}.passengername || ${varName}.Name || '—'}}</span>
                                                            </div>
                                                            <div class="bw-card-route-row" ng-if="${varName}.DropAddress">
                                                                <span class="bw-rdot bw-rdot-drop"></span>
                                                                <span class="bw-raddr">{{${varName}.DropAddress}}</span>
                                                                <span class="bw-rmeta" ng-if="${varName}.PhoneNo"><i class="fa fa-phone"></i> {{${varName}.PhoneNo}}</span>
                                                            </div>
                                                        </div>
                                                        <div class="bw-assign-row">
                                                            <span class="bw-b" style="background:#dc2626;color:#fff;font-weight:700;">{{${varName}.BookingStatus}}</span>
                                                            <span class="bw-b" ng-style="{background: latealert(${varName}.DispatchTimebefore, ${varName}.BookingDateTime) || '#475569', color:'#fff'}"><i class="fa fa-hourglass-half"></i> {{checklateornow(${varName}.JobMins, ${varName}.DispatchTimebefore)}}</span>
                                                            <span class="bw-mc" ng-if="${varName}.TotalFare || ${varName}.fare"><i class="fa fa-dollar"></i>{{${varName}.TotalFare || ${varName}.fare}}</span>
                                                            <span class="bw-mc" ng-if="${varName}.TripMins != null"><i class="fa fa-clock-o"></i>{{${varName}.TripMins}}m</span>
                                                            <span class="bw-mc" ng-if="${varName}.drivername || ${varName}.VehicleNo"><i class="fa fa-car"></i>{{${varName}.drivername || ''}} {{${varName}.VehicleNo || ${varName}.CallSign || ''}}</span>
                                                            <span style="margin-left:auto;display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">${actionsHtml}</span>
                                                        </div>
                                                    </div>`;

const offerActions = `
                                                                <span class="bw-ab bw-ab-edit" ng-click="EditJobunassignedng(value.Id, value.JobMins)" title="Edit"><i class="fa fa-pencil"></i></span>
                                                                <span class="bw-ab bw-ab-del" ng-click="UnAssignedJobsCancelng(value.Id, value.U_id)" title="Cancel"><i class="fa fa-times"></i></span>
                                                                <span id="spxa{{value.Id}}"><select id="spx{{value.Id}}" class="form-control bw-spx-sel"><option value="-1" ng-selected="value.BookingStatus == 'No One'" data-is-noone="true">No One</option><option value="0">Select Driver</option><option ng-repeat="drivi in driverdatarealx" ng-show="checkofferjob(drivi.driverid) && checkDriverSvc(drivi.driverid,(value.serviceType||'taxi'))" ng-if="drivi.vehiclestatus == 'Available' && checkjobvehile(value.VehicleType, drivi.vehicletype)" value="{{drivi.driverid}}" data-zoneq="{{drivi.zonequeue}}" data-doo="{{drivi.VehicleId}}">{{drivi.vehiclenumber}}/{{drivi.vehicletype}}</option></select></span>
                                                                <span class="bw-b bw-send-pulse" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="bwConfirmSpx(value.Id)"><i class="fa fa-paper-plane"></i></span>`;

const assignActions = `
                                                                <select id="sxq{{avalue.Id}}" class="form-control bw-spx-sel" style="max-width:130px;"><option value="0">Select Driver</option><option value="0">No One</option><option ng-repeat="drivi in driverdatarealx" ng-show="checkofferjob(drivi.driverid) && checkDriverSvc(drivi.driverid,(avalue.serviceType||'taxi'))" ng-if="drivi.vehiclestatus == 'Available' && checkjobvehile(avalue.VehicleType, drivi.vehicletype)" value="{{drivi.driverid}}" data-zoneq="{{drivi.zonequeue}}" data-doo="{{drivi.VehicleId}}">{{drivi.vehiclenumber}}/{{drivi.vehicletype}}</option></select>
                                                                <span class="bw-b" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="AssignJobFromJobList(avalue.Id,avalue.VehicleId,avalue.DriverId,avalue.U_id, avalue.quenumber, 'sxq')"><i class="fa fa-paper-plane"></i></span>
                                                                <span class="bw-ab bw-ab-edit" ng-click="EditJob(avalue.Id, avalue.quenumber)"><i class="fa fa-pencil"></i></span>
                                                                <span class="bw-ab bw-ab-del" ng-click="CancelJob(avalue.Id,avalue.U_id, avalue.ZoneId, avalue.quenumber)"><i class="fa fa-times"></i></span>
                                                                <span class="bw-b" style="background:#27ae60;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="forceCompleteJob(avalue.Id, avalue.DriverId)"><i class="fa fa-check"></i> Complete</span>`;

const activeActions = `
                                                                <span class="bw-b" style="background:#27ae60;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="forceCompleteJob(acvalue.Id, acvalue.DriverId)"><i class="fa fa-check"></i> Complete</span>
                                                                <span class="bw-ab bw-ab-del" ng-click="cancelactivejob(acvalue.Id)"><i class="fa fa-times"></i></span>`;

const dyActions = `
                                                                <select id="sax{{value.Id}}" class="form-control bw-spx-sel" style="max-width:130px;"><option value="0">Select Driver</option><option value="-1" data-is-noone="true">No One</option><option ng-repeat="drivi in driverdatarealx" value="{{drivi.Id}}">{{drivi.VehicleNo}}/{{drivi.VehicleName}}</option></select>
                                                                <span class="bw-b bw-send-pulse" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="bwConfirmCard('sax','pending',value.Id,value.VehicleId,value.DriverId,value.U_id)"><i class="fa fa-paper-plane"></i></span>
                                                                <span class="bw-ab bw-ab-del" ng-click="UnAssignedJobsCancelng(value.Id,value.U_id)"><i class="fa fa-times"></i></span>`;

replaceBetween(
  '<div class="tab-pane vowali " id="tab9">',
  '<div class="tab-pane" id="tab6">',
  `                                                <div class="tab-pane vowali " id="tab9">\n${BW_CARD('value', offerActions, "true").replace('__LIST__', 'oferunassignedjob_list')}\n                                                </div>\n\n                                                `,
  'Tab9 Offer bw cards'
);

replaceBetween(
  '<div class="tab-pane" id="tab6">',
  '<div class="tab-pane" id="tab-queue">',
  `                                                <div class="tab-pane" id="tab6">\n${BW_CARD('avalue', assignActions, 'true').replace('__LIST__', 'assignedjob_list')}\n                                                </div>\n\n                                                `,
  'Tab6 Assign bw cards'
);

replaceBetween(
  '<div class="tab-pane" id="tab7">',
  '<div class="tab-pane " id="tab8">',
  `                                                <div class="tab-pane" id="tab7">\n${BW_CARD('acvalue', activeActions, 'true').replace('__LIST__', 'ActiveJob')}\n                                                </div>\n                                                `,
  'Tab7 Active bw cards'
);

replaceBetween(
  '<div class="tab-pane " id="tab8">',
  '</div>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                </div>\n                <div class="col-sm-12 col-md-6 col-lg-6 col-xs-12">',
  `                                                <div class="tab-pane " id="tab8">\n${BW_CARD('value', dyActions, 'true').replace('__LIST__', 'deliveryjobs')}\n                                                </div>`,
  'Tab8 DY bw cards'
);

// Search jobs — remove right panel, route clicks to ShowJobPopup
replaceBetween(
  '                                <div ng-click="JobDetails(searh.Id)"',
  '                                     onmouseout="this.style.background=\'#fff\'; this.style.borderColor=\'#e2e4ea\';">',
  `                                <div ng-click="(function(id){ $('#search-jobs').modal('hide'); if(window.ShowJobPopup) ShowJobPopup(id); })(searh.Id)"`,
  'Search jobs ShowJobPopup click'
);

if (html.includes('<!-- RIGHT: Job Details -->')) {
  const r0 = html.indexOf('<!-- RIGHT: Job Details -->');
  const r1 = html.indexOf('</div>\n            </div>\n        </div>\n    </div>\n    <div class="modal fade" id="closed-jobs">', r0);
  if (r0 >= 0 && r1 > r0) {
    html = html.slice(0, r0) + `                    <div style="flex:1;padding:24px;background:#fff;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px;text-align:center;">
                        <div><i class="fa fa-info-circle" style="font-size:28px;color:#dfba5f;display:block;margin-bottom:10px;"></i>Click a result to open the job detail popup.<br><span style="font-size:12px;color:#94a3b8;">Legacy inline detail panel removed.</span></div>
                    </div>` + html.slice(r1);
    console.log('OK: Search jobs right panel removed');
  }
}

// Closed jobs — fix No Show typo + modern table wrapper
html = html.replace('No Shown', 'No Show');
html = html.replace(
  '<table id="tbleClosedJobs" class="table table-striped table-bordered dt-responsive nowrap" style="border-collapse:collapse; border-spacing:0; width:100%;" width="100%"></table>',
  `<div id="bw-closed-jobs-wrap" style="padding:12px 16px;overflow-x:auto;">
                        <table id="tbleClosedJobs" class="bw-modern-table" style="width:100%;border-collapse:collapse;font-size:12px;"></table>
                        <div id="bw-closed-empty" style="display:none;text-align:center;padding:32px;color:#94a3b8;">No closed jobs for this filter.</div>
                    </div>`
);

// ACC — remove dead tab panes, add Manage ACC link
replaceBetween(
  '                            <div class="tab-content">',
  '                               <div id="approvaldetails" class="tab-pane fade in active">',
  `                            <div class="tab-content">
                              <div style="margin-bottom:14px;display:flex;justify-content:flex-end;">
                                <a id="bw-acc-owner-link" href="#" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="background:#1a73e8;border:none;font-weight:600;">
                                  <i class="fa fa-external-link"></i> Manage ACC in Owner Panel
                                </a>
                              </div>`,
  'ACC manage link'
);

replaceBetween(
  '                              <div id="manager" class="tab-pane fade">',
  '                               <div id="approvaldetails" class="tab-pane fade in active">',
  '',
  'ACC dead manager tab'
);

html = html.replace(/Calim No/g, 'Claim No');

// Alarms — ng-repeat container
html = html.replace(
  '<div class="modal-body modal-alarm-box" style="height:300px; overflow-y:auto; padding:12px 16px; background:#f9fafb;">\n                </div>',
  `<div class="modal-body" style="height:300px; overflow-y:auto; padding:12px 16px; background:#f9fafb;" ng-controller="myangular">
                    <div ng-if="!(bwAlarmList && bwAlarmList.length)" style="text-align:center;color:#94a3b8;padding:24px;">No alarms due right now.</div>
                    <div ng-repeat="alm in bwAlarmList track by alm.Id" id="AlarmDiv{{alm.Id}}" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                        <div style="font-size:13px;color:#334155;margin-bottom:6px;">{{alm.AlarmText}}</div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:8px;"><i class="fa fa-calendar"></i> {{alm.AlarmDate}} &nbsp; <i class="fa fa-clock-o"></i> {{alm.displayTime || alm.AlarmTime}}</div>
                        <button class="btn btn-sm btn-warning" ng-click="bwDisableAlarm(alm.Id)" style="font-weight:600;">Disable</button>
                    </div>
                </div>`
);

// Closed jobs modal CSS
if (!html.includes('.bw-modern-table')) {
  html = html.replace(
    '    div.bw-job-card.bw-card-alt',
    `    .bw-modern-table thead tr { background:#f1f5f9; }
    .bw-modern-table th { padding:10px 8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; border-bottom:2px solid #e2e8f0; }
    .bw-modern-table td { padding:9px 8px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .bw-modern-table tbody tr:hover { background:#fffbeb; cursor:pointer; }
    .dataTables_wrapper .paginate_button { color:#475569 !important; border-radius:4px !important; }
    .dataTables_wrapper .paginate_button.current { background:#1a73e8 !important; color:#fff !important; border-color:#1a73e8 !important; }
    div.bw-job-card.bw-card-alt`
  );
}

fs.writeFileSync(aspPath, html, 'utf8');
console.log('Follow-up patch applied to Default.aspx');
