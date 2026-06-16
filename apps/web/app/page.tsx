import React from 'react';
import { 
  Building2, 
  Users, 
  CheckSquare, 
  AlertTriangle,
  Layers,
  ArrowUpRight,
  TrendingUp,
  MessageSquare
} from 'lucide-react';

export default function AdminDashboard() {
  // Mock data representing state in v1
  const stats = [
    { name: 'Total Employees', value: '42', icon: Users, change: '+4 this week', changeType: 'positive' },
    { name: 'Active Tasks', value: '118', icon: CheckSquare, change: '24 awaiting action', changeType: 'neutral' },
    { name: 'Critical/Urgent Tasks', value: '9', icon: AlertTriangle, change: 'Needs immediate review', changeType: 'negative' },
    { name: 'Active Sites/Projects', value: '6', icon: Building2, change: '2 ending this month', changeType: 'neutral' },
  ];

  const recentTasks = [
    { id: '1', title: 'Verify Concrete Pour at Site A', status: 'Needs Verification', priority: 'High', site: 'Metro Station Project' },
    { id: '2', title: 'Submit Bookkeeping Q2 Invoice', status: 'In Progress', priority: 'Medium', site: 'Corporate Office Site' },
    { id: '3', title: 'Re-routing Electrical Piping Ground Floor', status: 'Needs Action', priority: 'Critical', site: 'Residential Complex Site' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 p-8 text-slate-100">
      {/* Header */}
      <header className="mb-12 flex flex-col justify-between gap-4 border-b border-slate-800/60 pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Construction Task Manager
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Internal administrative panel & global operations monitor.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition">
            Manage Employees
          </button>
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200 transition flex items-center gap-2">
            Create Global Task <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Grid Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.name} className="relative overflow-hidden rounded-xl bg-slate-900/60 border border-slate-800/80 p-6 backdrop-blur-md hover:border-slate-700/80 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{stat.name}</span>
              <stat.icon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white tracking-tight">{stat.value}</span>
            </div>
            <div className="mt-2 flex items-center text-xs">
              <span className={`font-semibold ${
                stat.changeType === 'positive' ? 'text-emerald-400' :
                stat.changeType === 'negative' ? 'text-rose-400' : 'text-slate-400'
              }`}>{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Recent Activity / High Priority */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-slate-400" /> High-Priority Work Overview
            </h2>
            <span className="text-xs text-slate-400 underline cursor-pointer hover:text-white">View all tasks</span>
          </div>

          <div className="space-y-4">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-950/40 p-4 hover:bg-slate-900/30 transition">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-slate-200">{task.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-900 border border-slate-800 px-2 py-0.5">{task.site}</span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-medium ${
                      task.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                      task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {task.priority} Priority
                    </span>
                  </div>
                </div>
                <div>
                  <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-400">
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Platform Configuration Overview */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-slate-400" /> Platform Configuration
            </h2>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-800/50 pb-3">
                <span className="text-slate-400">Preferred System Languages</span>
                <span className="font-semibold text-slate-200">EN, HI, TE</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-3">
                <span className="text-slate-400">Active Task Categories</span>
                <span className="font-semibold text-slate-200">5 Categories</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-3">
                <span className="text-slate-400">Phone Authentication System</span>
                <span className="font-semibold text-slate-200">OTP Enabled (Dev)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-3">
                <span className="text-slate-400">AWS S3 Assets Bucket</span>
                <span className="font-semibold text-slate-200">Linked</span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg bg-indigo-950/20 border border-indigo-500/20 p-4 text-xs text-indigo-300">
            <h4 className="font-bold mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Next Steps</h4>
            Launch your Expo mobile app in terminal to begin simulating local task updates and synchronize with this console.
          </div>
        </div>
      </div>
    </div>
  );
}
