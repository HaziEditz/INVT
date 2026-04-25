import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Car, MapPin, Map as MapIcon, Plus, Bell, 
  Clock, Navigation, CheckCircle2, User, Search,
  Menu, MoreVertical, Compass, Signal, SignalHigh,
  SignalZero, ArrowRight
} from "lucide-react";

export function Dashboard() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Top Navbar */}
      <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-600 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(8,145,178,0.4)]">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">BookaWaka</span>
          <span className="text-xs uppercase tracking-widest text-slate-500 ml-4 font-mono font-medium border border-slate-800 rounded px-2 py-0.5">Console</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-300">System Online</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
            </Button>
            
            <div className="h-8 w-px bg-slate-800"></div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-white">Alex Dispatcher</div>
                <div className="text-xs text-slate-400">Shift ends 18:00</div>
              </div>
              <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarFallback className="bg-slate-800 text-cyan-400 font-medium">AD</AvatarFallback>
              </Avatar>
            </div>

            <Button className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)] hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all ml-2 gap-2">
              <Plus className="w-4 h-4" />
              New Job
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-6">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-800/80 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Unassigned</div>
            <div className="font-mono text-white text-base font-medium">3</div>
          </div>
        </div>
        
        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-800/80 text-blue-400">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Assigned</div>
            <div className="font-mono text-white text-base font-medium">1</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-800/80 text-green-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Active</div>
            <div className="font-mono text-white text-base font-medium">1</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-800/80 text-cyan-400">
            <Signal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Online Drivers</div>
            <div className="font-mono text-white text-base font-medium">3 / 4</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        
        {/* Job Board (3 columns) */}
        <div className="flex-1 grid grid-cols-3 gap-6 p-6 overflow-hidden bg-slate-950">
          
          {/* Column 1: Unassigned */}
          <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                <h2 className="font-semibold text-slate-200">Unassigned</h2>
              </div>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono">3</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* Job Card 1 */}
              <Card className="bg-slate-900 border-slate-700/50 shadow-md hover:border-slate-600 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-semibold text-cyan-400">#BW-4821</span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 3 mins ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Sarah Johnson
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">Sedan</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 pb-3">
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">14 Queen St</span>
                    </div>
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Airport</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/50">
                  <Button size="sm" className="w-full bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 border border-cyan-600/20">
                    Assign Driver
                  </Button>
                </CardFooter>
              </Card>

              {/* Job Card 2 */}
              <Card className="bg-slate-900 border-slate-700/50 shadow-md hover:border-slate-600 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-semibold text-cyan-400">#BW-4822</span>
                    <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 7 mins ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Mike Chen
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">Van</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 pb-3">
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">82 Tay St</span>
                    </div>
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Hospital</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/50">
                  <Button size="sm" className="w-full bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 border border-cyan-600/20">
                    Assign Driver
                  </Button>
                </CardFooter>
              </Card>

              {/* Job Card 3 */}
              <Card className="bg-slate-900 border-red-900/30 shadow-[0_0_15px_rgba(220,38,38,0.05)] hover:border-red-800/50 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-semibold text-cyan-400">#BW-4823</span>
                    <span className="text-xs font-medium text-red-400 flex items-center gap-1 animate-pulse">
                      <Clock className="w-3 h-3" /> 12 mins ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Emma Wilson
                    </div>
                    <Badge variant="outline" className="border-cyan-800 bg-cyan-950/30 text-cyan-300 text-[10px]">Wheelchair</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 pb-3">
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Countdown Supermarket</span>
                    </div>
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">6 Leven St</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/50">
                  <Button size="sm" className="w-full bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 border border-cyan-600/20">
                    Assign Driver
                  </Button>
                </CardFooter>
              </Card>

            </div>
          </div>

          {/* Column 2: Assigned */}
          <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                <h2 className="font-semibold text-slate-200">Assigned</h2>
              </div>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono">1</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* Job Card 4 */}
              <Card className="bg-slate-900 border-slate-700/50 shadow-md">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-semibold text-cyan-400">#BW-4825</span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 22 mins ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Lisa Brown
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">SUV</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 pb-3">
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">44 Dee St</span>
                    </div>
                    <div className="relative text-sm text-slate-300 flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Airport</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-slate-700">
                        <AvatarFallback className="bg-slate-800 text-[10px] text-cyan-400">T105</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-slate-300">Ana Santos</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">En Route</Badge>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/50 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    Recall
                  </Button>
                  <Button size="sm" className="w-full bg-slate-800 hover:bg-slate-700 text-white">
                    Message
                  </Button>
                </CardFooter>
              </Card>

            </div>
          </div>

          {/* Column 3: Active */}
          <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <h2 className="font-semibold text-slate-200">Active</h2>
              </div>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono">1</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* Job Card 5 */}
              <Card className="bg-slate-900 border-green-900/30 shadow-[0_0_15px_rgba(34,197,94,0.05)] border-l-2 border-l-green-500">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-semibold text-cyan-400">#BW-4824</span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 1 min ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Tom Parker
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">Sedan</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 pb-3">
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
                    <div className="relative text-sm text-slate-400 line-through flex items-start gap-3">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Railway Station</span>
                    </div>
                    <div className="relative text-sm text-slate-200 flex items-start gap-3 font-medium">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-slate-900"></div>
                      <span className="line-clamp-1">Crown Hotel</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-slate-700">
                        <AvatarFallback className="bg-slate-800 text-[10px] text-cyan-400">T201</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-slate-300">James Kirk</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/10">In Transit</Badge>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/50 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    Update
                  </Button>
                  <Button size="sm" className="w-full bg-green-600/10 text-green-400 hover:bg-green-600/20 border border-green-600/20">
                    Complete
                  </Button>
                </CardFooter>
              </Card>

            </div>
          </div>

        </div>

        {/* Right Panel (Map + Drivers) */}
        <div className="w-[35%] shrink-0 border-l border-slate-800 flex flex-col bg-slate-950 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
          
          {/* Stylized Map Area */}
          <div className="h-[55%] relative overflow-hidden bg-slate-900 map-bg border-b border-slate-800 group">
            
            {/* Fake map controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <div className="bg-slate-900/80 backdrop-blur rounded-md border border-slate-700 p-1 flex flex-col shadow-lg">
                <button className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded">
                  <Plus className="w-4 h-4" />
                </button>
                <div className="w-6 h-px bg-slate-700 mx-auto"></div>
                <button className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded">
                  <div className="w-3 h-[2px] bg-current"></div>
                </button>
              </div>
              <button className="w-10 h-10 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 shadow-lg">
                <Navigation className="w-4 h-4" />
              </button>
            </div>

            {/* Map overlay elements (streets simulation) */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0 100 Q 150 150 300 100 T 600 200" stroke="#334155" strokeWidth="4" fill="none" />
              <path d="M 100 0 L 150 400" stroke="#334155" strokeWidth="3" fill="none" />
              <path d="M 300 0 L 250 400" stroke="#334155" strokeWidth="6" fill="none" />
              <path d="M 0 250 L 600 300" stroke="#334155" strokeWidth="2" fill="none" />
            </svg>

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none opacity-60"></div>

            {/* Map Pins */}
            {/* T105 - Available */}
            <div className="absolute top-[35%] left-[25%] transform -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform cursor-pointer">
              <div className="relative">
                <div className="w-12 h-12 bg-green-500/20 rounded-full animate-ping absolute -top-2 -left-2"></div>
                <div className="bg-slate-900 border border-green-500 rounded px-2 py-1 flex items-center gap-1 shadow-[0_0_10px_rgba(34,197,94,0.3)] relative z-10">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-[10px] font-mono font-bold text-white">T105</span>
                </div>
                <div className="w-0.5 h-4 bg-green-500 mx-auto"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mx-auto -mt-0.5 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
              </div>
            </div>

            {/* T201 - Busy */}
            <div className="absolute top-[60%] left-[65%] transform -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform cursor-pointer">
              <div className="relative">
                <div className="bg-slate-900 border border-amber-500 rounded px-2 py-1 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.3)] relative z-10">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-[10px] font-mono font-bold text-white">T201</span>
                </div>
                <div className="w-0.5 h-4 bg-amber-500 mx-auto"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto -mt-0.5 shadow-[0_0_5px_rgba(245,158,11,0.8)]"></div>
                
                {/* Active route line to destination */}
                <svg className="absolute top-1/2 left-1/2 w-[100px] h-[50px] overflow-visible pointer-events-none opacity-50 z-0" style={{ transform: 'translate(0, -100%)' }}>
                  <path d="M 0 0 Q 50 -20 80 -40" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" fill="none" className="animate-[dash_1s_linear_infinite]" />
                  <circle cx="80" cy="-40" r="3" fill="#f59e0b" />
                </svg>
              </div>
            </div>

            {/* T088 - Available */}
            <div className="absolute top-[20%] left-[70%] transform -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform cursor-pointer">
              <div className="relative">
                <div className="bg-slate-900 border border-green-500 rounded px-2 py-1 flex items-center gap-1 shadow-[0_0_10px_rgba(34,197,94,0.3)] relative z-10">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-[10px] font-mono font-bold text-white">T088</span>
                </div>
                <div className="w-0.5 h-4 bg-green-500 mx-auto"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mx-auto -mt-0.5 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Live Tracking Active</span>
            </div>
          </div>

          {/* Drivers List */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Signal className="w-4 h-4 text-cyan-400" /> Fleet Status
              </h3>
              <div className="flex bg-slate-900 rounded-md border border-slate-800 p-0.5">
                <button className="px-2 py-1 text-[10px] font-medium rounded bg-slate-800 text-white">All</button>
                <button className="px-2 py-1 text-[10px] font-medium rounded text-slate-400 hover:text-slate-200">Online</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
              
              {/* Driver 1 */}
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-slate-700">
                      <AvatarFallback className="bg-slate-800 text-slate-300 font-mono text-xs">JK</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-slate-950"></div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white group-hover:text-cyan-400 transition-colors">James Kirk</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-slate-400">T201</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-amber-400">Busy (Job #4824)</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              {/* Driver 2 */}
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-slate-700">
                      <AvatarFallback className="bg-slate-800 text-slate-300 font-mono text-xs">AS</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-slate-950"></div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white group-hover:text-cyan-400 transition-colors">Ana Santos</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-slate-400">T105</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-green-400">Available</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              {/* Driver 3 */}
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-slate-700">
                      <AvatarFallback className="bg-slate-800 text-slate-300 font-mono text-xs">DW</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-slate-950"></div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white group-hover:text-cyan-400 transition-colors">Dave Wilson</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-slate-400">T088</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-green-400">Available</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              {/* Driver 4 */}
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800 cursor-pointer group opacity-60">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-slate-800">
                      <AvatarFallback className="bg-slate-900 text-slate-500 font-mono text-xs">PP</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-600 border-2 border-slate-950"></div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Priya Patel</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-slate-500">T312</span>
                      <span className="text-slate-700">•</span>
                      <span className="text-slate-500">Offline</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInlineStyle={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -8;
          }
        }
      `}} />
    </div>
  );
}
