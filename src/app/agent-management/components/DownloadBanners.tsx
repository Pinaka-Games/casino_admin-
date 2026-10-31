"use client";

import { useEffect, useState } from "react";
import { bannerPackApi } from "@/api/bannerpack/banner-pack.api";
import { BannerPack } from "@/types/banner-pack";
import Image from "next/image";
import { Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import JSZip from "jszip";
import EmptyStatePage from "@/components/emptystatePage";
import { notfound } from "@/assets/icons";

export default function DownloadBanners() {
  const [packs, setPacks] = useState<BannerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      setLoading(true);
      const res = await bannerPackApi.getPublicPacks();
      // Only show active packs
      setPacks(res.data.filter(p => p.isActive));
    } catch (err) {
      console.error("Failed to fetch banner packs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (pack: BannerPack) => {
    try {
      setDownloadingId(pack.id);
      const zip = new JSZip();

      // 1. Collect all unique files
      const filesToDownload: { id: string, name: string, path: string }[] = [];
      
      // Direct files
      if (pack.files) {
        pack.files.forEach((f: any) => {
          filesToDownload.push({ id: f.id, name: f.fileName, path: f.fileName });
        });
      }

      // Folder files
      if (pack.folders) {
        pack.folders.forEach((folder: any) => {
          if (folder.files) {
            folder.files.forEach((f: any) => {
              filesToDownload.push({ 
                id: f.id, 
                name: f.fileName, 
                path: `${folder.name}/${f.fileName}` 
              });
            });
          }
        });
      }

      if (filesToDownload.length === 0) {
        toast.error("No files found in this pack.");
        return;
      }

      // 2. Fetch all file binaries concurrently with progress tracking if needed
      // For now, simple Promise.all
      await Promise.all(
        filesToDownload.map(async (file) => {
          try {
            const res = await bannerPackApi.downloadFileBlob(file.id);
            zip.file(file.path, res.data);
          } catch (err) {
            console.error(`Failed to download file ${file.name}:`, err);
          }
        })
      );

      // 3. Generate and trigger download
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${pack.title}.zip`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      
    } catch (err) {
      toast.error("Failed to prepare download");
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-[#B93DEB] animate-spin" />
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="py-20">
        <EmptyStatePage 
          title="No Banner Packs"
          description="There are no banner packs available for download at the moment."
          image={notfound}
          imageWidth={200}
          imageHeight={100}
        />
      </div>
    );
  }

  return (
    <div className="bg-[#191D24] text-white p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
        {packs.map((pack) => (
          <div key={pack.id} className="bg-[#13171D] rounded-xl overflow-hidden border border-[#242B35] hover:border-[#B93DEB]/50 transition-all group">
            
            {/* Cover Image */}
            <div className="relative w-full h-52 bg-[#191D24] overflow-hidden">
              <Image 
                src={pack.coverImage || "/placeholder-image.png"} 
                alt={pack.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#13171D] to-transparent opacity-60" />
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-white text-lg font-bold group-hover:text-[#B93DEB] transition-colors">
                  {pack.title}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2 h-8">
                  {pack.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                <span>{pack.fileCount} Assets</span>
                <span>{pack.packSize}</span>
              </div>

              <button 
                onClick={() => handleDownload(pack)}
                disabled={downloadingId === pack.id}
                className="w-full bg-[#B93DEB] hover:bg-[#A32CD8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[#B93DEB]/20 flex items-center justify-center gap-2"
              >
                {downloadingId === pack.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download {pack.packSize}
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}