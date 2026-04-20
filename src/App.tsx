/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pencil, 
  ChevronLeft, 
  X, 
  Trash2, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin,
  Youtube,
  Cloud,
  Image as ImageIcon,
  Type,
  Lock,
  Share2,
  Copy,
  GripHorizontal,
  PlusCircle,
  Palette,
  Type as TypeIcon,
  Globe,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Plus,
  ExternalLink,
  Printer,
  Upload,
  Video,
  Check
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  db, 
  BlogData, 
  INITIAL_DATA, 
  saveBlog, 
  duplicateBlog, 
  InfoSection, 
  blogsQuery, 
  deleteBlog, 
  createNewBlog,
  renameBlog,
  toggleBlogStatus
} from './lib/firebase';

// --- Constants ---

const PASSWORD_KEY = "STUDIO9886";
const DASHBOARD_PASSWORD = "GROWINGOLD9886";
const VIBRANT_COLORS = ['#FFDE59', '#FF1694', '#8A2BE2', '#4CAF50', '#00D4FF', '#FF6321', '#FFFFFF'];

// --- Sub-components ---

const Typewriter = ({ words }: { words: string[] }) => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [speed, setSpeed] = useState(150);

  useEffect(() => {
    if (!words || words.length === 0) return;
    const handleType = () => {
      const currentWord = words[index];
      const shouldDelete = isDeleting;

      setDisplayText(prev => 
        shouldDelete 
          ? currentWord.substring(0, prev.length - 1)
          : currentWord.substring(0, prev.length + 1)
      );

      setSpeed(shouldDelete ? 75 : 150);

      if (!shouldDelete && displayText === currentWord) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (shouldDelete && displayText === '') {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % words.length);
      }
    };

    const timer = setTimeout(handleType, speed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, index, words, speed]);

  return (
    <div className="bg-white/80 backdrop-blur-xl px-10 py-5 rounded-full inline-flex items-center gap-3 border-4 border-white shadow-2xl">
      <span className="font-heading text-xl font-black uppercase tracking-widest text-[#FF1694]">{displayText}</span>
      <span className="w-1.5 h-1.5 rounded-full bg-[#8A2BE2] animate-ping" />
    </div>
  );
};

const SortableInfoItem = ({ section, isEditMode, index }: { section: InfoSection, isEditMode?: boolean, index?: number, key?: any }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colors = [
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-500', accent: '#FB7185' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-500', accent: '#818CF8' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-500', accent: '#34D399' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-500', accent: '#FBBF24' },
  ];
  
  const color = colors[(index || 0) % colors.length];

  return (
    <motion.div 
      ref={setNodeRef} 
      whileHover={{ y: -5, scale: 1.02 }}
      className={`${color.bg} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_15px_30px_rgba(0,0,0,0.04)] border-4 border-white relative group flex flex-col mb-4 break-inside-avoid info-item w-full transition-all`}
      style={{ ...style }}
    >
      {isEditMode && (
        <div {...attributes} {...listeners} className="absolute top-4 right-4 cursor-grab opacity-20 group-hover:opacity-100 p-2 bg-white rounded-xl shadow-sm no-print z-10 transition-opacity">
          <GripHorizontal size={16} />
        </div>
      )}
      <h2 className={`font-black uppercase tracking-[0.2em] text-[8px] mb-2 font-heading ${color.text}`}>
        {section.label}
      </h2>
      <p className="text-gray-700 text-xs md:text-sm leading-tight font-medium break-words">
        {section.value}
      </p>
      
      <div className="mt-auto pt-2 flex justify-end no-print">
         <div className="w-2.5 h-2.5 rounded-full opacity-20" style={{ backgroundColor: color.accent }}></div>
      </div>
    </motion.div>
  );
};

const SortableGenericItem: React.FC<{ id: string, children: React.ReactNode, isEditMode?: boolean }> = ({ id, children, isEditMode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isEditMode && (
        <div {...attributes} {...listeners} className="absolute top-2 left-2 cursor-grab opacity-30 group-hover:opacity-100 p-2 bg-gray-900 rounded-xl shadow-lg z-20 border border-gray-700">
          <GripHorizontal size={14} className="text-white" />
        </div>
      )}
      {children}
    </div>
  );
};

export default function App() {
  const [blogId, setBlogId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'default-vibrant-blog';
  });

  const [data, setData] = useState<BlogData>(INITIAL_DATA);
  const [editData, setEditData] = useState<BlogData>(INITIAL_DATA);
  const [allBlogs, setAllBlogs] = useState<BlogData[]>([]);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isImpactPanelOpen, setIsImpactPanelOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [editTab, setEditTab] = useState<'info' | 'contents' | 'impact'>('info');
  const [copyStatus, setCopyStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // Auto-save logic
  useEffect(() => {
    if (!blogId || !isEditPanelOpen) return;
    
    // Skip auto-save if no changes made locally
    if (!isDirty) return;

    const handler = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);
        await saveBlog(blogId, editData);
        setLastSaved(new Date());
        setIsDirty(false); // Reset dirty flag after successful save
      } catch (err: any) {
        console.error("Auto-save failed:", err);
        setSaveError(err.message || "Cloud Save Failed");
      } finally {
        setTimeout(() => setIsSaving(false), 300);
      }
    }, 5000); // 5s is requested by the user

    return () => clearTimeout(handler);
  }, [editData, blogId, isEditPanelOpen, isDirty]);
  const [isEditAuthenticated, setIsEditAuthenticated] = useState(false);
  const [isDashboardAuthenticated, setIsDashboardAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState<'edit' | 'dashboard' | null>(null);

  const updateEditData = (newData: BlogData | ((prev: BlogData) => BlogData)) => {
    setEditData(newData);
    setIsDirty(true);
    setSaveError(null);
  };

  useEffect(() => {
    if (!blogId) return;
    const unsub = onSnapshot(doc(db, 'blogs', blogId), (snapshot) => {
      if (snapshot.exists()) {
        const blog = { ...snapshot.data() as BlogData, id: snapshot.id };
        setData(blog);
        
        // Sync local edit state only if panel is closed or if local state is empty/sync
        const isCurrentlyPristine = !isEditPanelOpen;
        if (isCurrentlyPristine) {
          setEditData(blog);
        }
      } else if (blogId === 'default-vibrant-blog') {
        saveBlog(blogId, INITIAL_DATA);
      }
    });

    // Listen to all blogs for the dashboard
    const unsubBlogs = onSnapshot(blogsQuery, (snap) => {
      const blogs = snap.docs.map(doc => ({ ...doc.data() as BlogData, id: doc.id }));
      setAllBlogs(blogs);
    });

    return () => {
      unsub();
      unsubBlogs();
    };
  }, [blogId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

   const handleDragEndInfo = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      updateEditData((items) => {
        const oldIndex = items.infoSections.findIndex((i) => i.id === active.id);
        const newIndex = items.infoSections.findIndex((i) => i.id === over?.id);
        return {
          ...items,
          infoSections: arrayMove(items.infoSections, oldIndex, newIndex),
        };
      });
    }
  }, [editData, blogId]);

  const handleDragEndImpact = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      updateEditData((items) => {
        const oldIndex = items.socialImpact.findIndex((i) => i.id === active.id);
        const newIndex = items.socialImpact.findIndex((i) => i.id === over?.id);
        return {
          ...items,
          socialImpact: arrayMove(items.socialImpact, oldIndex, newIndex),
        };
      });
    }
  }, [editData, blogId]);

  const handleDragEndContents = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      updateEditData((items) => {
        const oldIndex = items.contentBlocks.findIndex((i) => i.id === active.id);
        const newIndex = items.contentBlocks.findIndex((i) => i.id === over?.id);
        return {
          ...items,
          contentBlocks: arrayMove(items.contentBlocks, oldIndex, newIndex),
        };
      });
    }
  }, [editData, blogId]);

  const handlePasswordSubmit = () => {
    if (showPasswordDialog === 'dashboard') {
      if (passwordInput === DASHBOARD_PASSWORD) {
        setIsDashboardAuthenticated(true);
        setIsDashboardOpen(true);
        setShowPasswordDialog(null);
        setPasswordInput('');
      } else {
        alert("Incorrect Dashboard Password!");
      }
    } else {
      const correctPassword = data.password || PASSWORD_KEY;
      if (passwordInput === correctPassword) {
        setIsEditAuthenticated(true);
        setIsEditPanelOpen(true);
        setShowPasswordDialog(null);
        setPasswordInput('');
      } else {
        alert("Incorrect Editor Password!");
      }
    }
  };

  const openProtected = (type: 'edit' | 'dashboard') => {
    if (type === 'edit' && isEditAuthenticated) {
      setIsEditPanelOpen(true);
    } else if (type === 'dashboard' && isDashboardAuthenticated) {
      setIsDashboardOpen(true);
    } else {
      setShowPasswordDialog(type);
    }
  };

  const manualSave = async () => {
    if (blogId) {
      try {
        setIsSaving(true);
        setSaveError(null);
        await saveBlog(blogId, editData);
        setLastSaved(new Date());
        setIsDirty(false);
      } catch (err: any) {
        console.error("Manual save failed:", err);
        setSaveError(err.message || "Manual Save Failed");
      } finally {
        setTimeout(() => setIsSaving(false), 500);
      }
    }
  };

  const handleUpdate = async () => {
    if (blogId) {
      try {
        setIsSaving(true);
        await saveBlog(blogId, editData);
        setIsEditPanelOpen(false);
        setIsEditAuthenticated(false);
        setData(editData);
        setLastSaved(new Date());
      } catch (err) {
        alert("Failed to save changes. Please check your connection.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.querySelector('main');
    if (!element) return;
    
    // Alert user that generation might take a moment
    const btn = document.getElementById('print-btn');
    if (btn) btn.innerHTML = '<span class="animate-spin">🌀</span>';

    const canvas = await html2canvas(element, { 
      scale: 1, 
      useCORS: true, 
      allowTaint: true,
      ignoreElements: (el) => el.classList.contains('no-print')
    });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfImgHeight = (imgProps.height * width) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, width, pdfImgHeight);
    pdf.save(`${data.profile.name}-blog.pdf`);
    
    if (btn) btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"></path><rect x="6" y="14" width="12" height="8" rx="2"></rect></svg>';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePic' | 'coverPhoto' | 'impactMedia', impactIdx?: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        if (field === 'profilePic') {
          updateEditData({ ...editData, profile: { ...editData.profile, profilePic: url } });
        } else if (field === 'coverPhoto') {
          updateEditData({ ...editData, profile: { ...editData.profile, coverPhoto: url } });
        } else if (field === 'impactMedia' && impactIdx !== undefined) {
          const blocks = [...editData.socialImpact];
          blocks[impactIdx].mediaUrl = url;
          updateEditData({ ...editData, socialImpact: blocks });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDuplicate = async (blogToCopy: BlogData) => {
    const newId = await duplicateBlog(blogToCopy);
    setCopyStatus(true);
    setTimeout(() => {
      setCopyStatus(false);
      window.location.href = `?id=${newId}`;
    }, 1500);
  };

  const handleCreateNew = async () => {
    const newId = await createNewBlog();
    window.location.href = `?id=${newId}`;
  };

  const handleDelete = async (id: string) => {
    if (confirm("🚨 DANGER ZONE\n\nAre you sure you want to delete this website permanently? This action cannot be undone and you will lose all progress.")) {
      await deleteBlog(id);
      if (id === blogId) {
        window.location.href = window.location.origin;
      }
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const newName = prompt("Rename Website:", currentName);
    if (newName && newName !== currentName) {
      await renameBlog(id, newName);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleBlogStatus(id, currentStatus);
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/?id=${id}`;
    navigator.clipboard.writeText(url);
    alert("🚀 Link copied to clipboard!\n\nYou can now share this link with anyone. The link will always show your latest cloud-saved changes.");
  };

  const addInfoSection = () => {
    updateEditData({
      ...editData,
      infoSections: [
        ...editData.infoSections,
        { id: Math.random().toString(36).substr(2, 9), label: 'New Label', value: 'New Value' }
      ]
    });
  };

  const addImpactBlock = (type: 'positive' | 'negative') => {
    updateEditData({
      ...editData,
      socialImpact: [
        ...editData.socialImpact,
        { id: Math.random().toString(36).substr(2, 9), type, label: type === 'positive' ? 'New Positive' : 'New Negative', value: 'New impact description...' }
      ]
    });
  };

  const addBlock = (type: 'text' | 'image' | 'video') => {
    updateEditData({
      ...editData,
      contentBlocks: [
        ...editData.contentBlocks,
        { id: Math.random().toString(36).substr(2, 9), type, value: '' }
      ]
    });
  };

  const SocialIcon = ({ type, url }: { type: string, url: string, key?: any }) => {
    if (!url) return null;
    const Icons: Record<string, any> = {
      facebook: Facebook,
      twitter: Twitter,
      instagram: Instagram,
      linkedin: Linkedin,
      youtube: Youtube
    };
    const Icon = Icons[type];
    return (
      <a href={url} target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-[20px] flex items-center justify-center text-[#FF1694] hover:bg-[#FF1694] hover:text-white hover:scale-110 cursor-pointer transition-all shadow-lg border-2 border-white">
        <Icon size={22} />
      </a>
    );
  };

  return (
    <div 
      className="min-h-screen font-sans flex overflow-hidden transition-all duration-500"
      style={{ backgroundColor: data.settings.bgColor, color: data.settings.textColor, fontSize: `${data.settings.fontSize}px` }}
    >
      {/* Password Overlay */}
      {showPasswordDialog && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border-t-8 border-[#FF1694]">
            <h2 className="text-2xl font-black uppercase text-center mb-6 text-black">Restricted Area</h2>
            <input 
              type="password" 
              placeholder="Enter Password..."
              className="w-full bg-gray-100 p-4 rounded-xl mb-4 text-center font-bold tracking-widest text-black"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setShowPasswordDialog(null)}
                className="flex-1 py-3 font-bold text-gray-400"
              >
                Cancel
              </button>
              <button 
                onClick={handlePasswordSubmit}
                className="flex-1 py-3 bg-[#FF1694] text-white rounded-xl font-black uppercase shadow-lg shadow-pink-200"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Websites Dashboard Panel */}
      <AnimatePresence>
        {isDashboardOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
               onClick={() => {
                 setIsDashboardOpen(false);
                 setIsDashboardAuthenticated(false);
               }}
             />
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden relative shadow-2xl border-b-[12px] border-[#8A2BE2] flex flex-col max-h-[90vh]"
             >
               {/* Dashboard Header */}
               <div className="p-10 flex justify-between items-center border-b border-gray-100 bg-gray-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner">
                      <Globe size={32} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-black flex items-center gap-2">My Websites</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Manage your projects &bull; <span className="text-red-500">{allBlogs.length} Sites Running</span></p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                   <button 
                    onClick={handleCreateNew}
                    className="bg-[#FF4D4D] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-red-200"
                   >
                     <Plus size={20} /> New Site
                   </button>
                    <button 
                      onClick={() => {
                        setIsDashboardOpen(false);
                        setIsDashboardAuthenticated(false);
                      }} 
                      className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-black"
                    >
                     <X size={24} />
                   </button>
                 </div>
               </div>

               {/* Dashboard Content */}
               <div className="flex-1 overflow-y-auto p-10 bg-white grid grid-cols-1 md:grid-cols-2 gap-8 scrollbar-hide">
                 {allBlogs.map((blog) => {
                   const isCurrent = blog.id === blogId;
                   const lastUpdated = blog.updatedAt?.toDate 
                    ? blog.updatedAt.toDate().toLocaleDateString()
                    : new Date().toLocaleDateString();

                   return (
                     <div 
                      key={blog.id} 
                      className={`p-8 rounded-[2.5rem] border-2 transition-all group relative ${isCurrent ? 'bg-emerald-50/10 border-emerald-400/30 shadow-sm' : 'bg-gray-50/50 border-gray-100 hover:border-indigo-200'}`}
                     >
                       <div className="flex justify-between items-start mb-4">
                         <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400">
                           <Globe size={24} />
                         </div>
                         <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleToggleStatus(blog.id!, blog.isActive)}
                              className={`p-2 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center transition-colors ${blog.isActive ? 'text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}
                            >
                              {blog.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button 
                              onClick={() => handleShare(blog.id!)}
                              className="p-2 bg-white rounded-lg hover:text-blue-500 shadow-sm border border-gray-100 flex items-center justify-center"
                            >
                              <LinkIcon size={14} />
                            </button>
                            <button 
                              onClick={() => handleRename(blog.id!, blog.name)}
                              className="p-2 bg-white rounded-lg hover:text-amber-500 shadow-sm border border-gray-100 flex items-center justify-center"
                            >
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDuplicate(blog)} className="p-2 bg-white rounded-lg hover:text-indigo-500 shadow-sm border border-gray-100"><Copy size={14} /></button>
                            <button onClick={() => handleDelete(blog.id!)} className="p-2 bg-white rounded-lg hover:text-red-500 shadow-sm border border-gray-100"><Trash2 size={14} /></button>
                         </div>
                       </div>
                       
                       <div className="mb-8">
                         <h3 className="text-2xl font-black uppercase text-black tracking-tight mb-1">{blog.name}</h3>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                           Last Updated {lastUpdated}
                         </p>
                       </div>

                       <div className="flex gap-2">
                         {blog.isActive ? (
                            <div className="w-full bg-emerald-50 text-emerald-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-center border-2 border-emerald-100">
                              Currently Active
                            </div>
                         ) : (
                            <button 
                              onClick={() => {
                                setBlogId(blog.id!);
                                window.location.href = `?id=${blog.id}`;
                              }}
                              className="w-full bg-white text-gray-900 border-2 border-gray-200 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                            >
                              Open Site <ExternalLink size={14} />
                            </button>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
               {copyStatus && <div className="absolute top-0 inset-x-0 h-1 bg-[#8A2BE2] animate-pulse"></div>}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Edit Panel */}
      <AnimatePresence>
        {isEditPanelOpen && (
          <motion.div
            id="studio-panel"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            className="fixed left-0 top-0 bottom-0 w-full md:w-[500px] bg-[#1A1A1A] text-white z-50 overflow-hidden flex flex-col border-r-0 md:border-r-[12px] border-[#8A2BE2] shadow-2xl no-print"
          >
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-[#8A2BE2]">Studio Panel</h2>
                <div className="flex items-center gap-2 mt-1">
                  {saveError ? (
                    <span className="flex items-center gap-1 text-[8px] text-red-500 font-black uppercase">
                      <div className="w-1 h-1 rounded-full bg-red-500"></div> {saveError === "Quota exceeded." ? "Cloud Quota Full" : "Sync Error"}
                    </span>
                  ) : isSaving ? (
                    <span className="flex items-center gap-1 text-[8px] text-amber-500 font-black uppercase animate-pulse">
                      <div className="w-1 h-1 rounded-full bg-amber-500"></div> Syncing...
                    </span>
                  ) : isDirty ? (
                    <span className="flex items-center gap-1 text-[8px] text-amber-300 font-black uppercase">
                      <div className="w-1 h-1 rounded-full bg-amber-300"></div> Pending Save (5s)
                    </span>
                  ) : lastSaved ? (
                    <span className="text-[8px] text-emerald-500 font-black uppercase flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-emerald-500"></div> DONE
                    </span>
                  ) : (
                    <span className="text-[8px] text-gray-500 font-black uppercase">Draft Active</span>
                  )}
                </div>
              </div>
               <div className="flex items-center gap-2">
                <button 
                  onClick={manualSave}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    isDirty 
                      ? "bg-[#8A2BE2] text-white shadow-[0_0_15px_rgba(138,43,226,0.5)] scale-105" 
                      : "bg-gray-800 text-gray-500"
                  }`}
                  title="Force Cloud Save"
                >
                  <Cloud size={14} /> {isSaving ? "Saving..." : "Save Cloud"}
                </button>
                <button 
                  id="print-btn"
                  onClick={handleDownloadPDF}
                  className="hover:bg-gray-800 p-2 rounded-xl transition-colors text-white/50 hover:text-white"
                  title="Download PDF"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={() => {
                    setIsEditPanelOpen(false);
                    setIsEditAuthenticated(false);
                  }} 
                  className="hover:bg-gray-800 p-2 rounded-xl transition-colors text-white/50 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

              <div className="flex p-2 bg-gray-900 mx-6 mt-6 rounded-2xl gap-1">
                <button 
                  onClick={() => setEditTab('info')}
                  className={`flex-1 py-3 rounded-xl font-black uppercase text-[8px] tracking-[0.1em] transition-all ${editTab === 'info' ? 'bg-[#8A2BE2] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  Profile
                </button>
                <button 
                  onClick={() => setEditTab('contents')}
                  className={`flex-1 py-3 rounded-xl font-black uppercase text-[8px] tracking-[0.1em] transition-all ${editTab === 'contents' ? 'bg-[#FF1694] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  Posts
                </button>
                <button 
                  onClick={() => setEditTab('impact')}
                  className={`flex-1 py-3 rounded-xl font-black uppercase text-[8px] tracking-[0.1em] transition-all ${editTab === 'impact' ? 'bg-[#FFDE59] text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  Impact
                </button>
              </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                {editTab === 'info' ? (
                  <>
                    <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-[#8A2BE2] flex items-center gap-2">
                       <ImageIcon size={14} /> Profile Visuals
                    </h3>
                     <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 mb-1 block">Profile Pic</label>
                        <div className="flex gap-2">
                          <input className="hidden" id="pfp-upload" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'profilePic')} />
                          <label htmlFor="pfp-upload" className="bg-gray-800 p-2 rounded text-[#8A2BE2] hover:bg-gray-700 cursor-pointer transition-colors">
                            <Upload size={14} />
                          </label>
                          <input className="flex-1 bg-gray-800 p-2 rounded text-xs border border-transparent focus:border-[#8A2BE2] outline-none" 
                            placeholder="URL"
                            value={editData.profile.profilePic} 
                            onChange={(e) => updateEditData({ ...editData, profile: { ...editData.profile, profilePic: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 mb-1 block">Cover Photo</label>
                        <div className="flex gap-2">
                          <input className="hidden" id="cover-upload" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'coverPhoto')} />
                          <label htmlFor="cover-upload" className="bg-gray-800 p-2 rounded text-[#8A2BE2] hover:bg-gray-700 cursor-pointer transition-colors">
                            <Upload size={14} />
                          </label>
                          <input className="flex-1 bg-gray-800 p-2 rounded text-xs border border-transparent focus:border-[#8A2BE2] outline-none" 
                            placeholder="URL"
                            value={editData.profile.coverPhoto} 
                            onChange={(e) => updateEditData({ ...editData, profile: { ...editData.profile, coverPhoto: e.target.value } })}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-[#8A2BE2] flex items-center gap-2">
                       <TypeIcon size={14} /> Typewriter Effect
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                       {[0,1,2].map(i => (
                         <input key={i} className="w-full bg-gray-800 p-2 rounded-lg text-[9px] font-bold" 
                            placeholder={`Word ${i+1}`}
                            value={editData.settings.typewriterWords[i] || ''}
                            onChange={(e) => {
                              const words = [...editData.settings.typewriterWords];
                              words[i] = e.target.value;
                              updateEditData({ ...editData, settings: { ...editData.settings, typewriterWords: words } });
                            }}
                         />
                       ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-[#8A2BE2] flex items-center gap-2">
                       <TypeIcon size={14} /> Identity
                    </h3>
                    <input className="w-full bg-gray-800 p-3 rounded-xl text-sm font-bold" 
                      placeholder="Display Name"
                      value={editData.profile.name} 
                      onChange={(e) => updateEditData({ ...editData, profile: { ...editData.profile, name: e.target.value } })}
                    />
                    <textarea className="w-full bg-gray-800 p-3 rounded-xl text-sm h-16 resize-none" 
                      placeholder="My Bio..."
                      value={editData.profile.bio} 
                      onChange={(e) => updateEditData({ ...editData, profile: { ...editData.profile, bio: e.target.value } })}
                    />
                  </section>

                  <section className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black uppercase text-[#8A2BE2]">Draggable Boxes</h3>
                      <button onClick={addInfoSection} className="text-[#8A2BE2]"><PlusCircle size={20} /></button>
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndInfo}>
                      <SortableContext items={editData.infoSections.map(s => s.id)} strategy={rectSortingStrategy}>
                        <div className="space-y-3">
                          {editData.infoSections.map((s, idx) => (
                            <SortableGenericItem key={s.id} id={s.id} isEditMode={true}>
                              <div className="bg-gray-800 p-4 pl-12 rounded-2xl flex flex-col gap-2 border border-white/5">
                                <input className="bg-transparent text-[10px] font-black uppercase text-[#8A2BE2] border-none outline-none" 
                                  value={s.label}
                                  onChange={(e) => {
                                    const newSections = [...editData.infoSections];
                                    newSections[idx].label = e.target.value;
                                    updateEditData({ ...editData, infoSections: newSections });
                                  }}
                                />
                                <div className="flex gap-2">
                                  <textarea className="flex-1 bg-gray-900/50 p-2 rounded-xl text-xs text-white outline-none resize-none h-16 border border-white/5" 
                                    value={s.value}
                                    onChange={(e) => {
                                      const newSections = [...editData.infoSections];
                                      newSections[idx].value = e.target.value;
                                      updateEditData({ ...editData, infoSections: newSections });
                                    }}
                                  />
                                  <button onClick={() => updateEditData({ ...editData, infoSections: editData.infoSections.filter(i => i.id !== s.id) })} className="text-red-500/50 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                              </div>
                            </SortableGenericItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-[#8A2BE2]">Settings & Style</h3>
                    <div className="flex items-center gap-4">
                       <Palette size={16} />
                       <div className="flex gap-2">
                         {VIBRANT_COLORS.map(c => (
                           <button key={c} onClick={() => updateEditData({ ...editData, settings: { ...editData.settings, bgColor: c } })} className="w-6 h-6 rounded-full border border-gray-700" style={{ backgroundColor: c }} />
                         ))}
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <TypeIcon size={16} />
                       <input type="range" min="12" max="24" value={editData.settings.fontSize} onChange={(e) => updateEditData({ ...editData, settings: { ...editData.settings, fontSize: parseInt(e.target.value) } })} className="flex-1 accent-[#8A2BE2]" />
                       <span className="text-[10px] font-bold">{editData.settings.fontSize}px</span>
                    </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 block mb-2">Password Protection</label>
                        <input className="w-full bg-gray-800 p-3 rounded-xl text-xs border border-transparent focus:border-[#8A2BE2] outline-none" 
                          type="text"
                          placeholder="Change password..."
                          value={editData.password || ''}
                          onChange={(e) => updateEditData({ ...editData, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 block mb-2">Typewriter Words (Comma separated)</label>
                      <input className="w-full bg-gray-800 p-3 rounded-xl text-xs" 
                        value={(editData.settings.typewriterWords || []).join(', ')}
                        onChange={(e) => updateEditData({ ...editData, settings: { ...editData.settings, typewriterWords: e.target.value.split(',').map(s => s.trim()) } })}
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-[#8A2BE2]">Social Relations</h3>
                    {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'].map(plat => (
                      <div key={plat} className="flex gap-2 items-center">
                        <span className="w-20 text-[9px] uppercase font-bold text-gray-500">{plat}</span>
                        <input className="flex-1 bg-gray-800 p-2 rounded text-[10px]" 
                          value={(editData.profile.socials as any)?.[plat] || ''}
                          onChange={(e) => {
                            const newSocials = { ...editData.profile.socials, [plat]: e.target.value };
                            updateEditData({ ...editData, profile: { ...editData.profile, socials: newSocials } });
                          }}
                        />
                      </div>
                    ))}
                  </section>
                </>
                ) : editTab === 'contents' ? (
                  <div className="space-y-6">
                  <div className="flex gap-2">
                    <button onClick={() => addBlock('text')} className="flex-1 bg-gray-800 py-3 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-black uppercase">
                      <Type size={16} /> TEXT
                    </button>
                    <button onClick={() => addBlock('image')} className="flex-1 bg-gray-800 py-3 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-black uppercase">
                      <ImageIcon size={16} /> IMAGE
                    </button>
                    <button onClick={() => addBlock('video')} className="flex-1 bg-gray-800 py-3 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-black uppercase">
                      <Youtube size={16} /> VIDEO
                    </button>
                  </div>

                  <div className="space-y-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndContents}>
                      <SortableContext items={editData.contentBlocks.map(b => b.id)} strategy={rectSortingStrategy}>
                        {editData.contentBlocks.map((block, bIdx) => (
                           <SortableGenericItem key={block.id} id={block.id} isEditMode={true}>
                             <div className="bg-gray-800 p-4 pl-12 rounded-3xl border border-gray-700 relative group overflow-hidden">
                              <button onClick={() => updateEditData({ ...editData, contentBlocks: editData.contentBlocks.filter(b => b.id !== block.id) })} className="absolute -top-1 -right-1 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <Trash2 size={12} />
                              </button>
                              <h4 className="text-[9px] font-black uppercase mb-2 text-[#FF1694]">{block.type} BLOCK</h4>
                              <textarea className="w-full bg-gray-900 border border-gray-700 p-3 rounded-2xl text-xs h-24 resize-none" 
                                value={block.value}
                                onChange={(e) => {
                                  const blocks = [...editData.contentBlocks];
                                  blocks[bIdx].value = e.target.value;
                                  updateEditData({ ...editData, contentBlocks: blocks });
                                }}
                                placeholder={`Enter ${block.type} source/content...`}
                              />
                            </div>
                           </SortableGenericItem>
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
                ) : (
                  <div className="space-y-6">
                    <section className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-[#FFDE59]">Side Panel Title</label>
                       <input 
                         className="w-full bg-gray-800 p-3 rounded-xl text-sm font-bold border border-white/10"
                         value={editData.impactTitle || ''}
                         onChange={(e) => updateEditData({ ...editData, impactTitle: e.target.value })}
                       />
                    </section>

                    <div className="flex gap-2">
                      <button onClick={() => addImpactBlock('positive')} className="flex-1 bg-green-900/30 text-green-400 py-3 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-black uppercase border border-green-800/50">
                        <PlusCircle size={16} /> POSITIVE
                      </button>
                      <button onClick={() => addImpactBlock('negative')} className="flex-1 bg-red-900/30 text-red-400 py-3 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-black uppercase border border-red-800/50">
                        <PlusCircle size={16} /> NEGATIVE
                      </button>
                    </div>

                    <div className="space-y-4">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndImpact}>
                        <SortableContext items={editData.socialImpact.map(i => i.id)} strategy={rectSortingStrategy}>
                          {editData.socialImpact?.map((block, idx) => (
                            <SortableGenericItem key={block.id} id={block.id} isEditMode={true}>
                              <div className={`p-4 pl-12 rounded-3xl border relative group ${block.type === 'positive' ? 'bg-green-900/10 border-green-800/30' : 'bg-red-900/10 border-red-800/30'}`}>
                                <button onClick={() => updateEditData({ ...editData, socialImpact: editData.socialImpact.filter(b => b.id !== block.id) })} className="absolute -top-1 -right-1 bg-gray-800 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <Trash2 size={12} />
                                </button>
                                <div className="flex gap-2 mb-2">
                                   <input className="bg-transparent text-[9px] font-black uppercase flex-1 outline-none text-white/50" 
                                     value={block.label}
                                     onChange={(e) => {
                                       const blocks = [...editData.socialImpact];
                                       blocks[idx].label = e.target.value;
                                       updateEditData({ ...editData, socialImpact: blocks });
                                     }}
                                   />
                                   <div className="flex bg-gray-800 rounded px-1 gap-1">
                                     <button 
                                       onClick={() => {
                                         const blocks = [...editData.socialImpact];
                                         blocks[idx].mediaType = blocks[idx].mediaType === 'image' ? 'none' : 'image';
                                         updateEditData({ ...editData, socialImpact: blocks });
                                       }}
                                       className={`p-1 rounded ${block.mediaType === 'image' ? 'text-[#FFDE59]' : 'text-gray-500'}`}
                                     >
                                       <ImageIcon size={10} />
                                     </button>
                                     <button 
                                       onClick={() => {
                                         const blocks = [...editData.socialImpact];
                                         blocks[idx].mediaType = blocks[idx].mediaType === 'video' ? 'none' : 'video';
                                         updateEditData({ ...editData, socialImpact: blocks });
                                       }}
                                       className={`p-1 rounded ${block.mediaType === 'video' ? 'text-[#FFDE59]' : 'text-gray-500'}`}
                                     >
                                       <Video size={10} />
                                     </button>
                                   </div>
                                   <select 
                                     className="bg-gray-800 text-[8px] rounded px-1"
                                     value={block.type}
                                     onChange={(e) => {
                                       const blocks = [...editData.socialImpact];
                                       blocks[idx].type = e.target.value as any;
                                       updateEditData({ ...editData, socialImpact: blocks });
                                     }}
                                   >
                                      <option value="positive">Pos</option>
                                      <option value="negative">Neg</option>
                                   </select>
                                </div>
                                
                                <textarea className="w-full bg-black/30 border border-white/10 p-3 rounded-2xl text-xs h-16 resize-none outline-none focus:border-white/20 mb-3" 
                                  placeholder="Description (Optional)"
                                  value={block.value}
                                  onChange={(e) => {
                                    const blocks = [...editData.socialImpact];
                                    blocks[idx].value = e.target.value;
                                    updateEditData({ ...editData, socialImpact: blocks });
                                  }}
                                />

                                {block.mediaType && block.mediaType !== 'none' && (
                                  <div className="flex gap-2">
                                     {block.mediaType === 'image' && (
                                       <>
                                         <input className="hidden" id={`impact-up-${idx}`} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'impactMedia', idx)} />
                                         <label htmlFor={`impact-up-${idx}`} className="bg-gray-800 p-2 rounded text-[#FFDE59] cursor-pointer">
                                           <Upload size={12} />
                                         </label>
                                       </>
                                     )}
                                     <input className="flex-1 bg-black/40 p-2 rounded text-[10px] border border-white/5" 
                                       placeholder={block.mediaType === 'video' ? "YouTube Link (Paste URL)" : "Image URL (Paste URL)"}
                                       value={block.mediaUrl || ''}
                                       onChange={(e) => {
                                         const blocks = [...editData.socialImpact];
                                         blocks[idx].mediaUrl = e.target.value;
                                         updateEditData({ ...editData, socialImpact: blocks });
                                       }}
                                     />
                                  </div>
                                )}
                              </div>
                            </SortableGenericItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
                )}
            </div>

            <div className="p-6 bg-gray-900/80 border-t border-gray-800">
               <button 
                onClick={handleUpdate}
                disabled={isSaving}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 ${isSaving ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#8A2BE2] text-white shadow-purple-900/30'}`}
               >
                 {isSaving ? (
                   <>Saving to Cloud...</>
                 ) : (
                   <>Save Everything & Exit <Check size={18} /></>
                 )}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative flex flex-col h-screen overflow-y-auto scrollbar-hide bg-[#FFF5F7]">
        {/* Offline Overlay */}
        {data.isActive === false && !isEditPanelOpen && !isDashboardOpen && (
          <div className="fixed inset-0 bg-white z-[95] flex flex-col items-center justify-center p-10 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md"
            >
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <EyeOff size={48} />
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-gray-900">Site Offline</h1>
              <p className="text-gray-500 font-medium leading-relaxed mb-10">
                This website has been deactivated by the owner. Please check back later or contact the administrator if you believe this is an error.
              </p>
              <div className="flex flex-col gap-4 items-center">
                <div className="h-1 w-20 bg-gray-100 rounded-full mb-4" />
                <button 
                  onClick={() => openProtected('dashboard')}
                  className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-[#8A2BE2] transition-colors flex items-center gap-2"
                >
                  <Lock size={12} /> Owner Login
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Decorative Blobs */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-200/50 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed top-[20%] right-[-5%] w-[30%] h-[30%] bg-amber-100/30 rounded-full blur-[100px] pointer-events-none" />

        {/* Header/Cover Photo Area */}
        <div className="relative h-[240px] md:h-[320px] shrink-0 overflow-hidden bg-gradient-to-br from-[#8A2BE2] to-[#FF1694] border-b-[6px] border-white no-print">
          <img 
            src={data.profile.coverPhoto} 
            alt="Cover" 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Profile Pic Anchor - FIXING FULL VISIBILITY */}
        <div className="relative z-10 px-6 md:px-12 -mt-16 md:-mt-24 pointer-events-none">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
            <motion.div 
               initial={{ scale: 0 }} animate={{ scale: 1 }}
               className="w-32 h-32 md:w-48 md:h-48 rounded-full border-[6px] md:border-[10px] border-white bg-gray-200 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex-shrink-0 pointer-events-auto no-print"
            >
              <img src={data.profile.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
            
            <div className="mb-0 md:mb-6 pointer-events-auto bg-white/40 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border-4 border-white shadow-2xl text-center md:text-left w-full md:w-auto">
              <h1 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-3 font-heading text-gray-900">
                {data.profile.name}
              </h1>
              <p className="font-bold opacity-70 text-xs md:text-sm mb-4 md:mb-6 text-gray-800 tracking-widest uppercase">{data.profile.email}</p>
              <div className="flex justify-center md:justify-start gap-3 no-print">
                {Object.entries(data.profile.socials || {}).map(([type, url]) => (
                  <SocialIcon key={type} type={type} url={url as string} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-12 mt-8 md:mt-12 space-y-8 md:y-12 pb-32">
          {/* Top Info Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-8 lg:gap-12">
            <div className="shrink-0 no-print">
               <Typewriter words={data.settings.typewriterWords} />
            </div>
            
            <motion.div 
              style={{ rotate: -1.5 }}
              className="bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] max-w-lg border-4 border-white shadow-2xl relative w-full lg:w-auto"
            >
               <span className="absolute -top-3 -right-3 bg-[#FF1694] text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg no-print">
                Personal Bio
              </span>
              <p className="italic text-gray-800 leading-relaxed text-base md:text-lg">"{data.profile.bio}"</p>
            </motion.div>
          </div>

          <div className="columns-masonry gap-4 md:gap-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndInfo}>
              <SortableContext items={data.infoSections.map(s => s.id)} strategy={rectSortingStrategy}>
                {data.infoSections.map((section, idx) => (
                  <SortableInfoItem key={section.id} section={section} index={idx} isEditMode={false} />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="space-y-12 md:space-y-16 no-print">
            <div className="flex items-center gap-6 opacity-30">
               <div className="h-0.5 bg-gray-400 flex-1"></div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.5em]">Interactive Stream (Drag to reorder)</h2>
               <div className="h-0.5 bg-gray-400 flex-1"></div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndContents}>
              <SortableContext items={data.contentBlocks.map(b => b.id)} strategy={rectSortingStrategy}>
                {data.contentBlocks.map((block) => (
                  <SortableGenericItem key={block.id} id={block.id} isEditMode={false}>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden border-[8px] md:border-[12px] border-white ring-1 ring-black/5"
                    >
                      {block.type === 'text' && (
                        <div className="p-6 md:p-12 text-lg md:text-xl font-medium leading-relaxed italic border-l-[8px] md:border-l-[12px] border-[#FFDE59]">
                          {block.value}
                        </div>
                      )}
                      {block.type === 'image' && (
                        <div className="p-2">
                          <img src={block.value || 'https://picsum.photos/seed/full-vibrant/1200/800'} alt="Content" className="w-full rounded-[1.5rem] md:rounded-[2rem] object-cover max-h-[700px]" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {block.type === 'video' && (
                        <div className="aspect-video">
                          {(block.value.includes('youtube.com') || block.value.includes('youtu.be')) ? (
                             <iframe 
                              className="w-full h-full"
                              src={block.value.includes('watch?v=') 
                                ? block.value.replace('watch?v=', 'embed/').split('&')[0]
                                : `https://www.youtube.com/embed/${block.value.split('/').pop()?.split('?')[0]}`
                              }
                              title="YouTube video player" frameBorder="0" allowFullScreen
                            ></iframe>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                              <Youtube size={48} className="mb-4 opacity-50" />
                              <span className="text-xs uppercase font-black tracking-widest">Paste YouTube Link in Contents Panel</span>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </SortableGenericItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Footer Area with Share Lock */}
          <div className="pt-20 border-t-2 border-dashed border-gray-400/30 flex flex-col items-center">
             <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 opacity-40">
               Blog by {data.profile.name} &bull; 2026
             </p>
             <button 
              onClick={() => openProtected('dashboard')}
              className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all group"
             >
               <Lock size={20} className="group-hover:text-emerald-400 transition-colors" />
             </button>
          </div>
        </div>

        {/* Global Floating Edit Button */}
        <motion.button 
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => openProtected('edit')}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-28 w-14 h-14 md:w-16 md:h-16 bg-[#FF1694] text-white rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(255,22,148,0.4)] z-[45] border-4 border-white no-print"
        >
          <Pencil size={24} />
        </motion.button>

        {/* Impact Side Arrow */}
        <div 
          onClick={() => setIsImpactPanelOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 w-10 h-24 md:w-12 md:h-32 bg-white/30 backdrop-blur border-l-4 border-white flex items-center justify-center shadow-2xl cursor-pointer hover:bg-white/50 transition-all rounded-l-3xl z-30 no-print"
        >
          <ChevronLeft size={32} className="text-[#8A2BE2] animate-pulse" />
        </div>

        {/* Impact Overlay Panel */}
        <AnimatePresence>
          {isImpactPanelOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImpactPanelOpen(false)} className="fixed inset-0 bg-black/50 z-[80] no-print" />
              <motion.div 
                id="impact-panel"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', bounce: 0.3 }}
                className="fixed inset-y-0 right-0 w-full md:w-[700px] bg-white z-[85] shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 md:p-12 border-l-0 md:border-l-[15px] border-[#FF1694] overflow-y-auto no-print"
              >
                <button onClick={() => setIsImpactPanelOpen(false)} className="absolute top-10 right-10 flex items-center gap-2 font-black uppercase text-xs border-2 px-6 py-3 rounded-2xl">
                  Close <X size={20} />
                </button>
                <div className="mt-16 space-y-12">
                  <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] font-heading">
                    {data.impactTitle?.split(' ').map((word, i) => (
                       <span key={i} className={i === 2 || word === 'Impact' ? 'text-[#8A2BE2]' : ''}>{word} </span>
                    )) || "Social Media Impact"}
                  </h2>
                  
                    <div className="space-y-8">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndImpact}>
                        <SortableContext items={(data.socialImpact || []).map(i => i.id)} strategy={rectSortingStrategy}>
                          {data.socialImpact?.map((block) => (
                            <SortableGenericItem key={block.id} id={block.id} isEditMode={false}>
                              <div 
                                className={`p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border-l-[8px] md:border-l-[12px] shadow-sm ${
                                  block.type === 'positive' 
                                    ? 'bg-emerald-50 border-emerald-400' 
                                    : 'bg-rose-50 border-rose-400'
                                }`}
                              >
                                <h3 className={`text-lg md:text-xl font-black mb-3 uppercase ${
                                  block.type === 'positive' ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {block.label}
                                </h3>
                                {block.value && <p className="text-gray-600 leading-relaxed text-sm md:text-base mb-4">{block.value}</p>}
                                
                                {block.mediaType === 'image' && block.mediaUrl && (
                                  <div className="rounded-[1.2rem] md:rounded-[1.5rem] overflow-hidden shadow-md border-2 border-white">
                                    <img src={block.mediaUrl} alt={block.label} className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                                {block.mediaType === 'video' && block.mediaUrl && (
                                  <div className="rounded-[1.2rem] md:rounded-[1.5rem] overflow-hidden shadow-md border-2 border-white aspect-video relative">
                                    {(block.mediaUrl.includes('youtube.com') || block.mediaUrl.includes('youtu.be')) ? (
                                      <iframe
                                        className="w-full h-full"
                                        src={`https://www.youtube.com/embed/${block.mediaUrl.split('v=')[1]?.split('&')[0] || block.mediaUrl.split('/').pop()?.split('?')[0]}`}
                                        title="Impact Video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      ></iframe>
                                    ) : (
                                      <video src={block.mediaUrl} controls className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </SortableGenericItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
