import {
  dashboard,
  user,
  wallet,
  report,
  setting
} from "@/assets/icons";
import { History, Tag, Package , Send} from "lucide-react";

export interface AgentNavItem {
  locked: boolean;
  title: string;
  url?: string;
  icon?: any;
  items?: AgentNavItem[];
  allowedRoles?: string[]; // New field to filter by role
}

export const agentNavItems: AgentNavItem[] = [
  {
    locked: false,
    title: "Dashboard",
    url: "/agent-management",
    icon: dashboard,
    allowedRoles: ["AGENT", "SUBAGENT"], // Both can see dashboard
  },
  {
    locked: false,
    title: "Sub-Agents Listing",
    icon: user,
    url: "/agent-management/sub-agents",
    allowedRoles: ["AGENT"], // Only Agent can manage sub-agents
  },
  {
    locked: false,
    title: "Promo Codes Listing",
    icon: Tag,
    // Single destination — a collapsible group would just add a click.
    url: "/agent-management/promo-code-listing",
    allowedRoles: ["AGENT"],
  },
  {
    locked: false,
    title: "Commission Requests",
    icon: Tag,
    url: "/agent-management/commission-requests",
    allowedRoles: ["SUBAGENT"], // Sub-agent approves commission changes
  },
  {
    locked: false,
    title: "Transactions History ",
    icon: History,
    allowedRoles: ["AGENT", "SUBAGENT"], // Both can see transactions
    items: [
      {
        locked: false,
        title: "Commission Deposit",
        url: "/agent-management/deposit-logs",
      },
      {
        locked: false,
        title: "Wallet Transaction",
        url: "/agent-management/withdraw-logs",
      },
    ],
  },
  
  {
    locked: false,
    title: "Payout Management",
    icon: Send,
    // Sub-agents need this too: it's the only place they can see their own past
    // payout requests and their status. The page itself already scopes what each
    // role sees (agents get their sub-agents' queue, sub-agents get their own).
    allowedRoles: ["AGENT", "SUBAGENT"],
    items: [
      {
        locked: false,
        title: "Payout Requests",
        url: "/agent-management/payout-requests",
      },
      {
        locked: false,
        title: "Payout History",
        url: "/agent-management/sub-agent-history",
      },
    ],
  },


  {
    locked: false,
    title: "Agent Package Management",
    icon: Package,
    allowedRoles: ["AGENT"], // Only Agent can manage payouts
    items: [
      {
        locked: false,
        title: "Agent Package",
        url: "/agent-management/agent-package-mgt",
      },
      {
        title: "Agent Package History",
        url: "/agent-management/agent-package-history",
        locked: false
      },
    ],
  },
];
