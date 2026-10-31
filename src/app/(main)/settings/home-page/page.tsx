"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Database, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { seedAllDefaults } from "@/api/setup/seed";
import { getSidebarTree } from "@/api/sidebar/sidebar";

// Heavy (dnd-kit + modals) — load on the client only.
const CategoriesManager = dynamic(() => import("./components/CategoriesManager"), {
  ssr: false,
});
const HomeCategoriesManager = dynamic(() => import("./components/HomeCategoriesManager"), {
  ssr: false,
});
const LobbyTabsManager = dynamic(() => import("./components/LobbyTabsManager"), {
  ssr: false,
});
const JackpotCardsManager = dynamic(() => import("./components/JackpotCardsManager"), {
  ssr: false,
});
const SidebarMenuManager = dynamic(
  () => import("../sidebar-menus/components/SidebarMenuManager"),
  { ssr: false },
);
const ModalManager = dynamic(
  () => import("../modal-management/components/ModalManager"),
  { ssr: false },
);

export default function HomePageSettings() {
  const [seeding, setSeeding] = useState(false);
  // Bumped after a successful seed to remount the tab managers so they refetch.
  const [reloadKey, setReloadKey] = useState(0);
  // null = unknown/loading; true = no sidebar menus yet (fresh DB).
  const [isEmpty, setIsEmpty] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const checkEmpty = useCallback(async () => {
    try {
      const tree = await getSidebarTree();
      setIsEmpty((tree?.length ?? 0) === 0);
    } catch {
      setIsEmpty(null);
    }
  }, []);

  useEffect(() => {
    checkEmpty();
  }, [checkEmpty, reloadKey]);

  // The seed button only exists on a fresh database (no menus yet); once menus
  // are configured it is hidden, so it always opens a plain confirmation.
  const handleSeedClick = () => setConfirmOpen(true);
  const showSeedButton = seeding || isEmpty === true;

  const runSeed = async () => {
    setConfirmOpen(false);
    setSeeding(true);
    try {
      const res = await seedAllDefaults();
      const s = res.sidebar;
      toast.success(
        `Defaults seeded — menus: ${s.groupsCreated + s.groupsUpdated} groups, ${s.itemsCreated + s.itemsUpdated} items; categories: +${res.categories.created}; modals: +${res.modals.created}; home layout: ${res.homeLayout.sections} rows (+${res.homeLayout.added}); live casino tabs: ${res.liveCasinoTabs.tabs} (+${res.liveCasinoTabs.created}, ${res.liveCasinoTabs.gamesLinked} games linked)`,
      );
      setReloadKey((k) => k + 1);
    } catch {
      toast.error("Failed to seed defaults");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#15181E] p-3 md:p-4 min-w-0 overflow-x-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-4 py-3 rounded-md flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-normal text-white">Settings / Home &amp; Menus</h1>
          {isEmpty === true && (
            <p className="text-[11px] text-amber-400/90 mt-0.5">
              No menus configured yet — seed the defaults to get started.
            </p>
          )}
        </div>
        {showSeedButton && (
          <button
            onClick={handleSeedClick}
            disabled={seeding}
            title="Create the default sidebar menus & game categories"
            className="flex items-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white ring-2 ring-[#B93DEB]/40 transition-colors hover:bg-[#a32cd4] disabled:opacity-50 animate-pulse"
          >
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            {seeding ? "Seeding…" : "Seed Defaults"}
          </button>
        )}
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-[#15181E] border border-gray-800/50 p-1 mb-3 md:mb-4 w-full justify-start overflow-x-auto scrollbar-hide">
          <TabsTrigger
            value="categories"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="home"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Home Page Layout
          </TabsTrigger>
          <TabsTrigger
            value="lobby"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Lobby Tabs
          </TabsTrigger>
          <TabsTrigger
            value="jackpot"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Jackpot Cards
          </TabsTrigger>
          <TabsTrigger
            value="menus"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Menu Management
          </TabsTrigger>
          <TabsTrigger
            value="modals"
            className="shrink-0 whitespace-nowrap data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1.5 px-3 md:px-4 rounded-md transition-all"
          >
            Modal Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="focus-visible:outline-none">
          <CategoriesManager key={`cat-${reloadKey}`} />
        </TabsContent>
        <TabsContent value="home" className="focus-visible:outline-none">
          <HomeCategoriesManager key={`home-${reloadKey}`} />
        </TabsContent>
        <TabsContent value="lobby" className="focus-visible:outline-none">
          <LobbyTabsManager key={`lobby-${reloadKey}`} />
        </TabsContent>
        <TabsContent value="jackpot" className="focus-visible:outline-none">
          <JackpotCardsManager key={`jackpot-${reloadKey}`} />
        </TabsContent>
        <TabsContent value="menus" className="focus-visible:outline-none">
          <SidebarMenuManager key={`menus-${reloadKey}`} />
        </TabsContent>
        <TabsContent value="modals" className="focus-visible:outline-none">
          <ModalManager key={`modals-${reloadKey}`} />
        </TabsContent>
      </Tabs>

      <ConfirmSeedDialog
        open={confirmOpen}
        // Nothing to overwrite on a fresh database — only gate the re-seed.
        destructive={isEmpty !== true}
        title={isEmpty === true ? "Seed defaults?" : "Seed defaults again?"}
        description="This seeds the sidebar menus, game categories, modals, home page layout and live casino tabs."
        effects={[
          "Default sidebar menus and items get their default icon, link and order back (on/off state is kept)",
          "Missing game categories and modals are added; existing ones are not changed",
          "Home page layout: missing sections are added, sections for deleted categories are dropped, your order is kept",
          "Missing live casino tabs are created and empty manual tabs are filled with games",
        ]}
        note="Custom menus, categories and modals are not deleted."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runSeed}
      />
    </div>
  );
}
