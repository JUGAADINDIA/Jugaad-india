import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  preferred_language: string | null;
  preferred_address: string | null;
  service_area: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  rating: number | null;
  completed_job: number | null;
};

type RequestRow = {
  id: string;
  customer_id?: string | null;
  user_id?: string | null;
  title?: string | null;
  description?: string | null;
  need?: string | null;
  input_type?: string | null;
  category?: string | null;
  budget?: number | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  required_at?: string | null;
  target_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MatchRow = {
  id: string;
  request_id: string;
  worker_id?: string | null;
  provider_id?: string | null;
  quoted_amount?: number | null;
  distance_km?: number | null;
  status?: string | null;
  created_at?: string | null;
};

const CATEGORIES = [
  "Home", "Repair", "Delivery", "Personal", "Business",
  "Electrician", "Plumber", "Mobile Repair", "AC/Cooler Repair",
  "Home Cleaning", "Transport", "Tutor", "Other"
];

const STATUS = {
  pending: "pending",
  accepted: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

function normalizeIndiaPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return value.startsWith("+") ? value : `+91${digits}`;
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function timeText(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function statusLabel(value?: string | null) {
  return (value || "pending").replaceAll("_", " ");
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [tab, setTab] = useState<"home" | "explore" | "requests" | "profile">("home");
  const [need, setNeed] = useState("");
  const [category, setCategory] = useState("Other");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [inputType, setInputType] = useState<"text" | "voice" | "photo">("text");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [providers, setProviders] = useState<Profile[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileLanguage, setProfileLanguage] = useState("Hindi");
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const recognitionRef = useRef<any>(null);

  const role = String(profile?.role || "Customer").toLowerCase();
  const isProvider = role === "provider" || role === "worker" || role === "service_provider";
  const isAdmin = role === "admin" || role === "super_admin";

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRequests();
    loadProviders();
  }, [user, isProvider]);

  async function loadProfile(id: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setProfile(data as Profile);
      setProfileName(data.full_name || "");
      setProfileAddress(data.preferred_address || "");
      setProfileLanguage(data.preferred_language || "Hindi");
    } else {
      const fallback = {
        id,
        full_name: user?.user_metadata?.full_name || "",
        role: "Customer",
        preferred_language: "Hindi",
        is_active: true,
      };
      const { data: created } = await supabase.from("profiles").upsert(fallback).select("*").single();
      if (created) setProfile(created as Profile);
    }
  }

  async function sendOtp() {
    setAuthBusy(true);
    setAuthMessage("");
    const normalized = normalizeIndiaPhone(phone);
    if (!/^\+91\d{10}$/.test(normalized)) {
      setAuthMessage("10 digit mobile number dalo.");
      setAuthBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) setAuthMessage(error.message);
    else {
      setAuthMode("otp");
      setAuthMessage("OTP bhej diya. SMS check karo.");
    }
    setAuthBusy(false);
  }

  async function verifyOtp() {
    setAuthBusy(true);
    setAuthMessage("");
    const normalized = normalizeIndiaPhone(phone);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp.trim(),
      type: "sms",
    });
    if (error) setAuthMessage(error.message);
    else if (data.user) {
      await loadProfile(data.user.id);
      setAuthMessage("JUGAAD mein swagat hai! 😎");
    }
    setAuthBusy(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setTab("home");
    setRequests([]);
    setMatches([]);
  }

  async function loadRequests() {
    if (!user) return;

    const column = isProvider ? "status" : "customer_id";
    let query = supabase.from("requests").select("*").order("created_at", { ascending: false });

    if (isProvider) {
      query = query.in("status", [STATUS.pending, STATUS.accepted, STATUS.in_progress]);
    } else {
      query = query.eq("customer_id", user.id);
    }

    let { data, error } = await query;

    // Backward-compatible fallback for the earlier requests.user_id schema.
    if (error && !isProvider) {
      const fallback = await supabase
        .from("requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      data = fallback.data || [];
      error = fallback.error;
    }

    if (!error) setRequests((data || []) as RequestRow[]);
    else console.error("requests:", error.message);
  }

  async function loadProviders() {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["Provider", "provider", "Worker", "worker"])
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(20);

    if (!error) setProviders((data || []) as Profile[]);
  }

  async function createRequest() {
    if (!user) return;
    const cleanNeed = need.trim();
    if (!cleanNeed) {
      alert("Pehle batao kya chahiye 😄");
      return;
    }

    setRequestBusy(true);
    const title = cleanNeed.length > 70 ? cleanNeed.slice(0, 67) + "..." : cleanNeed;
    const payload = {
      customer_id: user.id,
      title,
      description: cleanNeed,
      input_type: inputType,
      category,
      budget: budget ? Number(budget) : null,
      location: location.trim() || profile?.preferred_address || null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      status: STATUS.pending,
    };

    let { error } = await supabase.from("requests").insert(payload);

    // Backward-compatible fallback for the older table.
    if (error) {
      const oldPayload = {
        user_id: user.id,
        need: cleanNeed,
        category,
        location: location.trim() || profile?.preferred_address || null,
        status: STATUS.pending,
      };
      const fallback = await supabase.from("requests").insert(oldPayload);
      error = fallback.error;
    }

    if (error) {
      alert("Request save nahi hui: " + error.message);
    } else {
      setNeed("");
      setBudget("");
      setLocation("");
      setInputType("text");
      setTab("requests");
      await loadRequests();
      alert("JUGAAD lag gaya! 🔧 Ab kaam dhoondhne nikal pade.");
    }
    setRequestBusy(false);
  }

  async function acceptRequest(requestId: string) {
    if (!user) return;
    const amount = window.prompt("Apna quote kitna rakhoge? ₹ (optional)");
    const quote = amount?.trim() ? Number(amount) : null;

    const payload = {
      request_id: requestId,
      worker_id: user.id,
      provider_id: user.id,
      quoted_amount: Number.isFinite(quote as number) ? quote : null,
      status: "accepted",
    };

    const { error } = await supabase.from("matches").insert(payload);
    if (error) {
      alert("Match create nahi hua: " + error.message);
      return;
    }

    const update = await supabase.from("requests").update({
      status: STATUS.accepted,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    if (update.error) console.warn(update.error);
    await loadRequests();
    alert("Request accept ho gayi. Customer ko bata diya gaya. 👍");
  }

  async function loadMatches(requestId: string) {
    setSelectedRequest(requestId);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    if (!error) setMatches((data || []) as MatchRow[]);
  }

  async function updateRequestStatus(id: string, status: string) {
    const { error } = await supabase.from("requests").update({
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      alert("Status update nahi hua: " + error.message);
      return;
    }
    await loadRequests();
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    const { data, error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profileName.trim() || null,
      preferred_address: profileAddress.trim() || null,
      preferred_language: profileLanguage,
      is_active: true,
      updated_at: new Date().toISOString(),
    }).select("*").single();

    if (error) alert("Profile save error: " + error.message);
    else {
      setProfile(data as Profile);
      setEditingProfile(false);
      alert("Profile save ho gayi. Ab JUGAAD ko aapki zarurat pata hai 😎");
    }
    setSavingProfile(false);
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Is browser mein voice input available nahi hai. Text se JUGAAD karo.");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = profileLanguage === "English" ? "en-IN" : "hi-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setInputType("voice");
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setNeed(text);
      setInputType("voice");
    };
    recognition.onerror = () => alert("Awaaz pakadne mein dikkat hui. Dobara try karo.");
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function rateCompleted(requestId: string) {
    if (!user) return;
    setRatingBusy(true);

    // The rating table/columns may vary; attempt the common `ratings` structure.
    const { error } = await supabase.from("ratings").insert({
      request_id: requestId,
      customer_id: user.id,
      rating,
    });

    if (error) {
      alert("Rating save nahi hui. Database mein ratings table/RLS check karo: " + error.message);
    } else {
      alert("Rating mil gayi! ⭐ JUGAAD ko aur smart banane mein madad milegi.");
    }
    setRatingBusy(false);
  }

  const activeRequests = useMemo(
    () => requests.filter(r => !["completed", "cancelled"].includes(String(r.status))),
    [requests]
  );

  if (loading) {
    return <div className="splash"><div className="logo-mark">💡</div><h1>JUGAAD</h1><p>Jugaad laga rahe hain...</p></div>;
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo-mark">💡</div>
          <div className="brand">JUGAAD</div>
          <div className="tagline">Har zarurat ka jugaad 🇮🇳</div>
          <h1>Jo chahiye, JUGAAD se milega.</h1>
          <p className="muted">Voice, photo ya text mein batao. Baaki jugaad hum dekh lenge 😎</p>

          {authMode === "phone" ? (
            <>
              <label>Mobile Number</label>
              <input
                inputMode="numeric"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(-10))}
                placeholder="10 digit mobile number"
              />
              <button className="primary big" disabled={authBusy} onClick={sendOtp}>
                {authBusy ? "OTP aa raha hai..." : "OTP Bhejo →"}
              </button>
            </>
          ) : (
            <>
              <label>OTP</label>
              <input
                inputMode="numeric"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digit OTP"
              />
              <button className="primary big" disabled={authBusy} onClick={verifyOtp}>
                {authBusy ? "Check ho raha..." : "JUGAAD Karo →"}
              </button>
              <button className="link-btn" onClick={() => { setAuthMode("phone"); setOtp(""); }}>
                Number badlo
              </button>
            </>
          )}

          {authMessage && <div className="message">{authMessage}</div>}
          <div className="auth-note">OTP ke liye Supabase Auth mein Phone provider/SMS provider configured hona zaroori hai.</div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="admin-gate">
        <div className="card">
          <div className="logo-mark">🛠️</div>
          <h1>Admin Account</h1>
          <p>Admin ke liye separate desktop dashboard rakha gaya hai.</p>
          <button className="primary" onClick={logout}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="mini-logo">💡</div>
          <div>
            <div className="brand">JUGAAD</div>
            <div className="small-tag">Har zarurat ka jugaad 🇮🇳</div>
          </div>
        </div>
        <div className="top-user">
          <span>{profile?.full_name || "JUGAAD User"}</span>
          <button className="icon-btn" onClick={logout}>↪</button>
        </div>
      </header>

      <main className="main">
        {tab === "home" && (
          <section>
            <div className="hero">
              <span className="eyebrow">JUGAAD READY 🚀</span>
              <h1>Jo chahiye,<br /><b>JUGAAD se milega.</b></h1>
              <p>Aapko kis cheez ki zarurat hai?</p>

              <div className="need-box">
                <textarea
                  value={need}
                  onChange={e => { setNeed(e.target.value); setInputType("text"); }}
                  placeholder="Jaise: Ghar ka fan kharab hai, electrician chahiye..."
                  rows={4}
                />
                <div className="input-actions">
                  <button className={inputType === "voice" ? "tool active" : "tool"} onClick={startVoice}>🎙️ Awaaz</button>
                  <button className={inputType === "photo" ? "tool active" : "tool"} onClick={() => setInputType("photo")}>📷 Photo</button>
                  <button className={inputType === "text" ? "tool active" : "tool"} onClick={() => setInputType("text")}>⌨️ Text</button>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Budget (optional)</label>
                  <input inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="₹ Kitna socha hai?" />
                </div>
              </div>

              <label>Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder={profile?.preferred_address || "Area / City"} />

              <button className="primary big full" disabled={requestBusy} onClick={createRequest}>
                {requestBusy ? "JUGAAD lag raha hai..." : "JUGAAD Karo →"}
              </button>
            </div>

            <div className="smile-card">
              <span>😎</span>
              <div>
                <b>Tension mat lo.</b>
                <p>Kaam genuine hai? JUGAAD uske liye banda/resource dhoondhega.</p>
              </div>
            </div>
          </section>
        )}

        {tab === "explore" && (
          <section>
            <SectionTitle title={isProvider ? "Aas-paas ke Kaam" : "JUGAAD Providers"} subtitle={isProvider ? "Jo kaam aap kar sakte ho, uthao." : "Service providers se connect hone ke options."} />
            {isProvider ? (
              <div className="stack">
                {requests.length === 0 && <Empty text="Abhi koi matching kaam nahi. Chai pi lo ☕" />}
                {requests.map(r => (
                  <RequestCard key={r.id} request={r} provider onAccept={() => acceptRequest(r.id)} />
                ))}
              </div>
            ) : (
              <div className="provider-grid">
                {providers.length === 0 && <Empty text="Providers abhi load nahi hue." />}
                {providers.map(p => (
                  <div className="provider-card" key={p.id}>
                    <div className="avatar">{(p.full_name || "J").charAt(0).toUpperCase()}</div>
                    <div className="provider-main">
                      <b>{p.full_name || "JUGAAD Provider"}</b>
                      <span>{p.service_area || p.preferred_address || "Nearby"}</span>
                      <span>⭐ {Number(p.rating || 0).toFixed(1)} · {p.completed_job || 0} jobs</span>
                    </div>
                    {p.is_verified && <span className="verified">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section>
            <SectionTitle title={isProvider ? "Mere Accepted Kaam" : "Meri Requests"} subtitle={isProvider ? "Kaam ka status yahin sambhalo." : "Aapke saare JUGAAD ek jagah."} />
            <div className="stack">
              {activeRequests.length === 0 && requests.length === 0 && <Empty text="Abhi koi request nahi. Ek JUGAAD laga do 😄" />}
              {requests.map(r => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onOpen={() => !isProvider && loadMatches(r.id)}
                  selected={selectedRequest === r.id}
                  onStatus={(s) => updateRequestStatus(r.id, s)}
                />
              ))}
            </div>

            {selectedRequest && (
              <div className="card matches-card">
                <div className="row-between"><h3>Matching Providers</h3><button className="link-btn" onClick={() => setSelectedRequest(null)}>Close</button></div>
                {matches.length === 0 ? <Empty text="Abhi match nahi mila. Search chal raha hai 🔎" /> : matches.map(m => (
                  <div className="match-row" key={m.id}>
                    <span>Provider: {m.provider_id || m.worker_id}</span>
                    <span>{money(m.quoted_amount)} · {statusLabel(m.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "profile" && (
          <section>
            <SectionTitle title="Mera Profile" subtitle="JUGAAD ko aapke baare mein thoda aur batao." />
            <div className="profile-card">
              <div className="profile-avatar">{(profile?.full_name || "J").charAt(0).toUpperCase()}</div>
              <h2>{profile?.full_name || "Naam add karo"}</h2>
              <p>{profile?.phone || user.phone || ""}</p>
              <span className="role-pill">{profile?.role || "Customer"}</span>
            </div>

            {!editingProfile ? (
              <div className="card">
                <Info label="Naam" value={profile?.full_name || "—"} />
                <Info label="Mobile" value={profile?.phone || user.phone || "—"} />
                <Info label="Language" value={profile?.preferred_language || "Hindi"} />
                <Info label="Address" value={profile?.preferred_address || "—"} />
                <button className="secondary full" onClick={() => setEditingProfile(true)}>Profile Edit Karo</button>
              </div>
            ) : (
              <div className="card">
                <label>Naam</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)} />
                <label>Preferred Language</label>
                <select value={profileLanguage} onChange={e => setProfileLanguage(e.target.value)}>
                  <option>Hindi</option><option>Hinglish</option><option>English</option>
                </select>
                <label>Preferred Address</label>
                <textarea value={profileAddress} onChange={e => setProfileAddress(e.target.value)} rows={3} />
                <div className="grid-2">
                  <button className="secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                  <button className="primary" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? "Saving..." : "Save"}</button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <NavButton active={tab === "home"} icon="🏠" text="Home" onClick={() => setTab("home")} />
        <NavButton active={tab === "explore"} icon={isProvider ? "🧰" : "🔎"} text={isProvider ? "Kaam" : "Explore"} onClick={() => setTab("explore")} />
        <NavButton active={tab === "requests"} icon="📋" text="Requests" onClick={() => setTab("requests")} />
        <NavButton active={tab === "profile"} icon="👤" text="Profile" onClick={() => setTab("profile")} />
      </nav>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="section-title"><h1>{title}</h1><p>{subtitle}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><span>{label}</span><b>{value}</b></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><div>🛠️</div><p>{text}</p></div>;
}

function NavButton({ active, icon, text, onClick }: { active: boolean; icon: string; text: string; onClick: () => void }) {
  return <button className={active ? "nav-btn active" : "nav-btn"} onClick={onClick}><span>{icon}</span><small>{text}</small></button>;
}

function RequestCard({
  request, provider, selected, onAccept, onOpen, onStatus
}: {
  request: RequestRow;
  provider?: boolean;
  selected?: boolean;
  onAccept?: () => void;
  onOpen?: () => void;
  onStatus?: (status: string) => void;
}) {
  const title = request.title || request.need || request.description || "JUGAAD Request";
  const description = request.description || request.need || "";
  const status = String(request.status || "pending");

  return (
    <div className={selected ? "request-card selected" : "request-card"}>
      <div className="row-between">
        <span className="category-pill">{request.category || "Other"}</span>
        <span className={`status status-${status}`}>{statusLabel(status)}</span>
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <div className="request-meta">
        <span>📍 {request.location || "Location pending"}</span>
        {request.budget !== null && request.budget !== undefined && <span>💰 {money(request.budget)}</span>}
      </div>
      <div className="request-footer">
        <small>{timeText(request.created_at)}</small>
        <div className="actions">
          {provider && status === "pending" && <button className="primary small" onClick={onAccept}>Kaam Lo 👍</button>}
          {!provider && <button className="secondary small" onClick={onOpen}>Matches</button>}
          {!provider && status === "accepted" && <button className="primary small" onClick={() => onStatus?.("in_progress")}>Kaam Start</button>}
          {!provider && status === "in_progress" && <button className="primary small" onClick={() => onStatus?.("completed")}>Complete ✓</button>}
          {!provider && !["completed", "cancelled"].includes(status) && <button className="danger small" onClick={() => onStatus?.("cancelled")}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}

export default App;
