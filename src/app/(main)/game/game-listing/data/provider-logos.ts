/**
 * Provider (studio) logo lookup — resolved by the DB SLUG.
 *
 * These are STATIC imports on purpose. The previous version built the map with
 * `require.context`, which Turbopack does not implement: the call threw, the
 * catch swallowed it, and the map stayed empty — so every provider fell back to
 * its remote logo URL or, failing that, to plain text. That is why studios with
 * perfectly good art in this folder (Mascot Gaming, Novomatic, …) rendered as
 * names.
 *
 * To add a provider: drop `{slug}.svg` into `src/assets/images/providers/` and
 * add the matching import + map entry below. Keep the key lower-case; it is
 * matched against the DB slug and against a normalized provider name.
 */
import logo_3oaksgaming from "@/assets/images/providers/3oaksgaming.svg";
import logo_7777gaming from "@/assets/images/providers/7777gaming.svg";
import logo_betsoft from "@/assets/images/providers/betsoft.svg";
import logo_bigtimegaming from "@/assets/images/providers/bigtimegaming.svg";
import logo_boominggames from "@/assets/images/providers/boominggames.svg";
import logo_caleta from "@/assets/images/providers/caleta.svg";
import logo_cggames from "@/assets/images/providers/cggames.svg";
import logo_ctinteractive from "@/assets/images/providers/ctinteractive.svg";
import logo_elagames from "@/assets/images/providers/elagames.svg";
import logo_endorphina from "@/assets/images/providers/endorphina.svg";
import logo_eurasiangaming from "@/assets/images/providers/eurasiangaming.svg";
import logo_evolution from "@/assets/images/providers/evolution.svg";
import logo_ezugi from "@/assets/images/providers/ezugi.svg";
import logo_felixgaming from "@/assets/images/providers/felixgaming.svg";
import logo_gamingcorps from "@/assets/images/providers/gamingcorps.svg";
import logo_gamzix from "@/assets/images/providers/gamzix.svg";
import logo_gmw from "@/assets/images/providers/gmw.svg";
import logo_hacksawgaming from "@/assets/images/providers/hacksawgaming.svg";
import logo_iconic21 from "@/assets/images/providers/iconic21.svg";
import logo_jacktop from "@/assets/images/providers/jacktop.svg";
import logo_jili from "@/assets/images/providers/jili.svg";
import logo_kagaming from "@/assets/images/providers/kagaming.svg";
import logo_kalamba from "@/assets/images/providers/kalamba.svg";
import logo_mancala from "@/assets/images/providers/mancala.svg";
import logo_mascotgaming from "@/assets/images/providers/mascotgaming.svg";
import logo_netent from "@/assets/images/providers/netent.svg";
import logo_netgaming from "@/assets/images/providers/netgaming.svg";
import logo_nolimitcity from "@/assets/images/providers/nolimitcity.svg";
import logo_novomatic from "@/assets/images/providers/novomatic.svg";
import logo_onlyplay from "@/assets/images/providers/onlyplay.svg";
import logo_openrgs from "@/assets/images/providers/openrgs.svg";
import logo_penguinking from "@/assets/images/providers/penguinking.svg";
import logo_playson from "@/assets/images/providers/playson.svg";
import logo_redrakegaming from "@/assets/images/providers/redrakegaming.svg";
import logo_redtigergaming from "@/assets/images/providers/redtigergaming.svg";
import logo_sagaming from "@/assets/images/providers/sagaming.svg";
import logo_slotmill from "@/assets/images/providers/slotmill.svg";
import logo_spinomenal from "@/assets/images/providers/spinomenal.svg";
import logo_spinoro from "@/assets/images/providers/spinoro.svg";
import logo_triplecherry from "@/assets/images/providers/triplecherry.svg";

/** Normalize a provider/studio name into the DB-style slug. */
export const normalizeProviderKey = (value: string): string =>
  (value || "").toLowerCase().replace(/[\s_'’.-]+/g, "");

const LOGO_BY_SLUG: Record<string, any> = {
  "3oaksgaming": logo_3oaksgaming,
  "7777gaming": logo_7777gaming,
  "betsoft": logo_betsoft,
  "bigtimegaming": logo_bigtimegaming,
  "boominggames": logo_boominggames,
  "caleta": logo_caleta,
  "cggames": logo_cggames,
  "ctinteractive": logo_ctinteractive,
  "elagames": logo_elagames,
  "endorphina": logo_endorphina,
  "eurasiangaming": logo_eurasiangaming,
  "evolution": logo_evolution,
  "ezugi": logo_ezugi,
  "felixgaming": logo_felixgaming,
  "gamingcorps": logo_gamingcorps,
  "gamzix": logo_gamzix,
  "gmw": logo_gmw,
  "hacksawgaming": logo_hacksawgaming,
  "iconic21": logo_iconic21,
  "jacktop": logo_jacktop,
  "jili": logo_jili,
  "kagaming": logo_kagaming,
  "kalamba": logo_kalamba,
  "mancala": logo_mancala,
  "mascotgaming": logo_mascotgaming,
  "netent": logo_netent,
  "netgaming": logo_netgaming,
  "nolimitcity": logo_nolimitcity,
  "novomatic": logo_novomatic,
  "onlyplay": logo_onlyplay,
  "openrgs": logo_openrgs,
  "penguinking": logo_penguinking,
  "playson": logo_playson,
  "redrakegaming": logo_redrakegaming,
  "redtigergaming": logo_redtigergaming,
  "sagaming": logo_sagaming,
  "slotmill": logo_slotmill,
  "spinomenal": logo_spinomenal,
  "spinoro": logo_spinoro,
  "triplecherry": logo_triplecherry,
};

/** Look up a provider logo by its DB SLUG; null when no `{slug}.svg` exists. */
export const getProviderLogoBySlug = (slug?: string | null): any | null =>
  slug ? (LOGO_BY_SLUG[normalizeProviderKey(slug)] ?? null) : null;

/** Convenience: resolve curated art by a studio NAME (derives the slug). */
export const getProviderLogo = (name: string): any | null =>
  getProviderLogoBySlug(normalizeProviderKey(name));
