"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import MessageRenderer from "@/components/MessageRenderer";

export default function PanelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"orders" | "chat" | "subscription" | "calculator" | "notes" | "tests">("orders");
  const [isLoading, setIsLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: string; content: string; attachments?: any[] }>>([]);
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversation history state
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  // License state
  const [licenseCode, setLicenseCode] = useState("");
  const [redeemingLicense, setRedeemingLicense] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // === Kalkulator: state ===
  const [calcInfo, setCalcInfo] = useState<any>(null);
  const [calcConvs, setCalcConvs] = useState<any[]>([]);
  const [calcNotes, setCalcNotes] = useState<any[]>([]);
  const [calcTests, setCalcTests] = useState<any[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcClaimCode, setCalcClaimCode] = useState("");
  const [calcClaiming, setCalcClaiming] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcOpenedConv, setCalcOpenedConv] = useState<any>(null);
  const [showChangeLicense, setShowChangeLicense] = useState(false);
  const [unclaiming, setUnclaiming] = useState(false);

  // === Pair device (deviceId + unlockCode) ===
  const [pairDeviceId, setPairDeviceId] = useState("");
  const [pairUnlockCode, setPairUnlockCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairOk, setPairOk] = useState(false);

  const pairDevice = async () => {
    setPairError(null);
    setPairOk(false);
    setPairing(true);
    try {
      const r = await fetch("/api/user/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: pairDeviceId.trim(),
          unlockCode: pairUnlockCode.trim(),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setPairError(j.error || "Nie udalo sie sparowac");
      } else {
        setPairOk(true);
        setPairDeviceId("");
        setPairUnlockCode("");
        // Odswiez calcInfo
        const r2 = await fetch("/api/user/license/claim", { cache: "no-store" });
        setCalcInfo(await r2.json());
      }
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "Blad sieci");
    } finally {
      setPairing(false);
    }
  };

  // Notes
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Tests
  const [editingTest, setEditingTest] = useState<any>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testContent, setTestContent] = useState("");
  const [savingTest, setSavingTest] = useState(false);

  // Load calculator data when tab activated
  useEffect(() => {
    if (session && (activeTab === "calculator" || activeTab === "notes" || activeTab === "tests" || activeTab === "subscription")) {
      const load = async () => {
        setCalcLoading(true);
        try {
          const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
          const j1 = await r1.json();
          setCalcInfo(j1);
          if (j1.claimed) {
            const [r2, r3, r4] = await Promise.all([
              fetch("/api/user/conversations?limit=50", { cache: "no-store" }),
              fetch("/api/user/notes", { cache: "no-store" }),
              fetch("/api/user/tests", { cache: "no-store" }),
            ]);
            setCalcConvs((await r2.json()).items || []);
            setCalcNotes((await r3.json()).notes || []);
            setCalcTests((await r4.json()).tests || []);
          }
        } finally {
          setCalcLoading(false);
        }
      };
      load();
    }
  }, [session, activeTab]);

  const calcUnclaim = async () => {
    if (!confirm("Odepnij licencje? Notatki, sprawdziany i historia zostana — mozesz potem przypisac inna licencje.")) return;
    setUnclaiming(true);
    try {
      const r = await fetch("/api/user/license/claim", { method: "DELETE" });
      const j = await r.json();
      if (j.ok) {
        setShowChangeLicense(false);
        // Odswiez calcInfo
        const r2 = await fetch("/api/user/license/claim", { cache: "no-store" });
        setCalcInfo(await r2.json());
      } else {
        alert(j.error || "Blad");
      }
    } finally {
      setUnclaiming(false);
    }
  };

  const calcDoClaim = async () => {
    if (!calcClaimCode.trim()) return;
    setCalcClaiming(true);
    setCalcError(null);
    try {
      const r = await fetch("/api/user/license/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: calcClaimCode.trim() }),
      });
      const j = await r.json();
      if (!j.ok) setCalcError(j.error || "Blad");
      else {
        setCalcClaimCode("");
        // reload
        const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
        setCalcInfo(await r1.json());
      }
    } finally {
      setCalcClaiming(false);
    }
  };

  const calcSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        await fetch("/api/user/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingNote.id, title: noteTitle, content: noteContent }),
        });
      } else {
        await fetch("/api/user/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });
      }
      setEditingNote(null); setNoteTitle(""); setNoteContent("");
      const r = await fetch("/api/user/notes", { cache: "no-store" });
      setCalcNotes((await r.json()).notes || []);
    } finally { setSavingNote(false); }
  };
  const calcDelNote = async (id: string) => {
    if (!confirm("Usunac notatke?")) return;
    await fetch(`/api/user/notes?id=${id}`, { method: "DELETE" });
    const r = await fetch("/api/user/notes", { cache: "no-store" });
    setCalcNotes((await r.json()).notes || []);
  };

  const calcSaveTest = async () => {
    if (!testTitle.trim() && !testContent.trim()) return;
    setSavingTest(true);
    try {
      if (editingTest) {
        await fetch("/api/user/tests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTest.id, title: testTitle, content: testContent }),
        });
      } else {
        await fetch("/api/user/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: testTitle, content: testContent }),
        });
      }
      setEditingTest(null); setTestTitle(""); setTestContent("");
      const r = await fetch("/api/user/tests", { cache: "no-store" });
      setCalcTests((await r.json()).tests || []);
    } finally { setSavingTest(false); }
  };
  const calcDelTest = async (id: string) => {
    if (!confirm("Usunac sprawdzian?")) return;
    await fetch(`/api/user/tests?id=${id}`, { method: "DELETE" });
    const r = await fetch("/api/user/tests", { cache: "no-store" });
    setCalcTests((await r.json()).tests || []);
  };


  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch subscription status
  useEffect(() => {
    if (session && activeTab === "subscription") {
      fetchSubscriptionStatus();
    }
  }, [session, activeTab]);

  // Fetch orders when orders tab is active
  useEffect(() => {
    if (session && activeTab === "orders") {
      fetchOrders();
    }
  }, [session, activeTab]);

  // Fetch conversations when chat tab is active
  useEffect(() => {
    if (session && activeTab === "chat") {
      fetchConversations();
    }
  }, [session, activeTab]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        // Map messages to include attachments with correct data format
        const messagesWithAttachments = data.conversation.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          attachments: msg.attachments?.map((att: any) => ({
            filename: att.filename,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            data: att.fileData,
          })),
        }));
        setMessages(messagesWithAttachments);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const createNewConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nowa konwersacja" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentConversationId(data.conversation.id);
        setMessages([]);
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę konwersację?")) return;

    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (currentConversationId === conversationId) {
          setMessages([]);
          setCurrentConversationId(null);
        }
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await fetch("/api/subscription/status");
      if (res.ok) {
        const data = await res.json();
        setSubscriptionStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch subscription status:", error);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/user/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Można dodać toast notification
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Limit: max 5 files, max 10MB each
    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024).slice(0, 5);
    setSelectedFiles(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if ((!userMessage.trim() && selectedFiles.length === 0) || isSending) return;

    setIsSending(true);

    try {
      // Convert files to base64
      const attachments = await Promise.all(
        selectedFiles.map(async (file) => ({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          data: await fileToBase64(file),
        }))
      );

      const newMessage = {
        role: "user",
        content: userMessage || "(plik załączony)",
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const newMessages = [...messages, newMessage];
      setMessages(newMessages);
      setUserMessage("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          conversationId: currentConversationId || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();
      setMessages([...newMessages, { role: "assistant", content: data.response }]);

      // Update conversationId if backend created a new one
      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Refresh conversations to update list
      fetchConversations();
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([
        ...messages,
        { role: "assistant", content: "Przepraszam, wystąpił błąd. Spróbuj ponownie." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubscribe = async (plan: "second_month" | "regular") => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/subscription/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        alert("Nie udało się utworzyć subskrypcji. Spróbuj ponownie.");
      }
    } catch (error) {
      console.error("Failed to create subscription:", error);
      alert("Nie udało się utworzyć subskrypcji. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemLicense = async () => {
    if (!licenseCode.trim()) {
      alert("Wprowadź kod licencji");
      return;
    }

    setRedeemingLicense(true);
    try {
      const res = await fetch("/api/subscription/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode: licenseCode.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        setLicenseCode("");
        fetchSubscriptionStatus();
      } else {
        alert(data.error || "Nie udało się zrealizować licencji");
      }
    } catch (error) {
      console.error("Failed to redeem license:", error);
      alert("Wystąpił błąd podczas realizacji licencji");
    } finally {
      setRedeemingLicense(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Czy na pewno chcesz anulować subskrypcję?")) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (res.ok) {
        alert("Subskrypcja została anulowana.");
        fetchSubscriptionStatus();
      }
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      alert("Nie udało się anulować subskrypcji.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2563EB] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1a1a1a] dark:text-[#E0E0E0]">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338]">
      {/* Header */}
      <header className="bg-white dark:bg-[#2B2D31] border-b border-gray-100 dark:border-[#3F4147] sticky top-0 z-50 backdrop-blur-sm bg-white/80 dark:bg-[#2B2D31]/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/kalkmate_icon.svg"
              alt="KalkMate"
              width={32}
              height={32}
              className="dark:invert"
            />
            <span className="text-xl font-bold text-[#2563EB] dark:text-[#3B82F6]">
              KalkMate Panel
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F5] dark:bg-[#313338] rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                {session.user?.email}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { id: "orders" as const, label: "Moje zamówienia", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            ) },
            { id: "chat" as const, label: "AI Chat", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            ) },
            { id: "subscription" as const, label: "Subskrypcja", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            ) },
            { id: "calculator" as const, label: "Kalkulator", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="10" y2="14" />
                <line x1="13" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
            ) },
            { id: "notes" as const, label: "Notatki", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ) },
            { id: "tests" as const, label: "Sprawdziany", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ) },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#2563EB] dark:bg-[#3B82F6] text-white shadow-lg shadow-[#2563EB]/30 dark:shadow-[#3B82F6]/30"
                  : "bg-white dark:bg-[#2B2D31] text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] border border-gray-100 dark:border-[#3F4147]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6]">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                      Historia zamówień
                    </h2>
                    <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                      Twoje zamówienia i status wysyłek
                    </p>
                  </div>
                </div>

                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#2563EB] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1a1a1a]/20 dark:text-[#E0E0E0]/20">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                    <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
                      Nie masz jeszcze żadnych zamówień
                    </p>
                    <Link
                      href="/#kup-teraz"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Zamów KalkMate
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1, ease: "easeOut" as const }}
                        className="border border-gray-100 dark:border-[#3F4147] rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                          <div>
                            <p className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                              Zamówienie #{order.orderNumber}
                            </p>
                            <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1 flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {new Date(order.createdAt).toLocaleDateString("pl-PL", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                            order.status === "paid"
                              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                              : order.status === "pending"
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                          }`}>
                            {order.status === "paid" ? "✓ Opłacone" : order.status === "pending" ? "⏳ Oczekuje" : "✗ Anulowane"}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-[#F5F5F5] dark:bg-[#313338] rounded-lg p-4">
                            <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 mb-1">Kwota</p>
                            <p className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                              {(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}
                            </p>
                          </div>

                          {order.pickupPoint && (
                            <div className="bg-[#F5F5F5] dark:bg-[#313338] rounded-lg p-4">
                              <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 mb-1">Punkt odbioru</p>
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] truncate">
                                {order.pickupPoint}
                              </p>
                            </div>
                          )}

                          {order.fulfillmentStatus && (
                            <div className="bg-[#F5F5F5] dark:bg-[#313338] rounded-lg p-4">
                              <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 mb-1">Status wysyłki</p>
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">
                                {order.fulfillmentStatus === "fulfilled" ? "📦 Wysłane" : "⏰ Oczekuje"}
                              </p>
                            </div>
                          )}

                          {order.trackingNumber && (
                            <div className="bg-[#F5F5F5] dark:bg-[#313338] rounded-lg p-4">
                              <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 mb-1">Numer przesyłki</p>
                              <p className="text-sm font-medium text-[#2563EB] dark:text-[#3B82F6] font-mono">
                                {order.trackingNumber}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="bg-white dark:bg-[#2B2D31] rounded-2xl border border-gray-100 dark:border-[#3F4147] overflow-hidden flex h-[700px]"
            >
              {/* Sidebar with conversations */}
              <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} border-r border-gray-100 dark:border-[#3F4147] flex flex-col transition-all duration-300 overflow-hidden`}>
                {/* Sidebar header */}
                <div className="p-4 border-b border-gray-100 dark:border-[#3F4147] flex items-center justify-between">
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] text-sm">Historie</h3>
                  <button
                    onClick={createNewConversation}
                    className="p-1.5 rounded-lg bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:opacity-80 transition-opacity"
                    title="Nowa konwersacja"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>

                {/* Conversations list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                        currentConversationId === conv.id
                          ? 'bg-[#2563EB]/10 dark:bg-[#3B82F6]/10'
                          : 'hover:bg-gray-100 dark:hover:bg-[#313338]'
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] truncate pr-6">
                        {conv.title}
                      </p>
                      <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">
                        {conv._count?.messages || 0} wiadomości
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-red-500/10 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Usuń"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                        Brak konwersacji
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Main chat area */}
              <div className="flex-1 flex flex-col"
            >
              {/* Chat header */}
              <div className="p-6 border-b border-gray-100 dark:border-[#3F4147] bg-gradient-to-r from-[#2563EB]/5 to-[#3B82F6]/5 dark:from-[#2563EB]/10 dark:to-[#3B82F6]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-[#313338]/50 transition-colors"
                      title={isSidebarOpen ? "Ukryj historię" : "Pokaż historię"}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <line x1="3" y1="18" x2="21" y2="18"/>
                      </svg>
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">AI Chat - Gemini Pro</h2>
                      <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                        Rozwiązuj zadania z matematyki, fizyki, chemii i biologii
                      </p>
                    </div>
                  </div>
                  {currentConversationId && (
                    <button
                      onClick={createNewConversation}
                      className="px-4 py-2 rounded-lg bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:opacity-80 transition-opacity text-sm font-medium"
                    >
                      Nowy chat
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F5F5F5] dark:bg-[#313338]">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-20 h-20 mb-4 rounded-2xl bg-white dark:bg-[#2B2D31] flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6]">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                      Rozpocznij rozmowę z AI
                    </h3>
                    <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-md mb-4">
                      Wklej treść zadania z matematyki, fizyki, chemii lub biologii, a AI pomoże Ci je rozwiązać zgodnie z zasadami CKE
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-w-lg">
                      <div className="bg-white dark:bg-[#2B2D31] p-3 rounded-lg border border-gray-200 dark:border-[#3F4147]">
                        <div className="text-2xl mb-1">📐</div>
                        <p className="text-xs font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">Matematyka</p>
                        <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Podstawowy i rozszerzony</p>
                      </div>
                      <div className="bg-white dark:bg-[#2B2D31] p-3 rounded-lg border border-gray-200 dark:border-[#3F4147]">
                        <div className="text-2xl mb-1">⚡</div>
                        <p className="text-xs font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">Fizyka</p>
                        <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Poziom rozszerzony</p>
                      </div>
                      <div className="bg-white dark:bg-[#2B2D31] p-3 rounded-lg border border-gray-200 dark:border-[#3F4147]">
                        <div className="text-2xl mb-1">🧪</div>
                        <p className="text-xs font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">Chemia</p>
                        <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Poziom rozszerzony</p>
                      </div>
                      <div className="bg-white dark:bg-[#2B2D31] p-3 rounded-lg border border-gray-200 dark:border-[#3F4147]">
                        <div className="text-2xl mb-1">🧬</div>
                        <p className="text-xs font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">Biologia</p>
                        <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Poziom rozszerzony</p>
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" as const }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-6 py-4 relative ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white shadow-lg shadow-[#2563EB]/30 dark:shadow-[#3B82F6]/30"
                          : "bg-white dark:bg-[#2B2D31] text-[#1a1a1a] dark:text-[#E0E0E0] border border-gray-100 dark:border-[#3F4147] shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kopiuj odpowiedź"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      )}
                      {msg.role === "user" ? (
                        <>
                          {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map((att: any, i: number) => (
                                <div key={i}>
                                  {att.mimeType.startsWith('image/') ? (
                                    <img
                                      src={att.data}
                                      alt={att.filename}
                                      className="max-w-sm rounded-lg"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                                        <polyline points="13 2 13 9 20 9"/>
                                      </svg>
                                      <span className="text-xs">{att.filename}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <MessageRenderer content={msg.content} isUser={false} />
                      )}
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
                {isSending && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white dark:bg-[#2B2D31] border border-gray-100 dark:border-[#3F4147] rounded-2xl px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#2563EB] dark:bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-[#2563EB] dark:bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-[#2563EB] dark:bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Myślę...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-gray-100 dark:border-[#3F4147] bg-white dark:bg-[#2B2D31]">
                {/* Selected files preview */}
                {selectedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 px-3 py-2 rounded-lg">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                          {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          onClick={() => removeFile(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Wklej treść zadania lub dołącz zdjęcie..."
                      className="flex-1 bg-[#F5F5F5] dark:bg-[#313338] border border-gray-100 dark:border-[#3F4147] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] resize-none"
                      rows={3}
                      disabled={isSending}
                    />
                    {/* File upload button */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#2563EB] dark:text-[#3B82F6] hover:bg-[#2563EB]/10 dark:hover:bg-[#3B82F6]/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        Załącz plik (maks. 5 x 10MB)
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={(!userMessage.trim() && selectedFiles.length === 0) || isSending}
                    className="self-end bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white px-8 py-3 rounded-xl hover:shadow-lg hover:shadow-[#2563EB]/30 dark:hover:shadow-[#3B82F6]/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Wyślij
                  </button>
                </div>
              </div>
              </div>
            </motion.div>
          )}

          {activeTab === "subscription" && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6]">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                      Subskrypcja AI Chat
                    </h2>
                    <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                      Zarządzaj dostępem do AI Chat
                    </p>
                  </div>
                </div>

                {subscriptionStatus ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl">
                      <div className={`w-4 h-4 rounded-full ${subscriptionStatus.canUseChat ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                      <span className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Status: {subscriptionStatus.status === "trial" ? "🎁 Okres próbny" : subscriptionStatus.status === "active" ? "✓ Aktywna" : "✗ Nieaktywna"}
                      </span>
                    </div>

                    {/* Aktualnie przypisana licencja */}
                    {calcInfo?.claimed && calcInfo?.license?.code && (
                      <div className="flex items-center justify-between p-4 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl">
                        <div>
                          <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-1">
                            Przypisana licencja
                          </div>
                          <div className="font-mono text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                            {calcInfo.license.code}
                          </div>
                          <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">
                            {calcInfo.license.durationDays} dni
                            {calcInfo.license.activatedAt
                              ? ` · aktywowana ${new Date(calcInfo.license.activatedAt).toLocaleDateString("pl-PL")}`
                              : " · nieaktywowana"}
                          </div>
                        </div>
                        <button
                          onClick={calcUnclaim}
                          disabled={unclaiming}
                          className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg disabled:opacity-50"
                        >
                          {unclaiming ? "Odpinanie..." : "Odepnij"}
                        </button>
                      </div>
                    )}

                    {/* License Redemption */}
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                            Masz kod licencji?
                          </h3>
                          <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                            Wprowadź kod, aby przedłużyć dostęp do AI Chat
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={licenseCode}
                          onChange={(e) => setLicenseCode(e.target.value)}
                          placeholder="abcd123-+=%abcd"
                          className="flex-1 bg-white dark:bg-[#2B2D31] border border-purple-200 dark:border-purple-500/20 rounded-xl px-4 py-3 text-sm text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          disabled={redeemingLicense}
                        />
                        <button
                          onClick={handleRedeemLicense}
                          disabled={!licenseCode.trim() || redeemingLicense}
                          className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {redeemingLicense ? "Realizuję..." : "Realizuj"}
                        </button>
                      </div>
                    </div>

                    {subscriptionStatus.isTrialActive && (
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-600/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6M12 2v10M16 7l-4-4-4 4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-2">
                              Okres próbny: {subscriptionStatus.daysRemaining} dni pozostało
                            </p>
                            {subscriptionStatus.hasPurchasedCalculator && subscriptionStatus.trialDays === 30 && (
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                ✨ Dodatkowe 30 dni za zakup kalkulatora!
                              </p>
                            )}
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                              Kończy się: {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString("pl-PL", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!subscriptionStatus.hasActiveSubscription && !subscriptionStatus.isTrialActive && (
                      <div>
                        <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-6">
                          {subscriptionStatus.hasPurchasedCalculator ? (
                            <>
                              Twój {subscriptionStatus.trialDays}-dniowy okres próbny wygasł.
                              {" "}Możesz kontynuować korzystanie z AI Chat aktywując subskrypcję.
                            </>
                          ) : (
                            <>
                              Twój okres próbny wygasł. Aktywuj subskrypcję, aby kontynuować korzystanie z AI Chat.
                            </>
                          )}
                        </p>

                        {/* Pricing Plans */}
                        <div className="bg-gradient-to-br from-[#2563EB]/5 to-[#3B82F6]/5 dark:from-[#2563EB]/10 dark:to-[#3B82F6]/10 rounded-2xl p-6 mb-6">
                          <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4 text-center">
                            Wybierz plan subskrypcji
                          </h3>

                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {/* Second Month Plan - 1 zł */}
                            <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-5 border-2 border-[#2563EB] dark:border-[#3B82F6] relative">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold rounded-full">
                                🔥 Promocja -98%
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-1">
                                  1 zł
                                </div>
                                <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">
                                  Drugi miesiąc
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("second_month")}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white px-4 py-3 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 font-bold text-sm"
                              >
                                {isLoading ? "Ładowanie..." : "Wybierz 1 zł"}
                              </button>
                            </div>

                            {/* Regular Plan - 15 zł */}
                            <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-5 border-2 border-gray-200 dark:border-[#3F4147]">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                                💎 Stała cena
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-1">
                                  15 zł
                                </div>
                                <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">
                                  Kolejne miesiące
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("regular")}
                                disabled={isLoading}
                                className="w-full bg-[#2B2D31] dark:bg-[#313338] text-[#E0E0E0] px-4 py-3 rounded-xl hover:bg-[#313338] dark:hover:bg-[#3F4147] transition-all duration-300 disabled:opacity-50 font-bold text-sm border border-gray-200 dark:border-[#3F4147]"
                              >
                                {isLoading ? "Ładowanie..." : "Wybierz 15 zł"}
                              </button>
                            </div>
                          </div>

                          <div className="text-center text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                            💳 Bezpieczna płatność przez Stripe • Anuluj w każdej chwili
                          </div>
                        </div>

                        {subscriptionStatus.hasPurchasedCalculator && (
                          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              💡 <strong>Jako właściciel kalkulatora</strong> możesz korzystać z AI Chat przez subskrypcję. To opcjonalne - kalkulator działa niezależnie.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {subscriptionStatus.hasActiveSubscription && (
                      <div>
                        <div className="bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-500/10 dark:to-emerald-600/10 border border-green-200 dark:border-green-500/20 rounded-xl p-6 mb-4">
                          <p className="text-lg font-bold text-green-900 dark:text-green-200 mb-2">
                            ✓ Płatna subskrypcja aktywna
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Opłata: <strong>15 zł/miesiąc</strong> <span className="text-xs">(oszczędzasz 67%)</span>
                          </p>
                          {subscriptionStatus.subscriptionEndsAt && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              Odnawia się: {new Date(subscriptionStatus.subscriptionEndsAt).toLocaleDateString("pl-PL")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleCancelSubscription}
                          disabled={isLoading}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          Anuluj subskrypcję
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#2563EB] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "calculator" && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="space-y-6"
            >
              {calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}

              {!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                  <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                    Najpierw przypisz licencje
                  </h2>
                  <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
                    Aby sparowac kalkulator z kontem, najpierw przypisz licencje
                    do swojego konta w zakladce <strong>Subskrypcja</strong>.
                  </p>
                  <button
                    onClick={() => setActiveTab("subscription")}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded font-medium"
                  >
                    Przejdz do Subskrypcji
                  </button>
                </div>
              )}

              {!calcLoading && calcInfo && calcInfo.claimed && !calcInfo.device && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                  <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                    Sparuj kalkulator z kontem
                  </h2>
                  <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
                    Wpisz <strong>Device ID</strong> z kalkulatora (Settings → Device ID + QR)
                    oraz <strong>kod odblokowania</strong> (Settings → Kod AI). Po sparowaniu
                    zobaczysz tutaj historie rozwiazan, notatki i sprawdziany.
                    <br /><br />
                    <em className="text-xs">Uwaga: kalkulator musi byc polaczony z WiFi i zglosic
                    sie do serwera, zanim sie sparuje.</em>
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-1">
                        Device ID (MAC)
                      </label>
                      <input
                        type="text"
                        value={pairDeviceId}
                        onChange={(e) => setPairDeviceId(e.target.value.toUpperCase())}
                        placeholder="np. 68FE71E43B94"
                        className="w-full px-3 py-2 bg-white dark:bg-[#1A1B1E] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-1">
                        Kod odblokowania
                      </label>
                      <input
                        type="text"
                        value={pairUnlockCode}
                        onChange={(e) => setPairUnlockCode(e.target.value)}
                        placeholder="np. 1111"
                        className="w-full px-3 py-2 bg-white dark:bg-[#1A1B1E] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                    </div>
                    <button
                      onClick={pairDevice}
                      disabled={pairing || !pairDeviceId.trim() || !pairUnlockCode.trim()}
                      className="w-full px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-50 font-medium"
                    >
                      {pairing ? "Paruje..." : "Sparuj urzadzenie"}
                    </button>
                  </div>
                  {pairError && <div className="mt-2 text-red-400 text-sm">{pairError}</div>}
                  {pairOk && <div className="mt-2 text-green-400 text-sm">Sparowano!</div>}
                </div>
              )}

              {!calcLoading && calcInfo && calcInfo.claimed && (
                <>
                  {/* Info o urzadzeniu */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Twoje urzadzenie
                      </h2>
                      <button
                        onClick={calcUnclaim}
                        disabled={unclaiming}
                        className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg disabled:opacity-50"
                      >
                        {unclaiming ? "Odpinanie..." : "Zmien licencje"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Licencja</div>
                        <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.license?.code}</div>
                      </div>
                      {calcInfo.device && (
                        <>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Device ID (MAC)</div>
                            <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.device.deviceId}</div>
                          </div>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Firmware</div>
                            <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.device.firmwareVersion || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Zapytan</div>
                            <div className="font-bold text-[#3B82F6]">{calcInfo.device.requestCount}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>{/* Historia rozmów */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4">
                      Historia rozwiazan ({calcConvs.length})
                    </h2>
                    {calcConvs.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm">
                        Zadnych zadan jeszcze nie rozwiazano.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcConvs.map((it: any) => (
                          <button
                            key={it.id}
                            onClick={() => setCalcOpenedConv(it)}
                            className="block w-full text-left bg-gray-50 dark:bg-[#1A1B1E] hover:bg-gray-100 dark:hover:bg-[#3F4147]/40 rounded p-3 border border-gray-100 dark:border-[#3F4147]"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0] truncate">
                                  {it.mode === "image" ? "Zdjecie" : it.question}
                                </div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1 line-clamp-2">
                                  {it.answer.slice(0, 120)}...
                                </div>
                              </div>
                              <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 ml-2 whitespace-nowrap">
                                {new Date(it.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Modal pelnego widoku konwersacji */}
              {calcOpenedConv && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setCalcOpenedConv(null)}>
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 border border-gray-100 dark:border-[#3F4147]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{new Date(calcOpenedConv.createdAt).toLocaleString("pl-PL")}</div>
                        <div className="text-xs font-mono text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">{calcOpenedConv.deviceId}</div>
                      </div>
                      <button onClick={() => setCalcOpenedConv(null)} className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] text-2xl leading-none">×</button>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm font-bold mb-1 text-[#1a1a1a] dark:text-[#E0E0E0]">Zadanie:</div>
                      <div className="bg-gray-50 dark:bg-[#1A1B1E] p-3 rounded text-sm whitespace-pre-wrap text-[#1a1a1a] dark:text-[#E0E0E0]">{calcOpenedConv.question}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold mb-1 text-[#1a1a1a] dark:text-[#E0E0E0]">Rozwiazanie:</div>
                      <div className="bg-blue-50 dark:bg-[#1A1B1E] p-3 rounded text-sm whitespace-pre-wrap font-mono text-[#1a1a1a] dark:text-[#E0E0E0] border border-blue-100 dark:border-[#3B82F6]/30">{calcOpenedConv.answer}</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}


          {activeTab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              {calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}
              {!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147] text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                  Najpierw przypisz licencje w zakladce <strong>Kalkulator</strong>.
                </div>
              )}
              {!calcLoading && calcInfo && calcInfo.claimed && (<>{/* Notatki */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Notatki offline ({calcNotes.length}/50)
                      </h2>
                      <span className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                        Sync do urzadzenia przy WiFi
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1A1B1E] rounded p-4 mb-4 border border-gray-100 dark:border-[#3F4147]">
                      <div className="font-semibold mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        {editingNote ? "Edytuj notatke" : "Nowa notatka"}
                      </div>
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Tytul (max 60 znakow)"
                        maxLength={60}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Tresc (max 4000 znakow - wzory, definicje)"
                        maxLength={4000}
                        rows={4}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{noteContent.length}/4000</div>
                        <div className="flex gap-2">
                          {editingNote && (
                            <button
                              onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }}
                              className="px-3 py-1 text-sm bg-gray-200 dark:bg-[#3F4147] hover:bg-gray-300 dark:hover:bg-[#4A4D52] text-[#1a1a1a] dark:text-[#E0E0E0] rounded"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveNote}
                            disabled={savingNote || (!noteTitle.trim() && !noteContent.trim())}
                            className="px-3 py-1 text-sm bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-50"
                          >{savingNote ? "Zapisuje..." : editingNote ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcNotes.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm text-center py-4">
                        Brak notatek.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcNotes.map((n: any) => (
                          <div key={n.id} className="border border-gray-100 dark:border-[#3F4147] rounded p-3 hover:bg-gray-50 dark:hover:bg-[#3F4147]/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">{n.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1 line-clamp-2 whitespace-pre-wrap">{n.content || "(pusta)"}</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingNote(n); setNoteTitle(n.title); setNoteContent(n.content); }}
                                  className="text-xs px-2 py-1 bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] rounded">Edytuj</button>
                                <button onClick={() => calcDelNote(n.id)}
                                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded">Usun</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div></>)}
            </motion.div>
          )}

          {activeTab === "tests" && (
            <motion.div
              key="tests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              {calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}
              {!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147] text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                  Najpierw przypisz licencje w zakladce <strong>Kalkulator</strong>.
                </div>
              )}
              {!calcLoading && calcInfo && calcInfo.claimed && (<>{/* Sprawdziany */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Sprawdziany ({calcTests.length}/50)
                      </h2>
                      <span className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Markdown/LaTeX OK</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1A1B1E] rounded p-4 mb-4 border border-gray-100 dark:border-[#3F4147]">
                      <div className="font-semibold mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        {editingTest ? "Edytuj sprawdzian" : "Nowy sprawdzian"}
                      </div>
                      <input
                        type="text"
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder="Tytul (np. Matma 2026 - probna 1)"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <textarea
                        value={testContent}
                        onChange={(e) => setTestContent(e.target.value)}
                        placeholder="Wklej tutaj rozwiazanie (markdown, LaTeX, $..$, **bold**...)"
                        maxLength={30000}
                        rows={8}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{testContent.length}/30000</div>
                        <div className="flex gap-2">
                          {editingTest && (
                            <button
                              onClick={() => { setEditingTest(null); setTestTitle(""); setTestContent(""); }}
                              className="px-3 py-1 text-sm bg-gray-200 dark:bg-[#3F4147] text-[#1a1a1a] dark:text-[#E0E0E0] rounded"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveTest}
                            disabled={savingTest || (!testTitle.trim() && !testContent.trim())}
                            className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                          >{savingTest ? "Zapisuje..." : editingTest ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcTests.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm text-center py-4">
                        Brak sprawdzianow.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcTests.map((t: any) => (
                          <div key={t.id} className="border border-gray-100 dark:border-[#3F4147] rounded p-3 hover:bg-gray-50 dark:hover:bg-[#3F4147]/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">{t.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">{t.content.length} znakow</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingTest(t); setTestTitle(t.title); setTestContent(t.content); }}
                                  className="text-xs px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded">Edytuj</button>
                                <button onClick={() => calcDelTest(t.id)}
                                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded">Usun</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div></>)}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
