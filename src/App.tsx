import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Maximize2, Plus, Share2, Upload, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  where,
  deleteDoc,
  doc
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { Trash2 } from "lucide-react";

// --- Types & Data ---

type Category = string;

interface GalleryImage {
  id: string;
  url: string;
  category: Category;
  title: string;
  description: string;
  userId?: string;
  createdAt?: any;
}

const STATIC_IMAGES: GalleryImage[] = [
  {
    id: "static-1",
    url: "https://picsum.photos/seed/arch1/1200/1600",
    category: "Architecture",
    title: "Monolithic Void",
    description: "Concrete structures meeting the clarity of a mid-day sky.",
  },
  {
    id: "static-2",
    url: "https://picsum.photos/seed/nature1/1600/1200",
    category: "Nature",
    title: "Alpine Silence",
    description: "The rhythmic peaks of the northern range under soft light.",
  },
  {
    id: "static-3",
    url: "https://picsum.photos/seed/min1/1200/1200",
    category: "Minimal",
    title: "Linear Study",
    description: "Found patterns in the mundane, reduced to pure geometry.",
  },
  {
    id: "static-4",
    url: "https://picsum.photos/seed/life1/1600/1000",
    category: "Lifestyle",
    title: "Urban Pulse",
    description: "Capturing the fleeting moments of connection in the city.",
  },
];

const DEFAULT_CATEGORIES: string[] = ["Architecture", "Nature", "Minimal", "Lifestyle"];

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [firestoreImages, setFirestoreImages] = useState<GalleryImage[]>([]);
  const [firestoreCategories, setFirestoreCategories] = useState<{id: string, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Auth Listener & URL Parser
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    
    // Check for user ID in URL
    const params = new URLSearchParams(window.location.search);
    const uId = params.get('u');
    if (uId) setViewingUserId(uId);

    return () => unsubscribe();
  }, []);

  // Firestore Listeners - Logic for Current User OR Shared User
  useEffect(() => {
    const effectiveUserId = viewingUserId || user?.uid;

    if (!effectiveUserId) {
      setFirestoreImages([]);
      setFirestoreCategories([]);
      return;
    }

    const qImgs = query(
      collection(db, "images"), 
      where("userId", "==", effectiveUserId),
      orderBy("createdAt", "desc")
    );
    const unsubscribeImgs = onSnapshot(qImgs, (snapshot) => {
      const imgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GalleryImage[];
      setFirestoreImages(imgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "images");
    });

    const qCats = query(
      collection(db, "categories"), 
      where("userId", "==", effectiveUserId),
      orderBy("createdAt", "asc")
    );
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as {id: string, name: string}[];
      setFirestoreCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    return () => {
      unsubscribeImgs();
      unsubscribeCats();
    };
  }, [user, viewingUserId]);

  const isOwner = useMemo(() => {
    if (!user) return false;
    if (viewingUserId) return user.uid === viewingUserId;
    return true;
  }, [user, viewingUserId]);

  const allCategories = useMemo(() => {
    const customCats = firestoreCategories.map(c => c.name);
    // If logged in OR viewing a shared gallery, only show those categories. Otherwise show defaults.
    const baseCats = (user || viewingUserId) ? customCats : DEFAULT_CATEGORIES;
    const uniqueCats = Array.from(new Set(baseCats));
    return ["All", ...uniqueCats];
  }, [user, viewingUserId, firestoreCategories]);

  const allImages = useMemo(() => {
    // Show only user's uploaded images if logged in or viewing a shared gallery, otherwise show guest gallery
    if (user || viewingUserId) return firestoreImages;
    return STATIC_IMAGES;
  }, [user, viewingUserId, firestoreImages]);

  const filteredImages = useMemo(() => {
    return selectedCategory === "All"
      ? allImages
      : allImages.filter((img) => img.category === selectedCategory);
  }, [selectedCategory, allImages]);

  const handleDeleteCategory = async (e: React.MouseEvent, catName: string) => {
    e.stopPropagation();
    if (!isOwner || !user || !window.confirm(`Delete the category "${catName}"? This will not delete the images in it.`)) return;
    
    try {
      const catObj = firestoreCategories.find(c => c.name === catName);
      if (catObj) {
        await deleteDoc(doc(db, "categories", catObj.id));
        if (selectedCategory === catName) setSelectedCategory("All");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "categories");
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!isOwner || !user || !window.confirm("Are you sure you want to delete this image?")) return;
    try {
      await deleteDoc(doc(db, "images", imageId));
      setSelectedImageId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "images");
    }
  };

  const handleShareGallery = () => {
    const targetUserId = user?.uid;
    if (!targetUserId) return;
    
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("u", targetUserId);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 2000);
    });
  };

  const resetToMyGallery = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    window.history.pushState({}, "", url.toString());
    setViewingUserId(null);
    setSelectedCategory("All");
  };

  const currentImageIndex = useMemo(() => {
    if (selectedImageId === null) return -1;
    return filteredImages.findIndex((img) => img.id === selectedImageId);
  }, [selectedImageId, filteredImages]);

  const handleNext = useCallback(() => {
    if (currentImageIndex === -1) return;
    const nextIndex = (currentImageIndex + 1) % filteredImages.length;
    setSelectedImageId(filteredImages[nextIndex].id);
  }, [currentImageIndex, filteredImages]);

  const handlePrev = useCallback(() => {
    if (currentImageIndex === -1) return;
    const prevIndex = (currentImageIndex - 1 + filteredImages.length) % filteredImages.length;
    setSelectedImageId(filteredImages[prevIndex].id);
  }, [currentImageIndex, filteredImages]);

  const handleClose = useCallback(() => setSelectedImageId(null), []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageId === null) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageId, handleNext, handlePrev, handleClose]);

  return (
    <div className="min-h-screen px-4 py-8 md:px-12 lg:px-24 bg-[#FBFBF9]">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
        <header className="text-center md:text-left">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-5xl font-light tracking-tight md:text-7xl text-neutral-900"
          >
            My <span className="italic">Memories</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 max-w-xl text-lg text-neutral-400 font-sans font-light"
          >
            {viewingUserId 
              ? "Exploring a shared visual perspective. Discover the story through their lens."
              : user 
                ? "Your private collection of visual studies. Share your link to let others explore."
                : "A dynamic collaborative collection of visual studies. Sign in to start your own."}
          </motion.p>
        </header>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 self-center md:self-start">
          {viewingUserId && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetToMyGallery}
              className="flex items-center gap-2 bg-white text-neutral-600 border border-neutral-200 px-5 py-2.5 rounded-full text-sm font-medium hover:border-neutral-400 transition-all shadow-sm"
            >
              <span>{user ? "Back to Mine" : "View Global"}</span>
            </motion.button>
          )}

          {user && !viewingUserId && (
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShareGallery}
                className="flex items-center gap-2 bg-white text-neutral-900 border border-neutral-200 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm"
              >
                <Share2 size={18} />
                <span>{shareFeedback ? "Link Copied!" : "Share Gallery"}</span>
              </motion.button>
              <AnimatePresence>
                {shareFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] px-3 py-1 rounded shadow-xl whitespace-nowrap z-50"
                  >
                    Copied Link to Clipboard
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 bg-neutral-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-neutral-200"
              >
                <Plus size={18} />
                <span>Share Photo</span>
              </motion.button>
              <div className="flex items-center gap-3 pl-4 border-l border-neutral-200">
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                <button onClick={logout} className="text-neutral-400 hover:text-neutral-900 transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  console.error("Sign-in Error:", err);
                  alert(`Sign-in failed: ${err.message || "Unknown error"}. Check if "localhost" is authorized in your Firebase Console.`);
                }
              }}
              className="flex items-center gap-2 bg-white text-neutral-900 border border-neutral-200 px-6 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm"
            >
              <LogIn size={18} />
              <span>Sign in to Share</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <nav className="mb-12 flex flex-wrap justify-center gap-4 md:justify-start">
        {allCategories.map((cat, i) => {
          const isUserCat = firestoreCategories.some(c => c.name === cat);
          return (
            <div key={cat} className="relative group/cat">
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === cat
                    ? "bg-neutral-900 text-white shadow-md"
                    : "bg-white text-neutral-400 border border-neutral-100 hover:border-neutral-300 hover:text-neutral-600 shadow-sm"
                }`}
              >
                {cat}
                {isUserCat && isOwner && (
                  <span 
                    onClick={(e) => handleDeleteCategory(e, cat)}
                    className="ml-1 p-0.5 hover:bg-red-500 hover:text-white rounded-full transition-colors"
                  >
                    <X size={10} />
                  </span>
                )}
              </motion.button>
            </div>
          );
        })}
      </nav>

      {/* Grid */}
      <motion.div 
        layout
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredImages.map((image) => (
            <motion.div
              layout
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="group relative cursor-zoom-in overflow-hidden rounded-xl bg-neutral-100 aspect-[3/4] shadow-sm hover:shadow-xl transition-shadow duration-500"
              onClick={() => setSelectedImageId(image.id)}
            >
              <GalleryItemContent image={image} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {selectedImageId !== null && (
          <Lightbox
            images={filteredImages}
            activeIndex={currentImageIndex}
            onClose={handleClose}
            onNext={handleNext}
            onPrev={handlePrev}
            onDelete={handleDeleteImage}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <UploadModal 
            onClose={() => setIsUploadModalOpen(false)} 
            user={user}
            existingCategories={allCategories.filter(c => c !== "All")}
          />
        )}
      </AnimatePresence>

      <footer className="mt-24 border-t border-neutral-200 py-12 text-center text-sm text-neutral-400">
        <p> <span className="italic">Developed by Kashish Singh Rajput.</span></p>
          
      </footer>
    </div>
  );
}

function GalleryItemContent({ image }: { image: GalleryImage }) {
  return (
    <>
      <motion.img
        src={image.url}
        alt={image.title}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-6">
        <div className="translate-y-4 transition-transform duration-500 group-hover:translate-y-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mb-2 font-medium">{image.category}</p>
          <h3 className="font-serif text-xl text-white font-medium mb-1">{image.title}</h3>
          <p className="text-xs text-white/50 line-clamp-1 font-light">{image.description}</p>
        </div>
        <div className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
          <Maximize2 size={18} strokeWidth={1.5} />
        </div>
      </div>
    </>
  );
}

function Lightbox({
  images,
  activeIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
  isOwner,
}: {
  images: GalleryImage[];
  activeIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDelete: (id: string) => void;
  isOwner: boolean;
}) {
  const currentImage = images[activeIndex];

  if (!currentImage) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4 md:p-12 lg:p-24"
    >
      {/* Close button with distinctive design */}
      <button
        onClick={onClose}
        className="absolute top-8 right-8 z-[60] flex items-center justify-center w-12 h-12 bg-neutral-900 text-white rounded-full hover:scale-110 transition-transform shadow-xl"
      >
        <X size={24} strokeWidth={1.5} />
      </button>

      {/* Navigation Controls */}
      <div className="absolute inset-y-0 left-0 flex items-center px-4 md:px-8">
        <button
          onClick={onPrev}
          className="text-neutral-300 hover:text-neutral-900 transition-colors p-4 hover:scale-110"
        >
          <ChevronLeft size={48} strokeWidth={1} />
        </button>
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center px-4 md:px-8">
        <button
          onClick={onNext}
          className="text-neutral-300 hover:text-neutral-900 transition-colors p-4 hover:scale-110"
        >
          <ChevronRight size={48} strokeWidth={1} />
        </button>
      </div>

      {/* Content Layout */}
      <div className="relative flex flex-col lg:flex-row items-center justify-center gap-12 w-full h-full max-w-7xl mx-auto overflow-hidden">
        <motion.div 
          key={currentImage.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="flex-1 w-full h-full flex items-center justify-center"
        >
          <img
            src={currentImage.url}
            alt={currentImage.title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
          />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:w-[350px] flex-shrink-0 text-neutral-900 text-center lg:text-left"
        >
          <div className="inline-block px-3 py-1 bg-neutral-100 rounded text-[10px] uppercase tracking-widest text-neutral-500 font-medium mb-6">
            {currentImage.category} 
            <span className="ml-3 border-l border-neutral-300 pl-3">No. {activeIndex + 1}</span>
          </div>
          
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-serif text-4xl md:text-5xl font-light text-neutral-900 leading-tight">
              {currentImage.title}
            </h2>
            {isOwner && !currentImage.id.startsWith("static-") && (
              <button 
                onClick={() => onDelete(currentImage.id)}
                className="text-neutral-300 hover:text-red-500 transition-colors"
                title="Delete Photo"
              >
                <Trash2 size={24} strokeWidth={1.5} />
              </button>
            )}
          </div>
          
          <p className="text-lg text-neutral-500 font-light leading-relaxed mb-8">
            {currentImage.description}
          </p>

          <div className="pt-8 border-t border-neutral-200">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-4">Interactions</p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <span className="px-3 py-1.5 bg-neutral-50 rounded text-xs text-neutral-500 border border-neutral-100">Esc to Close</span>
              <span className="px-3 py-1.5 bg-neutral-50 rounded text-xs text-neutral-500 border border-neutral-100">← Prev</span>
              <span className="px-3 py-1.5 bg-neutral-50 rounded text-xs text-neutral-500 border border-neutral-100">Next →</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Backdrop for mobile interaction */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </motion.div>
  );
}

function UploadModal({ onClose, user, existingCategories }: { onClose: () => void; user: User | null; existingCategories: string[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(existingCategories[0] || "General");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(existingCategories.length === 0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      // Check initial file size - strictly warn if it's massive (e.g. > 5MB) 
      // but we will try to resize anyway.
      setFile(f);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Canvas resizing logic to ensure we stay under the 1MB Firestore limit
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const max_size = 1200; // Max dimension

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Quality 0.7 to balance look vs size
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          
          // Firestore document limit is 1,048,576 bytes. 
          // Base64 strings are ~33% larger than raw data. 
          // We target ~800k characters to be safe.
          if (dataUrl.length > 1000000) {
            alert("This image is too large for the database even after resizing. Please try a smaller photo.");
            setPreview(null);
            setFile(null);
          } else {
            setPreview(dataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(f);
    }
  };

  const handleUpload = async () => {
    if (!user || !preview || !title) return;
    setIsUploading(true);
    try {
      let finalCategory = category;

      // Create new category if needed
      if (isAddingNewCategory && newCategoryName.trim()) {
        const catName = newCategoryName.trim();
        // Check if it already exists in the local list to avoid duplicates
        if (!existingCategories.includes(catName)) {
           await addDoc(collection(db, "categories"), {
            name: catName,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
        }
        finalCategory = catName;
      }

      await addDoc(collection(db, "images"), {
        url: preview,
        title,
        category: finalCategory,
        description,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (error: any) {
      console.error("Upload Error:", error);
      if (error.message?.includes("too large")) {
        alert("The image data is too large for the database. Try a smaller image or a different format.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, "upload_process");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: 50, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 50, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
      >
        <div className="md:w-1/2 bg-neutral-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-neutral-100">
          {preview ? (
            <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-lg">
              <img src={preview} className="w-full h-full object-cover" alt="Preview" />
              <button 
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 p-2 bg-white/90 rounded-full text-neutral-900 shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[3/4] border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center gap-4 hover:border-neutral-400 hover:bg-neutral-100 transition-all text-neutral-400 hover:text-neutral-600"
            >
              <Upload size={32} strokeWidth={1.5} />
              <span className="text-sm font-medium text-center px-4">Select a photo from device</span>
              <span className="text-[10px] text-neutral-400">JPG, PNG up to 1MB</span>
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="md:w-1/2 p-8 flex flex-col h-full bg-white">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-serif text-2xl font-light">Share Perspective</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900"><X size={24} /></button>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-2 font-semibold">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give it a name..."
                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Category</label>
                <button 
                  onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                  className="text-[10px] text-neutral-900 font-medium hover:underline"
                >
                  {isAddingNewCategory ? "Use Existing" : "+ New Category"}
                </button>
              </div>
              
              {isAddingNewCategory ? (
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all"
                />
              ) : (
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer"
                >
                  {existingCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-2 font-semibold">Description</label>
              <textarea 
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="The story behind this shot..."
                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all resize-none"
              />
            </div>
          </div>

          <motion.button 
            disabled={!preview || !title || isUploading || (isAddingNewCategory && !newCategoryName.trim())}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpload}
            className={`mt-8 w-full py-4 rounded-xl font-medium text-sm transition-all ${
              !preview || !title || isUploading || (isAddingNewCategory && !newCategoryName.trim())
                ? "bg-neutral-100 text-neutral-400 cursor-not-allowed" 
                : "bg-neutral-900 text-white shadow-xl shadow-neutral-200 hover:shadow-neutral-300"
            }`}
          >
            {isUploading ? "Processing..." : "Publish to Gallery"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

