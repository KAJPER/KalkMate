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
  const [activeTab, setActiveTab] = useState<"orders" | "chat" | "subscription" | "ai" | "calculator" | "notes" | "tests" | "settings">("orders");
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

  // Captures (galeria zdjec)
  const [captures, setCaptures] = useState<Array<{ filename: string; deviceId: string; timestamp: string; sizeKB: number }>>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [openedCapture, setOpenedCapture] = useState<string | null>(null);

  // === AI settings (sekcja AI): wybor modelu + tryb Matura/Czysty (per-user) ===
  const [aiModel, setAiModel] = useState<string>("default");
  const [aiMode, setAiMode] = useState<"matura" | "raw">("matura");
  const [aiModels, setAiModels] = useState<Array<{ id: string; label: string; provider: string; note?: string }>>([]);
  const [aiSaving, setAiSaving] = useState(false);

  const loadAiSettings = async () => {
    try {
      const r = await fetch("/api/user/ai-settings");
      const j = await r.json();
      if (j?.ok) {
        setAiModel(j.aiModel || "default");
        setAiMode(j.aiMode === "raw" ? "raw" : "matura");
        setAiModels(Array.isArray(j.models) ? j.models : []);
      }
    } catch {}
  };

  const saveAiSettings = async (patch: { aiModel?: string; aiMode?: "matura" | "raw" }) => {
    setAiSaving(true);
    try {
      const r = await fetch("/api/user/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!j?.ok) { alert(j?.error || "Nie udało się zapisać"); return; }
      if (patch.aiModel !== undefined) setAiModel(patch.aiModel);
      if (patch.aiMode !== undefined) setAiMode(patch.aiMode);
    } finally {
      setAiSaving(false);
    }
  };

  // === Ustawienia konta: zmiana hasla + emaila ===
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async () => {
    setPwMsg(null);
    if (pwNew.length < 6) { setPwMsg({ ok: false, text: "Nowe hasło musi mieć min. 6 znaków" }); return; }
    if (pwNew !== pwNew2) { setPwMsg({ ok: false, text: "Hasła nie są takie same" }); return; }
    setPwSaving(true);
    try {
      const r = await fetch("/api/user/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const j = await r.json();
      if (!j?.ok) { setPwMsg({ ok: false, text: j?.error || "Błąd" }); return; }
      setPwMsg({ ok: true, text: "Hasło zostało zmienione." });
      setPwCurrent(""); setPwNew(""); setPwNew2("");
    } finally { setPwSaving(false); }
  };

  const [emNew, setEmNew] = useState("");
  const [emPassword, setEmPassword] = useState("");
  const [emSaving, setEmSaving] = useState(false);
  const [emMsg, setEmMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changeEmail = async () => {
    setEmMsg(null);
    setEmSaving(true);
    try {
      const r = await fetch("/api/user/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: emNew, password: emPassword }),
      });
      const j = await r.json();
      if (!j?.ok) { setEmMsg({ ok: false, text: j?.error || "Błąd" }); return; }
      setEmMsg({ ok: true, text: "Email zmieniony. Za chwilę nastąpi wylogowanie..." });
      setTimeout(() => signOut({ callbackUrl: "/auth/signin" }), 1600);
    } finally { setEmSaving(false); }
  };

  // Wczytaj ustawienia AI gdy sesja gotowa
  useEffect(() => {
    if (session) loadAiSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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
            setCapturesLoading(true);
            const [r2, r3, r4, r5] = await Promise.all([
              fetch("/api/user/conversations?limit=50", { cache: "no-store" }),
              fetch("/api/user/notes", { cache: "no-store" }),
              fetch("/api/user/tests", { cache: "no-store" }),
              fetch("/api/user/captures", { cache: "no-store" }),
            ]);
            setCalcConvs((await r2.json()).items || []);
            setCalcNotes((await r3.json()).notes || []);
            setCalcTests((await r4.json()).tests || []);
            setCaptures((await r5.json()).items || []);
            setCapturesLoading(false);
          }
        } finally {
          setCalcLoading(false);
        }
      };
      load();
    }
  }, [session, activeTab]);

  const calcUnclaim = async () => {
    const deviceId = calcInfo?.device?.deviceId;
    if (!deviceId) {
      alert("Brak urzadzenia do odpiecia.");
      return;
    }
    if (!confirm(`Odepnac urzadzenie ${deviceId}? Bedziesz mogl je sparowac ponownie.`)) return;
    setUnclaiming(true);
    try {
      const r = await fetch(`/api/user/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (j.ok) {
        setShowChangeLicense(false);
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

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyToClipboard = async (text: string, idx?: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    if (typeof idx === "number") {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1600);
    }
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Błąd serwera (${response.status})`);
      }

      setMessages([...newMessages, { role: "assistant", content: data.response }]);

      // Update conversationId if backend created a new one
      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Refresh conversations to update list
      fetchConversations();
    } catch (error) {
      console.error("Chat error:", error);
      const msg = error instanceof Error ? error.message : "Spróbuj ponownie.";
      setMessages([
        ...messages,
        { role: "assistant", content: `⚠️ ${msg}` },
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
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
          <p className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const tabs = [
    { id: "orders" as const, n: "01", label: "Zamówienia" },
    { id: "chat" as const, n: "02", label: "AI Chat" },
    { id: "subscription" as const, n: "03", label: "Subskrypcja" },
    { id: "ai" as const, n: "04", label: "AI" },
    { id: "calculator" as const, n: "05", label: "Kalkulator" },
    { id: "notes" as const, n: "06", label: "Notatki" },
    { id: "tests" as const, n: "07", label: "Sprawdziany" },
    { id: "settings" as const, n: "08", label: "Ustawienia konta" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0B0B]/85 backdrop-blur-md border-b border-[rgba(242,237,227,0.10)]">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="km-display text-[26px] tracking-tight leading-none text-[#F2EDE3]">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden sm:inline">
                /panel
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden md:inline-flex items-center gap-2 km-mono-eyebrow text-[#F2EDE3]/55">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="km-mono-eyebrow text-[#F2EDE3]/70 hover:text-[#FF4D2E] px-3 py-1.5 border border-[rgba(242,237,227,0.18)] hover:border-[#FF4D2E] transition-colors"
              >
                Wyloguj ↗
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-10 lg:py-14">
        {/* Page heading */}
        <div className="mb-10 lg:mb-14 grid lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 00 ] · Twój panel</p>
            <h1 className="km-display text-[clamp(40px,7vw,96px)] mt-3">
              Witaj, <span className="italic text-[#D8FF3D]">{(session.user?.name || session.user?.email?.split("@")[0] || "user").toString()}</span>.
            </h1>
          </div>
          <div className="lg:col-span-4 km-mono-eyebrow text-[#F2EDE3]/45 lg:text-right">
            <p>PANEL · v0.6.4</p>
            <p className="mt-1 text-[#F2EDE3]/30">Sesja aktywna</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-10 border-y border-[rgba(242,237,227,0.10)]">
          <div className="flex overflow-x-auto km-no-scrollbar">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative group flex items-baseline gap-2.5 px-5 py-4 whitespace-nowrap transition-colors ${
                  i > 0 ? "border-l border-[rgba(242,237,227,0.10)]" : ""
                } ${
                  activeTab === tab.id
                    ? "bg-[#0E0E0E] text-[#F2EDE3]"
                    : "text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:bg-[#0E0E0E]/50"
                }`}
              >
                <span className={`km-mono-eyebrow ${activeTab === tab.id ? "text-[#D8FF3D]" : "text-[#F2EDE3]/35"}`}>
                  {tab.n}
                </span>
                <span className="text-[14.5px]">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-[#D8FF3D]" />
                )}
              </button>
            ))}
          </div>
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
              <div className="bg-[#0E0E0E]  p-8 border border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12  bg-[#D8FF3D]/10 bg-[#D8FF3D]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#F2EDE3]">
                      Historia zamówień
                    </h2>
                    <p className="text-sm text-[#F2EDE3]/60">
                      Twoje zamówienia i status wysyłek
                    </p>
                  </div>
                </div>

                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#141414] flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F2EDE3]/20">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                    <p className="text-[#F2EDE3]/60 mb-4">
                      Nie masz jeszcze żadnych zamówień
                    </p>
                    <Link
                      href="/#kup-teraz"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#D8FF3D] text-[#0B0B0B] font-medium rounded-full hover:bg-[#F2EDE3] transition-colors"
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
                        className="border border-[rgba(242,237,227,0.10)]  p-6  transition-shadow duration-300"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                          <div>
                            <p className="text-lg font-bold text-[#F2EDE3]">
                              Zamówienie #{order.orderNumber}
                            </p>
                            <p className="text-sm text-[#F2EDE3]/60 mt-1 flex items-center gap-2">
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
                          <div className="bg-[#141414]  p-4">
                            <p className="text-xs text-[#F2EDE3]/40 mb-1">Kwota</p>
                            <p className="text-lg font-bold text-[#F2EDE3]">
                              {(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}
                            </p>
                          </div>

                          {order.pickupPoint && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">Punkt odbioru</p>
                              <p className="text-sm font-medium text-[#F2EDE3] truncate">
                                {order.pickupPoint}
                              </p>
                            </div>
                          )}

                          {order.fulfillmentStatus && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">Status wysyłki</p>
                              <p className="text-sm font-medium text-[#F2EDE3]">
                                {order.fulfillmentStatus === "fulfilled" ? "📦 Wysłane" : "⏰ Oczekuje"}
                              </p>
                            </div>
                          )}

                          {order.trackingNumber && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">Numer przesyłki</p>
                              <p className="text-sm font-medium text-[#D8FF3D] font-mono">
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
              className="bg-[#0E0E0E]  border border-[rgba(242,237,227,0.10)] overflow-hidden flex h-[700px]"
            >
              {/* Sidebar with conversations */}
              <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} border-r border-[rgba(242,237,227,0.10)] flex flex-col transition-all duration-300 overflow-hidden`}>
                {/* Sidebar header */}
                <div className="p-4 border-b border-[rgba(242,237,227,0.10)] flex items-center justify-between">
                  <h3 className="font-semibold text-[#F2EDE3] text-sm">Historie</h3>
                  <button
                    onClick={createNewConversation}
                    className="p-1.5  bg-[#D8FF3D] text-[#0B0B0B] hover:opacity-80 transition-opacity"
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
                      className={`group relative p-3  cursor-pointer transition-colors ${
                        currentConversationId === conv.id
                          ? 'bg-[#D8FF3D]/10 bg-[#D8FF3D]/10'
                          : 'hover:bg-[#141414]'
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <p className="text-sm font-medium text-[#F2EDE3] truncate pr-6">
                        {conv.title}
                      </p>
                      <p className="text-xs text-[#F2EDE3]/60 mt-1">
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
                      <p className="text-xs text-[#F2EDE3]/60">
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
              <div className="p-6 border-b border-[rgba(242,237,227,0.10)]  from-[#D8FF3D]/5 to-[#D8FF3D]/5 dark:from-[#D8FF3D]/10 dark:to-[#D8FF3D]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-2  hover:bg-[#141414]/50 transition-colors"
                      title={isSidebarOpen ? "Ukryj historię" : "Pokaż historię"}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <line x1="3" y1="18" x2="21" y2="18"/>
                      </svg>
                    </button>
                    <div className="w-12 h-12   from-[#D8FF3D] to-[#D8FF3D] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#F2EDE3]">AI Chat - KalkMate Pro</h2>
                      <p className="text-sm text-[#F2EDE3]/60">
                        Rozwiązuj zadania z matematyki, fizyki, chemii i biologii
                      </p>
                    </div>
                  </div>
                  {currentConversationId && (
                    <button
                      onClick={createNewConversation}
                      className="px-4 py-2  bg-[#D8FF3D] text-[#0B0B0B] hover:opacity-80 transition-opacity text-sm font-medium"
                    >
                      Nowy chat
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#141414]">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-20 h-20 mb-4  bg-[#0E0E0E] flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#F2EDE3] mb-2">
                      Rozpocznij rozmowę z AI
                    </h3>
                    <p className="text-sm text-[#F2EDE3]/60 max-w-md mb-4">
                      Wklej treść zadania z matematyki, fizyki, chemii lub biologii, a AI pomoże Ci je rozwiązać zgodnie z zasadami CKE
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-w-lg">
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">📐</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">Matematyka</p>
                        <p className="text-xs text-[#F2EDE3]/60">Podstawowy i rozszerzony</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">⚡</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">Fizyka</p>
                        <p className="text-xs text-[#F2EDE3]/60">Poziom rozszerzony</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">🧪</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">Chemia</p>
                        <p className="text-xs text-[#F2EDE3]/60">Poziom rozszerzony</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">🧬</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">Biologia</p>
                        <p className="text-xs text-[#F2EDE3]/60">Poziom rozszerzony</p>
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
                      className={`max-w-[85%] flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                    <div
                      className={`w-full px-5 py-3.5 ${
                        msg.role === "user"
                          ? "bg-[#D8FF3D] text-[#0B0B0B] border border-[#D8FF3D]"
                          : "bg-[#0E0E0E] text-[#F2EDE3] border border-[rgba(242,237,227,0.10)]"
                      }`}
                    >
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
                                      className="max-w-sm "
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
                    {msg.role === "assistant" && msg.content && (
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 km-mono-eyebrow border border-[rgba(242,237,227,0.15)] text-[#F2EDE3]/55 hover:text-[#D8FF3D] hover:border-[#D8FF3D] transition-colors"
                        title="Kopiuj odpowiedź"
                      >
                        {copiedIdx === i ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Skopiowano
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Kopiuj
                          </>
                        )}
                      </button>
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
                    <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]  px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-[#F2EDE3]/60">Myślę...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
                {/* Selected files preview */}
                {selectedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => {
                      const isImg = file.type.startsWith("image/");
                      const thumb = isImg ? URL.createObjectURL(file) : null;
                      return (
                        <div key={idx} className="relative flex items-center gap-2 bg-[#D8FF3D]/10 border border-[#D8FF3D]/30 px-2 py-1.5">
                          {thumb && (
                            <img
                              src={thumb}
                              alt={file.name}
                              className="w-10 h-10 object-cover border border-[#D8FF3D]/40"
                              onLoad={() => URL.revokeObjectURL(thumb)}
                            />
                          )}
                          <div className="flex flex-col leading-tight">
                            <span className="text-xs text-[#F2EDE3] truncate max-w-[180px]">{file.name}</span>
                            <span className="km-mono-eyebrow text-[#F2EDE3]/45">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-[#F2EDE3]/50 hover:text-[#FF4D2E] transition-colors p-1"
                            title="Usuń"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      );
                    })}
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
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        const pasted: File[] = [];
                        for (let i = 0; i < items.length; i++) {
                          const it = items[i];
                          if (it.kind === "file" && it.type.startsWith("image/")) {
                            const f = it.getAsFile();
                            if (f && f.size <= 10 * 1024 * 1024) {
                              const ext = (it.type.split("/")[1] || "png").split("+")[0];
                              const stamp = new Date().toISOString().replace(/[:.]/g, "-");
                              const renamed = new File([f], f.name && f.name !== "image.png" ? f.name : `wklejone-${stamp}.${ext}`, { type: it.type });
                              pasted.push(renamed);
                            }
                          }
                        }
                        if (pasted.length > 0) {
                          e.preventDefault();
                          setSelectedFiles((prev) => [...prev, ...pasted].slice(0, 5));
                        }
                      }}
                      placeholder="Wklej treść zadania lub dołącz zdjęcie (Ctrl+V działa też dla obrazów)..."
                      className="flex-1 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] px-4 py-3 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/35 focus:outline-none focus:border-[#D8FF3D] resize-none transition-colors"
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
                        className="inline-flex items-center gap-2 px-3 py-1.5 km-mono-eyebrow text-[#D8FF3D]/80 hover:text-[#D8FF3D] hover:bg-[#D8FF3D]/10 transition-colors disabled:opacity-40"
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
                    className="self-end bg-[#D8FF3D] text-[#0B0B0B] px-7 py-3 km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    Wyślij <span>→</span>
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
              <div className="bg-[#0E0E0E]  p-8 border border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12  bg-[#D8FF3D]/10 bg-[#D8FF3D]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#F2EDE3]">
                      Subskrypcja AI Chat
                    </h2>
                    <p className="text-sm text-[#F2EDE3]/60">
                      Zarządzaj dostępem do AI Chat
                    </p>
                  </div>
                </div>

                {subscriptionStatus ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-[#141414] ">
                      <div className={`w-4 h-4 rounded-full ${subscriptionStatus.canUseChat ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                      <span className="text-lg font-bold text-[#F2EDE3]">
                        Status: {subscriptionStatus.status === "trial" ? "🎁 Okres próbny" : subscriptionStatus.status === "active" ? "✓ Aktywna" : "✗ Nieaktywna"}
                      </span>
                    </div>

                    {/* Aktualnie przypisana licencja */}
                    {calcInfo?.claimed && calcInfo?.license?.code && (
                      <div className="flex items-center justify-between p-4 bg-[#141414] ">
                        <div>
                          <div className="text-xs text-[#F2EDE3]/60 mb-1">
                            Przypisana licencja
                          </div>
                          <div className="font-mono text-sm text-[#F2EDE3]">
                            {calcInfo.license.code}
                          </div>
                          <div className="text-xs text-[#F2EDE3]/60 mt-1">
                            {calcInfo.license.durationDays} dni
                            {calcInfo.license.activatedAt
                              ? ` · aktywowana ${new Date(calcInfo.license.activatedAt).toLocaleDateString("pl-PL")}`
                              : " · nieaktywowana"}
                          </div>
                        </div>
                        <button
                          onClick={calcUnclaim}
                          disabled={unclaiming}
                          className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400  disabled:opacity-50"
                        >
                          {unclaiming ? "Odpinanie..." : "Odepnij"}
                        </button>
                      </div>
                    )}

                    {/* License Redemption */}
                    <div className=" from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/20  p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10   from-purple-500 to-blue-500 flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#F2EDE3]">
                            Masz kod licencji?
                          </h3>
                          <p className="text-xs text-[#F2EDE3]/60">
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
                          className="flex-1 bg-[#0E0E0E] border border-purple-200 dark:border-purple-500/20  px-4 py-3 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/40 placeholder:text-[#F2EDE3]/40 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          disabled={redeemingLicense}
                        />
                        <button
                          onClick={handleRedeemLicense}
                          disabled={!licenseCode.trim() || redeemingLicense}
                          className="px-6 py-3  from-purple-500 to-blue-500 text-white font-medium   transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {redeemingLicense ? "Realizuję..." : "Realizuj"}
                        </button>
                      </div>
                    </div>

                    {subscriptionStatus.isTrialActive && (
                      <div className=" from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-600/10 border border-blue-200 dark:border-blue-500/20  p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12  bg-blue-500 flex items-center justify-center shrink-0">
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
                        <p className="text-sm text-[#F2EDE3]/60 mb-6">
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
                        <div className=" from-[#D8FF3D]/5 to-[#D8FF3D]/5 dark:from-[#D8FF3D]/10 dark:to-[#D8FF3D]/10  p-6 mb-6">
                          <h3 className="text-lg font-bold text-[#F2EDE3] mb-4 text-center">
                            Wybierz plan subskrypcji
                          </h3>

                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {/* Second Month Plan - 1 zł */}
                            <div className="bg-[#0E0E0E]  p-5 border-2 border-[#D8FF3D] relative">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1  from-[#D8FF3D] to-[#D8FF3D] text-[#0B0B0B] text-xs font-bold rounded-full">
                                🔥 Promocja -98%
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#D8FF3D] mb-1">
                                  1 zł
                                </div>
                                <div className="text-xs text-[#F2EDE3]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#F2EDE3]/60 mt-1">
                                  Drugi miesiąc
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("second_month")}
                                disabled={isLoading}
                                className="w-full  from-[#D8FF3D] to-[#D8FF3D] text-[#0B0B0B] px-4 py-3   transition-all duration-300 disabled:opacity-50 font-bold text-sm"
                              >
                                {isLoading ? "Ładowanie..." : "Wybierz 1 zł"}
                              </button>
                            </div>

                            {/* Regular Plan - 15 zł */}
                            <div className="bg-[#0E0E0E]  p-5 border-2 border-[rgba(242,237,227,0.15)] border-[rgba(242,237,227,0.10)]">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow">
                                💎 Stała cena
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#F2EDE3] mb-1">
                                  15 zł
                                </div>
                                <div className="text-xs text-[#F2EDE3]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#F2EDE3]/60 mt-1">
                                  Kolejne miesiące
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("regular")}
                                disabled={isLoading}
                                className="w-full bg-[#0E0E0E] bg-[#141414] text-[#F2EDE3] px-4 py-3  hover:bg-[#141414] hover:bg-[#1a1a1a] transition-all duration-300 disabled:opacity-50 font-bold text-sm border border-[rgba(242,237,227,0.15)]"
                              >
                                {isLoading ? "Ładowanie..." : "Wybierz 15 zł"}
                              </button>
                            </div>
                          </div>

                          <div className="text-center text-xs text-[#F2EDE3]/60">
                            💳 Bezpieczna płatność przez Stripe • Anuluj w każdej chwili
                          </div>
                        </div>

                        {subscriptionStatus.hasPurchasedCalculator && (
                          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20  p-4">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              💡 <strong>Jako właściciel kalkulatora</strong> możesz korzystać z AI Chat przez subskrypcję. To opcjonalne - kalkulator działa niezależnie.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {subscriptionStatus.hasActiveSubscription && (
                      <div>
                        <div className=" from-green-50 to-emerald-100 dark:from-green-500/10 dark:to-emerald-600/10 border border-green-200 dark:border-green-500/20  p-6 mb-4">
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
                    <div className="w-8 h-8 border-4 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)] max-w-3xl">
                <div className="km-mono-eyebrow text-[#D8FF3D] mb-1">/ Model AI</div>
                <p className="text-sm text-[#F2EDE3]/55 mb-4">
                  Wybierz model, którego kalkulator użyje do rozwiązywania zadań. Wszystkie najlepsze modele przez jedno API (OpenRouter).
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {aiModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => saveAiSettings({ aiModel: m.id })}
                      disabled={aiSaving}
                      className={`text-left px-4 py-3 border transition-colors disabled:opacity-50 ${
                        aiModel === m.id
                          ? "border-[#D8FF3D] bg-[#D8FF3D]/10"
                          : "border-[rgba(242,237,227,0.18)] hover:border-[rgba(242,237,227,0.40)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${aiModel === m.id ? "text-[#D8FF3D]" : "text-[#F2EDE3]"}`}>{m.label}</span>
                        <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] whitespace-nowrap">{m.provider}</span>
                      </div>
                      {m.note && <div className="text-xs text-[#F2EDE3]/45 mt-1">{m.note}</div>}
                    </button>
                  ))}
                </div>

                {/* Tryb AI — przeniesiony z zakładki Kalkulator */}
                <div className="mt-6 pt-5 border-t border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">/ Tryb AI</div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => saveAiSettings({ aiMode: "matura" })}
                      disabled={aiSaving}
                      className={`km-mono-eyebrow px-4 py-2 border transition-colors disabled:opacity-50 ${
                        aiMode !== "raw"
                          ? "border-[#D8FF3D] bg-[#D8FF3D]/10 text-[#D8FF3D]"
                          : "border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:border-[rgba(242,237,227,0.40)]"
                      }`}
                      title="Wyspecjalizowany prompt pod zadania CKE (matematyka, fizyka, chemia, biologia)"
                    >
                      Matura (CKE)
                    </button>
                    <button
                      onClick={() => saveAiSettings({ aiMode: "raw" })}
                      disabled={aiSaving}
                      className={`km-mono-eyebrow px-4 py-2 border transition-colors disabled:opacity-50 ${
                        aiMode === "raw"
                          ? "border-[#D8FF3D] bg-[#D8FF3D]/10 text-[#D8FF3D]"
                          : "border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:border-[rgba(242,237,227,0.40)]"
                      }`}
                      title="Bez ograniczen do matury - dowolny przedmiot (elektronika, informatyka, jezyki...)"
                    >
                      Czysty AI
                    </button>
                  </div>
                  <div className="text-xs text-[#F2EDE3]/45">
                    {aiMode === "raw"
                      ? "Tryb uniwersalny — AI nie zakłada matury. Działa dla elektroniki, informatyki, języków itp."
                      : "Tryb maturalny — AI odpowiada w formacie CKE (matematyka/fizyka/chemia/biologia)."}
                  </div>
                </div>
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
                <div className="text-[#F2EDE3]/60">Ladowanie...</div>
              )}

              {!calcLoading && calcInfo && !calcInfo.device && (
                <div className="relative bg-[#0E0E0E] border border-[rgba(242,237,227,0.18)]">
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                  <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                      Sparuj kalkulator
                    </span>
                    <span className="km-mono-eyebrow text-[#F2EDE3]/40">/PAIR</span>
                  </div>

                  <div className="p-6 lg:p-8">
                    <h2 className="km-display text-3xl text-[#F2EDE3]">
                      Dodaj swoje <span className="italic text-[#D8FF3D]">urządzenie</span>.
                    </h2>
                    <p className="mt-3 text-[14px] text-[#F2EDE3]/65 leading-[1.6]">
                      Wpisz <strong className="text-[#F2EDE3]">Device ID</strong> z kalkulatora
                      (Settings → Device ID + QR) oraz <strong className="text-[#F2EDE3]">kod
                      odblokowania</strong> (Settings → Kod AI).
                    </p>
                    <p className="mt-2 km-mono-eyebrow text-[#F2EDE3]/40">
                      ⚠ Kalkulator musi być najpierw połączony z WiFi i zgłosić się do serwera.
                    </p>

                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          Device ID (MAC)
                        </label>
                        <input
                          type="text"
                          value={pairDeviceId}
                          onChange={(e) => setPairDeviceId(e.target.value.toUpperCase())}
                          placeholder="68FE71E43B94"
                          className="w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] focus:outline-none focus:border-[#D8FF3D] text-[15px] font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/25 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          Kod odblokowania
                        </label>
                        <input
                          type="text"
                          value={pairUnlockCode}
                          onChange={(e) => setPairUnlockCode(e.target.value)}
                          placeholder="1111"
                          className="w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] focus:outline-none focus:border-[#D8FF3D] text-[15px] font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/25 transition-colors"
                        />
                      </div>
                      <button
                        onClick={pairDevice}
                        disabled={pairing || !pairDeviceId.trim() || !pairUnlockCode.trim()}
                        className="w-full inline-flex items-center justify-between px-5 py-3.5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2">
                          {!pairing && <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />}
                          {pairing ? "Parowanie..." : "Sparuj urządzenie"}
                        </span>
                        {!pairing && <span>→</span>}
                      </button>
                    </div>

                    {pairError && (
                      <div className="mt-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                        <p className="km-mono-eyebrow text-[#FF4D2E]">/ ERROR</p>
                        <p className="text-sm text-[#FF4D2E] mt-1">{pairError}</p>
                      </div>
                    )}
                    {pairOk && (
                      <div className="mt-4 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06] p-3">
                        <p className="km-mono-eyebrow text-[#D8FF3D]">✓ Sparowano</p>
                        <p className="text-sm text-[#F2EDE3]/80 mt-1">Urządzenie dodane do konta.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!calcLoading && calcInfo && calcInfo.device && (
                <>
                  {/* Info o urzadzeniu */}
                  <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="km-display text-2xl text-[#F2EDE3]">
                        Twoje <span className="italic text-[#D8FF3D]">urządzenie</span>
                      </h2>
                      <button
                        onClick={calcUnclaim}
                        disabled={unclaiming}
                        className="km-mono-eyebrow px-3 py-1.5 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 disabled:opacity-50 transition-colors"
                      >
                        {unclaiming ? "Odpinanie..." : "Odepnij"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[#F2EDE3]/60">Licencja</div>
                        <div className="font-mono text-[#F2EDE3]">{calcInfo.license?.code}</div>
                      </div>
                      {calcInfo.device && (
                        <>
                          <div>
                            <div className="text-[#F2EDE3]/60">Device ID (MAC)</div>
                            <div className="font-mono text-[#F2EDE3]">{calcInfo.device.deviceId}</div>
                          </div>
                          <div>
                            <div className="text-[#F2EDE3]/60">Firmware</div>
                            <div className="font-mono text-[#F2EDE3]">{calcInfo.device.firmwareVersion || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[#F2EDE3]/60">Zapytan</div>
                            <div className="font-bold text-[#D8FF3D]">{calcInfo.device.requestCount}</div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tryb AI + model — przeniesione do zakładki "AI" */}
                    <div className="mt-5 pt-5 border-t border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-1">/ Tryb AI i model</div>
                      <div className="text-xs text-[#F2EDE3]/45">
                        Model AI oraz tryb (Matura / Czysty AI) ustawisz w zakładce{" "}
                        <button onClick={() => setActiveTab("ai")} className="text-[#D8FF3D] underline hover:no-underline">AI</button>.
                      </div>
                    </div>
                  </div>

                  {/* Galeria zdjec z kamery */}
                  <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#D8FF3D]">/ Galeria zdjęć</span>
                      <span className="km-mono-eyebrow text-[#F2EDE3]/45">
                        {String(captures.length).padStart(2, "0")} ZDJĘĆ
                      </span>
                    </div>
                    {capturesLoading ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        Ładowanie…
                      </div>
                    ) : captures.length === 0 ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        Brak zdjęć. Zrób kamerą zdjęcie zadania w kalkulatorze.
                      </div>
                    ) : (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {captures.map((c) => (
                          <button
                            key={c.filename}
                            onClick={() => setOpenedCapture(c.filename)}
                            className="group relative aspect-[4/3] bg-[#1A1A1A] overflow-hidden border border-[rgba(242,237,227,0.10)] hover:border-[#D8FF3D] transition-colors"
                            title={`${new Date(c.timestamp).toLocaleString("pl-PL")} · ${c.sizeKB} kB`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/user/captures/${encodeURIComponent(c.filename)}`}
                              alt={c.filename}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                              <div className="km-mono-eyebrow text-[10px] text-[#F2EDE3]/80 truncate">
                                {new Date(c.timestamp).toLocaleString("pl-PL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modal — pelnoekranowy podglad zdjecia */}
                  {openedCapture && (
                    <div
                      onClick={() => setOpenedCapture(null)}
                      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/user/captures/${encodeURIComponent(openedCapture)}`}
                        alt={openedCapture}
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => setOpenedCapture(null)}
                        className="absolute top-4 right-4 km-mono-eyebrow text-[#F2EDE3]/80 hover:text-[#D8FF3D] border border-[rgba(242,237,227,0.20)] px-3 py-1.5"
                      >
                        Zamknij ×
                      </button>
                    </div>
                  )}

                  {/* Historia rozmów */}
                  <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#D8FF3D]">/ Historia rozwiązań</span>
                      <span className="km-mono-eyebrow text-[#F2EDE3]/45">
                        {String(calcConvs.length).padStart(2, "0")} REKORDÓW
                      </span>
                    </div>
                    {calcConvs.length === 0 ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        Żadnych zadań jeszcze nie rozwiązano.
                      </div>
                    ) : (
                      <div className="divide-y divide-[rgba(242,237,227,0.08)]">
                        {calcConvs.map((it: any, idx: number) => (
                          <button
                            key={it.id}
                            onClick={() => setCalcOpenedConv(it)}
                            className="block w-full text-left px-6 py-4 hover:bg-[#141414] transition-colors group"
                          >
                            <div className="flex items-start gap-4">
                              <span className="km-mono-eyebrow text-[#F2EDE3]/30 pt-1 group-hover:text-[#D8FF3D] transition-colors">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[15px] text-[#F2EDE3] truncate">
                                  {it.mode === "image" ? "📷 Zdjęcie" : it.question}
                                </div>
                                <div className="text-[13px] text-[#F2EDE3]/55 mt-1 line-clamp-1">
                                  {it.answer.slice(0, 140)}…
                                </div>
                              </div>
                              <span className="km-mono-eyebrow text-[#F2EDE3]/40 whitespace-nowrap tabular-nums">
                                {new Date(it.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
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
                <div className="fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setCalcOpenedConv(null)}>
                  <div className="relative bg-[#0B0B0B] max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-[rgba(242,237,227,0.18)]" onClick={(e) => e.stopPropagation()}>
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                    <div className="flex justify-between items-center px-6 py-4 border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B] z-10">
                      <div className="flex flex-col">
                        <span className="km-mono-eyebrow text-[#D8FF3D]">/ Rozwiązanie</span>
                        <span className="km-mono-eyebrow text-[#F2EDE3]/45 mt-1">
                          {new Date(calcOpenedConv.createdAt).toLocaleString("pl-PL")} · {calcOpenedConv.deviceId}
                        </span>
                      </div>
                      <button
                        onClick={() => setCalcOpenedConv(null)}
                        className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-6 lg:p-8 space-y-5">
                      <div>
                        <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-2">Zadanie</p>
                        <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] p-4 text-[14.5px] text-[#F2EDE3] whitespace-pre-wrap leading-relaxed">
                          {calcOpenedConv.question}
                        </div>
                      </div>
                      <div>
                        <p className="km-mono-eyebrow text-[#D8FF3D] mb-2">Rozwiązanie</p>
                        <div className="bg-[#0E0E0E] border border-[#D8FF3D]/30 border-l-2 p-4 text-[14px] text-[#F2EDE3] whitespace-pre-wrap font-mono leading-relaxed">
                          {calcOpenedConv.answer}
                        </div>
                      </div>
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
                <div className="text-[#F2EDE3]/60">Ladowanie...</div>
              )}
              {!calcLoading && calcInfo && !calcInfo.device && (
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ wymagany kalkulator</p>
                  <p className="text-sm text-[#F2EDE3]/70 mt-2">
                    Najpierw sparuj kalkulator w zakładce <strong className="text-[#F2EDE3]">Kalkulator</strong>.
                  </p>
                </div>
              )}
              {!calcLoading && calcInfo && calcInfo.device && (<>{/* Notatki */}
                  <div className="bg-[#0E0E0E]  p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#F2EDE3]">
                        Notatki offline ({calcNotes.length}/50)
                      </h2>
                      <span className="text-xs text-[#F2EDE3]/60">
                        Sync do urzadzenia przy WiFi
                      </span>
                    </div>
                    <div className="bg-[#141414] p-5 mb-5 border border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                        {editingNote ? "Edytuj notatke" : "Nowa notatka"}
                      </div>
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Tytul (max 60 znakow)"
                        maxLength={60}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] mb-2 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Tresc (max 4000 znakow - wzory, definicje)"
                        maxLength={4000}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors resize-none"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#F2EDE3]/60">{noteContent.length}/4000</div>
                        <div className="flex gap-2">
                          {editingNote && (
                            <button
                              onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }}
                              className="px-3 py-1.5 km-mono-eyebrow bg-[#1a1a1a] border border-[rgba(242,237,227,0.20)] hover:border-[#F2EDE3] text-[#F2EDE3]/80 hover:text-[#F2EDE3] transition-colors"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveNote}
                            disabled={savingNote || (!noteTitle.trim() && !noteContent.trim())}
                            className="px-4 py-1.5 km-mono-eyebrow bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] disabled:opacity-30 transition-colors"
                          >{savingNote ? "Zapisuje..." : editingNote ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcNotes.length === 0 ? (
                      <div className="text-[#F2EDE3]/60 text-sm text-center py-4">
                        Brak notatek.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcNotes.map((n: any) => (
                          <div key={n.id} className="border border-[rgba(242,237,227,0.10)] p-4 hover:bg-[#141414] hover:border-[rgba(242,237,227,0.20)] transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#F2EDE3]">{n.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#F2EDE3]/60 mt-1 line-clamp-2 whitespace-pre-wrap">{n.content || "(pusta)"}</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingNote(n); setNoteTitle(n.title); setNoteContent(n.content); }}
                                  className="text-xs px-2 py-1 border border-[#D8FF3D]/40 text-[#D8FF3D] hover:bg-[#D8FF3D]/10 km-mono-eyebrow">Edytuj</button>
                                <button onClick={() => calcDelNote(n.id)}
                                  className="text-xs px-2 py-1 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 km-mono-eyebrow">Usun</button>
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
                <div className="text-[#F2EDE3]/60">Ladowanie...</div>
              )}
              {!calcLoading && calcInfo && !calcInfo.device && (
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ wymagany kalkulator</p>
                  <p className="text-sm text-[#F2EDE3]/70 mt-2">
                    Najpierw sparuj kalkulator w zakładce <strong className="text-[#F2EDE3]">Kalkulator</strong>.
                  </p>
                </div>
              )}
              {!calcLoading && calcInfo && calcInfo.device && (<>{/* Sprawdziany */}
                  <div className="bg-[#0E0E0E]  p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#F2EDE3]">
                        Sprawdziany ({calcTests.length}/50)
                      </h2>
                      <span className="text-xs text-[#F2EDE3]/60">Markdown/LaTeX OK</span>
                    </div>
                    <div className="bg-[#141414] p-5 mb-5 border border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                        {editingTest ? "Edytuj sprawdzian" : "Nowy sprawdzian"}
                      </div>
                      <input
                        type="text"
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder="Tytul (np. Matma 2026 - probna 1)"
                        maxLength={100}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] mb-2 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors"
                      />
                      <textarea
                        value={testContent}
                        onChange={(e) => setTestContent(e.target.value)}
                        placeholder="Wklej tutaj rozwiazanie (markdown, LaTeX, $..$, **bold**...)"
                        maxLength={30000}
                        rows={8}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors resize-none"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#F2EDE3]/60">{testContent.length}/30000</div>
                        <div className="flex gap-2">
                          {editingTest && (
                            <button
                              onClick={() => { setEditingTest(null); setTestTitle(""); setTestContent(""); }}
                              className="px-3 py-1.5 km-mono-eyebrow bg-[#1a1a1a] border border-[rgba(242,237,227,0.20)] hover:border-[#F2EDE3] text-[#F2EDE3]/80 hover:text-[#F2EDE3] transition-colors"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveTest}
                            disabled={savingTest || (!testTitle.trim() && !testContent.trim())}
                            className="px-3 py-1 text-sm bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50"
                          >{savingTest ? "Zapisuje..." : editingTest ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcTests.length === 0 ? (
                      <div className="text-[#F2EDE3]/60 text-sm text-center py-4">
                        Brak sprawdzianow.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcTests.map((t: any) => (
                          <div key={t.id} className="border border-[rgba(242,237,227,0.10)] p-4 hover:bg-[#141414] hover:border-[rgba(242,237,227,0.20)] transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#F2EDE3]">{t.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#F2EDE3]/60 mt-1">{t.content.length} znakow</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingTest(t); setTestTitle(t.title); setTestContent(t.content); }}
                                  className="text-xs px-2 py-1 border border-[#D8FF3D]/40 text-[#D8FF3D] hover:bg-[#D8FF3D]/10 km-mono-eyebrow">Edytuj</button>
                                <button onClick={() => calcDelTest(t.id)}
                                  className="text-xs px-2 py-1 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 km-mono-eyebrow">Usun</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div></>)}
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
            >
              <div className="max-w-2xl space-y-6">
                {/* Profil */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">/ Konto</div>
                  <div className="text-sm text-[#F2EDE3]/55">Zalogowany jako</div>
                  <div className="text-[#F2EDE3] font-medium break-all">{session.user?.email}</div>
                </div>

                {/* Zmiana hasła */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-4">/ Zmiana hasła</div>
                  <div className="space-y-2">
                    <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="Aktualne hasło" autoComplete="current-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Nowe hasło (min. 6 znaków)" autoComplete="new-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} placeholder="Powtórz nowe hasło" autoComplete="new-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                  </div>
                  {pwMsg && <div className={`text-xs mt-2 ${pwMsg.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}>{pwMsg.text}</div>}
                  <button onClick={changePassword} disabled={pwSaving} className="mt-3 px-4 py-2 bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 transition-colors">{pwSaving ? "Zapisuje..." : "Zmień hasło"}</button>
                </div>

                {/* Zmiana emaila */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-4">/ Zmiana adresu email</div>
                  <div className="space-y-2">
                    <input type="email" value={emNew} onChange={(e) => setEmNew(e.target.value)} placeholder="Nowy adres email" autoComplete="email" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={emPassword} onChange={(e) => setEmPassword(e.target.value)} placeholder="Potwierdź hasłem" autoComplete="current-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                  </div>
                  {emMsg && <div className={`text-xs mt-2 ${emMsg.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}>{emMsg.text}</div>}
                  <button onClick={changeEmail} disabled={emSaving} className="mt-3 px-4 py-2 bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 transition-colors">{emSaving ? "Zapisuje..." : "Zmień email"}</button>
                  <p className="text-xs text-[#F2EDE3]/40 mt-2">Po zmianie emaila nastąpi wylogowanie — zaloguj się nowym adresem.</p>
                </div>

                {/* Wyloguj */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">/ Sesja</div>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="px-4 py-2 border border-[rgba(242,237,227,0.20)] hover:border-[#FF4D2E] text-[#F2EDE3]/80 hover:text-[#FF4D2E] km-mono-eyebrow transition-colors">Wyloguj się ↗</button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
