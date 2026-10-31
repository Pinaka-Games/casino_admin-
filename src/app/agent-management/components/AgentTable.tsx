"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { User, Calendar, ShieldCheck, Mail, Phone } from "lucide-react";
import { UserWithProfile } from "@/types/profile.type";

interface AgentTableProps {
  agents: UserWithProfile[];
  isLoading: boolean;
}

export function AgentTable({ agents, isLoading }: AgentTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-[#191D24] p-6 sm:p-12 rounded-xl border border-dashed border-gray-800 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
          <ShieldCheck className="text-gray-600" size={24} />
        </div>
        <h4 className="text-white font-bold uppercase tracking-tight">No Agents Found</h4>
        <p className="text-gray-500 text-sm mt-1 max-w-[200px]">
          There are currently no users registered as agents.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#191D24] rounded-xl border border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Table>
        <TableHeader className="bg-black/20">
          <TableRow className="border-gray-800 hover:bg-transparent">
            <TableHead className="text-gray-400 font-bold uppercase text-[10px] py-4">Agent Identity</TableHead>
            <TableHead className="text-gray-400 font-bold uppercase text-[10px] py-4">Contact Info</TableHead>
            <TableHead className="text-gray-400 font-bold uppercase text-[10px] py-4">Status</TableHead>
            <TableHead className="text-right text-gray-400 font-bold uppercase text-[10px] py-4">Joined Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id} className="border-gray-800 hover:bg-white/5 transition-colors group">
              <TableCell className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-white/5 shadow-inner">
                    <ShieldCheck size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tighter">
                      {agent.username || agent.profile?.displayName || "Anonymous Agent"}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">
                      ID: {agent.id.substring(0, 12)}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="space-y-1">
                   <div className="flex items-center gap-2 text-gray-400 text-xs font-bold">
                      <Mail size={12} className="text-gray-600" />
                      {agent.profile?.email || "No Email"}
                   </div>
                   <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold">
                      <Phone size={12} className="text-gray-700" />
                      {agent.profile?.phone || "No Phone"}
                   </div>
                </div>
              </TableCell>
              <TableCell className="py-4">
                 <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                    agent.isActive 
                    ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                    : "bg-red-500/10 text-red-500 border border-red-500/20"
                 }`}>
                    <div className={`w-1 h-1 rounded-full ${agent.isActive ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                    {agent.isActive ? "Active" : "Inactive"}
                 </div>
              </TableCell>
              <TableCell className="py-4 text-right">
                <div className="flex items-center justify-end gap-2 text-gray-300 text-sm font-bold">
                  <Calendar size={14} className="text-gray-600" />
                  {format(parseISO(agent.createdAt), "MMM dd, yyyy")}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
