"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo } from "react";
import { 
  ChevronLeft, 
  FolderPlus, 
  Upload, 
  Plus, 
  Folder as FolderIcon,
  File as FileIcon,
  MoreVertical,
  Trash2,
  Download,
  ExternalLink,
  ChevronRight,
  Edit,
  Loader2
} from "lucide-react";

import { useBannerPackStore } from "@/store/banner-pack-store";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { bannerPackApi } from "@/api/bannerpack/banner-pack.api";
import { BannerPack, BannerFolder, BannerPackFile } from "@/types/banner-pack";
import Image from "next/image";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notfound } from "@/assets/icons";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyStatePage from "@/components/emptystatePage";

export default function BannerPackEditor() {
  const { id } = useParams();
  const router = useRouter();
  const coverUploaderRef = useRef<ImageUploaderRef>(null);
  const [pack, setPack] = useState<BannerPack | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderNameError, setFolderNameError] = useState("");
  
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderNameEdit, setFolderNameEdit] = useState("");
  
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'folder' | 'file' } | null>(null);

  const fetchPackDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await bannerPackApi.getDetails(id as string);
      setPack(res.data);
      setEditTitle(res.data.title);
      setEditDescription(res.data.description);
      // Auto-select the default folder
      if (res.data.folders?.length > 0) {
        const def = res.data.folders.find((f: any) => f.isDefault) || res.data.folders[0];
        setSelectedFolderId(prev => prev ?? def.id);
      }
    } catch (err) {
      toast.error("Failed to load pack details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackDetails();
  }, [id]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setFolderNameError("Folder name cannot be empty.");
      return;
    }
    setFolderNameError("");
    try {
      await bannerPackApi.createFolder(id as string, newFolderName.trim());
      setNewFolderName("");
      setFolderDialogOpen(false);
      toast.success("Folder created");
      fetchPackDetails(true);
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setDeleteTarget({ id: folderId, type: 'folder' });
    setDeleteModalOpen(true);
  };

  const performFolderDelete = async (folderId: string) => {
    try {
      setIsDeleting(true);
      await bannerPackApi.deleteFolder(folderId);
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      toast.success("Folder deleted");
      await fetchPackDetails(true);
    } catch {
      toast.error("Failed to delete folder");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!folderNameEdit.trim()) {
      setEditingFolderId(null);
      return;
    }
    try {
      await bannerPackApi.updateFolder(folderId, folderNameEdit);
      setEditingFolderId(null);
      toast.success("Folder renamed");
      fetchPackDetails(true);
    } catch {
      toast.error("Failed to rename folder");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setIsUploading(true);
      await bannerPackApi.uploadFiles(id as string, Array.from(files), selectedFolderId || undefined);
      toast.success(`${files.length} file(s) uploaded`);
      await fetchPackDetails(true);
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
    e.target.value = "";
  };

  const handleAutoSave = async (title: string, description: string) => {
    try {
      await bannerPackApi.update(id as string, { title, description });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    setDeleteTarget({ id: fileId, type: 'file' });
    setDeleteModalOpen(true);
  };

  const performFileDelete = async (fileId: string) => {
    try {
      setIsDeleting(true);
      await bannerPackApi.deleteFile(fileId);
      toast.success("File deleted");
      await fetchPackDetails(true);
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'folder') {
      performFolderDelete(deleteTarget.id);
    } else {
      performFileDelete(deleteTarget.id);
    }
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDownloadFile = (fileId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/admin";
    // Using simple window.location.href with the proxy endpoint to guarantee download
    window.location.href = `${apiUrl}/banner-packs/files/${fileId}/download`;
  };

  const currentFolder = useMemo(() => {
    return pack?.folders?.find(f => f.id === selectedFolderId);
  }, [pack, selectedFolderId]);

  const displayFiles = useMemo(() => {
    if (selectedFolderId) {
      const folder = pack?.folders?.find(f => f.id === selectedFolderId);
      return folder?.files || [];
    }
    return pack?.files?.filter(f => !f.folderId) || [];
  }, [pack, selectedFolderId]);

  if (loading && !pack) return <BannerPackEditorSkeleton />;
  if (!pack) return <div className="p-10 text-white text-center">Pack not found</div>;

  return (
    <div className="bg-[#15181E] min-h-screen p-6 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-[#191D24] p-5 rounded-2xl border border-[#242B35] shadow-xl">
        <div className="flex items-center gap-5">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/settings/banner-pack-listing")}
            className="text-gray-400 hover:text-white hover:bg-[#242B35] rounded-xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="h-10 w-[1px] bg-[#242B35]" />
          <div>
            <input 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleAutoSave(editTitle, editDescription)}
              className="bg-transparent border-none text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-purple-500 rounded px-1 -ml-1"
            />
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onBlur={() => handleAutoSave(editTitle, editDescription)}
              className="bg-transparent border-none text-gray-500 text-xs mt-0.5 w-full focus:outline-none focus:ring-1 focus:ring-purple-500 rounded px-1 -ml-1"
            />
          </div>
        </div>
        {/* <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="text-gray-400 hover:text-white hover:bg-[#242B35]"
            onClick={() => router.push("/settings/banner-pack-listing")}
          >
            ← Back
          </Button>
        </div> */}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        
        {/* Sidebar / Folders */}
        <div className="space-y-4 lg:col-span-3">
          <div className="bg-[#191D24] p-4 rounded-xl border border-[#242B35]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Folders</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-purple-500 w-8 h-8 text-white hover:bg-purple-500/10"
                onClick={() => setFolderDialogOpen(true)}
              >
                <FolderPlus className="w-8 h-8" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {/* All folders from DB — default first, editable like any other */}
              {pack.folders
                ?.slice()
                .sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0))
                .map((folder) => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      selectedFolderId === folder.id 
                        ? 'bg-purple-600/10 text-purple-500 border border-purple-500/20 shadow-lg shadow-purple-500/5' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#242B35]'
                    }`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <FolderIcon className={`w-4 h-4 ${selectedFolderId === folder.id ? 'text-purple-500' : 'text-gray-500 group-hover:text-purple-400'}`} />
                      {editingFolderId === folder.id ? (
                        <input
                          autoFocus
                          value={folderNameEdit}
                          onChange={(e) => setFolderNameEdit(e.target.value)}
                          onBlur={() => handleRenameFolder(folder.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(folder.id);
                            if (e.key === 'Escape') setEditingFolderId(null);
                          }}
                          className="bg-[#15181E] border-none text-white text-sm focus:ring-1 focus:ring-purple-500 rounded px-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span 
                          className="truncate max-w-[140px]"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingFolderId(folder.id);
                            setFolderNameEdit(folder.name);
                          }}
                        >
                          {folder.name}
                        </span>
                      )}
                    </div>
                    {!editingFolderId && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        selectedFolderId === folder.id ? 'bg-purple-500/20 text-purple-400' : 'bg-[#15181E] text-gray-500'
                      }`}>
                        {folder.files?.length || 0}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-100">
                    {/* Actions moved to main header */}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cover Section */}
          <div className="bg-[#191D24] p-4 rounded-xl border border-[#242B35] space-y-4">
            <h2 className="text-white font-semibold">Cover Image</h2>
            <div className="relative aspect-video rounded-lg overflow-hidden border border-[#242B35] group">
              <Image 
                src={pack.coverImage || "/placeholder-image.png"} 
                alt="cover" 
                fill 
                className="object-cover" 
                unoptimized
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Button 
                  size="sm" 
                  className="bg-white text-black hover:bg-gray-200"
                  onClick={() => coverUploaderRef.current?.open()}
                >
                  Change
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content / Files */}
        <div className="min-w-0 space-y-4 lg:col-span-9">
          <div className="bg-[#191D24] p-3 sm:p-6 rounded-xl border border-[#242B35] min-h-[500px]">
            <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-[#242B35] sm:flex-row sm:items-center sm:justify-between sm:mb-8 sm:pb-6">
              <div className="flex min-w-0 items-center gap-2">
                <div className="bg-purple-500/10 p-2 rounded-lg">
                  <FolderIcon className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex flex-col">
                  <span className="truncate text-white font-semibold text-base sm:text-lg">{currentFolder ? currentFolder.name : "Uncategorized Assets"}</span>
                  <span className="text-gray-500 text-xs">{displayFiles.length} items in this folder</span>
                </div>
              </div>
              
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                {currentFolder && (
                  <div className="flex items-center gap-2 mr-4 pr-4 border-r border-[#242B35]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white hover:bg-[#242B35] h-9 px-3 gap-2"
                      onClick={() => {
                        setEditingFolderId(currentFolder.id);
                        setFolderNameEdit(currentFolder.name);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Rename
                    </Button>
                    {(pack?.folders?.length ?? 0) > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10 h-9 px-3 gap-2"
                        onClick={() => handleDeleteFolder(currentFolder.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    asChild
                    className="bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/30 font-medium px-5"
                  >
                    <label htmlFor="file-upload">
                      <Plus className="w-4 h-4 text-white" /> Add Files
                    </label>
                  </Button>
                </div>
              </div>
            </div>

            {/* File List / Content */}
            <div className="relative">
              {(isUploading || isDeleting) && (
                <div className="absolute inset-0 z-10 bg-[#191D24]/60 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center space-y-3 transition-all">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                    <div className="absolute inset-0 blur-lg bg-purple-500/20 rounded-full animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-white font-medium">
                      {isUploading ? "Uploading assets..." : "Removing asset..."}
                    </span>
                    <span className="text-gray-400 text-xs text-center px-10">
                      {isUploading 
                        ? "Please wait while we process and upload your files to the server."
                        : "Please wait while we permanently remove this asset from the library."}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {displayFiles.map((file) => (
                <div key={file.id} className="group bg-[#15181E] border border-[#242B35] rounded-xl p-3 hover:border-purple-500/50 transition-all">
                  <div className="aspect-square bg-[#191D24] rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                    {file.fileUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ? (
                      <Image 
                        src={file.fileUrl} 
                        alt={file.fileName} 
                        fill 
                        className="object-contain p-2"
                        unoptimized
                      />
                    ) : (
                      <FileIcon className="w-12 h-12 text-gray-600" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-white hover:bg-white/20"
                        onClick={() => handleDownloadFile(file.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white text-sm font-medium truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button 
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {displayFiles.length === 0 && (
                <div className="col-span-full py-12">
                  <EmptyStatePage
                    type="default"
                    image={notfound}
                    title="No Files Found"
                    description="This folder is empty. Start by uploading some assets!"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* NEW FOLDER DIALOG */}
      <Dialog
        open={folderDialogOpen}
        onOpenChange={(v) => {
          setFolderDialogOpen(v);
          if (!v) {
            setNewFolderName("");
            setFolderNameError("");
          }
        }}
      >
        <DialogContent className="bg-[#191D24] border-[#242B35] text-white">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-1">
            <label className="text-sm text-gray-400 mb-2 block">Folder Name</label>
            <Input 
              placeholder="e.g. Social Media Icons" 
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                if (e.target.value.trim()) setFolderNameError("");
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              className={`bg-[#15181E] border-[#242B35] text-white focus:ring-purple-500 ${
                folderNameError ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
              autoFocus
            />
            {folderNameError && (
              <p className="text-xs text-red-500 pt-0.5">{folderNameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setFolderDialogOpen(false); setFolderNameError(""); setNewFolderName(""); }} className="text-gray-400 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} className="bg-purple-600 text-white hover:bg-purple-700">
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HIDDEN COVER UPLOADER */}
      <ImageUploader
        ref={coverUploaderRef}
        aspect={16 / 9}
        folder="banner-packs"
        onUploadComplete={async (url) => {
          try {
            const t = toast.loading("Updating cover...");
            await bannerPackApi.update(id as string, { coverImage: url });
            toast.success("Cover updated", { id: t });
            fetchPackDetails(true);
          } catch {
            toast.error("Failed to update cover");
          }
        }}
      />

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-[#191D24] border-[#242B35] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="w-5 h-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-400 text-sm">
            Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 font-semibold">
              Delete Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannerPackEditorSkeleton() {
  return (
    <div className="bg-[#15181E] min-h-screen p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between bg-[#191D24] p-5 rounded-2xl border border-[#242B35]">
        <div className="flex items-center gap-5 w-full">
          <Skeleton className="w-10 h-10 rounded-xl bg-[#242B35]" />
          <div className="h-10 w-[1px] bg-[#242B35]" />
          <div className="space-y-2 w-1/3">
            <Skeleton className="h-7 w-48 bg-[#242B35]" />
            <Skeleton className="h-4 w-64 bg-[#242B35]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Sidebar Skeleton */}
        <div className="space-y-4 lg:col-span-3">
          <div className="bg-[#191D24] p-4 rounded-xl border border-[#242B35] space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20 bg-[#242B35]" />
              <Skeleton className="h-8 w-8 rounded-lg bg-[#242B35]" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl bg-[#242B35]" />
              ))}
            </div>
          </div>

          <div className="bg-[#191D24] p-4 rounded-xl border border-[#242B35] space-y-4">
            <Skeleton className="h-6 w-24 bg-[#242B35]" />
            <Skeleton className="aspect-video w-full rounded-lg bg-[#242B35]" />
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="min-w-0 lg:col-span-9 bg-[#191D24] rounded-2xl border border-[#242B35] flex flex-col min-h-[70vh]">
          <div className="p-6 border-b border-[#242B35]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl bg-[#242B35]" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32 bg-[#242B35]" />
                  <Skeleton className="h-4 w-24 bg-[#242B35]" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-24 rounded-lg bg-[#242B35]" />
                <Skeleton className="h-9 w-24 rounded-lg bg-[#242B35]" />
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-[#15181E] rounded-xl border border-[#242B35] overflow-hidden">
                  <Skeleton className="aspect-square w-full bg-[#242B35]" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-[#242B35]" />
                    <Skeleton className="h-3 w-1/2 bg-[#242B35]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}