import { useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type RequestItem = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  input_type: string | null;
  category: string | null;
  budget: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  required_at: string | null;
  target_at: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type MatchItem = {
  id: string;
  request_id: string;
  worker_id: string | null;
  provider_id: string | null;
  quoted_amount: number | null;
  distance_km: number | null;
  matches_status: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  preferred_language: string | null;
};

const services = [
  ["🔌", "Electrician"],
  ["🔧", "Plumber"],
  ["📱", "Mobile Repair"],
  ["❄️", "AC / Cooler"],
  ["🧹", "Home Cleaning"],
  ["🚚", "Delivery"],
  ["💻", "Online / Digital"],
  ["📚", "Education"],
  ["🚕", "Travel"],
  ["🙋", "Personal"],
  ["🏢", "Business"],
  ["🛠️", "Other"],
];

const categories = [
  "Sab",
  "Repair",
  "Delivery",
  "Personal",
  "Business",
  "Education",
  "Travel",
  "Digital",
  "Other",
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<
    "home" | "explore" | "requests" | "profile" | "provider"
  >("home");

  const [mode, setMode] = useState<"customer" | "provider">("customer");

  const [requestTitle, setRequestTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Sab");

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [providerRequests, setProviderRequests] = useState<RequestItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);

  const [quoteValues, setQuoteValues] = useState<Record<string, string>>({});

  const [selectedService, setSelectedService] = useState("");

  const isProvider =
    profile?.role === "provider" ||
    profile?.role === "worker" ||
    profile?.role === "service_provider";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadRequests();
      loadMatches();
    } else {
      setProfile(null);
      setRequests([]);
      setMatches([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && isProvider) {
      loadProviderRequests();
    }
  }, [user, isProvider]);

  async function loadProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_url, role, preferred_language"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      if (
        data.role === "provider" ||
        data.role === "worker" ||
        data.role === "service_provider"
      ) {
        setMode("provider");
      }
    }
  }

  async function loadRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from("requests")
      .select(
        "id, customer_id, title, description, input_type, category, budget, location, latitude, longitude, required_at, target_at, status, created_at, updated_at"
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setRequests(data ?? []);
    }
  }

  async function loadProviderRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from("requests")
      .select(
        "id, customer_id, title, description, input_type, category, budget, location, latitude, longitude, required_at, target_at, status, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error) {
      setProviderRequests(data ?? []);
    }
  }

  async function loadMatches() {
    if (!user) return;

    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, request_id, worker_id, provider_id, quoted_amount, distance_km, matches_status, created_at"
      )
      .or(`worker_id.eq.${user.id},provider_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!error) {
      setMatches(data ?? []);
    }
  }

  async function sendOtp() {
    if (!phone.trim()) {
      alert("Phone number डालो");
      return;
    }

    setLoading(true);

    const cleanPhone = phone.startsWith("+")
      ? phone
      : `+91${phone.replace(/\D/g, "")}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: cleanPhone,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOtpSent(true);
    alert("OTP भेज दिया गया है");
  }

  async function verifyOtp() {
    if (!otp.trim()) {
      alert("OTP डालो");
      return;
    }

    setLoading(true);

    const cleanPhone = phone.startsWith("+")
      ? phone
      : `+91${phone.replace(/\D/g, "")}`;

    const { data, error } = await supabase.auth.verifyOtp({
      phone: cleanPhone,
      token: otp.trim(),
      type: "sms",
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setUser(data.user);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setTab("home");
    setMode("customer");
  }

  async function askJugaad() {
    if (!user) {
      alert("पहले login करो");
      setTab("profile");
      return;
    }

    if (!message.trim()) {
      alert("अपनी जरूरत लिखो");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("requests").insert({
      customer_id: user.id,
      title: requestTitle.trim() || message.trim().slice(0, 60),
      description: message.trim(),
      input_type: "text",
      category: category === "Sab" ? null : category,
      budget: null,
      location: "Lucknow",
      latitude: null,
      longitude: null,
      required_at: null,
      target_at: null,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRequestTitle("");
    setMessage("");
    setCategory("Sab");

    await loadRequests();

    alert("आपकी request JUGAAD पर भेज दी गई है");
    setTab("requests");
  }

  async function becomeProvider() {
    if (!user) {
      setTab("profile");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "provider",
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      alert(
        "Provider mode activate नहीं हुआ: " +
          error.message
      );
      return;
    }

    await loadProfile();
    await loadProviderRequests();

    setMode("provider");
    setTab("provider");

    alert("अब आपका Provider mode चालू है");
  }

  async function sendQuote(request: RequestItem) {
    if (!user) return;

    const rawQuote = quoteValues[request.id];

    if (!rawQuote || Number(rawQuote) <= 0) {
      alert("पहले अपना quote amount डालो");
      return;
    }

    const amount = Number(rawQuote);

    setLoading(true);

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("request_id", request.id)
      .or(`worker_id.eq.${user.id},provider_id.eq.${user.id}`)
      .maybeSingle();

    let error = null;

    if (existing?.id) {
      const result = await supabase
        .from("matches")
        .update({
          quoted_amount: amount,
          matches_status: "quoted",
        })
        .eq("id", existing.id);

      error = result.error;
    } else {
      const result = await supabase.from("matches").insert({
        request_id: request.id,
        worker_id: user.id,
        provider_id: user.id,
        quoted_amount: amount,
        distance_km: null,
        matches_status: "quoted",
      });

      error = result.error;
    }

    setLoading(false);

    if (error) {
      alert("Quote भेजने में error: " + error.message);
      return;
    }

    setQuoteValues((prev) => ({
      ...prev,
      [request.id]: "",
    }));

    await loadMatches();

    alert("आपका quote customer को भेज दिया गया है");
  }

  async function acceptQuote(match: MatchItem) {
    if (!user) return;

    setLoading(true);

    const { error: matchError } = await supabase
      .from("matches")
      .update({
        matches_status: "accepted",
      })
      .eq("id", match.id);

    if (matchError) {
      setLoading(false);
      alert(matchError.message);
      return;
    }

    const { error: requestError } = await supabase
      .from("requests")
      .update({
        status: "matched",
      })
      .eq("id", match.request_id)
      .eq("customer_id", user.id);

    setLoading(false);

    if (requestError) {
      alert(requestError.message);
      return;
    }

    await loadRequests();
    await loadMatches();

    alert("Provider accept हो गया");
  }

  const serviceList = useMemo(() => {
    return services.filter((item) => {
      if (!selectedService) return true;
      return item[1] === selectedService;
    });
  }, [selectedService]);

  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.authCard}>
          <div style={styles.logo}>JUGAAD</div>
          <div style={styles.logoSub}>INDIA</div>

          <h1 style={styles.authTitle}>
            हर काम का
            <br />
            <span style={styles.orange}>JUGAAD</span>
          </h1>

          <p style={styles.muted}>
            जरूरत बताइए, सही इंसान तक पहुंचिए।
          </p>

          {!otpSent ? (
            <>
              <input
                style={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number"
                inputMode="tel"
              />

              <button
                style={styles.primaryButton}
                onClick={sendOtp}
                disabled={loading}
              >
                {loading ? "भेज रहे हैं..." : "OTP भेजें"}
              </button>
            </>
          ) : (
            <>
              <input
                style={styles.input}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="OTP"
                inputMode="numeric"
              />

              <button
                style={styles.primaryButton}
                onClick={verifyOtp}
                disabled={loading}
              >
                {loading ? "Verify..." : "OTP Verify करें"}
              </button>

              <button
                style={styles.textButton}
                onClick={() => setOtpSent(false)}
              >
                नंबर बदलें
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>JUGAAD</div>
          <div style={styles.brandSub}>INDIA</div>
        </div>

        <button
          style={styles.locationButton}
          onClick={() => alert("Location feature अगले step में connect होगा")}
        >
          📍 Lucknow
        </button>
      </header>

      <main style={styles.content}>
        {tab === "home" && (
          <>
            <div style={styles.hero}>
              <div style={styles.heroTitle}>
                आपको क्या चाहिए?
              </div>

              <div style={styles.heroText}>
                काम छोटा हो या बड़ा,
                <br />
                JUGAAD ढूंढ देगा।
              </div>

              <textarea
                style={styles.bigInput}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="जैसे: घर में पंखा खराब है, electrician चाहिए..."
              />

              <input
                style={styles.input}
                value={requestTitle}
                onChange={(e) =>
                  setRequestTitle(e.target.value)
                }
                placeholder="काम का छोटा नाम (optional)"
              />

              <div style={styles.categoryRow}>
                {categories.map((item) => (
                  <button
                    key={item}
                    style={{
                      ...styles.categoryButton,
                      ...(category === item
                        ? styles.categoryActive
                        : {}),
                    }}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <button
                style={styles.primaryButton}
                onClick={askJugaad}
                disabled={loading}
              >
                {loading ? "भेज रहे हैं..." : "🚀 JUGAAD ढूंढो"}
              </button>

              <div style={styles.quickRow}>
                <button
                  style={styles.quickButton}
                  onClick={() =>
                    alert("Voice input अगले step में connect होगा")
                  }
                >
                  🎤 Voice
                </button>

                <button
                  style={styles.quickButton}
                  onClick={() =>
                    alert("Photo input अगले step में connect होगा")
                  }
                >
                  📷 Photo
                </button>
              </div>
            </div>

            <h2 style={styles.sectionTitle}>
              Popular Services
            </h2>

            <div style={styles.serviceGrid}>
              {serviceList.map(([icon, name]) => (
                <button
                  key={name}
                  style={styles.serviceCard}
                  onClick={() => {
                    setSelectedService(name);
                    setCategory(
                      categories.includes(name)
                        ? name
                        : "Other"
                    );
                    setMessage(`${name} चाहिए`);
                  }}
                >
                  <div style={styles.serviceIcon}>{icon}</div>
                  <div style={styles.serviceName}>{name}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "explore" && (
          <>
            <h1 style={styles.pageTitle}>Explore</h1>

            <p style={styles.muted}>
              अपनी जरूरत की service चुनिए।
            </p>

            <div style={styles.serviceGrid}>
              {services.map(([icon, name]) => (
                <button
                  key={name}
                  style={styles.serviceCard}
                  onClick={() => {
                    setSelectedService(name);
                    setMessage(`${name} चाहिए`);
                    setTab("home");
                  }}
                >
                  <div style={styles.serviceIcon}>{icon}</div>
                  <div style={styles.serviceName}>{name}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "requests" && (
          <>
            <h1 style={styles.pageTitle}>
              आपकी Requests
            </h1>

            {requests.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIcon}>📋</div>
                <h3>अभी कोई request नहीं है</h3>
                <p style={styles.muted}>
                  Home पर जाकर अपनी जरूरत बताइए।
                </p>
              </div>
            ) : (
              requests.map((request) => {
                const requestMatches = matches.filter(
                  (m) => m.request_id === request.id
                );

                return (
                  <div
                    key={request.id}
                    style={styles.requestCard}
                  >
                    <div style={styles.requestHeader}>
                      <div>
                        <h3 style={styles.requestTitle}>
                          {request.title}
                        </h3>
                        <p style={styles.requestDescription}>
                          {request.description}
                        </p>
                      </div>

                      <span style={styles.status}>
                        {request.status || "pending"}
                      </span>
                    </div>

                    {requestMatches.length > 0 && (
                      <div style={styles.quoteBox}>
                        <h4>Provider Quotes</h4>

                        {requestMatches.map((match) => (
                          <div
                            key={match.id}
                            style={styles.quoteRow}
                          >
                            <div>
                              <strong>
                                ₹
                                {match.quoted_amount ??
                                  "—"}
                              </strong>
                              <div style={styles.smallText}>
                                {match.matches_status}
                              </div>
                            </div>

                            {match.matches_status ===
                              "quoted" &&
                              request.status ===
                                "pending" && (
                                <button
                                  style={styles.smallButton}
                                  onClick={() =>
                                    acceptQuote(match)
                                  }
                                >
                                  Accept
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === "provider" && (
          <>
            <div style={styles.providerHero}>
              <div style={styles.providerBadge}>
                PROVIDER MODE
              </div>

              <h1 style={styles.pageTitle}>
                आसपास के काम
              </h1>

              <p style={styles.muted}>
                Customer की जरूरत देखें और अपना quote भेजें।
              </p>
            </div>

            {providerRequests.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIcon}>🔎</div>
                <h3>अभी कोई open request नहीं</h3>
                <p style={styles.muted}>
                  नई customer requests यहाँ दिखाई देंगी।
                </p>
              </div>
            ) : (
              providerRequests.map((request) => {
                const myMatch = matches.find(
                  (m) =>
                    m.request_id === request.id &&
                    (m.worker_id === user.id ||
                      m.provider_id === user.id)
                );

                return (
                  <div
                    key={request.id}
                    style={styles.providerRequest}
                  >
                    <div style={styles.requestHeader}>
                      <div>
                        <h3 style={styles.requestTitle}>
                          {request.title}
                        </h3>

                        <p style={styles.requestDescription}>
                          {request.description}
                        </p>
                      </div>

                      <span style={styles.status}>
                        {request.category || "General"}
                      </span>
                    </div>

                    <div style={styles.locationText}>
                      📍 {request.location || "Location unavailable"}
                    </div>

                    {myMatch ? (
                      <div style={styles.sentQuote}>
                        Quote sent: ₹
                        {myMatch.quoted_amount ?? "—"}
                        <br />
                        <span style={styles.smallText}>
                          Status:{" "}
                          {myMatch.matches_status}
                        </span>
                      </div>
                    ) : (
                      <div style={styles.quoteInputRow}>
                        <input
                          style={styles.quoteInput}
                          value={
                            quoteValues[request.id] || ""
                          }
                          onChange={(e) =>
                            setQuoteValues((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
                          placeholder="₹ आपका charge"
                          inputMode="numeric"
                        />

                        <button
                          style={styles.smallButton}
                          onClick={() =>
                            sendQuote(request)
                          }
                          disabled={loading}
                        >
                          Quote भेजें
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === "profile" && (
          <>
            <h1 style={styles.pageTitle}>Profile</h1>

            <div style={styles.profileCard}>
              <div style={styles.avatar}>
                {profile?.full_name
                  ? profile.full_name
                      .charAt(0)
                      .toUpperCase()
                  : "J"}
              </div>

              <h2>
                {profile?.full_name ||
                  "JUGAAD User"}
              </h2>

              <p style={styles.muted}>
                {profile?.phone ||
                  user.phone ||
                  "Phone verified"}
              </p>

              <div style={styles.roleBadge}>
                Role: {profile?.role || "customer"}
              </div>
            </div>

            {!isProvider && (
              <button
                style={styles.providerButton}
                onClick={becomeProvider}
                disabled={loading}
              >
                🛠️ Provider बनें
              </button>
            )}

            {isProvider && (
              <button
                style={styles.providerButton}
                onClick={() => {
                  setMode("provider");
                  setTab("provider");
                }}
              >
                🛠️ Provider Dashboard खोलें
              </button>
            )}

            <button
              style={styles.logoutButton}
              onClick={logout}
            >
              Logout
            </button>
          </>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <NavButton
          icon="🏠"
          label="Home"
          active={tab === "home"}
          onClick={() => setTab("home")}
        />

        <NavButton
          icon="🔎"
          label="Explore"
          active={tab === "explore"}
          onClick={() => setTab("explore")}
        />

        <NavButton
          icon="📋"
          label="Requests"
          active={tab === "requests"}
          onClick={() => setTab("requests")}
        />

        {isProvider && (
          <NavButton
            icon="🛠️"
            label="Provider"
            active={tab === "provider"}
            onClick={() => {
              setMode("provider");
              setTab("provider");
              loadProviderRequests();
            }}
          />
        )}

        <NavButton
          icon="👤"
          label="Profile"
          active={tab === "profile"}
          onClick={() => setTab("profile")}
        />
      </nav>
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navButton,
        ...(active ? styles.navActive : {}),
      }}
    >
      <div>{icon}</div>
      <small>{label}</small>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg,#fff7ed,#ffffff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },

  authCard: {
    width: "100%",
    maxWidth: 430,
    background: "#fff",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 15px 50px rgba(0,0,0,.10)",
    textAlign: "center",
  },

  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
    paddingBottom: 80,
  },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    borderBottom: "1px solid #e5e7eb",
  },

  brand: {
    fontSize: 25,
    fontWeight: 900,
    color: "#f97316",
    letterSpacing: 1,
  },

  brandSub: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 4,
    color: "#111827",
  },

  logo: {
    fontSize: 34,
    fontWeight: 900,
    color: "#f97316",
  },

  logoSub: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 6,
  },

  authTitle: {
    fontSize: 30,
    marginTop: 35,
    lineHeight: 1.2,
  },

  orange: {
    color: "#f97316",
  },

  muted: {
    color: "#6b7280",
    lineHeight: 1.5,
  },

  content: {
    maxWidth: 900,
    margin: "0 auto",
    padding: 18,
  },

  hero: {
    background:
      "linear-gradient(135deg,#fff7ed,#ffedd5)",
    borderRadius: 25,
    padding: 22,
    marginBottom: 25,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: 900,
  },

  heroText: {
    marginTop: 8,
    marginBottom: 18,
    color: "#4b5563",
    lineHeight: 1.5,
  },

  bigInput: {
    width: "100%",
    minHeight: 110,
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    resize: "vertical",
    marginBottom: 12,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    outline: "none",
  },

  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 15,
    padding: 15,
    background: "#f97316",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },

  textButton: {
    border: 0,
    background: "transparent",
    marginTop: 15,
    color: "#f97316",
    cursor: "pointer",
  },

  locationButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 20,
    padding: "9px 12px",
    fontSize: 12,
  },

  categoryRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 12,
  },

  categoryButton: {
    flexShrink: 0,
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 20,
    padding: "8px 13px",
    cursor: "pointer",
  },

  categoryActive: {
    background: "#111827",
    color: "#fff",
    borderColor: "#111827",
  },

  quickRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },

  quickButton: {
    flex: 1,
    border: "1px solid #fed7aa",
    background: "#fff",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
  },

  sectionTitle: {
    fontSize: 22,
    marginBottom: 14,
  },

  serviceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill,minmax(135px,1fr))",
    gap: 12,
  },

  serviceCard: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 18,
    padding: 17,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(0,0,0,.04)",
  },

  serviceIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  serviceName: {
    fontWeight: 700,
    fontSize: 14,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: 900,
    marginBottom: 8,
  },

  emptyCard: {
    background: "#fff",
    borderRadius: 20,
    padding: 30,
    textAlign: "center",
    border: "1px solid #e5e7eb",
  },

  emptyIcon: {
    fontSize: 45,
  },

  requestCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  requestHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },

  requestTitle: {
    margin: 0,
    fontSize: 18,
  },

  requestDescription: {
    color: "#6b7280",
    lineHeight: 1.5,
  },

  status: {
    height: "fit-content",
    background: "#fff7ed",
    color: "#c2410c",
    padding: "6px 9px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  quoteBox: {
    marginTop: 15,
    background: "#f8fafc",
    borderRadius: 15,
    padding: 14,
  },

  quoteRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #e5e7eb",
    padding: "12px 0",
  },

  smallText: {
    color: "#6b7280",
    fontSize: 12,
  },

  smallButton: {
    border: 0,
    borderRadius: 12,
    background: "#f97316",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  providerHero: {
    background:
      "linear-gradient(135deg,#eff6ff,#ffffff)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
  },

  providerBadge: {
    display: "inline-block",
    background: "#111827",
    color: "#fff",
    borderRadius: 20,
    padding: "6px 10px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
  },

  providerRequest: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  locationText: {
    color: "#6b7280",
    fontSize: 13,
    margin: "12px 0",
  },

  quoteInputRow: {
    display: "flex",
    gap: 8,
  },

  quoteInput: {
    flex: 1,
    minWidth: 0,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },

  sentQuote: {
    background: "#ecfdf5",
    borderRadius: 13,
    padding: 12,
    color: "#047857",
    fontWeight: 700,
  },

  profileCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 25,
    textAlign: "center",
    border: "1px solid #e5e7eb",
    marginBottom: 15,
  },

  avatar: {
    width: 70,
    height: 70,
    margin: "0 auto 12px",
    borderRadius: "50%",
    background: "#f97316",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 30,
    fontWeight: 900,
  },

  roleBadge: {
    display: "inline-block",
    background: "#f3f4f6",
    padding: "8px 12px",
    borderRadius: 20,
    fontSize: 12,
    marginTop: 10,
  },

  providerButton: {
    width: "100%",
    border: 0,
    borderRadius: 15,
    background: "#111827",
    color: "#fff",
    padding: 15,
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 10,
    cursor: "pointer",
  },

  logoutButton: {
    width: "100%",
    border: "1px solid #fecaca",
    borderRadius: 15,
    background: "#fff",
    color: "#dc2626",
    padding: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: 65,
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "center",
    gap: 4,
    padding: "5px 8px",
  },

  navButton: {
    flex: 1,
    maxWidth: 110,
    border: 0,
    background: "transparent",
    color: "#6b7280",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 18,
  },

  navActive: {
    color: "#f97316",
    background: "#fff7ed",
    fontWeight: 800,
  },
};
