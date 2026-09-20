import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  createClient,
  type User,
} from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type Service = {
  id: number;
  title: string;
  category: string;
  location: string;
  icon: string;
  description: string;
};

type RequestItem = {
  id: string;
  need: string;
  category: string | null;
  location: string | null;
  status: string;
  created_at: string;
};

const services: Service[] = [
  {
    id: 1,
    title: "Electrician",
    category: "Home",
    location: "Lucknow",
    icon: "⚡",
    description: "Ghar ki wiring, fan, switch aur electrical kaam",
  },
  {
    id: 2,
    title: "Plumber",
    category: "Home",
    location: "Lucknow",
    icon: "🔧",
    description: "Pipe, tap, bathroom aur water leakage ka kaam",
  },
  {
    id: 3,
    title: "Mobile Repair",
    category: "Repair",
    location: "Lucknow",
    icon: "📱",
    description: "Mobile screen, battery aur software repair",
  },
  {
    id: 4,
    title: "AC / Cooler Repair",
    category: "Repair",
    location: "Lucknow",
    icon: "❄️",
    description: "AC, cooler aur appliance repair",
  },
  {
    id: 5,
    title: "Home Cleaning",
    category: "Home",
    location: "Lucknow",
    icon: "🧹",
    description: "Ghar ki cleaning aur deep cleaning",
  },
  {
    id: 6,
    title: "Delivery Help",
    category: "Delivery",
    location: "Lucknow",
    icon: "🛵",
    description: "Local saman pickup aur delivery",
  },
  {
    id: 7,
    title: "Online / Digital Help",
    category: "Digital",
    location: "Lucknow",
    icon: "💻",
    description: "Online form, document, app aur digital kaam mein help",
  },
  {
    id: 8,
    title: "Education Help",
    category: "Education",
    location: "Lucknow",
    icon: "📚",
    description: "Study, tuition, assignment aur learning help",
  },
  {
    id: 9,
    title: "Travel Help",
    category: "Travel",
    location: "Lucknow",
    icon: "🧳",
    description: "Travel planning, booking aur local travel help",
  },
  {
    id: 10,
    title: "Personal Help",
    category: "Personal",
    location: "Lucknow",
    icon: "🤝",
    description: "Daily life ki legitimate personal help",
  },
  {
    id: 11,
    title: "Business Help",
    category: "Business",
    location: "Lucknow",
    icon: "💼",
    description: "Business, shop, marketing aur professional help",
  },
  {
    id: 12,
    title: "Other / Custom JUGAAD",
    category: "Other",
    location: "Lucknow",
    icon: "🧩",
    description: "Jo service list mein nahi hai, woh bhi batao",
  },
];

const categories = [
  "Sab",
  "Home",
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Sab");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("home");

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesCategory =
        category === "Sab" || service.category === category;

      const text =
        `${service.title} ${service.description} ${service.category}`.toLowerCase();

      const matchesSearch =
        search.trim() === "" ||
        text.includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const loadRequests = async () => {
    setLoadingRequests(true);

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setRequests([]);
      setLoadingRequests(false);
      return;
    }

    const { data, error } = await supabase
      .from("requests")
      .select(
        "id, need, category, location, status, created_at"
      )
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    }

    setLoadingRequests(false);
  };

  useEffect(() => {
    const startAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setAuthLoading(false);

      if (session?.user) {
        loadRequests();
      }
    };

    startAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          loadRequests();
        } else {
          setRequests([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openLogin = () => {
    setAuthMessage("");
    setOtp("");
    setOtpSent(false);
    setActiveTab("profile");
  };

  const normalizePhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");

    if (cleaned.startsWith("91") && cleaned.length === 12) {
      return "+" + cleaned;
    }

    if (cleaned.length === 10) {
      return "+91" + cleaned;
    }

    return "";
  };

  const sendOtp = async () => {
    setAuthMessage("");

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      setAuthMessage(
        "Please apna 10 digit Indian mobile number enter karein."
      );
      return;
    }

    setAuthBusy(true);

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: true,
      },
    });

    setAuthBusy(false);

    if (error) {
      setAuthMessage(
        "OTP send nahi hua: " + error.message
      );
      return;
    }

    setPhone(normalizedPhone.replace("+91", ""));
    setOtpSent(true);
    setAuthMessage(
      "✅ OTP aapke mobile number par bheja gaya hai."
    );
  };

  const verifyOtp = async () => {
    setAuthMessage("");

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      setAuthMessage(
        "Mobile number sahi enter karein."
      );
      return;
    }

    if (!otp.trim()) {
      setAuthMessage("OTP enter karein.");
      return;
    }

    if (otp.trim().length !== 6) {
      setAuthMessage("6 digit OTP enter karein.");
      return;
    }

    setAuthBusy(true);

    const { data, error } =
      await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp.trim(),
        type: "sms",
      });

    setAuthBusy(false);

    if (error) {
      setAuthMessage(
        "OTP verify nahi hua: " + error.message
      );
      return;
    }

    if (data.user) {
      setUser(data.user);
      setOtp("");
      setOtpSent(false);
      setAuthMessage("✅ Login successful!");

      await loadRequests();

      setTimeout(() => {
        setActiveTab("home");
        setAuthMessage("");
      }, 700);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();

    setUser(null);
    setRequests([]);
    setPhone("");
    setOtp("");
    setOtpSent(false);
    setAuthMessage("");
    setActiveTab("home");

    alert("Aap logout ho gaye.");
  };

  const askJugaad = async () => {
    if (!message.trim()) {
      alert("Pehle apni zarurat likhiye.");
      return;
    }

    if (!user) {
      setActiveTab("profile");
      setAuthMessage(
        "Request bhejne ke liye pehle mobile number se login karein."
      );
      return;
    }

    setLoading(true);

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setLoading(false);
      setUser(null);
      setActiveTab("profile");
      setAuthMessage(
        "Session expire ho gaya. Dobara mobile number se login karein."
      );
      return;
    }

    const { error } = await supabase
      .from("requests")
      .insert({
        user_id: currentUser.id,
        need: message.trim(),
        category:
          category === "Sab" ? null : category,
        location: "Lucknow",
        status: "pending",
      });

    setLoading(false);

    if (error) {
      alert(
        "Request save nahi hui:\n\n" +
          error.message
      );
      return;
    }

    setMessage("");

    await loadRequests();

    setActiveTab("requests");

    alert(
      "✅ JUGAAD request submit ho gayi!\n\nAb relevant person/service dhoondi jayegi."
    );
  };

  const connectService = async (
    service: Service
  ) => {
    if (!user) {
      setActiveTab("profile");
      setAuthMessage(
        "Service se connect karne ke liye pehle mobile number se login karein."
      );
      return;
    }

    setMessage(
      `${service.title} ki zarurat hai - ${service.description}`
    );

    setCategory(service.category);
    setActiveTab("home");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const statusText = (status: string) => {
    if (status === "pending") return "Pending";
    if (status === "accepted") return "Accepted";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return status;
  };

  if (authLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingLogo}>
          JUGAAD
        </div>

        <div style={styles.muted}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.logo}>JUGAAD</div>

          <div style={styles.tagline}>
            Har zarurat ka jugaad 🇮🇳
          </div>
        </div>

        <button
          style={styles.locationButton}
          onClick={() =>
            alert(
              "📍 Current location: Lucknow"
            )
          }
        >
          📍 Lucknow
        </button>
      </header>

      <main style={styles.container}>
        {activeTab === "home" && (
          <>
            <section style={styles.hero}>
              <div style={styles.heroBadge}>
                🇮🇳 JUGAAD INDIA
              </div>

              <h1 style={styles.heroTitle}>
                Jo chahiye,{" "}
                <span style={styles.highlight}>
                  JUGAAD
                </span>{" "}
                se milega.
              </h1>

              <p style={styles.heroText}>
                Apni zarurat apne words mein batao.
                JUGAAD aapko sahi person, service ya
                resource se connect karega.
              </p>

              <div style={styles.needBox}>
                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  placeholder="Aapko kis cheez ki zarurat hai?"
                  style={styles.textarea}
                />

                <div style={styles.actionRow}>
                  <button
                    style={styles.smallButton}
                    onClick={() =>
                      alert(
                        "🎙️ Voice input next stage mein connect hoga."
                      )
                    }
                  >
                    🎙️ Voice
                  </button>

                  <button
                    style={styles.smallButton}
                    onClick={() =>
                      alert(
                        "📷 Photo input next stage mein connect hoga."
                      )
                    }
                  >
                    📷 Photo
                  </button>

                  <button
                    style={{
                      ...styles.jugaadButton,
                      opacity: loading ? 0.6 : 1,
                    }}
                    onClick={askJugaad}
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : "JUGAAD Karo →"}
                  </button>
                </div>
              </div>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>
                Kya chahiye?
              </h2>

              <div style={styles.categories}>
                {categories.map((item) => (
                  <button
                    key={item}
                    onClick={() =>
                      setCategory(item)
                    }
                    style={{
                      ...styles.categoryButton,
                      ...(category === item
                        ? styles.categoryActive
                        : {}),
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>
                Aas-paas ki services
              </h2>

              <p style={styles.muted}>
                Aapki zarurat ke liye available help
              </p>

              <div style={styles.searchBox}>
                🔎

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Service ya kaam search karein..."
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.grid}>
                {filteredServices.map(
                  (service) => (
                    <div
                      key={service.id}
                      style={styles.card}
                    >
                      <div style={styles.cardIcon}>
                        {service.icon}
                      </div>

                      <div
                        style={styles.cardContent}
                      >
                        <h3
                          style={styles.cardTitle}
                        >
                          {service.title}
                        </h3>

                        <p
                          style={
                            styles.cardDescription
                          }
                        >
                          {service.description}
                        </p>

                        <div
                          style={
                            styles.cardLocation
                          }
                        >
                          📍 {service.location}
                        </div>

                        <button
                          style={
                            styles.connectButton
                          }
                          onClick={() =>
                            connectService(
                              service
                            )
                          }
                        >
                          Connect →
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {filteredServices.length === 0 && (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>
                    🔎
                  </div>

                  <h3>Service nahi mili?</h3>

                  <p>
                    Upar apni zarurat JUGAAD ko
                    batao. Fixed category ki zarurat
                    nahi hai.
                  </p>

                  <button
                    style={styles.primaryButton}
                    onClick={() => {
                      setCategory("Other");
                      setActiveTab("home");
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                  >
                    Custom JUGAAD Karo →
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "requests" && (
          <section style={styles.requestsPage}>
            <h1 style={styles.pageTitle}>
              📋 Meri Requests
            </h1>

            <p style={styles.muted}>
              Aapki JUGAAD requests yahan dikhengi.
            </p>

            {!user ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>
                  🔐
                </div>

                <h3>Login required</h3>

                <p>
                  Apni requests dekhne ke liye
                  mobile number se login karein.
                </p>

                <button
                  style={styles.primaryButton}
                  onClick={openLogin}
                >
                  Mobile Login →
                </button>
              </div>
            ) : loadingRequests ? (
              <div style={styles.empty}>
                Requests load ho rahi hain...
              </div>
            ) : requests.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>
                  📋
                </div>

                <h3>
                  Abhi koi request nahi hai
                </h3>

                <p>
                  Apni zarurat batane ke liye
                  JUGAAD Karo button use karein.
                </p>

                <button
                  style={styles.primaryButton}
                  onClick={() =>
                    setActiveTab("home")
                  }
                >
                  JUGAAD Karo →
                </button>
              </div>
            ) : (
              <div style={styles.requestList}>
                {requests.map((request) => (
                  <div
                    key={request.id}
                    style={styles.requestCard}
                  >
                    <div style={styles.requestTop}>
                      <span
                        style={
                          styles.requestIcon
                        }
                      >
                        🧩
                      </span>

                      <span
                        style={{
                          ...styles.status,
                          background:
                            request.status ===
                            "accepted"
                              ? "#d9f7df"
                              : request.status ===
                                "completed"
                              ? "#d7ecff"
                              : "#fff1b8",
                        }}
                      >
                        {statusText(
                          request.status
                        )}
                      </span>
                    </div>

                    <h3
                      style={styles.requestTitle}
                    >
                      {request.need}
                    </h3>

                    <div
                      style={styles.requestMeta}
                    >
                      📍{" "}
                      {request.location ||
                        "India"}
                    </div>

                    {request.category && (
                      <div
                        style={
                          styles.requestMeta
                        }
                      >
                        🏷️ {request.category}
                      </div>
                    )}

                    <div
                      style={styles.requestDate}
                    >
                      {new Date(
                        request.created_at
                      ).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "profile" && (
          <section style={styles.profilePage}>
            <div style={styles.profileIcon}>
              👤
            </div>

            <h1 style={styles.pageTitle}>
              JUGAAD Profile
            </h1>

            <p style={styles.muted}>
              Mobile account
            </p>

            {user ? (
              <>
                <div style={styles.profileCard}>
                  <div style={styles.profileRow}>
                    <span>Mobile</span>

                    <strong>
                      {user.phone || "Mobile user"}
                    </strong>
                  </div>

                  <div
                    style={styles.profileRow}
                  >
                    <span>Status</span>

                    <strong
                      style={{
                        color: "#16833a",
                      }}
                    >
                      ✓ Logged in
                    </strong>
                  </div>

                  <div
                    style={styles.profileRow}
                  >
                    <span>Location</span>

                    <strong>
                      📍 Lucknow
                    </strong>
                  </div>

                  <div
                    style={styles.profileRow}
                  >
                    <span>Platform</span>

                    <strong>
                      JUGAAD India
                    </strong>
                  </div>
                </div>

                <button
                  style={styles.logoutButton}
                  onClick={logout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <div
                  style={styles.authCard}
                >
                  <h2 style={styles.authTitle}>
                    Mobile se Login
                  </h2>

                  <p style={styles.authDescription}>
                    Apna mobile number enter karein.
                    OTP ke through account login
                    hoga.
                  </p>

                  <div style={styles.phoneInputRow}>
                    <div style={styles.countryCode}>
                      +91
                    </div>

                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10)
                        )
                      }
                      placeholder="10 digit mobile number"
                      style={styles.phoneInput}
                      disabled={otpSent}
                    />
                  </div>

                  {otpSent && (
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) =>
                        setOtp(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6)
                        )
                      }
                      placeholder="6 digit OTP"
                      style={styles.authInput}
                    />
                  )}

                  {authMessage && (
                    <div
                      style={
                        styles.authMessage
                      }
                    >
                      {authMessage}
                    </div>
                  )}

                  {!otpSent ? (
                    <button
                      style={{
                        ...styles.authButton,
                        opacity: authBusy
                          ? 0.6
                          : 1,
                      }}
                      onClick={sendOtp}
                      disabled={authBusy}
                    >
                      {authBusy
                        ? "OTP bhej rahe hain..."
                        : "OTP Bhejo →"}
                    </button>
                  ) : (
                    <>
                      <button
                        style={{
                          ...styles.authButton,
                          opacity: authBusy
                            ? 0.6
                            : 1,
                        }}
                        onClick={verifyOtp}
                        disabled={authBusy}
                      >
                        {authBusy
                          ? "Verify ho raha hai..."
                          : "OTP Verify Karo →"}
                      </button>

                      <button
                        style={
                          styles.secondaryAuthButton
                        }
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                          setAuthMessage("");
                        }}
                        disabled={authBusy}
                      >
                        Number Change Karein
                      </button>

                      <button
                        style={
                          styles.resendButton
                        }
                        onClick={sendOtp}
                        disabled={authBusy}
                      >
                        OTP Dobara Bhejo
                      </button>
                    </>
                  )}
                </div>

                <div
                  style={styles.profileCard}
                >
                  <div
                    style={styles.profileRow}
                  >
                    <span>Login method</span>

                    <strong>
                      📱 Mobile + OTP
                    </strong>
                  </div>

                  <div
                    style={styles.profileRow}
                  >
                    <span>Location</span>

                    <strong>
                      📍 Lucknow
                    </strong>
                  </div>

                  <div
                    style={styles.profileRow}
                  >
                    <span>Platform</span>

                    <strong>
                      JUGAAD India
                    </strong>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "explore" && (
          <section style={styles.requestsPage}>
            <h1 style={styles.pageTitle}>
              🔎 Explore JUGAAD
            </h1>

            <p style={styles.muted}>
              Kisi bhi service ya help ko search
              karein.
            </p>

            <div style={styles.exploreBox}>
              <div style={styles.bigEmoji}>
                🧩
              </div>

              <h2>
                Har zarurat ka JUGAAD
              </h2>

              <p>
                Electrician, plumber, repair,
                delivery, cleaning, education,
                digital, travel, business help ya
                koi bhi legitimate real-world
                service.
              </p>

              <button
                style={styles.primaryButton}
                onClick={() =>
                  setActiveTab("home")
                }
              >
                Apni Zarurat Batao →
              </button>
            </div>
          </section>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button
          style={
            activeTab === "home"
              ? styles.navItemActive
              : styles.navItem
          }
          onClick={() =>
            setActiveTab("home")
          }
        >
          🏠
          <span>Home</span>
        </button>

        <button
          style={
            activeTab === "explore"
              ? styles.navItemActive
              : styles.navItem
          }
          onClick={() =>
            setActiveTab("explore")
          }
        >
          🔎
          <span>Explore</span>
        </button>

        <button
          style={styles.navJugaad}
          onClick={() => {
            setActiveTab("home");

            setTimeout(() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }, 50);
          }}
        >
          +
        </button>

        <button
          style={
            activeTab === "requests"
              ? styles.navItemActive
              : styles.navItem
          }
          onClick={() => {
            setActiveTab("requests");
            loadRequests();
          }}
        >
          📋
          <span>Requests</span>
        </button>

        <button
          style={
            activeTab === "profile"
              ? styles.navItemActive
              : styles.navItem
          }
          onClick={() =>
            setActiveTab("profile")
          }
        >
          👤
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fffdf7",
    color: "#171717",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    paddingBottom: 90,
  },

  loadingScreen: {
    minHeight: "100vh",
    background: "#fffdf7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingLogo: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 1,
  },

  header: {
    background: "#ffffff",
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #eeeeee",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  logo: {
    fontSize: 27,
    fontWeight: 900,
    letterSpacing: 1,
  },

  tagline: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },

  locationButton: {
    border: "1px solid #e5e5e5",
    background: "#fff",
    borderRadius: 20,
    padding: "9px 13px",
    fontWeight: 600,
    cursor: "pointer",
  },

  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 16px",
  },

  hero: {
    background: "#ffdd00",
    borderRadius: 26,
    padding: 22,
    boxShadow:
      "0 8px 25px rgba(0,0,0,0.08)",
  },

  heroBadge: {
    display: "inline-block",
    background: "#171717",
    color: "#fff",
    borderRadius: 20,
    padding: "7px 12px",
    fontSize: 11,
    fontWeight: 800,
  },

  heroTitle: {
    fontSize: "clamp(30px, 8vw, 52px)",
    lineHeight: 1.05,
    margin: "18px 0 10px",
    fontWeight: 900,
  },

  highlight: {
    textDecoration: "underline",
  },

  heroText: {
    fontSize: 15,
    lineHeight: 1.5,
    maxWidth: 650,
  },

  needBox: {
    marginTop: 18,
    background: "#fff",
    borderRadius: 18,
    padding: 12,
  },

  textarea: {
    width: "100%",
    minHeight: 80,
    border: "none",
    outline: "none",
    resize: "vertical",
    fontSize: 16,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },

  actionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  smallButton: {
    border: "1px solid #ddd",
    background: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },

  jugaadButton: {
    marginLeft: "auto",
    border: "none",
    background: "#171717",
    color: "#fff",
    borderRadius: 12,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 22,
    margin: 0,
    fontWeight: 850,
  },

  muted: {
    color: "#777",
    marginTop: 5,
    fontSize: 13,
  },

  categories: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    padding: "14px 0",
  },

  categoryButton: {
    whiteSpace: "nowrap",
    border: "1px solid #ddd",
    background: "#fff",
    borderRadius: 22,
    padding: "9px 15px",
    fontWeight: 700,
    cursor: "pointer",
  },

  categoryActive: {
    background: "#171717",
    color: "#fff",
    borderColor: "#171717",
  },

  searchBox: {
    marginTop: 14,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 15,
    padding: "11px 14px",
    display: "flex",
    gap: 9,
    alignItems: "center",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: 15,
    background: "transparent",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
    marginTop: 16,
  },

  card: {
    background: "#fff",
    border: "1px solid #eeeeee",
    borderRadius: 20,
    padding: 16,
    display: "flex",
    gap: 14,
  },

  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "#fff1a8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 25,
    flexShrink: 0,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
  },

  cardDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.4,
    margin: "6px 0",
  },

  cardLocation: {
    fontSize: 12,
    color: "#777",
  },

  connectButton: {
    marginTop: 12,
    width: "100%",
    border: "none",
    background: "#ffdd00",
    borderRadius: 11,
    padding: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    background: "#fff",
    borderRadius: 20,
    padding: 30,
    marginTop: 16,
  },

  emptyIcon: {
    fontSize: 35,
  },

  requestsPage: {
    paddingTop: 8,
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: 900,
    margin: "10px 0 5px",
  },

  requestList: {
    display: "grid",
    gap: 14,
    marginTop: 20,
  },

  requestCard: {
    background: "#fff",
    border: "1px solid #eeeeee",
    borderRadius: 20,
    padding: 17,
  },

  requestTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  requestIcon: {
    fontSize: 26,
  },

  status: {
    borderRadius: 20,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },

  requestTitle: {
    fontSize: 17,
    margin: "13px 0 8px",
  },

  requestMeta: {
    color: "#666",
    fontSize: 13,
    marginTop: 5,
  },

  requestDate: {
    color: "#999",
    fontSize: 11,
    marginTop: 12,
  },

  primaryButton: {
    marginTop: 15,
    border: "none",
    background: "#171717",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },

  profilePage: {
    paddingTop: 20,
    textAlign: "center",
  },

  profileIcon: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "#ffdd00",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    margin: "0 auto 15px",
  },

  profileCard: {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #eee",
    marginTop: 25,
    overflow: "hidden",
    textAlign: "left",
  },

  profileRow: {
    padding: 16,
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    fontSize: 14,
  },

  authCard: {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #eee",
    marginTop: 25,
    padding: 18,
    textAlign: "left",
    boxShadow:
      "0 8px 25px rgba(0,0,0,0.05)",
  },

  authTitle: {
    margin: "0 0 7px",
    fontSize: 22,
    fontWeight: 900,
  },

  authDescription: {
    color: "#777",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 18,
  },

  phoneInputRow: {
    display: "flex",
    gap: 8,
    marginBottom: 11,
  },

  countryCode: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
    border: "1px solid #ddd",
    borderRadius: 12,
    background: "#f7f7f7",
    fontWeight: 800,
  },

  phoneInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: "13px",
    outline: "none",
    fontSize: 16,
    fontFamily: "inherit",
  },

  authInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: "13px",
    marginBottom: 11,
    outline: "none",
    fontSize: 16,
    fontFamily: "inherit",
  },

  authButton: {
    width: "100%",
    border: "none",
    background: "#171717",
    color: "#fff",
    borderRadius: 12,
    padding: "13px",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },

  secondaryAuthButton: {
    width: "100%",
    marginTop: 9,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#171717",
    borderRadius: 12,
    padding: "12px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },

  resendButton: {
    width: "100%",
    marginTop: 9,
    border: "none",
    background: "transparent",
    color: "#555",
    borderRadius: 12,
    padding: "9px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },

  authMessage: {
    background: "#fff8cf",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 1.4,
  },

  logoutButton: {
    marginTop: 18,
    border: "1px solid #e33",
    background: "#fff",
    color: "#d22",
    borderRadius: 12,
    padding: "12px 25px",
    fontWeight: 800,
    cursor: "pointer",
  },

  exploreBox: {
    background: "#ffdd00",
    borderRadius: 24,
    padding: 25,
    marginTop: 25,
    textAlign: "center",
  },

  bigEmoji: {
    fontSize: 55,
  },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    background: "#fff",
    borderTop: "1px solid #e8e8e8",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 20,
  },

  navItem: {
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "center",
    color: "#777",
    fontSize: 11,
    cursor: "pointer",
  },

  navItemActive: {
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "center",
    color: "#171717",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  navJugaad: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    border: "4px solid #fff",
    background: "#ffdd00",
    fontSize: 27,
    fontWeight: 900,
    marginTop: -25,
    boxShadow:
      "0 4px 15px rgba(0,0,0,0.18)",
    cursor: "pointer",
  },
};
