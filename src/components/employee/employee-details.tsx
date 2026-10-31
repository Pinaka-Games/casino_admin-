"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/types/employee";
import CopyButton from "@/components/CopyButton";
// Date formatting helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};
import {
  Mail,
  Calendar,
  Building2,
  Shield,
  Lock,
  CheckCircle2,
} from "lucide-react";

interface EmployeeDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeeDetails({
  open,
  onOpenChange,
  employee,
}: EmployeeDetailsProps) {
  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-[#15181E] border-none text-white p-0 rounded-xl shadow-xl overflow-hidden z-999">
        {/* FIXED HEADER */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-700">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-semibold text-white">
              Employee Details & Permissions
            </DialogTitle>

            {/* USERNAME + STATUS */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <DialogDescription className="text-gray-400 text-sm uppercase">
                  {employee.username}
                </DialogDescription>
              </div>

              <Badge
                className={`px-2 py-0.5 text-xs font-medium ${
                  employee.isActive
                    ? "bg-green-600 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-4 space-y-4 scrollbar-hide">
          {/* BASIC INFO CARD */}
          <Card className="bg-[#1C2027] border-none text-white">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 -mt-4">
                <Mail className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Email
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-200">{employee.email}</p>
                    <CopyButton value={employee.email} size={14} />
                  </div>
                </div>
              </div>

              {employee.lastLoginAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Last Login
                    </p>
                    <p className="text-sm text-gray-200">
                      {formatDate(employee.lastLoginAt)}
                    </p>
                  </div>
                </div>
              )}

              {!employee.lastLoginAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Last Login
                    </p>
                    <p className="text-sm text-gray-400 italic">
                      Never logged in
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ROLES SECTION */}
          <Card className="bg-[#1C2027] border-none text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                Roles ({employee.roles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 -mt-8">
              {employee.roles.map((role) => (
                <div
                  key={role.id}
                  className="bg-[#242B35] rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-semibold text-white capitalize">
                          {role.name}
                        </h4>
                        <Badge
                          variant={role.isActive ? "default" : "secondary"}
                          className={`text-xs ${
                            role.isActive
                              ? "bg-green-600/20 text-green-400 border-green-600/30"
                              : "bg-gray-600/20 text-gray-400 border-gray-600/30"
                          }`}
                        >
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">
                        {role.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Priority
                      </p>
                      <p className="text-lg font-bold text-blue-400">
                        {role.priority}
                      </p>
                    </div>
                  </div>

                  {/* PERMISSIONS */}
                  {role.permissions && role.permissions.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-amber-400" />
                        <h5 className="text-sm font-medium text-gray-300">
                          Permissions ({role.permissions.length})
                        </h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {role.permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="bg-[#1C2027] rounded-md p-3 border border-gray-700/50 hover:border-gray-600 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {permission.name}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {permission.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="text-xs bg-blue-600/20 text-blue-400 border-blue-600/30">
                                    {permission.action}
                                  </Badge>
                                  <Badge className="text-xs bg-purple-600/20 text-purple-400 border-purple-600/30">
                                    {permission.resource}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 pt-2  border-t border-gray-700">
                    <p>Created: {formatDate(role.createdAt)}</p>
                    <p>Updated: {formatDate(role.updatedAt)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* FOOTER TIMESTAMPS */}
          <Card className="bg-[#1C2027] border-none mb-6 text-white">
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 space-y-1">
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">Account Created:</span>
                  <span className="text-gray-300">
                    {formatDate(employee.createdAt)}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">Last Updated:</span>
                  <span className="text-gray-300">
                    {formatDate(employee.updatedAt)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
